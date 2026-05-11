import { useState, useEffect } from 'react'
import { Calendar, Badge, Typography, Card, Tag } from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { useSchoolStore } from '../../store/schoolStore'

const { Title } = Typography

export default function AcademicCalendar() {
  const { school } = useSchoolStore()
  const [exams, setExams] = useState<any[]>([])
  const [selectedMonth, setSelectedMonth] = useState(dayjs())

  useEffect(() => {
    if (!school) return
    window.api.marks.getExams(school.id, school.academic_year).then(setExams)
  }, [school])

  const getListData = (date: Dayjs) => {
    const dateStr = date.format('YYYY-MM-DD')
    return exams.filter((e) => e.exam_date === dateStr).map((e: any) => ({
      type: e.exam_type === 'major' ? 'error' : 'warning',
      content: e.name
    }))
  }

  const dateCellRender = (date: Dayjs) => {
    const listData = getListData(date)
    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {listData.map((item: any, i: number) => (
          <li key={i}>
            <Badge status={item.type} text={<span style={{ fontSize: 11 }}>{item.content}</span>} />
          </li>
        ))}
      </ul>
    )
  }

  const upcomingExams = exams
    .filter((e) => e.exam_date && dayjs(e.exam_date).isAfter(dayjs().subtract(1, 'day')))
    .sort((a, b) => dayjs(a.exam_date).unix() - dayjs(b.exam_date).unix())
    .slice(0, 5)

  return (
    <div>
      <Title level={4}>Academic Calendar</Title>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24 }}>
        <div style={{ background: 'white', borderRadius: 16, padding: 16, border: '1px solid rgba(226,232,240,0.8)' }}>
          <Calendar
            dateCellRender={dateCellRender}
            value={selectedMonth}
            onChange={(d) => setSelectedMonth(d)}
          />
        </div>
        <div>
          <Card title="Upcoming Exams" size="small" style={{ borderRadius: 16 }}>
            {upcomingExams.length === 0 && <span style={{ color: '#64748B' }}>No upcoming exams</span>}
            {upcomingExams.map((e: any) => (
              <div key={e.id} style={{ marginBottom: 8, padding: '8px 12px', background: '#F8FAFC', borderRadius: 10 }}>
                <strong>{e.name}</strong>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <Tag color={e.exam_type === 'major' ? 'red' : 'orange'}>{e.exam_type === 'major' ? 'Major' : 'Minor'}</Tag>
                  <span style={{ fontSize: 12, color: '#64748B' }}>{e.exam_date ? dayjs(e.exam_date).format('DD MMM YYYY') : 'No date set'}</span>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  )
}

