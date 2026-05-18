import { SPECIES } from '../data/species'

const DEPTH_LABELS = {
  epipelagic: 'Sunlight Zone',
  mesopelagic: 'Twilight Zone',
  bathypelagic: 'Midnight Zone',
  abyssalpelagic: 'Abyssal Zone',
  hadalpelagic: 'Hadal Zone',
  shallow: 'Shallow Water',
  mid: 'Mid Water',
  deep: 'Deep Water',
  benthic: 'Benthic Floor',
}

const SPECIES_BY_NAME = new Map(SPECIES.map(species => [species.name, species]))

const styles = {
  wrap: {
    position: 'absolute',
    right: 'clamp(1rem, 4vw, 2.25rem)',
    bottom: 'clamp(4.75rem, 7vh, 6.5rem)',
    width: 'min(22rem, calc(100vw - 2rem))',
    color: '#f5fbff',
    padding: '1rem',
    borderRadius: '20px',
    border: '1px solid rgba(168,225,255,0.22)',
    background: 'linear-gradient(150deg, rgba(3,18,38,0.9), rgba(2,38,56,0.76))',
    boxShadow: '0 24px 70px rgba(0, 8, 24, 0.42), inset 0 1px 0 rgba(255,255,255,0.08)',
    backdropFilter: 'blur(16px)',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
    pointerEvents: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    alignItems: 'flex-start',
  },
  eyebrow: {
    margin: 0,
    color: 'rgba(170,225,255,0.64)',
    fontSize: '0.62rem',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
  },
  title: {
    margin: '0.22rem 0 0',
    fontSize: 'clamp(1.25rem, 4.8vw, 1.8rem)',
    lineHeight: 1,
    fontWeight: 720,
    letterSpacing: '-0.035em',
  },
  close: {
    width: 34,
    height: 34,
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.07)',
    color: 'rgba(245,252,255,0.86)',
    fontSize: '1.15rem',
    cursor: 'pointer',
    lineHeight: 1,
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.42rem',
    marginTop: '0.9rem',
  },
  chip: {
    border: '1px solid rgba(168,225,255,0.18)',
    background: 'rgba(105,200,255,0.1)',
    color: 'rgba(226,246,255,0.86)',
    padding: '0.28rem 0.52rem',
    borderRadius: 999,
    fontSize: '0.68rem',
    letterSpacing: '0.045em',
    textTransform: 'uppercase',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.55rem',
    marginTop: '0.95rem',
  },
  speciesDescription: {
    margin: '0.9rem 0 0',
    color: 'rgba(226,246,255,0.76)',
    fontSize: '0.84rem',
    lineHeight: 1.45,
  },
  individualDescription: {
    margin: '0.72rem 0 0',
    color: 'rgba(232,244,250,0.62)',
    fontSize: '0.78rem',
    fontStyle: 'italic',
    lineHeight: 1.4,
  },
  stat: {
    borderRadius: 14,
    padding: '0.62rem 0.68rem',
    background: 'rgba(0, 9, 24, 0.28)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  label: {
    margin: 0,
    color: 'rgba(190,226,245,0.52)',
    fontSize: '0.61rem',
    letterSpacing: '0.13em',
    textTransform: 'uppercase',
  },
  value: {
    margin: '0.2rem 0 0',
    color: 'rgba(255,255,255,0.92)',
    fontSize: '0.86rem',
    fontWeight: 620,
    overflowWrap: 'anywhere',
  },
  footer: {
    margin: '0.85rem 0 0',
    color: 'rgba(210,235,245,0.48)',
    fontSize: '0.68rem',
    lineHeight: 1.35,
  },
}

function formatBornAt(value) {
  if (!value) return 'Unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function fallbackIndividualDescription() {
  return 'this one poops a lot'
}

function Stat({ label, value }) {
  return (
    <div style={styles.stat}>
      <p style={styles.label}>{label}</p>
      <p style={styles.value}>{value}</p>
    </div>
  )
}

export default function InfoCard({ creature, onClose }) {
  const species = SPECIES_BY_NAME.get(creature.species)
  const depthLabel = DEPTH_LABELS[creature.depthZone] ?? creature.depthZone ?? 'Unknown zone'
  const individualDescription = creature.description?.trim() || fallbackIndividualDescription(creature)

  return (
    <section style={styles.wrap} aria-label={`${creature.species} details`}>
      <div style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Focused creature</p>
          <h2 style={styles.title}>{creature.species}</h2>
        </div>
        <button type="button" style={styles.close} onClick={onClose} aria-label="Close focus card">×</button>
      </div>

      <div style={styles.chips}>
        <span style={styles.chip}>{depthLabel}</span>
        <span style={styles.chip}>{species?.schooling ? 'Schooling' : 'Solo'}</span>
        {species?.predator && <span style={styles.chip}>Predator</span>}
        {species?.aggressive && <span style={styles.chip}>Aggressive</span>}
      </div>

      {species?.description && <p style={styles.speciesDescription}>{species.description}</p>}
      <p style={styles.individualDescription}>{individualDescription}</p>

      <div style={styles.grid}>
        <Stat label="ID" value={creature.id} />
        <Stat label="Born" value={formatBornAt(creature.bornAt)} />
      </div>

      <p style={styles.footer}>Tap another fish to switch focus. Tap empty water or × to release.</p>
    </section>
  )
}
