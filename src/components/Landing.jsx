import { useEffect, useMemo, useState } from 'react'

export default function Landing({ onEnter }) {
  const [visible, setVisible] = useState(false)
  const bubbles = useMemo(() => Array.from({ length: 14 }, (_, i) => ({
    id: i,
    size: 6 + Math.random() * 12,
    left: 8 + Math.random() * 84,
    delay: Math.random() * 7,
    duration: 9 + Math.random() * 9,
    drift: (Math.random() - 0.5) * 50,
  })), [])

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'radial-gradient(ellipse at 50% 30%, #0b3d6e 0%, #061a2e 55%, #030d17 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      color: '#e0f0ff', overflow: 'hidden', position: 'relative',
    }}>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {bubbles.map(b => (
          <div key={b.id} style={{
            position: 'absolute', width: b.size, height: b.size, borderRadius: '50%',
            background: 'rgba(120, 200, 255, 0.08)', left: `${b.left}%`, bottom: '-10%',
            animation: `bubbleUp-${b.id} ${b.duration}s linear infinite`, animationDelay: `${b.delay}s`,
          }} />
        ))}
      </div>

      <div style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.8s ease, transform 0.8s ease',
        textAlign: 'center', zIndex: 1, padding: '0 1rem',
      }}>
        <h1 style={{
          margin: 0, fontSize: 'clamp(2.5rem, 7vw, 4.5rem)', fontWeight: 800,
          letterSpacing: '-0.03em', lineHeight: 1.05,
          background: 'linear-gradient(180deg, #e0f4ff 0%, #7cc9ff 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>
          World Oceanarium
        </h1>
        <p style={{
          margin: '0.65rem 0 3rem', fontSize: 'clamp(0.85rem, 2vw, 1.05rem)',
          color: 'rgba(160, 200, 230, 0.6)', letterSpacing: '0.12em', textTransform: 'uppercase',
        }}>
          Virtual Aquatic Ecosystems
        </p>
        <button onClick={onEnter} style={{
          background: 'linear-gradient(180deg, #4db8ff 0%, #1a7acc 100%)', border: 0, color: '#fff',
          padding: '16px 52px', borderRadius: '60px', fontSize: '1rem', fontWeight: 700,
          letterSpacing: '0.06em', cursor: 'pointer',
          boxShadow: '0 8px 32px rgba(30, 120, 200, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
        }}>
          DIVE IN
        </button>
      </div>

      <style>{bubbles.map(b => `
        @keyframes bubbleUp-${b.id} {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 0.6; }
          100% { transform: translateY(-112vh) translateX(${b.drift}px); opacity: 0; }
        }
      `).join('\n')}</style>
    </div>
  )
}
