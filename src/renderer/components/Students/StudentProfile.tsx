import { useState } from 'react'
import { Descriptions, Tag, Typography, Button, Modal, Select, Input, DatePicker, Table, message, Space } from 'antd'
import { BarChartOutlined, SwapOutlined, HistoryOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'

interface StudentProfileProps {
  student: any
  onViewAnalytics?: (studentId: number) => void
  onStudentUpdated?: () => void
}

export default function StudentProfile({ student, onViewAnalytics, onStudentUpdated }: StudentProfileProps) {
  const { t } = useTranslation()
  const [showStatus, setShowStatus] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [newStatus, setNewStatus] = useState('active')
  const [reason, setReason] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(dayjs())
  const [history, setHistory] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  const statusColor = student.status === 'active' ? 'green' : student.status === 'withdrawn' ? 'red' : 'orange'
  const statusLabel = student.status === 'active' ? 'Active' : student.status === 'withdrawn' ? 'Withdrawn' : student.status

  const items = [
    { key: 'uid', label: t('students.studentId'), children: student.student_uid },
    { key: 'status', label: t('students.status'), children: <Tag color={statusColor}>{statusLabel}</Tag> },
    { key: 'enrollment', label: t('fields.enrollment_date'), children: student.enrollment_date || '-' }
  ]

  if (student.field_values) {
    for (const [key, value] of Object.entries(student.field_values)) {
      const fieldLabel = t(`fields.${key}`, key)
      items.push({ key, label: fieldLabel, children: (value as string) || '-' })
    }
  }

  const handleChangeStatus = async () => {
    if (!reason.trim()) { message.error('Reason is required'); return }
    setSaving(true)
    try {
      await window.api.students.changeStatus(
        student.id, student.status, newStatus,
        reason.trim(), effectiveDate.format('YYYY-MM-DD')
      )
      message.success('Status updated')
      setShowStatus(false); setReason('')
      if (onStudentUpdated) onStudentUpdated()
    } catch { message.error('Failed to update status') }
    finally { setSaving(false) }
  }

  const loadHistory = async () => {
    const h = await window.api.students.getStatusHistory(student.id)
    setHistory(h)
    setShowHistory(true)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        {student.photo ? (
          <img src={student.photo} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #4F46E5, #6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>👤</div>
        )}
        <Typography.Title level={5} style={{ margin: 0 }}>{student.field_values?.full_name || student.student_uid}</Typography.Title>
      </div>
      <Descriptions column={2} items={items} bordered size="small" />
      <Space style={{ marginTop: 16, flexWrap: 'wrap' }}>
        {onViewAnalytics && (
          <Button type="primary" icon={<BarChartOutlined />} onClick={() => onViewAnalytics(student.id)}>View Performance</Button>
        )}
        <Button icon={<SwapOutlined />} onClick={() => { setNewStatus(student.status); setReason(''); setShowStatus(true) }}>Change Status</Button>
        <Button icon={<HistoryOutlined />} onClick={loadHistory}>Status History</Button>
      </Space>

      <Modal title="Change Student Status" open={showStatus} onCancel={() => setShowStatus(false)} onOk={handleChangeStatus} confirmLoading={saving} okText="Save">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select value={newStatus} onChange={setNewStatus} style={{ width: '100%' }}
            options={[{ label: 'Active', value: 'active' }, { label: 'Withdrawn', value: 'withdrawn' }, { label: 'On Leave', value: 'on_leave' }]} />
          <Input.TextArea placeholder="Reason for status change (required)" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          <DatePicker value={effectiveDate} onChange={(d) => setEffectiveDate(d || dayjs())} style={{ width: '100%' }} placeholder="Effective Date" />
        </Space>
      </Modal>

      <Modal title="Status History" open={showHistory} onCancel={() => setShowHistory(false)} footer={null} width={700}>
        <Table dataSource={history} rowKey="id" size="small" pagination={false} columns={[
          { title: 'Old Status', dataIndex: 'old_status', width: 100 },
          { title: 'New Status', dataIndex: 'new_status', width: 100, render: (v: string) => <Tag color={v === 'active' ? 'green' : 'red'}>{v}</Tag> },
          { title: 'Reason', dataIndex: 'reason' },
          { title: 'Effective Date', dataIndex: 'effective_date', width: 120 },
          { title: 'Changed At', dataIndex: 'changed_at', width: 160 }
        ]} />
      </Modal>
    </div>
  )
}
