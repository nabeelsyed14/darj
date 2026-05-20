import { useState, useEffect } from 'react'
import { Tabs, Form, Input, Button, Switch, Select, message, Typography, Space } from 'antd'
import { useTranslation } from 'react-i18next'
import { useSchoolStore } from '../../store/schoolStore'
import { useModuleStore } from '../../store/moduleStore'
import i18n from '../../i18n'

const { Title, Text } = Typography

export default function Settings() {
  const { t } = useTranslation()
  const { school, updateSchool } = useSchoolStore()
  const { attendance, marks, promotions, toggleModule } = useModuleStore()
  const [schoolForm] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [finalClass, setFinalClass] = useState<string | undefined>(undefined)
  const [classes, setClasses] = useState<any[]>([])

  useEffect(() => {
    if (school) {
      schoolForm.setFieldsValue({
        name: school.name,
        address: school.address,
        principal_name: school.principal_name,
        academic_year: school.academic_year,
        uid_prefix: school.uid_prefix
      })
      window.api.settings.get(school.id, 'final_class').then((v) => setFinalClass(v ?? undefined))
      window.api.classes.get(school.id).then(setClasses)
    }
  }, [school])

  const handleSchoolSave = async () => {
    if (!school) return
    try {
      const values = await schoolForm.validateFields()
      await window.api.schools.update({
        id: school.id,
        name: values.name || school.name,
        address: values.address ?? '',
        principal_name: values.principal_name ?? school.principal_name ?? '',
        academic_year: values.academic_year || school.academic_year,
        uid_prefix: values.uid_prefix || school.uid_prefix
      })
      updateSchool(values)
      message.success(t('common.success'))
    } catch (e: any) {
      message.error(e?.message || t('errors.generic'))
    }
  }

  const handlePasswordChange = async () => {
    const values = await passwordForm.validateFields()
    const success = await window.api.auth.changePassword(values.currentPassword, values.newPassword)
    if (success) {
      message.success(t('common.success'))
      passwordForm.resetFields()
    } else {
      message.error(t('login.wrongPassword'))
    }
  }

  const handleModuleToggle = async (key: string, checked: boolean) => {
    if (!school) return
    toggleModule(key as any)
    await window.api.modules.toggle(school.id, key, checked)
  }

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang)
  }

  const handleBackup = async () => {
    setLoading(true)
    try {
      const result = await window.api.app.backup()
      if (result.success) {
        message.success(t('settings.backupSuccess'))
      }
    } catch {
      message.error(t('errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async () => {
    setLoading(true)
    try {
      const result = await window.api.app.restore()
      if (result.success) {
        message.success(t('settings.restoreSuccess'))
        setTimeout(() => window.location.reload(), 1500)
      }
    } catch {
      message.error(t('errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  const items = [
    {
      key: 'school',
      label: t('settings.schoolDetails'),
      children: (
        <Form form={schoolForm} layout="vertical" onFinish={handleSchoolSave}>
          <Form.Item name="name" label={t('wizard.step1.schoolName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="address" label={t('wizard.step1.address')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="principal_name" label="Principal Name">
            <Input />
          </Form.Item>
          <Form.Item name="academic_year" label={t('wizard.step1.academicYear')}>
            <Select showSearch placeholder="Academic year" style={{ width: 200 }}
              options={(() => {
                const currentYear = new Date().getFullYear()
                const startYear = currentYear - 5
                return Array.from({ length: 11 }, (_, i) => {
                  const y = startYear + i
                  return { label: `${y}-${String(y+1).slice(2)}`, value: `${y}-${String(y+1).slice(2)}` }
                })
              })()} />
          </Form.Item>
          <Form.Item name="uid_prefix" label={t('wizard.step1.uidPrefix')}>
            <Input />
          </Form.Item>
          <Form.Item label="Final Class (Passout Grade)">
            <Select value={finalClass} onChange={async (v) => { setFinalClass(v); if (school) { await window.api.settings.set(school.id, 'final_class', v); message.success(t('common.success')) } }}
              placeholder="Select final class" allowClear style={{ width: 240 }}
              options={classes.map((c) => ({ label: c.name, value: c.name }))} />
            <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>Students promoted from this class are marked as Passed Out</Text>
          </Form.Item>
          <Button type="primary" htmlType="submit">{t('common.save')}</Button>
        </Form>
      )
    },
    {
      key: 'modules',
      label: t('settings.moduleToggle'),
      children: (
        <Space direction="vertical" size="large">
          <Space>
            <Switch checked={attendance} onChange={(v) => handleModuleToggle('attendance', v)} />
            <Text>{t('wizard.step2.attendance')}</Text>
          </Space>
          <Space>
            <Switch checked={marks} onChange={(v) => handleModuleToggle('marks', v)} />
            <Text>{t('wizard.step2.marks')}</Text>
          </Space>
          <Space>
            <Switch checked={promotions} onChange={(v) => handleModuleToggle('promotions', v)} />
            <Text>{t('wizard.step2.promotions')}</Text>
          </Space>
        </Space>
      )
    },
    {
      key: 'language',
      label: t('settings.language'),
      children: (
        <Select
          value={i18n.language}
          onChange={handleLanguageChange}
          options={[
            { label: t('settings.english'), value: 'en' },
            { label: t('settings.hindi'), value: 'hi' }
          ]}
          style={{ width: 200 }}
        />
      )
    },
    {
      key: 'password',
      label: t('settings.changePassword'),
      children: (
        <Form form={passwordForm} layout="vertical" onFinish={handlePasswordChange}>
          <Form.Item name="currentPassword" label={t('login.password')} rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="newPassword" label={t('login.newPassword')} rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="confirmPassword" label={t('login.confirmPassword')} dependencies={['newPassword']} rules={[{ required: true }, ({ getFieldValue }) => ({ validator(_, value) { if (!value || getFieldValue('newPassword') === value) return Promise.resolve(); return Promise.reject(new Error(t('wizard.step5.passwordsMismatch'))) } })]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit">{t('common.save')}</Button>
        </Form>
      )
    },
    {
      key: 'backup',
      label: t('settings.backup'),
      children: (
        <Space direction="vertical" size="large">
          <div>
            <Text strong>{t('settings.backup')}</Text>
            <Text type="secondary" style={{ display: 'block' }}>{t('settings.backupDesc')}</Text>
            <Button type="primary" onClick={handleBackup} loading={loading} style={{ marginTop: 8 }}>
              {t('settings.backup')}
            </Button>
          </div>
          <div>
            <Text strong>{t('settings.restore')}</Text>
            <Text type="secondary" style={{ display: 'block' }}>{t('settings.restoreDesc')}</Text>
            <Button danger onClick={handleRestore} loading={loading} style={{ marginTop: 8 }}>
              {t('settings.restore')}
            </Button>
          </div>
        </Space>
      )
    }
  ]

  return (
    <div>
      <Title level={4}>{t('settings.title')}</Title>
      <Tabs items={items} />
    </div>
  )
}

