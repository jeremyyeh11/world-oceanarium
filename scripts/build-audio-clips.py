#!/usr/bin/env python3
# Builds every shipped audio clip from the downloaded source recordings (docs/audio-redesign.md
# §3 clip list, §9 library picks) and writes src/audio/clipCatalog.json, the one machine-readable
# list of shipped clips. Standard library only; needs ffmpeg/ffprobe (8.x, with libopus, the
# native aac encoder and libsoxr) on PATH:
#
#   python -I -B scripts/build-audio-clips.py <source-folder>
#   python -I -B scripts/build-audio-clips.py <source-folder> --only reef-shrimp-hvar,click-shrimp-01
#
# <source-folder> holds the 30 downloads under the file names in SOURCES below (Freesound HQ
# previews and NOAA Fisheries clips, never committed). Every output is regenerated from it:
#
#   public/audio/beds/<id>.{webm,m4a}      looping habitat beds
#   public/audio/events/<id>.{webm,m4a}    event-layer one-shots (src/audio/eventScheduler.js)
#   public/audio/oneshots/<id>.{webm,m4a}  one-shots staged for later phases (swish, breath, ...)
#   public/audio/ui/<id>.{webm,m4a}        UI sounds (their own dry bus)
#
# Each format is Opus in WebM plus an AAC-LC m4a fallback, 48 kHz. Every clip goes through a
# 35 Hz high-pass (2nd order, run twice) after the trim; sources at 44.1, 16 or 8 kHz are
# resampled with soxr. Each filter runs over a pre-roll and post-roll of up to 1 s that is cut
# off afterwards, so no filter starts cold at a clip edge.
#
# Beds: one clean excerpt (or two, spliced with a 3 s equal-power crossfade), then a 3 s
# equal-power tail-into-head crossfade baked in: the excerpt runs `trim` = [start, end], the
# last 3 s are faded into the first 3 s, and the output is (end - start - 3) s long, so its last
# sample runs straight on into its first (see LOOP_PAD: the file holds the loop plus 85 ms of
# circular padding either side, and the catalog's `loop` is the region to loop). The loop length is rounded down to whole 1024-sample AAC
# frames (the excerpt end moves earlier by under 21.3 ms; the catalog's trim is the rounded one),
# so the m4a needs no end padding. Then gain to -20 LUFS integrated and a look-ahead limiter at
# -1.5 dBFS sample peak (ffmpeg alimiter: 0.5 ms attack, 15 ms release, or 80 ms for the two
# low-frequency beds; auto-level off; latency compensated) run on the loop with 0.5 s of circular
# padding, so the limiter's state matches across the seam. Gain is re-set until the result is
# within 0.15 LU of -20 (the limiter takes a little loudness off) and the limit is lowered until
# the true peak is <= -1 dBTP. The build log prints how hard the limiter worked on each bed.
# The surge bed is cut between two of its bursts, where the source is digital silence, so it needs
# no crossfade.
#
# Events, one-shots and UI: mono, trimmed tight around one call (or one train or cluster), a
# quarter-sine fade in and out (`fade` in ms; 5-10 ms where the source is quiet between calls,
# longer where a continuous background would otherwise start or stop abruptly), then peak
# normalised: events and one-shots to -3 dBFS, UI to -6 dBFS. Levels are set in code
# (src/audio/eventScheduler.js, useOceanAudio.js), not here.
#
# Every trim was chosen by analysis, not by ear (2026-11-14): per-second loudness and peaks,
# a <150 Hz band for boats, hull knocks and handling, 150-1500 Hz for engines and loud events,
# spectrograms for tonal hum and splices, silence detection and 5-20 ms envelopes to cut single
# calls. The notes beside each clip say what was avoided. Nothing here has been listened to.
#
# Licences: Freesound picks are all CC0 1.0 (read on each sound's page); NOAA Fisheries NEFSC
# Passive Acoustics Branch recordings are US government work with no copyright. Credit lines are
# in the catalog. The 9 older MP3s in public/audio/fish-sfx and ui-sfx are listed in the catalog
# as they are and never touched.

import argparse
import array
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_AUDIO = os.path.join(ROOT, 'public', 'audio')
CATALOG_PATH = os.path.join(ROOT, 'src', 'audio', 'clipCatalog.json')
SR = 48000
HIGHPASS = 'highpass=f=35,highpass=f=35'
AAC_FRAME = 1024
# Beds are stored as [last LOOP_PAD samples of the loop] + loop + [first LOOP_PAD samples], and the
# catalog's `loop` gives the loop region in seconds for AudioBufferSourceNode.loopStart/loopEnd.
# Opus and AAC both reconstruct the first and last ~20 ms of a file less exactly (the encoder
# starts from and ends in silence: 10 dB more error than mid-file in the m4a); the padding keeps
# those edges outside the region that loops. The PCM loop is continuous by construction; what the
# seam check still finds in the smooth, low-frequency beds is the codec's own waveform error, which
# is not periodic, so it steps at the seam.
LOOP_PAD = 4096
PREROLL = 1.0

NOAA_AUTHOR = 'NOAA Fisheries, NEFSC Passive Acoustics Branch'
NOAA_LICENCE = 'Public domain (US government work)'
CC0 = 'CC0 1.0'


def freesound(sound_id, author, title, preview):
    page = f'https://freesound.org/s/{sound_id}/'
    return {
        'download': preview, 'sourceUrl': page, 'author': author, 'title': title,
        'licence': CC0, 'credit': f'{title} by {author}, {page} (CC0 1.0)',
    }


def noaa(url, species, title):
    return {
        'download': url, 'sourceUrl': url, 'author': NOAA_AUTHOR, 'title': title,
        'licence': NOAA_LICENCE, 'credit': f'{NOAA_AUTHOR}. 2023. {species}.',
    }


NOAA_S3 = 'https://www.fisheries.noaa.gov/s3/2023-04/'
FS_CDN = 'https://cdn.freesound.org/previews/'

