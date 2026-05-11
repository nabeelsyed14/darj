import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './i18n'
import 'antd/dist/reset.css'
import './styles/globals.css'
import './styles/tiles.css'
import './styles/glass.css'
import './styles/animations.css'

window.onerror = (msg, url, line, col, error) => {
  console.error('RENDERER ERROR:', msg, url, line, col, error?.stack)
  if (window.api?.app?.logError) {
    window.api.app.logError(String(msg) + ' at ' + url + ':' + line + ':' + col)
  }
  return false
}

window.onunhandledrejection = (event) => {
  console.error('RENDERER UNHANDLED REJECTION:', event.reason)
  if (window.api?.app?.logError) {
    window.api.app.logError('Unhandled rejection: ' + String(event.reason))
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: '#6366F1',
            colorSuccess: '#0D9488',
            colorWarning: '#F59E0B',
            colorError: '#EF4444',
            borderRadius: 12,
            borderRadiusLG: 16,
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            fontSize: 15,
            lineHeight: 1.6,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 6px 16px rgba(79,70,229,0.08)',
            boxShadowSecondary: '0 4px 12px rgba(0,0,0,0.04), 0 12px 32px rgba(79,70,229,0.12)',
            motionDurationSlow: '0.3s',
            motionEaseInOut: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            colorBgContainer: '#FFFFFF',
            colorBgElevated: '#FFFFFF',
            colorBorderSecondary: 'rgba(226,232,240,0.8)'
          },
          components: {
            Card: {
              borderRadiusLG: 16
            },
            Table: {
              borderRadiusLG: 12,
              headerBg: 'rgba(79,70,229,0.04)'
            },
            Button: {
              borderRadius: 10,
              controlHeight: 38,
              fontWeight: 600
            },
            Input: {
              borderRadius: 10,
              controlHeight: 38
            },
            Select: {
              borderRadius: 10,
              controlHeight: 38
            },
            Menu: {
              itemBorderRadius: 10,
              itemMarginInline: 8
            }
          }
        }}
      >
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </ConfigProvider>
    </HashRouter>
  </React.StrictMode>
)
