import { useState } from 'react'
import { Form, Input, Button, Card, Typography, message, Divider } from 'antd'
import { LockOutlined, KeyOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import AppLogo from '../AppLogo'

const { Text } = Typography

interface LoginProps {
  onLogin: () => void
}

export default function Login({ onLogin }: LoginProps) {
  const { t } = useTranslation()
  const [showRecovery, setShowRecovery] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (values: { password: string }) => {
    setLoading(true)
    const valid = await window.api.auth.verifyLogin(values.password)
    setLoading(false)
    if (valid) {
      onLogin()
    } else {
      message.error(t('login.wrongPassword'))
    }
  }

  const handleRecovery = async (values: { recoveryKey: string; newPassword: string; confirmPassword: string }) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error(t('login.passwordsMismatch'))
      return
    }
    setLoading(true)
    const success = await window.api.auth.resetPassword(values.recoveryKey, values.newPassword)
    setLoading(false)
    if (success) {
      message.success(t('common.success'))
      setShowRecovery(false)
    } else {
      message.error(t('login.wrongRecoveryKey'))
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f5f5f5' }}>
      <Card style={{ width: 400 }}>
        <AppLogo size={80} radius={20} />
        <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 24, marginTop: 8 }}>{t('login.enterPassword')}</Text>

        {!showRecovery ? (
          <>
            <Form onFinish={handleLogin} layout="vertical">
              <Form.Item name="password" rules={[{ required: true, message: t('errors.required') }]}>
                <Input.Password prefix={<LockOutlined />} placeholder={t('login.password')} size="large" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} size="large" block>
                  {t('login.login')}
                </Button>
              </Form.Item>
            </Form>
            <Divider />
            <Button type="link" onClick={() => setShowRecovery(true)} block>
              <KeyOutlined /> {t('login.forgotPassword')}
            </Button>
          </>
        ) : (
          <>
            <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 24 }}>
              {t('login.recoveryTitle')}
            </Text>
            <Form onFinish={handleRecovery} layout="vertical">
              <Form.Item name="recoveryKey" rules={[{ required: true, message: t('errors.required') }]}>
                <Input prefix={<KeyOutlined />} placeholder={t('login.recoveryKey')} size="large" />
              </Form.Item>
              <Form.Item name="newPassword" rules={[{ required: true, message: t('errors.required') }]}>
                <Input.Password prefix={<LockOutlined />} placeholder={t('login.newPassword')} size="large" />
              </Form.Item>
              <Form.Item name="confirmPassword" dependencies={['newPassword']} rules={[{ required: true, message: t('errors.required') }]}>
                <Input.Password prefix={<LockOutlined />} placeholder={t('login.confirmPassword')} size="large" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} size="large" block>
                  {t('login.resetPassword')}
                </Button>
              </Form.Item>
            </Form>
            <Button type="link" onClick={() => setShowRecovery(false)} block>
              {t('common.back')}
            </Button>
          </>
        )}
      </Card>
    </div>
  )
}