# Source file name in <source-folder> -> where it came from. `download` is the exact file fetched.
SOURCES = {
    'a1-open-water-korcula.mp3': freesound(773947, 'GirlWithSoundRecorder', 'Below the Sea | Underwater Soundscape | Korcula, Croatia', FS_CDN + '773/773947_7834424-hq.mp3'),
    'a2-shrimp-hvar.mp3': freesound(630436, 'KaleidacousticsAudio', 'Underwater crackling sounds_Hydrophone.wav', FS_CDN + '630/630436_13875907-hq.mp3'),
    'a2-shrimp-aberwrach.mp3': freesound(867441, 'MeliaRoger', "UNDRWatr_Underwater clics atmosphere at night in the port of Aber Wrac'h bubbles calm continous -20LUFS_FR-BRETAGNE 20260822_Melia Roger_Droprig F3 Gladys", FS_CDN + '867/867441_13222620-hq.mp3'),
    'a3-reef-grays-reef-noaa.mp3': noaa(NOAA_S3 + 'Sdsc01-HourlySancSdCompiled-GRNMS-NOAA-PAGroup-26-amplified-soundscape-clip.mp3', 'Soundscape', "Soundscape: Gray's Reef National Marine Sanctuary, hourly compilation"),
    'a4-surf-seashore.mp3': freesound(815116, 'L.Finck', 'Underwater - seashore', FS_CDN + '815/815116_14042309-hq.mp3'),
    'a5-bubble-flow.mp3': freesound(852478, 'KolbyRFX', 'WATRUndwtr_Underwater Bubble Flow Loop_KOLBYR_FREE SOUNDS', FS_CDN + '852/852478_18763192-hq.mp3'),
    'a6-surge.mp3': freesound(852167, 'KolbyRFX', 'WATRUndwtr_Underwater Submerge Transition_KOLBYR_FREE SOUNDS', FS_CDN + '852/852167_18763192-hq.mp3'),
    'a7-descent-scuba.mp3': freesound(634225, 'sbvitug', 'Scuba_bubbles.mp3', FS_CDN + '634/634225_13988658-hq.mp3'),
    'b1-swish-hydrophone.mp3': freesound(422657, 'JavierZumer', 'Hydrophone Underwater movements.wav', FS_CDN + '422/422657_2836758-hq.mp3'),
    'b2-deep-impact.mp3': freesound(470084, 'Sheyvan', 'Underwater Deep Impact', FS_CDN + '470/470084_3248005-hq.mp3'),
    'b3-school-rush-src.mp3': freesound(760849, 'NapierFreesound', 'Underwater Motion', FS_CDN + '760/760849_15363503-hq.mp3'),
    'b4-red-grouper.mp3': noaa(NOAA_S3 + 'Epmo-pulses-NOAA-PAGroup-01-red-grouper-clip.mp3', 'Red Grouper', 'Red Grouper (Epinephelus morio): pulses'),
    'b4-toadfish.mp3': noaa(NOAA_S3 + 'Opsp-tonal-NOAA-PAGroup-01-amplified-LPfilter500-toadfish-clip.mp3', 'Toadfish', 'Toadfish (Opsanus spp.): tonal call'),
    'b4-cod-grunt.mp3': noaa(NOAA_S3 + 'Gamo-grunt-NOAA-PAGroup-03-amplified-atlantic-cod-clip.mp3', 'Atlantic Cod', 'Atlantic Cod (Gadus morhua): grunts'),
    'b5-haddock-knocks.mp3': noaa(NOAA_S3 + 'Meae-knock-NOAA-PAGroup-01-haddock-clip.mp3', 'Haddock', 'Haddock (Melanogrammus aeglefinus): knocks'),
    'b6-shrimp-snaps.mp3': noaa(NOAA_S3 + 'Alsp-snaps-NOAA-PAGroup-02-amplified-snapping-shrimp-clip.mp3', 'Snapping Shrimp', 'Snapping Shrimp (Alpheus spp.): snaps'),
    'b7-winkle-grazing.mp3': freesound(654439, 'bruno.auzet', 'winkle eating seaweed', FS_CDN + '654/654439_11519060-hq.mp3'),
    'b8-splash-below.mp3': freesound(761566, 'stuniverso', 'something coming out of the water, underwater', FS_CDN + '761/761566_16036556-hq.mp3'),
    'b9-dolphin-breaths-src.mp3': freesound(385796, 'geraldfiebig', 'Atlantic Spotted Dolphins off the coast of La Gomera, Canary Islands', FS_CDN + '385/385796_4438201-hq.mp3'),
    'b10-exhale-scuba.mp3': freesound(274491, 'timsc', 'Under water sounds while scuba diving', FS_CDN + '274/274491_266678-hq.mp3'),
    'b11-bubble-release.mp3': freesound(865358, 'Valerie-Vivegnis', '26.07.26- Underwater Bubble', FS_CDN + '865/865358_15375955-hq.mp3'),
    'b11-small-bubbles-src.mp3': freesound(422666, 'JavierZumer', 'hydrophone bubbles straw small.wav', FS_CDN + '422/422666_2836758-hq.mp3'),
    'b12-humpback-noaa.mp3': noaa(NOAA_S3 + 'Meno-song-NOAA-PAGroup-13-humpback-clip.mp3', 'Humpback Whale', 'Humpback Whale (Megaptera novaeangliae): song'),
    'b13-rubber-creak-src.mp3': freesound(450258, 'kyles', 'Lovis ship sailboat tire rubber stretching creaking squeezed against concrete pier closeup.flac', FS_CDN + '450/450258_612689-hq.mp3'),
    'b14-spotted-dolphin-noaa.mp3': noaa(NOAA_S3 + 'Stfr-Multisound-NOAA-PAGroup-01-atlantic-spotted-dolphin-clip.mp3', 'Atlantic Spotted Dolphin', 'Atlantic Spotted Dolphin (Stenella frontalis): whistles'),
    'c2-bubble-rise.mp3': freesound(486885, 'mosaichorse', 'Bubbles Rise.wav', FS_CDN + '486/486885_5435812-hq.mp3'),
    'c3-soft-error.mp3': freesound(478191, 'JonnyRuss01', 'Beep_Error_1.wav', FS_CDN + '478/478191_10233023-hq.mp3'),
    'c4-sonar-ping.mp3': freesound(808185, 'nicorico_120', 'Sonar ping', FS_CDN + '808/808185_11548422-hq.mp3'),
    'c5-plunge.mp3': freesound(679404, 'adviseme333', 'Dipping below water', FS_CDN + '679/679404_14805886-hq.mp3'),
    'c5-surface.mp3': freesound(679410, 'adviseme333', 'Coming up from underwater', FS_CDN + '679/679410_14805886-hq.mp3'),
}

# Encoding per group: Opus kbps (stereo, mono), AAC kbps (stereo, mono). The bed AAC rates are
# below the plan's 96/64 to keep the beds inside the ~3.5 MB budget per format.
BITRATES = {
    'bed': {'opus': (56, 32), 'aac': (64, 56)},
    'event': {'opus': (40, 40), 'aac': (64, 64)},
    'oneshot': {'opus': (40, 40), 'aac': (64, 64)},
    'ui': {'opus': (40, 40), 'aac': (64, 64)},
}
FOLDERS = {'bed': 'beds', 'event': 'events', 'oneshot': 'oneshots', 'ui': 'ui'}
PEAK_DBFS = {'event': -3.0, 'oneshot': -3.0, 'ui': -6.0}

