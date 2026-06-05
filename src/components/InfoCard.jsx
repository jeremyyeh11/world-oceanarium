import { DEPTH_ZONES, SPECIES } from '../data/species'
import { creatureBodyLengthMeters } from '../utils/speciesLookup'

const SPECIES_BY_NAME = new Map(SPECIES.map(species => [species.name, species]))
const DEPTH_ZONE_BY_ID = new Map(DEPTH_ZONES.map(zone => [zone.id, zone]))
const DEFAULT_MASS = {
  coefficient: 0.008,
  exponent: 3,
}

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
    color: 'rgba(210,235,245,0.62)',
    fontSize: '0.78rem',
    fontWeight: 560,
    letterSpacing: '0.01em',
  },
  title: {
    margin: '0.22rem 0 0',
    fontSize: 'clamp(1.25rem, 4.8vw, 1.8rem)',
    lineHeight: 1,
    fontWeight: 720,
    letterSpacing: '-0.035em',
  },
  scientificName: {
    margin: '0.38rem 0 0',
    color: 'rgba(210,235,245,0.62)',
    fontSize: '0.78rem',
    fontStyle: 'italic',
    letterSpacing: '0.01em',
  },
  nameTag: {
    display: 'inline-flex',
    alignItems: 'center',
    width: 'fit-content',
    marginTop: '0.58rem',
    border: '1px solid rgba(127, 255, 214, 0.42)',
    background: 'linear-gradient(135deg, rgba(21, 214, 176, 0.24), rgba(92, 164, 255, 0.16))',
    color: 'rgba(232, 255, 248, 0.95)',
    boxShadow: '0 0 18px rgba(38, 225, 185, 0.12)',
    padding: '0.32rem 0.62rem',
    borderRadius: 999,
    fontSize: '0.78rem',
    fontWeight: 700,
    letterSpacing: '0.035em',
  },
  close: {
    display: 'inline-grid',
    placeItems: 'center',
    width: 34,
    height: 34,
    padding: 0,
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.07)',
    color: 'rgba(245,252,255,0.86)',
    cursor: 'pointer',
  },
  closeIcon: {
    width: 15,
    height: 15,
    display: 'block',
    overflow: 'visible',
    stroke: 'currentColor',
    strokeWidth: 2.35,
    strokeLinecap: 'round',
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
  encyclopediaButton: {
    width: '100%',
    marginTop: '0.9rem',
    border: '1px solid rgba(125, 249, 255, 0.34)',
    borderRadius: 999,
    background: 'rgba(55, 186, 218, 0.13)',
    color: 'rgba(235, 253, 255, 0.92)',
    padding: '0.72rem 0.9rem',
    fontSize: '0.72rem',
    fontWeight: 760,
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
    cursor: 'pointer',
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function namedIndividualDescription(creature, customName) {
  const rawDescription = creature.description?.trim()
  if (!customName) return rawDescription || fallbackIndividualDescription(creature)
  if (!rawDescription) return `${customName} poops a lot`

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
  const depthLabel = depthZone?.label ?? creature.depthZone ?? 'Unknown zone'
  const customName = creature.customName?.trim()
  const individualDescription = namedIndividualDescription(creature, customName)
  const lengthMeters = bodyLengthMeters(creature, species)
  const massKg = estimateMassKg(lengthMeters, species)

  return (
    <section className="info-card" style={styles.wrap} aria-label={`${creature.species} details`}>
      <div style={styles.header}>
        <div>
          <p style={styles.eyebrow}>ID: {creature.id}</p>
          <h2 style={styles.title}>{creature.species}</h2>
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
        <Stat label="Body length" value={formatLength(lengthMeters)} />
        <Stat label="Weight" value={formatMass(massKg)} />
      </div>
      {onOpenEncyclopedia && (
        <button
          type="button"
          style={styles.encyclopediaButton}
          onClick={() => onOpenEncyclopedia(species?.id)}
        >
          Open in THE ATLAS
        </button>
      )}
      {children}
    </section>
  )
}
