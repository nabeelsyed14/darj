import { useState, useEffect } from 'react'
import { Form, Input, Button, DatePicker, Select, message, Space, Upload } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useSchoolStore } from '../../store/schoolStore'
import dayjs from 'dayjs'

interface StudentFormProps {
  student: any | null
  sections: { id: number; name: string; class_name: string }[]
  onComplete: () => void
}

export default function StudentForm({ student, sections, onComplete }: StudentFormProps) {
  const { t } = useTranslation()
  const { school } = useSchoolStore()
  const [form] = Form.useForm()
  const [fields, setFields] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [photo, setPhoto] = useState<string | null>(null)

  useEffect(() => {
    if (!school) return
    window.api.fields.get(school.id).then(setFields)
  }, [school])

  useEffect(() => {
    if (student && fields.length > 0) {
      const values: Record<string, any> = {
        section_id: student.section_id,
        enrollment_date: student.enrollment_date ? dayjs(student.enrollment_date) : undefined
      }
      for (const key in student.field_values) {
        const field = fields.find((f) => f.field_key === key)
        if (field && student.field_values[key]) {
          if (field.field_type === 'date') {
            values[key] = dayjs(student.field_values[key])
          } else {
            values[key] = student.field_values[key]
          }
        }
      }
      form.setFieldsValue(values)
    }
  }, [student, fields])

  const handleSubmit = async () => {
    if (!school) return
    const values = await form.validateFields()
    setLoading(true)

    try {
      const fieldValues = fields.map((f) => ({
        field_id: f.id,
        value: values[f.field_key]
          ? f.field_type === 'date'
            ? values[f.field_key].format('YYYY-MM-DD')
            : values[f.field_key]
          : null
      }))

      if (student) {
        await window.api.students.update(student.id, {
          section_id: values.section_id,
          enrollment_date: values.enrollment_date?.format('YYYY-MM-DD') || null,
          field_values: fieldValues
        })
        if (photo) await window.api.students.updatePhoto(student.id, photo)
        message.success(t('common.success'))
      } else {
        await window.api.students.create({
          school_id: school.id,
          section_id: values.section_id,
          enrollment_date: values.enrollment_date?.format('YYYY-MM-DD') || new Date().toISOString().split('T')[0],
          field_values: fieldValues
        })
        message.success(t('common.success'))
      }
      onComplete()
    } catch {
      message.error(t('errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  const renderField = (field: any) => {
    const parseSelectOptions = (f: any): { label: string; value: string }[] => {
      if (Array.isArray(f?.options)) return f.options.map((o: any) => ({ label: String(o), value: String(o) }))
      if (typeof f?.options === 'string') {
        return f.options.split(',').map((o: string) => o.trim()).filter(Boolean).map((o: string) => ({ label: o, value: o }))
      }
      if (f?.field_key === 'gender') {
        return ['Male', 'Female', 'Other'].map((o) => ({ label: o, value: o }))
      }
      return []
    }

    switch (field.field_type) {
      case 'date':
        return <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
      case 'number':
        return <Input type="number" />
      case 'select':
        return <Select options={parseSelectOptions(field)} showSearch allowClear />
      default:
        return <Input />
    }
  }

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit}>
      <Form.Item name="section_id" label={t('students.filterBySection')} rules={[{ required: true }]}>
        <Select options={sections.map((s) => ({ label: `${s.class_name} ${s.name}`, value: s.id }))} />
      </Form.Item>

      <Form.Item name="enrollment_date" label={t('fields.enrollment_date')}>
        <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
      </Form.Item>

      <Form.Item label="Photo">
        <Upload
          beforeUpload={(file) => {
            const reader = new FileReader()
            reader.onload = () => setPhoto(reader.result as string)
            reader.readAsDataURL(file)
            return false
          }}
          maxCount={1}
          accept="image/*"
          showUploadList={false}
        >
          <Button icon={<UploadOutlined />}>Upload Photo</Button>
        </Upload>
        {photo && <img src={photo} alt="Preview" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', marginTop: 8 }} />}
        {!photo && student?.photo && <img src={student.photo} alt="Current" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', marginTop: 8 }} />}
      </Form.Item>

      {fields.map((field: any) => (
        <Form.Item key={field.id} name={field.field_key} label={field.display_name}>
          {renderField(field)}
        </Form.Item>
      ))}

      <Form.Item style={{ marginBottom: 0 }}>
        <Space>
          <Button type="primary" htmlType="submit" loading={loading}>
            {t('common.save')}
          </Button>
          <Button onClick={onComplete}>{t('common.cancel')}</Button>
        </Space>
      </Form.Item>
    </Form>
  )
}