ABERWRACH_HUM = ('bandreject=f=42.1:width_type=h:w=2,bandreject=f=84.3:width_type=h:w=2,'
                 'bandreject=f=101.5:width_type=h:w=3')


def bed(id_, use, src, trim, channels, chain='', crossfade=3.0, segments=None, release=15, note=''):
    return dict(id=id_, group='bed', use=use, src=src, trim=trim, channels=channels, chain=chain,
                crossfade=crossfade, segments=segments, release=release, note=note)


def shot(group, id_, use, src, trim, fade=(5, 10), chain='', reverse_of=None, note=''):
    return dict(id=id_, group=group, use=use, src=src, trim=trim, channels=1, chain=chain,
                fade=fade, reverse_of=reverse_of, note=note)


def ev(*a, **k): return shot('event', *a, **k)
def os_(*a, **k): return shot('oneshot', *a, **k)
def ui(*a, **k): return shot('ui', *a, **k)


CLIPS = [
    # --- Beds ---------------------------------------------------------------------------------
    # Hvar: 13.5 min, very even (10 s levels within 3 dB), <150 Hz flat at -55 dBFS all through
    # (no boat). 421-485 s is the calmest 64 s: loudest single snap -6.3 dBFS, the fewest loud snaps.
    bed('reef-shrimp-hvar', 'bed:the-reefs', 'a2-shrimp-hvar.mp3', [421.0, 485.0], 2),
    # Aber Wrac'h: steady tones at 42.1, 84.3 and ~101.5 Hz run through the whole file (an engine
    # or generator harmonic set; it cannot be cut around), notched out. Loud knocks and low thumps
    # (+9 to +22 dB over the median) every 20-40 s; 363.5-413.5 s holds the fewest (one at +12 dB
    # near 405 s, one low thump near 393 s).
    bed('reef-shrimp-aberwrach', 'bed:the-reefs', 'a2-shrimp-aberwrach.mp3', [363.5, 413.5], 2, chain=ABERWRACH_HUM),
    # Gray's Reef: the NOAA clip is an hourly compilation spliced every ~2.5 s; 28-45.5 s is the
    # dusk fish chorus (150-1500 Hz up 20-30 dB), far too eventful for a bed. Built from the two
    # calm stretches either side, joined with a 3 s equal-power crossfade.
    bed('reef-soundscape-grays', 'bed:the-reefs', 'a3-reef-grays-reef-noaa.mp3', [0.0, 60.0], 1,
        segments=[[0.0, 27.5], [45.6, 60.0]]),
    # Korcula: almost all energy below 150 Hz (water movement), with low thumps that clip in the
    # source in about a sixth of all seconds, dropouts or edits at 114, 159.5, 218, 243, 269.5 and
    # 393 s, and faint steady tones at 300-1700 Hz throughout (possibly a distant engine). 1-77 s
    # avoids every dropout; it still holds one clipped thump near 48 s (limited here).
    bed('open-water-korcula', 'bed:open-sea', 'a1-open-water-korcula.mp3', [1.0, 77.0], 2, release=80),
    # Surf: steady low wash; small high ticks at about 30, 34, 44, 60 and 78 s cannot all be avoided
    # in 64 s of an 82 s file. 17.5-81.5 s scored calmest.
    bed('shallows-surf', 'bed:the-shallows', 'a4-surf-seashore.mp3', [17.5, 81.5], 1),
    # Bubble flow: even all through (2 s levels within 4 dB, no low-band events); 35-85 s scored calmest.
    bed('shallows-bubble-flow', 'bed:the-shallows', 'a5-bubble-flow.mp3', [35.0, 85.0], 2),
    # Surge: the source is a designed "submerge transition" series: 7 surges of ~6 s, each followed by
    # 2-3 s of digital silence, peaks clipping. Cut at 50.0 s, inside the silence before the 7th
    # surge, so the loop seam is one more silence (2.4 s) like the others and needs no crossfade.
    bed('kelp-surge', 'bed:kelp-forest', 'a6-surge.mp3', [0.0, 50.0], 2, crossfade=0.0, release=80),
    # Descent: diver breathing cycles of bubbles (~6 s period), even through the file; 10-53 s scored
    # calmest. It need not loop, but the crossfade is baked in anyway.
    bed('descent-scuba', 'bed:descent', 'a7-descent-scuba.mp3', [10.0, 53.0], 2),

    # --- Events: grunt (swim-bladder calls) ---------------------------------------------------
    # Red grouper: single pulses and a short growl from the first and third call bouts; the long
    # pulse trains (11-16.6 s, 28.9-33.4 s) are left out.
    ev('grunt-red-grouper-01', 'grunt', 'b4-red-grouper.mp3', [2.73, 2.98]),
    ev('grunt-red-grouper-02', 'grunt', 'b4-red-grouper.mp3', [3.19, 3.50]),
    ev('grunt-red-grouper-03', 'grunt', 'b4-red-grouper.mp3', [3.57, 4.36]),
    ev('grunt-red-grouper-04', 'grunt', 'b4-red-grouper.mp3', [10.47, 10.76]),
    ev('grunt-red-grouper-05', 'grunt', 'b4-red-grouper.mp3', [21.15, 21.38]),
    ev('grunt-red-grouper-06', 'grunt', 'b4-red-grouper.mp3', [21.79, 22.36]),
    # Atlantic cod: the clip's four grunts, ~0.1 s each, 8 kHz source.
    ev('grunt-cod-01', 'grunt', 'b4-cod-grunt.mp3', [1.39, 1.60]),
    ev('grunt-cod-02', 'grunt', 'b4-cod-grunt.mp3', [2.19, 2.40]),
    ev('grunt-cod-03', 'grunt', 'b4-cod-grunt.mp3', [3.21, 3.40]),
    ev('grunt-cod-04', 'grunt', 'b4-cod-grunt.mp3', [4.40, 4.60]),
    # Toadfish: the clip's two tonal "boatwhistle" calls; the source background is only ~16 dB down.
    ev('grunt-toadfish-01', 'grunt', 'b4-toadfish.mp3', [1.40, 1.93], fade=(8, 20)),
    ev('grunt-toadfish-02', 'grunt', 'b4-toadfish.mp3', [3.84, 4.25], fade=(8, 20)),

    # --- Events: knock (haddock) ---------------------------------------------------------------
    # Singles, pairs and triples from the two slow trains (1.35-2.9 s, 4.66-6.35 s, ~130 ms
    # apart) and one lone knock; one whole slow train for a drum-roll pool. The fast rasping trains
    # (9.1-12 s, 14-16.6 s) are left out.
    ev('knock-haddock-01', 'knock', 'b5-haddock-knocks.mp3', [1.33, 1.43]),
    ev('knock-haddock-02', 'knock', 'b5-haddock-knocks.mp3', [1.46, 1.81]),
    ev('knock-haddock-03', 'knock', 'b5-haddock-knocks.mp3', [2.36, 2.73]),
    ev('knock-haddock-04', 'knock', 'b5-haddock-knocks.mp3', [5.43, 5.65]),
    ev('knock-haddock-05', 'knock', 'b5-haddock-knocks.mp3', [6.16, 6.40]),
    ev('knock-haddock-06', 'knock', 'b5-haddock-knocks.mp3', [13.67, 13.76]),
    ev('knock-haddock-train-01', 'knock-train', 'b5-haddock-knocks.mp3', [4.64, 6.40], fade=(5, 20)),

    # --- Events: click (snapping shrimp) -------------------------------------------------------
    # The clip's six isolated snaps, each ~5 ms plus its ring. Snap 03 (1.235 s) reaches 0 dBFS in
    # the source and may be clipped.
    ev('click-shrimp-01', 'click', 'b6-shrimp-snaps.mp3', [0.091, 0.140], fade=(1, 8)),
    ev('click-shrimp-02', 'click', 'b6-shrimp-snaps.mp3', [0.631, 0.680], fade=(1, 8)),
    ev('click-shrimp-03', 'click', 'b6-shrimp-snaps.mp3', [1.231, 1.280], fade=(1, 8)),
    ev('click-shrimp-04', 'click', 'b6-shrimp-snaps.mp3', [2.771, 2.820], fade=(1, 8)),
    ev('click-shrimp-05', 'click', 'b6-shrimp-snaps.mp3', [3.156, 3.205], fade=(1, 8)),
    ev('click-shrimp-06', 'click', 'b6-shrimp-snaps.mp3', [3.431, 3.480], fade=(1, 8)),

    # --- Events: bloop (single bubbles) and bubble (clusters) ----------------------------------
    ev('bloop-release-01', 'bloop', 'b11-bubble-release.mp3', [0.555, 0.735]),
    ev('bloop-release-02', 'bloop', 'b11-bubble-release.mp3', [1.325, 1.490]),
    ev('bloop-release-03', 'bloop', 'b11-bubble-release.mp3', [1.520, 1.625]),
    ev('bloop-release-04', 'bloop', 'b11-bubble-release.mp3', [1.740, 1.865]),
    ev('bloop-small-01', 'bloop', 'b11-small-bubbles-src.mp3', [8.100, 8.300]),
    ev('bloop-small-02', 'bloop', 'b11-small-bubbles-src.mp3', [10.700, 10.870]),
    ev('bubble-small-01', 'bubble', 'b11-small-bubbles-src.mp3', [1.32, 1.98]),
    ev('bubble-small-02', 'bubble', 'b11-small-bubbles-src.mp3', [4.47, 4.80]),
    ev('bubble-small-03', 'bubble', 'b11-small-bubbles-src.mp3', [6.08, 6.40]),
    ev('bubble-small-04', 'bubble', 'b11-small-bubbles-src.mp3', [20.15, 20.45]),
    ev('bubble-small-05', 'bubble', 'b11-small-bubbles-src.mp3', [21.29, 21.64]),
    ev('bubble-small-06', 'bubble', 'b11-small-bubbles-src.mp3', [21.96, 22.45]),

    # --- Events: thup --------------------------------------------------------------------------
    # The deep impact is a 1.2 s low roar with a hard onset, not a decaying thud: these are its
    # onset, low-passed and faded into a short thud. Provisional until heard.
    ev('thup-deep-impact-01', 'thup', 'b2-deep-impact.mp3', [0.015, 0.33], fade=(2, 220), chain='lowpass=f=220,lowpass=f=220'),
    ev('thup-deep-impact-02', 'thup', 'b2-deep-impact.mp3', [0.015, 0.22], fade=(2, 150), chain='lowpass=f=180,lowpass=f=180'),

    # --- One-shots for later phases ------------------------------------------------------------
    # Swish: the softer passes; the two with a sharp broadband click (6.75 s, 9.5 s, likely the
    # hydrophone being touched) and the noisy tail (12.4-14 s) are left out.
    os_('swish-01', 'later:swish', 'b1-swish-hydrophone.mp3', [0.40, 1.30], fade=(30, 150)),
    os_('swish-02', 'later:swish', 'b1-swish-hydrophone.mp3', [1.90, 2.80], fade=(30, 150)),
    os_('swish-03', 'later:swish', 'b1-swish-hydrophone.mp3', [3.55, 4.55], fade=(30, 150)),
    os_('swish-04', 'later:swish', 'b1-swish-hydrophone.mp3', [4.70, 5.65], fade=(30, 150)),
    os_('swish-05', 'later:swish', 'b1-swish-hydrophone.mp3', [10.40, 11.40], fade=(30, 150)),
    os_('deep-thump', 'later:deep-thump', 'b2-deep-impact.mp3', [0.0, 1.497], fade=(2, 400)),
    # School rush: bursts in the source are separated by digital silence; cut at the silences.
    os_('school-rush-01', 'later:school-rush', 'b3-school-rush-src.mp3', [12.30, 14.10], fade=(5, 30)),
    os_('school-rush-02', 'later:school-rush', 'b3-school-rush-src.mp3', [26.35, 27.93], fade=(5, 30)),
    os_('school-rush-03', 'later:school-rush', 'b3-school-rush-src.mp3', [35.68, 38.45], fade=(5, 30)),
    os_('school-rush-04', 'later:school-rush', 'b3-school-rush-src.mp3', [42.40, 46.15], fade=(5, 30)),
    os_('school-rush-05', 'later:school-rush', 'b3-school-rush-src.mp3', [53.95, 57.30], fade=(5, 30)),
    # Grazing: single radula rasps (~0.7 s each, every ~2 s).
    os_('grazing-01', 'later:grazing', 'b7-winkle-grazing.mp3', [0.68, 1.50], fade=(10, 60)),
    os_('grazing-02', 'later:grazing', 'b7-winkle-grazing.mp3', [2.58, 3.42], fade=(10, 60)),
    os_('grazing-03', 'later:grazing', 'b7-winkle-grazing.mp3', [4.50, 5.50], fade=(10, 60)),
    os_('grazing-04', 'later:grazing', 'b7-winkle-grazing.mp3', [8.76, 9.70], fade=(10, 60)),
    os_('grazing-05', 'later:grazing', 'b7-winkle-grazing.mp3', [14.76, 15.62], fade=(10, 60)),
    # Splash from below: the source is one splash; a full and a short cut.
    os_('splash-below-01', 'later:splash-below', 'b8-splash-below.mp3', [0.0, 3.50], fade=(5, 600)),
    os_('splash-below-02', 'later:splash-below', 'b8-splash-below.mp3', [0.0, 1.30], fade=(5, 400)),
    # Breath: dolphin blows from the in-air part (0-36.4 s), over boat-engine rumble; a 250 Hz
    # high-pass (4th order) takes the engine out. The underwater part after 36.4 s is not used.
    os_('breath-01', 'later:breath', 'b9-dolphin-breaths-src.mp3', [4.20, 5.15], fade=(30, 150), chain='highpass=f=250,highpass=f=250'),
    os_('breath-02', 'later:breath', 'b9-dolphin-breaths-src.mp3', [11.20, 12.05], fade=(30, 150), chain='highpass=f=250,highpass=f=250'),
    os_('breath-03', 'later:breath', 'b9-dolphin-breaths-src.mp3', [14.72, 15.50], fade=(30, 150), chain='highpass=f=250,highpass=f=250'),
    os_('breath-04', 'later:breath', 'b9-dolphin-breaths-src.mp3', [31.82, 32.25], fade=(30, 150), chain='highpass=f=250,highpass=f=250'),
    # Exhale: bursts from the first 40 s; the propeller passing at about 68-76 s is avoided.
    os_('exhale-01', 'later:exhale', 'b10-exhale-scuba.mp3', [0.8, 3.8], fade=(150, 500)),
    os_('exhale-02', 'later:exhale', 'b10-exhale-scuba.mp3', [6.3, 10.3], fade=(150, 500)),
    os_('exhale-03', 'later:exhale', 'b10-exhale-scuba.mp3', [15.8, 20.8], fade=(150, 500)),
    os_('exhale-04', 'later:exhale', 'b10-exhale-scuba.mp3', [33.0, 35.3], fade=(150, 500)),
    # Humpback: three phrases of song units; the broad smear at 20.7-29 s and the strong <70 Hz
    # rumble under 6.8-10.3 s are left out. 70 Hz high-pass against flow noise.
    os_('humpback-01', 'later:humpback', 'b12-humpback-noaa.mp3', [13.2, 19.2], fade=(200, 500), chain='highpass=f=70,highpass=f=70'),
    os_('humpback-02', 'later:humpback', 'b12-humpback-noaa.mp3', [30.8, 40.6], fade=(200, 500), chain='highpass=f=70,highpass=f=70'),
    os_('humpback-03', 'later:humpback', 'b12-humpback-noaa.mp3', [43.4, 53.3], fade=(200, 500), chain='highpass=f=70,highpass=f=70'),
    # Creak: rubber-fender creaks between the source's pauses.
    os_('creak-01', 'later:creak', 'b13-rubber-creak-src.mp3', [10.40, 11.75], fade=(10, 50)),
    os_('creak-02', 'later:creak', 'b13-rubber-creak-src.mp3', [44.15, 46.80], fade=(10, 50)),
    os_('creak-03', 'later:creak', 'b13-rubber-creak-src.mp3', [88.65, 90.40], fade=(10, 50)),
    os_('creak-04', 'later:creak', 'b13-rubber-creak-src.mp3', [129.75, 130.85], fade=(10, 50)),
    os_('creak-05', 'later:creak', 'b13-rubber-creak-src.mp3', [159.15, 160.75], fade=(10, 50)),
    # Dolphin whistles sit at 5-15 kHz over broadband noise; a 3 kHz high-pass isolates them.
    os_('dolphin-whistle-01', 'later:dolphin-whistle', 'b14-spotted-dolphin-noaa.mp3', [0.10, 0.90], fade=(20, 80), chain='highpass=f=3000,highpass=f=3000'),
    os_('dolphin-whistle-02', 'later:dolphin-whistle', 'b14-spotted-dolphin-noaa.mp3', [2.40, 3.00], fade=(20, 80), chain='highpass=f=3000,highpass=f=3000'),
    os_('dolphin-whistle-03', 'later:dolphin-whistle', 'b14-spotted-dolphin-noaa.mp3', [3.10, 4.15], fade=(20, 80), chain='highpass=f=3000,highpass=f=3000'),
    os_('dolphin-whistle-04', 'later:dolphin-whistle', 'b14-spotted-dolphin-noaa.mp3', [4.15, 4.80], fade=(20, 80), chain='highpass=f=3000,highpass=f=3000'),

    # --- UI --------------------------------------------------------------------------------------
    ui('modal-open', 'ui:modal-open', 'c2-bubble-rise.mp3', [0.0, 0.88], fade=(3, 20)),
    ui('modal-close', 'ui:modal-close', 'c2-bubble-rise.mp3', [0.0, 0.88], fade=(3, 20), reverse_of='modal-open'),
    ui('soft-error', 'ui:soft-error', 'c3-soft-error.mp3', [0.0, 0.2448], fade=(2, 20)),
    # The ping's ~700 Hz tone decays for 3 s; cut to 1.2 s with a 600 ms fade. A 200 Hz high-pass
    # removes the low rumble under its first 1.3 s.
    ui('select-ping', 'ui:select-ping', 'c4-sonar-ping.mp3', [0.0, 1.2], fade=(2, 600), chain='highpass=f=200,highpass=f=200'),
    ui('plunge', 'ui:plunge', 'c5-plunge.mp3', [0.55, 3.40], fade=(20, 300)),
    # Surfacing: 1 s of rising bubbles, the break into air at 4.35 s, then 1 s of air.
    ui('surface', 'ui:surface', 'c5-surface.mp3', [3.40, 5.40], fade=(30, 500)),
]

