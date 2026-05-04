import { useState } from 'react'

export default function BiomeMenu({ biomes, onSelect }) {
  const [hoveredId, setHoveredId] = useState(null)

  return (
    <div style={{
      width: '100vw', minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 30%, #0b3d6e 0%, #061a2e 55%, #030d17 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: '#e0f0ff',
      overflowY: 'auto', padding: '2rem 1rem',
    }}>
      <header style={{ textAlign: 'center', margin: '2rem 0 3rem' }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 750, letterSpacing: '-0.02em' }}>
          Choose a Biome
        </h1>
        <p style={{ marginTop: '0.45rem', fontSize: '0.85rem', color: 'rgba(160, 200, 230, 0.5)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Select a tank to explore
        </p>
      </header>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.25rem', width: 'min(900px, 100%)', maxWidth: '100%',
      }}>
        {biomes.map(biome => {
          const isHovered = hoveredId === biome.id
          return (
            <button key={biome.id} onClick={() => onSelect(biome.id)} onMouseEnter={() => setHoveredId(biome.id)} onMouseLeave={() => setHoveredId(null)} style={{
              background: `linear-gradient(160deg, ${biome.color}cc 0%, ${biome.color}44 100%)`,
              border: `1px solid ${isHovered ? biome.accent + '88' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 20, padding: '2rem 1.5rem', cursor: 'pointer', textAlign: 'left', color: '#e0f0ff',
              fontFamily: 'inherit', transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
              transform: isHovered ? 'translateY(-4px) scale(1.02)' : 'translateY(0) scale(1)',
              boxShadow: isHovered ? `0 12px 40px ${biome.color}55, inset 0 1px 0 rgba(255,255,255,0.1)` : '0 4px 16px rgba(0,0,0,0.3)',
              backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: 210,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '2rem' }}>{biome.icon}</span>
                <div>
                  <div style={{ fontWeight: 750, fontSize: '1.15rem', letterSpacing: '-0.01em' }}>{biome.name}</div>
                  <div style={{ fontSize: '0.78rem', color: biome.accent, opacity: 0.85, marginTop: 2 }}>{biome.tagline}</div>
                </div>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'rgba(220, 240, 255, 0.55)', lineHeight: 1.5 }}>{biome.description}</div>
              <div style={{ marginTop: 'auto', fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'right' }}>
                Enter →
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
