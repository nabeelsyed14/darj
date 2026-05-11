import { useState, useEffect } from 'react'
import { Select, DatePicker, Button, Table, Radio, Space, Typography, message, Tag } from 'antd'
import { useTranslation } from 'react-i18next'
import { useSchoolStore } from '../../store/schoolStore'
import dayjs from 'dayjs'

const { Title } = Typography

export default function AttendanceSheet() {
  const { t } = useTranslation()
  const { school } = useSchoolStore()
  const [sections, setSections] = useState<any[]>([])
  const [selectedSection, setSelectedSection] = useState<number | undefined>(undefined)
  const [selectedDate, setSelectedDate] = useState(dayjs())
  const [students, setStudents] = useState<any[]>([])
  const [attendance, setAttendance] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!school) return
    window.api.sections.getAll(school.id).then(setSections)
  }, [school])

  useEffect(() => {
    if (!selectedSection || !selectedDate) return
    loadAttendance()
  }, [selectedSection, selectedDate])

  const loadAttendance = async () => {
    if (!selectedSection || !selectedDate) return
    setLoading(true)
    try {
      const studentsList = await window.api.students.getBySection(selectedSection)
      setStudents(studentsList)

      const dateStr = selectedDate.format('YYYY-MM-DD')
      const records = await window.api.attendance.getByDate(selectedSection, dateStr)
      const attMap: Record<number, string> = {}
      for (const r of records) {
        attMap[r.student_id] = r.status
      }
      setAttendance(attMap)
    } catch {
      message.error(t('errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  const markAll = (status: string) => {
    const newAtt: Record<number, string> = {}
    for (const s of students) {
      newAtt[s.id] = status
    }
    setAttendance(newAtt)
  }

  const handleSave = async () => {
    if (!school || !selectedSection || !selectedDate) return
    setSaving(true)
    try {
      const records = students
        .filter((s) => attendance[s.id])
        .map((s) => ({
          school_id: school.id,
          student_id: s.id,
          section_id: selectedSection,
          date: selectedDate.format('YYYY-MM-DD'),
          status: attendance[s.id]
        }))
      await window.api.attendance.markBulk(records)
      message.success(t('common.success'))
    } catch {
      message.error(t('errors.generic'))
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    {
      title: t('students.studentId'),
      dataIndex: 'student_uid',
      width: 130
    },
    {
      title: t('fields.full_name'),
      key: 'full_name',
      render: (_: any, r: any) => r.field_values?.full_name || '-'
    },
    {
      title: t('attendance.status'),
      key: 'status',
      render: (_: any, r: any) => (
        <Radio.Group
          value={attendance[r.id] || ''}
          onChange={(e) => setAttendance((prev) => ({ ...prev, [r.id]: e.target.value }))}
          buttonStyle="solid"
          size="small"
        >
          <Radio.Button value="present"><Tag color="green">P</Tag></Radio.Button>
          <Radio.Button value="absent"><Tag color="red">A</Tag></Radio.Button>
          <Radio.Button value="late"><Tag color="orange">L</Tag></Radio.Button>
        </Radio.Group>
      )
    }
  ]

  return (
    <div>
      <Title level={4}>{t('sidebar.attendance')}</Title>

      <Space style={{ marginBottom: 16 }}>
        <Select
          placeholder={t('students.filterBySection')}
          style={{ width: 200 }}
          value={selectedSection}
          onChange={setSelectedSection}
          options={sections.map((s) => ({ label: `${s.class_name} ${s.name}`, value: s.id }))}
        />
        <DatePicker value={selectedDate} onChange={(d) => setSelectedDate(d || dayjs())} format="DD/MM/YYYY" />
        <Button onClick={() => markAll('present')} size="small">{t('attendance.markAllPresent')}</Button>
        <Button type="primary" onClick={handleSave} loading={saving} disabled={!selectedSection || students.length === 0}>
          {t('common.save')}
        </Button>
      </Space>

      <Table
        dataSource={students}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
        locale={{ emptyText: t('attendance.selectHint') }}
      />
    </div>
  )
}