# The 9 older clips (CHANGELOG v0.7.2 and v0.7.4: "Jeremy-uploaded MP3 movement/burst assets",
# "Jeremy's four uploaded UI-click assets"); their origin was never recorded.
EXISTING = [
    ('fish-sfx/fish-small-movement-01', 'event', 'fish-swim:turn'),
    ('fish-sfx/fish-small-movement-02', 'event', 'fish-swim:turn'),
    ('fish-sfx/fish-small-movement-03', 'event', 'fish-swim:turn'),
    ('fish-sfx/fish-big-movement-01', 'event', 'fish-swim:burst'),
    ('fish-sfx/fish-big-movement-02', 'event', 'fish-swim:burst'),
    ('ui-sfx/ui-click-01', 'ui', 'ui:click'),
    ('ui-sfx/ui-click-02', 'ui', 'ui:click'),
    ('ui-sfx/ui-click-03', 'ui', 'ui:click'),
    ('ui-sfx/ui-click-04', 'ui', 'ui:click'),
]
UNRECORDED = 'Supplied by Jeremy (source not recorded)'


# --- helpers ---------------------------------------------------------------------------------

def run(cmd, data=None):
    res = subprocess.run(cmd, input=data, capture_output=True)
    if res.returncode != 0:
        raise RuntimeError(f"{' '.join(cmd[:6])}... failed:\n{res.stderr.decode(errors='replace')[-2000:]}")
    return res


