const arrowBtn = {
  background: 'rgba(0,10,30,0.65)',
  border: '1px solid rgba(255,255,255,0.15)',
  color: '#fff', fontSize: '1.4rem',
  width: '44px', height: '44px', borderRadius: '50%',
  cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center',
  backdropFilter: 'blur(6px)',
}

export default function UI({ biomeIndex, biomeCount, biomeNames, onPrev, onNext, scrollY }) {
  // scrollY: 0 = top (surface), 1 = bottom (floor)
  const thumbTop = `${(1 - scrollY) * 80 + 10}%`

  return (
    <>
      {/* Biome label */}
      <div style={{
        position: 'absolute', top: '1.5rem', left: '50%', transform: 'translateX(-50%)',
        color: 'rgba(255,255,255,0.7)', fontFamily: 'system-ui, sans-serif',
        fontSize: '0.85rem', letterSpacing: '0.15em', textTransform: 'uppercase',
        pointerEvents: 'none',
      }}>
        {biomeNames[biomeIndex]}
      </div>

      {/* Left arrow — middle left */}
      <button style={{ ...arrowBtn, position: 'absolute', left: '1.5rem', top: '50%', transform: 'translateY(-50%)' }} onClick={onPrev}>◀</button>

      {/* Right arrow — middle right */}
      <button style={{ ...arrowBtn, position: 'absolute', right: '1.5rem', top: '50%', transform: 'translateY(-50%)' }} onClick={onNext}>▶</button>

      {/* Depth scroll indicator */}
      <div style={{
        position: 'absolute', right: '4rem', top: '10%', height: '80%',
        width: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px',
      }}>
        <div style={{
          position: 'absolute', left: '-3px', width: '10px', height: '10px',
          borderRadius: '50%', background: 'rgba(255,255,255,0.6)',
          top: thumbTop, transform: 'translateY(-50%)',
          transition: 'top 0.1s ease',
        }} />
        <div style={{ position: 'absolute', top: '-1.2rem', right: '-0.5rem', color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem', fontFamily: 'system-ui' }}>↑</div>
        <div style={{ position: 'absolute', bottom: '-1.2rem', right: '-0.5rem', color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem', fontFamily: 'system-ui' }}>↓</div>
      </div>
    </>
  )
}
