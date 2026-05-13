import { useState } from 'react'
import logoImg from '../assets/logo.png'

interface AppLogoProps {
  size?: number
  radius?: number
  centered?: boolean
  light?: boolean
}

export default function AppLogo({ size = 48, radius = 14, centered = true, light = false }: AppLogoProps) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div style={{ textAlign: centered ? 'center' : undefined }}>
        <div style={{
          borderRadius: radius, background: light ? 'rgba(255,255,255,0.15)' : 'rgba(99,102,241,0.12)',
          padding: `${Math.max(6, size * 0.14)}px ${Math.max(10, size * 0.2)}px`, display: 'inline-block'
        }}>
          <span style={{
            color: light ? '#fff' : '#2A6372', fontSize: size * 0.38, fontWeight: 800,
            letterSpacing: 3, textShadow: light ? '0 0 20px rgba(255,255,255,0.3)' : '0 0 10px rgba(67,56,202,0.15)'
          }}>DARJ</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ textAlign: centered ? 'center' : undefined }}>
      <img src={logoImg} onError={() => setFailed(true)} alt="Darj"
        style={{
          width: size, height: size, borderRadius: radius, objectFit: 'cover',
          border: light ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(99,102,241,0.18)',
          boxShadow: light ? '0 2px 8px rgba(0,0,0,0.2)' : '0 4px 14px rgba(67,56,202,0.14)',
          display: centered ? 'block' : 'inline-block',
          margin: centered ? '0 auto' : undefined
        }}
      />
    </div>
  )
}