def probe(path):
    out = run(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries',
               'stream=channels,sample_rate:format=duration', '-of', 'json', path]).stdout
    info = json.loads(out)
    return info['streams'][0]['channels'], int(info['streams'][0]['sample_rate']), float(info['format']['duration'])


def decode(src_path, start, end, chain, channels):
    """Decode [start, end] s of a source at 48 kHz through the chain, with up to PREROLL s of
    context either side so filters are settled, then cut to the exact span."""
    src_ch, _, src_dur = probe(src_path)
    pre = min(PREROLL, start)
    post = min(PREROLL, max(0.0, src_dur - end))
    filters = [f'atrim=start={start - pre:.6f}:end={end + post:.6f}', 'asetpts=PTS-STARTPTS',
               f'aresample={SR}:resampler=soxr:precision=28']
    if channels == 1 and src_ch == 2:
        filters.append('pan=mono|c0=0.5*c0+0.5*c1')
    elif channels == 2 and src_ch == 1:
        raise ValueError(f'{src_path} is mono')
    filters.append(HIGHPASS)
    if chain:
        filters.append(chain)
    raw = run(['ffmpeg', '-v', 'error', '-nostdin', '-i', src_path, '-af', ','.join(filters),
               '-f', 'f32le', '-acodec', 'pcm_f32le', '-']).stdout
    x = array.array('f'); x.frombytes(raw)
    a = int(round(pre * SR)); n = int(round((end - start) * SR))
    frames = len(x) // channels
    if a + n > frames:
        raise ValueError(f'{src_path}: wanted {a + n} frames, decoded {frames}')
    return x[a * channels:(a + n) * channels]


