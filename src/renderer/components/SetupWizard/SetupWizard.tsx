import { useState } from 'react'
import { Steps, Card, Form, Input, Checkbox, Button, Typography, Table, Space, message, Tag, Select } from 'antd'
import { PlusOutlined, MinusOutlined, ArrowUpOutlined, ArrowDownOutlined, CopyOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useSchoolStore } from '../../store/schoolStore'
import ClassSelector from '../Classes/ClassSelector'
import AppLogo from '../AppLogo'

const { Title, Text, Paragraph } = Typography

interface SetupWizardProps {
  onComplete: () => void
}

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const { t } = useTranslation()
  const { setSchool } = useSchoolStore()
  const [current, setCurrent] = useState(0)
  const [schoolForm] = Form.useForm()
  const [recoveryKey, setRecoveryKey] = useState('')
  const [loading, setLoading] = useState(false)

  const [modules, setModules] = useState<string[]>(['attendance', 'marks', 'promotions'])
  const [classes, setClasses] = useState<{ name: string; sections: { name: string; teacher: string }[] }[]>([])
  const [finalClass, setFinalClass] = useState<string | undefined>(undefined)
  const [fields, setFields] = useState<any[]>([])

  const moduleOptions = [
    { key: 'attendance', label: t('wizard.step2.attendance'), desc: t('wizard.step2.attendanceDesc') },
    { key: 'marks', label: t('wizard.step2.marks'), desc: t('wizard.step2.marksDesc') },
    { key: 'promotions', label: t('wizard.step2.promotions'), desc: t('wizard.step2.promotionsDesc') }
  ]

  const handleNext = async () => {
    if (current === 0) {
      await schoolForm.validateFields()
      const defaults = await window.api.fields.defaults()
      setFields(defaults.map((f: any, i: number) => ({ ...f, display_order: i })))
    }
    setCurrent(current + 1)
  }

  const handleFinish = async () => {
    const schoolValues = schoolForm.getFieldsValue(true)
    setLoading(true)

    try {
      const schoolId = await window.api.schools.create({
        name: schoolValues.schoolName || '',
        address: schoolValues.address || '',
        principal_name: '',
        academic_year: schoolValues.academicYear || '',
        uid_prefix: schoolValues.uidPrefix || 'SCH'
      })

      // Enable selected modules, disable unselected ones
      for (const key of ['attendance', 'marks', 'promotions']) {
        await window.api.modules.toggle(schoolId, key, modules.includes(key))
      }

      for (const cls of classes) {
        if (!cls.name.trim()) continue
        const classId = await window.api.classes.create(schoolId, cls.name.trim())
        for (const sec of cls.sections) {
          if (!sec.name.trim()) continue
          await window.api.sections.create(classId, sec.name.trim(), sec.teacher.trim() || null)
        }
      }

      const resolvedFinalClass = finalClass || classes[classes.length - 1]?.name
      if (resolvedFinalClass?.trim()) {
        await window.api.settings.set(schoolId, 'final_class', resolvedFinalClass.trim())
      }

      await window.api.fields.create(schoolId, fields.filter((f: any) => f.field_key && f.display_name).map((f: any) => ({
        field_key: f.field_key,
        display_name: f.display_name,
        field_type: f.field_type,
        is_searchable: f.is_searchable ? 1 : 0
      })))

      const { recoveryKey: key } = await window.api.auth.create(schoolId, schoolValues.password)
      setRecoveryKey(key)
      setCurrent(5)

      const school = await window.api.app.getSchool()
      setSchool(school)
    } catch (e: any) {
      console.error('Wizard finish error:', e)
      message.error(e?.message || t('errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  const addClass = () => setClasses([...classes, { name: '', sections: [{ name: '', teacher: '' }] }])
  const removeClass = (i: number) => setClasses(classes.filter((_, idx) => idx !== i))
  const addSection = (i: number) => {
    const updated = [...classes]
    updated[i].sections.push({ name: '', teacher: '' })
    setClasses(updated)
  }
  const removeSection = (ci: number, si: number) => {
    const updated = [...classes]
    updated[ci].sections = updated[ci].sections.filter((_, idx) => idx !== si)
    setClasses(updated)
  }

  const addField = () => void setFields([...fields, { field_key: `custom_${Date.now()}`, display_name: '', field_type: 'text', is_searchable: 0, display_order: fields.length }])
  const removeField = (i: number) => setFields(fields.filter((_, idx) => idx !== i))
  const moveField = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= fields.length) return
    const updated = [...fields]
    ;[updated[i], updated[j]] = [updated[j], updated[i]]
    setFields(updated)
  }

  const copyRecoveryKey = () => {
    navigator.clipboard.writeText(recoveryKey)
    message.success(t('wizard.step5.copied'))
  }

  const steps = [
    { title: t('wizard.step1.title') },
    { title: t('wizard.step2.title') },
    { title: t('wizard.step3.title') },
    { title: t('wizard.step4.title') },
    { title: t('wizard.step5.title') }
  ]

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f5f5f5', padding: 24 }}>
        <Card style={{ width: 700, maxWidth: '100%' }}>
          <AppLogo size={80} radius={20} />
        <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 24 }}>{t('wizard.subtitle')}</Text>

        <Steps current={current} items={steps} style={{ marginBottom: 32 }} />

        {current === 0 && (
          <Form form={schoolForm} layout="vertical" initialValues={{ uidPrefix: 'SCH' }}>
            <Form.Item name="schoolName" label={t('wizard.step1.schoolName')} rules={[{ required: true }]}>
              <Input size="large" />
            </Form.Item>
            <Form.Item name="address" label={t('wizard.step1.address')}>
              <Input.TextArea rows={2} size="large" />
            </Form.Item>
            <Form.Item name="academicYear" label={t('wizard.step1.academicYear')} rules={[{ required: true }]}>
              <Select showSearch size="large" placeholder="2025-26"
                options={(() => {
                  const currentYear = new Date().getFullYear()
                  const startYear = currentYear - 5
                  return Array.from({ length: 11 }, (_, i) => {
                    const y = startYear + i
                    return { label: `${y}-${String(y+1).slice(2)}`, value: `${y}-${String(y+1).slice(2)}` }
                  })
                })()} />
            </Form.Item>
            <Form.Item name="uidPrefix" label={t('wizard.step1.uidPrefix')} tooltip={t('wizard.step1.uidPrefixHint')}>
              <Input size="large" />
            </Form.Item>
          </Form>
        )}

        {current === 1 && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Text>{t('wizard.step2.subtitle')}</Text>
            {moduleOptions.map((m) => (
              <Card key={m.key} size="small" style={{ cursor: 'pointer' }} onClick={() => {
                setModules(modules.includes(m.key) ? modules.filter((k) => k !== m.key) : [...modules, m.key])
              }}>
                <Checkbox checked={modules.includes(m.key)}>{m.label} - {m.desc}</Checkbox>
              </Card>
            ))}
          </Space>
        )}

        {current === 2 && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Text>{t('wizard.step3.subtitle')}</Text>
            {classes.map((cls, ci) => (
              <Card key={ci} size="small" title={
                <Space>
                  <ClassSelector value={cls.name} onChange={(v) => { const u = [...classes]; u[ci].name = v; setClasses(u) }} placeholder={t('wizard.step3.className')} />
                  <Button size="small" danger onClick={() => removeClass(ci)} icon={<MinusOutlined />}>{t('wizard.step3.remove')}</Button>
                </Space>
              }>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  {cls.sections.map((sec, si) => (
                    <Space key={si}>
                      <Input value={sec.name} onChange={(e) => { const u = [...classes]; u[ci].sections[si].name = e.target.value; setClasses(u) }} placeholder={t('wizard.step3.sectionName')} style={{ width: 100 }} />
                      <Input value={sec.teacher} onChange={(e) => { const u = [...classes]; u[ci].sections[si].teacher = e.target.value; setClasses(u) }} placeholder={t('wizard.step3.classTeacher')} style={{ width: 200 }} />
                      <Button size="small" danger onClick={() => removeSection(ci, si)} icon={<MinusOutlined />} />
                    </Space>
                  ))}
                  <Button size="small" type="dashed" onClick={() => addSection(ci)} icon={<PlusOutlined />}>{t('wizard.step3.addSection')}</Button>
                </Space>
              </Card>
            ))}
            <Button type="dashed" onClick={addClass} icon={<PlusOutlined />}>{t('wizard.step3.addClass')}</Button>
            <Form layout="vertical" style={{ marginTop: 12 }}>
              <Form.Item label="Final Class (Passout Grade)">
                <Select
                  value={finalClass}
                  onChange={setFinalClass}
                  placeholder="Select final class"
                  style={{ width: 260 }}
                  options={classes.filter((c) => c.name.trim()).map((c) => ({ label: c.name.trim(), value: c.name.trim() }))}
                />
              </Form.Item>
            </Form>
          </Space>
        )}

        {current === 3 && (
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Table
            size="small"
            dataSource={fields} rowKey={(_r, i) => String(i)}
            pagination={false}
            columns={[
              { title: t('wizard.step4.fieldName'), dataIndex: 'display_name', render: (val: string, _: any, i: number) => <Input value={val} onChange={(e) => { const u = [...fields]; u[i].display_name = e.target.value; setFields(u) }} /> },
              { title: t('wizard.step4.fieldType'), dataIndex: 'field_type', render: (val: string, _: any, i: number) => (
                <select value={val} onChange={(e) => { const u = [...fields]; u[i].field_type = e.target.value; setFields(u) }} style={{ padding: '4px 8px' }}>
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                </select>
              )},
              { title: t('wizard.step4.searchable'), dataIndex: 'is_searchable', render: (val: number, _: any, i: number) => <Checkbox checked={!!val} onChange={(e) => { const u = [...fields]; u[i].is_searchable = e.target.checked ? 1 : 0; setFields(u) }} /> },
              { title: 'Actions', render: (_: any, __: any, i: number) => (
                <Space>
                  <Button size="small" onClick={() => moveField(i, -1)} disabled={i === 0} icon={<ArrowUpOutlined />} />
                  <Button size="small" onClick={() => moveField(i, 1)} disabled={i === fields.length - 1} icon={<ArrowDownOutlined />} />
                  <Button size="small" danger onClick={() => removeField(i)} icon={<MinusOutlined />} />
                </Space>
              )}
            ]}
          />
            <Button type="dashed" onClick={addField} icon={<PlusOutlined />}>{t('wizard.step4.addField')}</Button>
          </Space>
        )}

        {current === 4 && (
          <Form form={schoolForm} layout="vertical">
            <Text>{t('wizard.step5.subtitle')}</Text>
            <Form.Item name="password" label={t('wizard.step5.password')} rules={[{ required: true }]} style={{ marginTop: 16 }}>
              <Input.Password size="large" />
            </Form.Item>
            <Form.Item name="confirmPassword" label={t('wizard.step5.confirmPassword')} dependencies={['password']} rules={[{ required: true }, ({ getFieldValue }) => ({ validator(_, value) { if (!value || getFieldValue('password') === value) return Promise.resolve(); return Promise.reject(new Error(t('wizard.step5.passwordsMismatch'))) } })]}>
              <Input.Password size="large" />
            </Form.Item>
          </Form>
        )}

        {current === 5 && (
          <div style={{ textAlign: 'center' }}>
            <Title level={4}>{t('wizard.step5.recoveryKeyTitle')}</Title>
            <Paragraph>{t('wizard.step5.recoveryKeyDesc')}</Paragraph>
            <Tag color="blue" style={{ fontSize: 20, padding: '8px 16px', fontFamily: 'monospace', letterSpacing: 2 }}>{recoveryKey}</Tag>
            <div style={{ marginTop: 16 }}>
              <Button icon={<CopyOutlined />} onClick={copyRecoveryKey}>{t('wizard.step5.copyKey')}</Button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
          {current > 0 && current < 5 && (
            <Button onClick={() => setCurrent(current - 1)}>{t('common.back')}</Button>
          )}
          {current < 4 && (
            <Button type="primary" onClick={handleNext} style={{ marginLeft: 'auto' }}>{t('common.next')}</Button>
          )}
          {current === 4 && (
            <Button type="primary" onClick={handleFinish} loading={loading} style={{ marginLeft: 'auto' }}>{t('common.finish')}</Button>
          )}
          {current === 5 && (
            <Button type="primary" onClick={onComplete} style={{ marginLeft: 'auto' }}>{t('common.close')}</Button>
          )}
        </div>
      </Card>
    </div>
  )
}





