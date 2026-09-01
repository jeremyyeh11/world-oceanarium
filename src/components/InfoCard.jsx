import { creatureBodyLengthMeters, DEPTH_ZONE_BY_ID, SPECIES_BY_NAME } from '../utils/speciesLookup'

const DEFAULT_MASS = {
  coefficient: 0.008,
  exponent: 3,
}

const styles = {
  wrap: {
    position: 'absolute',
    // Keep above the screen-space water overlays (.tank-top-exposure / .tank-depth-absorption, z 4).
    zIndex: 30,
    right: 'clamp(0.75rem, 3vw, 2.25rem)',
    bottom: 'clamp(4.75rem, 7vh, 6.5rem)',
    width: 'min(25rem, calc(100vw - 1.5rem))',
    color: 'var(--crt-foam)',
    padding: '1rem',
    borderRadius: 0,
    border: 0,
    background:
      'var(--crt-scanlines-soft), linear-gradient(180deg, var(--crt-hull-lit) 0 4px, rgba(6,26,44,0.94) 4px)',
    boxShadow:
      '0 0 0 1px var(--crt-rule), 0 0 32px rgba(127,220,242,0.1), 0 18px 48px rgba(2,6,13,0.45)',
    backdropFilter: 'none',
    fontFamily: 'var(--crt-font)',
    pointerEvents: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.7rem',
    alignItems: 'flex-start',
  },
  identity: {
    flex: '1 1 auto',
    minWidth: 0,
  },
  // Pixelify Sans sits close to a normal UI x-height and ships 400-700, so
  // sizes stay near their originals and emphasis is carried by weight rather
  // than by the glow the single-weight first pass had to fake it with.
  eyebrow: {
    margin: 0,
    color: 'var(--crt-lumen)',
    fontSize: '0.78rem',
    fontWeight: 500,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
  },
  title: {
    margin: '0.22rem 0 0',
    minWidth: 0,
    fontSize: 'clamp(1.2rem, 4.2vw, 1.6rem)',
    lineHeight: 1.05,
    fontWeight: 700,
    letterSpacing: '0.01em',
    textTransform: 'uppercase',
    textShadow: '-1px 1px 1px rgba(240,127,164,0.4), 1px -1px 1px rgba(127,220,242,0.4), 0 0 16px rgba(127,220,242,0.18)',
    whiteSpace: 'nowrap',
  },
  titleLine: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    minWidth: 0,
    width: 'fit-content',
    maxWidth: '100%',
  },
  atlasIconButton: {
    display: 'inline-grid',
    placeItems: 'center',
    flex: '0 0 auto',
    width: 32,
    height: 32,
    padding: 0,
    marginTop: '0.12rem',
    borderRadius: 0,
    border: 0,
    background: 'rgba(13, 48, 80, 0.7)',
    color: 'var(--crt-lumen)',
    boxShadow: 'inset 0 0 0 1px var(--crt-rule)',
    cursor: 'pointer',
  },
  atlasIcon: {
    width: 18,
    height: 18,
    display: 'block',
    overflow: 'visible',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'square',
    strokeLinejoin: 'miter',
  },
  scientificName: {
    margin: '0.38rem 0 0',
    color: 'var(--crt-drift)',
    fontSize: '0.8rem',
    fontStyle: 'italic',
    letterSpacing: '0.02em',
  },
  nameTag: {
    display: 'inline-flex',
    alignItems: 'center',
    width: 'fit-content',
    marginTop: '0.58rem',
    border: 0,
    background: 'var(--crt-amber)',
    color: 'var(--crt-void)',
    boxShadow: '0 0 14px rgba(240,205,140,0.25)',
    padding: '0.3rem 0.62rem 0.18rem',
    borderRadius: 0,
    fontSize: '0.78rem',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  close: {
    display: 'inline-grid',
    placeItems: 'center',
    width: 34,
    height: 34,
    padding: 0,
    borderRadius: 0,
    border: 0,
    background: 'rgba(4, 16, 28, 0.85)',
    boxShadow: 'inset 0 0 0 1px var(--crt-rule)',
    color: 'var(--crt-drift)',
    cursor: 'pointer',
  },
  closeIcon: {
    width: 15,
    height: 15,
    display: 'block',
    overflow: 'visible',
    stroke: 'currentColor',
    strokeWidth: 2.5,
    strokeLinecap: 'square',
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.42rem',
    marginTop: '0.9rem',
  },
  chip: {
    border: 0,
    background: 'rgba(4, 16, 28, 0.85)',
    boxShadow: 'inset 0 0 0 1px var(--crt-rule)',
    color: 'var(--crt-lumen)',
    padding: '0.26rem 0.52rem',
    borderRadius: 0,
    fontFamily: 'var(--crt-font-tiny)',
    fontSize: '0.7rem',
    fontWeight: 500,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  facts: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.44rem',
    marginTop: '0.9rem',
  },
  fact: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    columnGap: '0.42rem',
    alignItems: 'baseline',
    minWidth: 0,
    borderRadius: 0,
    padding: '0.46rem 0.54rem 0.34rem',
    background: 'rgba(2, 10, 20, 0.5)',
    border: 0,
    boxShadow: 'inset 0 0 0 1px rgba(23, 70, 107, 0.7)',
  },
  factLabel: {
    color: 'var(--crt-drift-dim)',
    fontFamily: 'var(--crt-font-tiny)',
    fontSize: '0.62rem',
    fontWeight: 600,
    letterSpacing: '0.13em',
    textTransform: 'uppercase',
  },
  factValue: {
    color: 'var(--crt-foam)',
    fontSize: '0.8rem',
    fontWeight: 400,
    letterSpacing: '0.01em',
    overflowWrap: 'anywhere',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.55rem',
    marginTop: '0.95rem',
  },
  individualDescription: {
    margin: '0.72rem 0 0',
    color: 'var(--crt-drift)',
    fontSize: '0.8rem',
    fontStyle: 'italic',
    lineHeight: 1.4,
  },
  stat: {
    borderRadius: 0,
    padding: '0.58rem 0.68rem 0.46rem',
    background: 'rgba(2, 10, 20, 0.55)',
    border: 0,
    boxShadow: 'inset 0 0 0 1px rgba(23, 70, 107, 0.7)',
  },
  label: {
    margin: 0,
    color: 'var(--crt-drift-dim)',
    fontFamily: 'var(--crt-font-tiny)',
    fontSize: '0.65rem',
    fontWeight: 600,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
  },
  value: {
    margin: '0.18rem 0 0',
    color: 'var(--crt-foam)',
    fontSize: '0.88rem',
    fontWeight: 400,
    letterSpacing: '0.01em',
    overflowWrap: 'anywhere',
  },
}