def splice(a, b, ch, xf_frames):
    """a then b, joined with an equal-power crossfade of xf_frames."""
    na = len(a) // ch
    out = array.array('f', a[:(na - xf_frames) * ch])
    for i in range(xf_frames):
        t = (i + 0.5) / xf_frames
        gi, go = math.sin(t * math.pi / 2), math.cos(t * math.pi / 2)
        for c in range(ch):
            out.append(a[(na - xf_frames + i) * ch + c] * go + b[i * ch + c] * gi)
    out.extend(b[xf_frames * ch:])
    return out


def loop_crossfade(x, ch, xf_frames):
    """Fold the last xf_frames into the head (equal power). The result's last sample is the
    sample just before the folded tail, so the loop runs on seamlessly."""
    if xf_frames == 0:
        return array.array('f', x)
    n = len(x) // ch; L = n - xf_frames
    out = array.array('f', x[:L * ch])
    for i in range(xf_frames):
        t = (i + 0.5) / xf_frames
        gi, go = math.sin(t * math.pi / 2), math.cos(t * math.pi / 2)
        for c in range(ch):
            out[i * ch + c] = x[i * ch + c] * gi + x[(L + i) * ch + c] * go
    return out


def ffmpeg_pcm(x, ch, af):
    raw = run(['ffmpeg', '-v', 'error', '-nostdin', '-f', 'f32le', '-ar', str(SR), '-ac', str(ch), '-i', 'pipe:0',
               '-af', af, '-f', 'f32le', '-acodec', 'pcm_f32le', '-'], x.tobytes()).stdout
    y = array.array('f'); y.frombytes(raw)
    return y


def loudness(x, ch):
    err = run(['ffmpeg', '-v', 'info', '-nostats', '-nostdin', '-f', 'f32le', '-ar', str(SR), '-ac', str(ch), '-i', 'pipe:0',
               '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-'], x.tobytes()).stderr.decode(errors='replace')
    summary = err[err.rfind('Summary:'):]
    i_lufs = float(re.search(r'I:\s+(-?[\d.]+|-inf) LUFS', summary).group(1))
    tp = float(re.search(r'Peak:\s+(-?[\d.]+|-inf) dBFS', summary).group(1))
    return i_lufs, tp


