import { useState } from 'react'
import { Form, Select, Button, message, Space } from 'antd'
import { useTranslation } from 'react-i18next'

interface MoveStudentProps {
  student: any
  sections: { id: number; name: string; class_name: string }[]
  onComplete: () => void
}

export default function MoveStudent({ student, sections, onComplete }: MoveStudentProps) {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    const values = await form.validateFields()
    setLoading(true)
    try {
      await window.api.students.move(student.id, values.new_section_id)
      message.success(t('common.success'))
      onComplete()
    } catch {
      message.error(t('errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit}>
      <Form.Item name="new_section_id" label={t('students.filterBySection')} rules={[{ required: true }]}>
        <Select options={sections.map((s) => ({ label: `${s.class_name} ${s.name}`, value: s.id }))} />
      </Form.Item>
      <Form.Item style={{ marginBottom: 0 }}>
        <Space>
          <Button type="primary" htmlType="submit" loading={loading}>{t('common.save')}</Button>
          <Button onClick={onComplete}>{t('common.cancel')}</Button>
        </Space>
      </Form.Item>
    </Form>
  )
}