function formatBornAt(value) {
  if (!value) return 'Unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function fallbackIndividualDescription() {
  return 'No individual notes yet.'
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function namedIndividualDescription(creature, customName) {
  const rawDescription = creature.description?.trim()
  if (!customName) return rawDescription || fallbackIndividualDescription(creature)
  if (!rawDescription) return `${customName}: No individual notes yet.`

  const namePattern = new RegExp(`\\b${escapeRegExp(customName)}\\b`, 'i')
  if (namePattern.test(rawDescription)) return rawDescription

  const speciesName = creature.species?.trim()
  if (!speciesName) return `${customName}: ${rawDescription}`

  const speciesPattern = new RegExp(`\\b${escapeRegExp(speciesName)}\\b`, 'gi')
  if (speciesPattern.test(rawDescription)) {
    return rawDescription.replace(speciesPattern, customName)
  }

  return `${customName}: ${rawDescription}`
}

function bodyLengthMeters(creature, species) {
  return creatureBodyLengthMeters(creature, species?.swim?.bodyLengthWU)
}

function estimateMassKg(lengthMeters, species) {
  const mass = species?.mass ?? DEFAULT_MASS
  const lengthCm = lengthMeters * 100
  const coefficient = mass.coefficient ?? DEFAULT_MASS.coefficient
  const exponent = mass.exponent ?? DEFAULT_MASS.exponent
  return (coefficient * (lengthCm ** exponent)) / 1000
}

function formatLength(lengthMeters) {
  if (!Number.isFinite(lengthMeters) || lengthMeters <= 0) return 'Unknown'
  if (lengthMeters < 1) return `${(lengthMeters * 100).toFixed(1)} cm`
  return `${lengthMeters.toFixed(lengthMeters < 10 ? 1 : 0)} m`
}

function formatMass(massKg) {
  if (!Number.isFinite(massKg) || massKg <= 0) return 'Unknown'
  if (massKg < 1) return `${(massKg * 1000).toFixed(1)} g`
  return `${massKg.toFixed(massKg < 10 ? 1 : 0)} kg`
}

function formatSex(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (normalized === 'male') return 'Male'
  if (normalized === 'female') return 'Female'
  return null
}

function compactDepthLabel(depthZone, fallback) {
  return depthZone?.shortLabel ?? depthZone?.name ?? fallback ?? 'Unknown'
}

function Stat({ label, value }) {
  return (
    <div style={styles.stat}>
      <p style={styles.label}>{label}</p>
      <p style={styles.value}>{value}</p>
    </div>
  )
}

export default function InfoCard({ creature, onClose, onOpenEncyclopedia, children }) {
  const species = SPECIES_BY_NAME.get(creature.species)
  const depthZone = DEPTH_ZONE_BY_ID.get(creature.depthZone)
  const depthLabel = compactDepthLabel(depthZone, creature.depthZone)
  const customName = creature.customName?.trim()
  const canOpenAtlas = Boolean(onOpenEncyclopedia && species && !species.hiddenInAtlas)
  const individualDescription = namedIndividualDescription(creature, customName)
  const lengthMeters = bodyLengthMeters(creature, species)
  const massKg = estimateMassKg(lengthMeters, species)
  const sexLabel = formatSex(creature.sex)

  return (
    <section className="info-card" style={styles.wrap} aria-label={`${creature.species} details`}>
      <div style={styles.header}>
        <div style={styles.identity}>
          <p style={styles.eyebrow}>ID: {creature.id}</p>
          <div style={styles.titleLine}>
            <h2 style={styles.title}>{creature.species}</h2>
            {canOpenAtlas && (
              <button
                type="button"
                className="info-card-atlas-icon"
                style={styles.atlasIconButton}
                onClick={() => onOpenEncyclopedia(species?.id)}
                aria-label="Open in The Atlas"
                title="Open in The Atlas"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false" style={styles.atlasIcon}>
                  <path d="M5 5.5c1.8-.9 4.2-.9 6 0v13c-1.8-.9-4.2-.9-6 0v-13Z" />
                  <path d="M13 5.5c1.8-.9 4.2-.9 6 0v13c-1.8-.9-4.2-.9-6 0v-13Z" />
                  <path d="M11 5.5v13M13 5.5v13" />
                </svg>
              </button>
            )}
          </div>
          {customName && <div style={styles.nameTag}>{customName}</div>}
          {species?.scientificName && <p style={styles.scientificName}>{species.scientificName}</p>}
        </div>
        <button type="button" style={styles.close} onClick={onClose} aria-label="Close focus card">
          <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false" style={styles.closeIcon}>
            <path d="M7 7l10 10M17 7L7 17" />
          </svg>
        </button>
      </div>

      <div style={styles.chips}>
        <span style={styles.chip}>{depthLabel}</span>
        {species?.family && <span style={styles.chip}>{species.family}</span>}
        {species?.predator && <span style={styles.chip}>Predator</span>}
        {species?.aggressive && <span style={styles.chip}>Aggressive</span>}
      </div>


      <p style={styles.individualDescription}>{individualDescription}</p>

      <div style={styles.grid}>
        <Stat label="Born" value={formatBornAt(creature.bornAt)} />
        <Stat label="Length" value={formatLength(lengthMeters)} />
        <Stat label="Mass" value={formatMass(massKg)} />
        {sexLabel && <Stat label="Sex" value={sexLabel} />}
      </div>
      {children}
    </section>
  )
}