def limit_loop(x, ch, gain_db, limit_db, circular, release=15):
    """Gain and look-ahead limiting; with circular padding the limiter sees the loop as endless."""
    n = len(x) // ch
    pad = min(int(0.5 * SR), n // 2) if circular else 0
    padded = array.array('f', x[(n - pad) * ch:]) + x + array.array('f', x[:pad * ch]) if pad else x
    lim = 10 ** (limit_db / 20)
    y = ffmpeg_pcm(padded, ch, f'volume={gain_db:.4f}dB,alimiter=limit={lim:.6f}:attack=0.5:release={release}:level=0:latency=1')
    if len(y) != len(padded):
        raise RuntimeError(f'limiter changed length {len(padded)} -> {len(y)}')
    return y[pad * ch:(pad + n) * ch]


def peak(x):
    return max(max(x), -min(x)) if len(x) else 0.0


def fade(x, ch, fade_in_ms, fade_out_ms):
    n = len(x) // ch
    fi = min(n, int(round(fade_in_ms * SR / 1000))); fo = min(n, int(round(fade_out_ms * SR / 1000)))
    for i in range(fi):
        g = math.sin((i + 0.5) / fi * math.pi / 2)
        for c in range(ch): x[i * ch + c] *= g
    for i in range(fo):
        g = math.sin((i + 0.5) / fo * math.pi / 2)
        j = n - 1 - i
        for c in range(ch): x[j * ch + c] *= g
    return x


def encode(x, ch, out_base, group):
    os.makedirs(os.path.dirname(out_base), exist_ok=True)
    opus = BITRATES[group]['opus'][0 if ch == 2 else 1]
    aac = BITRATES[group]['aac'][0 if ch == 2 else 1]
    common = ['ffmpeg', '-v', 'error', '-nostdin', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', str(ch), '-i', 'pipe:0',
              '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact']
    run(common + ['-c:a', 'libopus', '-b:a', f'{opus}k', '-vbr', 'on', '-compression_level', '10',
                  '-application', 'audio', out_base + '.webm'], x.tobytes())
    run(common + ['-c:a', 'aac', '-b:a', f'{aac}k', '-movflags', '+faststart', out_base + '.m4a'], x.tobytes())
    return {'webm': os.path.getsize(out_base + '.webm'), 'm4a': os.path.getsize(out_base + '.m4a')}


def decoded_frames(path, ch):
    raw = run(['ffmpeg', '-v', 'error', '-nostdin', '-i', path, '-f', 'f32le', '-acodec', 'pcm_f32le', '-ac', str(ch), '-ar', str(SR), '-']).stdout
    y = array.array('f'); y.frombytes(raw)
    return y


def seam_rank(y, ch):
    """Where the waveform's curvature (second difference) across the loop seam ranks among the
    curvature at every sample of the loop, as a percentile, worst channel. A continuous seam
    ranks anywhere; a click ranks at the very top (above ~99.9)."""
    worst = 0.0
    for c in range(ch):
        v = y[c::ch]; n = len(v)
        seam = max(abs(v[0] - 2 * v[-1] + v[-2]), abs(v[1] - 2 * v[0] + v[-1]))
        below = sum(1 for i in range(1, n - 1) if abs(v[i + 1] - 2 * v[i] + v[i - 1]) < seam)
        worst = max(worst, 100.0 * below / (n - 2))
    return worst


def chain_text(clip):
    parts = [f"trim {clip['trim'][0]:.3f}-{clip['trim'][1]:.3f} s"]
    if clip.get('segments'):
        parts[0] = 'segments ' + ' + '.join(f'{a:.3f}-{b:.3f} s' for a, b in clip['segments']) + ' (3 s equal-power splice)'
    parts += ['resample 48 kHz (soxr)', 'mono' if clip['channels'] == 1 else 'stereo', 'high-pass 35 Hz']
    if clip['chain']:
        parts.append(clip['chain'])
    if clip['group'] == 'bed':
        if clip['crossfade']:
            parts.append(f"{clip['crossfade']:.0f} s equal-power tail-into-head crossfade")
        parts.append(f"gain to -20 LUFS, limiter -1.5 dBFS 0.5/{clip['release']} ms (circular), <= -1 dBTP")
    else:
        if clip.get('reverse_of'):
            parts.append('reversed')
        parts.append(f"fades {clip['fade'][0]}/{clip['fade'][1]} ms, peak {PEAK_DBFS[clip['group']]:.0f} dBFS")
    return '; '.join(parts)


# --- builders --------------------------------------------------------------------------------

def bed_loop_frames(clip):
    spans = clip.get('segments') or [clip['trim']]
    return (sum(int(round((b - a) * SR)) for a, b in spans) - 3 * SR * (len(spans) - 1)
            - int(round(clip['crossfade'] * SR)))


def round_bed_trim(clip):
    """Whole AAC frames: a loop of k * 1024 samples needs no end padding in the m4a, so the
    fallback loops without a gap. Moves the excerpt end earlier by under 21.3 ms."""
    spans = clip.get('segments') or [clip['trim']]
    xf = int(round(clip['crossfade'] * SR))
    frames = sum(int(round((b - a) * SR)) for a, b in spans) - 3 * SR * (len(spans) - 1)
    drop = (frames - xf) % AAC_FRAME
    if drop:
        spans[-1][1] = round(spans[-1][1] - drop / SR, 6)
    if clip.get('segments'):
        clip['trim'] = [clip['segments'][0][0], clip['segments'][-1][1]]


def build_bed(clip, src_dir):
    src = os.path.join(src_dir, clip['src']); ch = clip['channels']
    if clip.get('segments'):
        segs = [decode(src, a, b, clip['chain'], ch) for a, b in clip['segments']]
        x = segs[0]
        for s in segs[1:]:
            x = splice(x, s, ch, int(3.0 * SR))
    else:
        x = decode(src, clip['trim'][0], clip['trim'][1], clip['chain'], ch)
    xf = int(round(clip['crossfade'] * SR))
    if (len(x) // ch - xf) % AAC_FRAME:
        raise RuntimeError(f"{clip['id']}: loop is not whole AAC frames")
    x = loop_crossfade(x, ch, xf)
    i0, _ = loudness(x, ch)
    gain = -20.0 - i0; limit_db = -1.5
    for _ in range(8):
        y = limit_loop(x, ch, gain, limit_db, True, clip['release'])
        i1, tp = loudness(y, ch)
        if abs(i1 + 20.0) <= 0.15 and tp <= -1.0:
            break
        gain += -20.0 - i1
        if tp > -1.0:
            limit_db -= (tp + 1.0) + 0.1
    # Gain reduction per 10 ms window: how hard the limiter worked.
    g = 10 ** (gain / 20); w = int(0.01 * SR) * ch; grs = []
    for i in range(0, len(x) - w, w):
        px = peak(x[i:i + w]) * g
        grs.append(20 * math.log10(max(px, 1e-9) / max(peak(y[i:i + w]), 1e-9)))
    grs.sort()
    return y, {'lufs': i1, 'tp': tp, 'gain': gain, 'limit': limit_db, 'maxGR': grs[-1],
               'GR>1dB%': 100 * sum(1 for v in grs if v > 1) / len(grs)}


def build_shot(clip, src_dir, built):
    ch = 1
    if clip.get('reverse_of'):
        base = built[clip['reverse_of']]
        y = array.array('f', reversed(base))
        return y, {'peak': 20 * math.log10(peak(y))}
    src = os.path.join(src_dir, clip['src'])
    x = decode(src, clip['trim'][0], clip['trim'][1], clip['chain'], ch)
    x = fade(x, ch, *clip['fade'])
    target = 10 ** (PEAK_DBFS[clip['group']] / 20)
    p = peak(x)
    g = target / p
    x = array.array('f', (v * g for v in x))
    return x, {'peak': 20 * math.log10(peak(x)), 'gain_db': 20 * math.log10(g)}


def edge_db(x, ch, ms=10):
    n = len(x) // ch; k = max(1, int(ms * SR / 1000))
    def rms(seg): return math.sqrt(sum(v * v for v in seg) / max(1, len(seg))) or 1e-12
    pk = peak(x) or 1e-12
    return 20 * math.log10(rms(x[:k * ch]) / pk), 20 * math.log10(rms(x[(n - k) * ch:]) / pk)


def main():
    ap = argparse.ArgumentParser(description='Build shipped audio clips and src/audio/clipCatalog.json')
    ap.add_argument('source_dir', help='folder holding the downloaded source files (names in SOURCES)')
    ap.add_argument('--only', help='comma-separated clip ids to rebuild (the catalog is still written in full from the files on disk)')
    ap.add_argument('--no-verify', action='store_true', help='skip decoding the outputs back for checks')
    ap.add_argument('--describe', action='store_true', help='print every output with its source, licence, trim and chain, and exit')
    args = ap.parse_args()
    for clip in CLIPS:
        if clip['group'] == 'bed':
            round_bed_trim(clip)
    if args.describe:
        for clip in CLIPS:
            src = SOURCES[clip['src']]
            print(f"public/audio/{FOLDERS[clip['group']]}/{clip['id']}.{{webm,m4a}}")
            print(f"  source  {clip['src']}  {src['download']}")
            print(f"  page    {src['sourceUrl']}  {src['author']}  {src['licence']}")
            print(f"  chain   {chain_text(clip)}")
        return
    src_dir = os.path.abspath(args.source_dir)
    missing = [name for name in SOURCES if not os.path.isfile(os.path.join(src_dir, name))]
    if missing:
        sys.exit(f'missing sources in {src_dir}: {missing}')
    ids = [c['id'] for c in CLIPS]
    if len(set(ids)) != len(ids):
        sys.exit('duplicate clip ids')
    only = set(args.only.split(',')) if args.only else None
    if only and only - set(ids):
        sys.exit(f'unknown ids: {sorted(only - set(ids))}')

    built = {}
    catalog = []
    report = []
    for clip in CLIPS:
        out_base = os.path.join(PUBLIC_AUDIO, FOLDERS[clip['group']], clip['id'])
        ch = clip['channels']
        rebuild = only is None or clip['id'] in only or (clip.get('reverse_of') and clip['reverse_of'] in only)
        if rebuild:
            if clip['group'] == 'bed':
                y, stats = build_bed(clip, src_dir)
            else:
                if clip.get('reverse_of') and clip['reverse_of'] not in built:
                    sys.exit(f"{clip['id']}: build {clip['reverse_of']} in the same run")
                y, stats = build_shot(clip, src_dir, built)
                built[clip['id']] = y
            if clip['group'] == 'bed':
                n = len(y) // ch
                if n != bed_loop_frames(clip):
                    raise RuntimeError(f"{clip['id']}: loop length {n} != {bed_loop_frames(clip)}")
                stored = array.array('f', y[(n - LOOP_PAD) * ch:]) + y + array.array('f', y[:LOOP_PAD * ch])
            else:
                stored = y
            sizes = encode(stored, ch, out_base, clip['group'])
            frames = len(stored) // ch
            line = f"{clip['id']:28s} {frames / SR:7.3f} s  webm {sizes['webm']:7d}  m4a {sizes['m4a']:7d}  " + \
                   '  '.join(f'{k} {v:.2f}' for k, v in stats.items())
            if clip['group'] != 'bed':
                e0, e1 = edge_db(y, ch)
                line += f'  edges {e0:.0f}/{e1:.0f} dB re peak'
            if not args.no_verify:
                for fmt in ('webm', 'm4a'):
                    d = decoded_frames(f'{out_base}.{fmt}', ch)
                    delta = (len(d) // ch - frames) / SR * 1000
                    line += f'  {fmt} len {delta:+.1f} ms'
                    if clip['group'] == 'bed':
                        region = d[LOOP_PAD * ch:(LOOP_PAD + len(y) // ch) * ch]
                        line += f' seam p{seam_rank(region, ch):.2f}'
            print(line, flush=True)
            report.append(line)
        else:
            if not os.path.isfile(out_base + '.webm'):
                sys.exit(f"{clip['id']}: not built yet")
            if clip['id'] in [c.get('reverse_of') for c in CLIPS if c.get('reverse_of')]:
                built[clip['id']] = decoded_frames(out_base + '.webm', ch)
        n_ch, _, dur = probe(out_base + '.webm')
        if clip['group'] == 'bed':
            dur = bed_loop_frames(clip) / SR
        elif rebuild:
            dur = (len(y) // ch) / SR
        src = SOURCES[clip['src']]
        duration = round(dur, 6 if clip['group'] == 'bed' else 3)
        entry = {
            'id': clip['id'],
            'path': f"/audio/{FOLDERS[clip['group']]}/{clip['id']}",
            'group': clip['group'],
            'use': clip['use'],
            'title': src['title'],
            'author': src['author'],
            'licence': src['licence'],
            'sourceUrl': src['sourceUrl'],
            'credit': src['credit'],
            'trim': [round(clip['trim'][0], 4), round(clip['trim'][1], 4)],
            'duration': duration,
            'channels': n_ch,
            'formats': ['webm', 'm4a'],
            'bytes': {'webm': os.path.getsize(out_base + '.webm'), 'm4a': os.path.getsize(out_base + '.m4a')},
        }
        if clip['group'] == 'bed':
            entry['loop'] = [round(LOOP_PAD / SR, 6), round((LOOP_PAD + bed_loop_frames(clip)) / SR, 6)]
        if clip.get('segments'):
            entry['segments'] = clip['segments']
        catalog.append(entry)

    for rel, group, use in EXISTING:
        path = os.path.join(PUBLIC_AUDIO, rel + '.mp3')
        n_ch, _, dur = probe(path)
        catalog.append({
            'id': os.path.basename(rel), 'path': f'/audio/{rel}', 'group': group, 'use': use,
            'title': os.path.basename(rel) + '.mp3', 'author': UNRECORDED, 'licence': UNRECORDED,
            'sourceUrl': None, 'credit': None, 'trim': None, 'duration': round(dur, 3), 'channels': n_ch,
            'formats': ['mp3'], 'bytes': {'mp3': os.path.getsize(path)},
        })

    with open(CATALOG_PATH, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(catalog, f, indent=2, ensure_ascii=False)
        f.write('\n')

    totals = {}
    for e in catalog:
        if 'webm' not in e['formats']:
            continue
        key = 'beds' if e['group'] == 'bed' else 'other'
        t = totals.setdefault(key, {'webm': 0, 'm4a': 0})
        for fmt in ('webm', 'm4a'):
            t[fmt] += e['bytes'][fmt]
    for key, t in totals.items():
        print(f"total {key}: webm {t['webm'] / 1e6:.3f} MB, m4a {t['m4a'] / 1e6:.3f} MB")
    print(f'wrote {os.path.relpath(CATALOG_PATH, ROOT)} ({len(catalog)} clips)')


if __name__ == '__main__':
    main()
