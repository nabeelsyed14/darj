import { useEffect, useState } from 'react'
import { Space } from 'antd'
import { MinusOutlined, BorderOutlined, CloseOutlined, BlockOutlined } from '@ant-design/icons'

const css = (s: Record<string, any>): React.CSSProperties => s as React.CSSProperties

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    window.api?.app?.isMaximized().then(setIsMaximized)
    window.api?.app?.onMaximizeChange(setIsMaximized)
  }, [])

  return (
    <div style={css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      height: 38,
      background: '#1E1B2E',
      WebkitAppRegion: 'drag',
      paddingLeft: 16,
      userSelect: 'none',
      borderBottom: '1px solid rgba(255,255,255,0.08)'
    })}>
      <span style={{ color: 'rgba(255,255,255,0.95)', fontSize: 13, fontWeight: 600, letterSpacing: 1 }}>Darj</span>
      <Space style={css({ WebkitAppRegion: 'no-drag' })}>
        {[
          { icon: <MinusOutlined style={{ fontSize: 10 }} />, action: () => window.api?.app?.minimize() },
          { icon: isMaximized ? <BlockOutlined style={{ fontSize: 10 }} /> : <BorderOutlined style={{ fontSize: 10 }} />, action: () => window.api?.app?.maximize() },
          { icon: <CloseOutlined style={{ fontSize: 10 }} />, action: () => window.api?.app?.close() }
        ].map((btn, i) => (
          <div key={i} onClick={btn.action} style={css({
            width: 46, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.7)', cursor: 'pointer', transition: 'background 0.15s',
            WebkitAppRegion: 'no-drag'
          })}>
            {btn.icon}
          </div>
        ))}
      </Space>
    </div>
  )
}
