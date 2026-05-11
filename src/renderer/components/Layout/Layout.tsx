import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout as AntLayout, Menu } from 'antd'
import {
  TeamOutlined,
  ApartmentOutlined,
  CalendarOutlined,
  FileTextOutlined,
  ArrowUpOutlined,
  ClockCircleOutlined,
  BarChartOutlined,
  SettingOutlined,
  DownloadOutlined,
  LogoutOutlined
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useModuleStore } from '../../store/moduleStore'
import { useAuthStore } from '../../store/authStore'
import { useUiStore } from '../../store/uiStore'
import TitleBar from './TitleBar'

const { Sider, Content } = AntLayout

export default function Layout() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { attendance, marks, promotions } = useModuleStore()
  const { logout } = useAuthStore()
  const { setCurrentPage } = useUiStore()

  const menuItems = [
    { key: '/students', icon: <TeamOutlined />, label: t('sidebar.students') },
    { key: '/classes', icon: <ApartmentOutlined />, label: t('sidebar.classes') },
    ...(attendance ? [{ key: '/attendance', icon: <CalendarOutlined />, label: t('sidebar.attendance') }] : []),
    ...(marks ? [{ key: '/marks', icon: <FileTextOutlined />, label: t('sidebar.marks') }] : []),
    ...(promotions ? [{ key: '/promotions', icon: <ArrowUpOutlined />, label: t('sidebar.promotions') }] : []),
    { key: '/yearEnd', icon: <ClockCircleOutlined />, label: t('sidebar.yearEnd') },
    { key: '/analytics', icon: <BarChartOutlined />, label: t('sidebar.analytics') },
    { key: '/export', icon: <DownloadOutlined />, label: t('sidebar.export') },
    { key: '/settings', icon: <SettingOutlined />, label: t('sidebar.settings') }
  ]

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === '/logout') {
      logout()
      navigate('/')
    } else {
      setCurrentPage(key.slice(1) as any)
      navigate(key)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TitleBar />
      <AntLayout style={{ flex: 1, overflow: 'hidden' }}>
      <Sider width={240} style={{
        background: 'linear-gradient(180deg, #4338CA 0%, #7C3AED 100%)',
        borderRight: 'none'
      }}>
        <div style={{ padding: '28px 16px 20px', textAlign: 'center' }}>
          <div style={{ borderRadius: 14, background: 'rgba(255,255,255,0.15)', padding: '8px 14px', display: 'inline-block' }}>
            <span style={{ color: '#fff', fontSize: 22, fontWeight: 700, letterSpacing: 3, textShadow: '0 0 20px rgba(255,255,255,0.3)' }}>DARJ</span>
          </div>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={[...menuItems, { type: 'divider' as const }, { key: '/logout', icon: <LogoutOutlined />, label: t('sidebar.logout') }]}
          onClick={handleMenuClick}
          style={{ background: 'transparent', borderRight: 'none' }}
          theme="dark"
        />
      </Sider>
      <AntLayout style={{ background: '#FAFAFA', overflow: 'hidden' }}>
        <Content style={{ margin: '24px', minHeight: 280, overflowY: 'auto', height: '100%', paddingRight: 8 }}>
          <div className="page-content">
            <Outlet />
          </div>
        </Content>
      </AntLayout>
      </AntLayout>
    </div>
  )
}
