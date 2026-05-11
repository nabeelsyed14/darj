import { useState } from 'react'

interface AppLogoProps {
  size?: number
  radius?: number
  centered?: boolean
}

export default function AppLogo({ size = 80, radius = 20, centered = true }: AppLogoProps) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div style={{ textAlign: centered ? 'center' : undefined }}>
        <div style={{ borderRadius: 14, background: 'rgba(99,102,241,0.12)', padding: `${size * 0.125}px ${size * 0.175}px`, display: 'inline-block' }}>
          <span style={{ color: '#4338CA', fontSize: size * 0.35, fontWeight: 800, letterSpacing: 4, textShadow: '0 0 10px rgba(67,56,202,0.15)' }}>DARJ</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ textAlign: centered ? 'center' : undefined }}>
      <img src="/logo.png" onError={() => setFailed(true)}
        alt="Darj"
        style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover', display: centered ? 'block' : undefined, margin: centered ? '0 auto 12px' : undefined }}
      />
    </div>
  )
}
