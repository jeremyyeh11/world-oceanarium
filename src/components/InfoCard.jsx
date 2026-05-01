const styles = {
  wrap: {
    position: 'absolute', bottom: '5rem', left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(0,10,30,0.88)', color: '#fff', padding: '1.5rem 2rem',
    borderRadius: '12px', backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.1)', minWidth: '260px',
    fontFamily: 'system-ui, sans-serif', pointerEvents: 'auto',
  },
  close: {
    position: 'absolute', top: '0.6rem', right: '0.9rem',
    background: 'none', border: 'none', color: '#fff',
    fontSize: '1.3rem', cursor: 'pointer', opacity: 0.6,
  },
  title: { margin: '0 0 0.4rem', fontSize: '1.15rem', fontWeight: 600 },
  meta:  { margin: '0.2rem 0 0', opacity: 0.55, fontSize: '0.82rem' },
}

export default function InfoCard({ creature, onClose }) {
  return (
    <div style={styles.wrap}>
      <button style={styles.close} onClick={onClose}>×</button>
      <h2 style={styles.title}>{creature.species}</h2>
      <p style={styles.meta}>ID: {creature.id}</p>
      <p style={styles.meta}>Zone: {creature.depthZone}</p>
      <p style={styles.meta}>Born: {new Date(creature.bornAt).toLocaleDateString()}</p>
      <p style={styles.meta}>Generation: {creature.generation ?? 0}</p>
    </div>
  )
}
