import { useState, useEffect } from 'react'
import { Typography, Select, Space, Card, Tag } from 'antd'
import { useLocation } from 'react-router-dom'
import { useSchoolStore } from '../../store/schoolStore'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, Legend } from 'recharts'

const { Title, Text } = Typography

export default function StudentAnalytics() {
  const { school } = useSchoolStore()
  const location = useLocation()
  const [classes, setClasses] = useState<any[]>([])
  const [sections, setSections] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
    const [allStudents, setAllStudents] = useState<any[]>([])
  const [selectedClass, setSelectedClass] = useState<number | undefined>(undefined)
  const [selectedSection, setSelectedSection] = useState<number | undefined>(undefined)
  const [selectedSubject, setSelectedSubject] = useState<number | undefined>(undefined)
  const [selectedStudent, setSelectedStudent] = useState<number | undefined>(undefined)
  const [barData, setBarData] = useState<any[]>([])
  const [passingThreshold, setPassingThreshold] = useState(35)
  const [classAverage, setClassAverage] = useState(0)
  const [atRisk, setAtRisk] = useState<any[]>([])
  const [studentLineData, setStudentLineData] = useState<any[]>([])
  const [studentSubjects, setStudentSubjects] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (school) window.api.classes.get(school.id).then(setClasses) }, [school])

  // Pre-select student from navigation state (linked from Student Profile)
  useEffect(() => {
    const id = (location.state as any)?.studentId
    if (id && school) {
      window.api.students.get(id).then(async (st: any) => {
        if (st) {
          setSelectedStudent(st.id)
          // Find the student's class
          const allClasses = await window.api.classes.get(school.id)
          for (const cls of allClasses) {
            const secs = await window.api.sections.getByClass(cls.id)
            for (const sec of secs) {
              const sts = await window.api.students.getBySection(sec.id)
              if (sts.some((s: any) => s.id === st.id)) {
                setSelectedClass(cls.id)
                setSelectedSection(sec.id)
                setSections(secs)
                await window.api.marks.getSubjects(cls.id).then(setSubjects)
                break
              }
            }
          }
          loadStudentGraph(st.id)
        }
      })
    }
  }, [location.state])

  useEffect(() => {
    if (!selectedClass) return
    window.api.sections.getByClass(selectedClass).then(setSections)
    window.api.marks.getSubjects(selectedClass).then(setSubjects)
  }, [selectedClass])

  useEffect(() => {
    if (!selectedSection || !selectedSubject) return
    loadClassAnalytics()
  }, [selectedSection, selectedSubject])

  useEffect(() => {
    if (!selectedStudent) return
    loadStudentGraph(selectedStudent)
  }, [selectedStudent])

  const loadClassAnalytics = async () => {
    if (!selectedSection || !selectedSubject) return
    setLoading(true)
    try {
      const sub = subjects.find((s: any) => s.id === selectedSubject)
      if (sub?.passing_marks) setPassingThreshold(sub.passing_marks)

      const studentsList = await window.api.students.getBySection(selectedSection)
      
      // Also load all students for the student selector
      let all: any[] = []
      for (const sec of sections) {
        const sts = await window.api.students.getBySection(sec.id)
        all = [...all, ...sts]
      }
      setAllStudents(all)

      const barDataList: any[] = []
      const atRiskList: any[] = []
      let total = 0

      for (const st of studentsList) {
        const marks = await window.api.marks.getByStudent(st.id)
        const subMarks = marks.filter((m: any) => m.subject_id === selectedSubject)
        const avgMarks = subMarks.length > 0
          ? Math.round(subMarks.reduce((s: number, m: any) => s + (m.marks_obtained || 0), 0) / subMarks.length)
          : -1 // -1 means no data
        if (avgMarks >= 0) total += avgMarks
        const name = st.field_values?.full_name || st.student_uid?.slice(-4) || 'Unknown'
        barDataList.push({ name, marks: avgMarks >= 0 ? avgMarks : 0, noData: avgMarks < 0 ? 20 : 0, uid: st.student_uid })
        if (avgMarks >= 0 && avgMarks < (sub?.passing_marks || 35)) atRiskList.push({ ...st, avgMarks })
      }
      setBarData(barDataList)
      setAtRisk(atRiskList)
      setClassAverage(studentsList.length > 0 ? Math.round(total / studentsList.length) : 0)
    } finally { setLoading(false) }
  }

  const loadStudentGraph = async (studentId: number) => {
    setLoading(true)
    try {
      const marks = await window.api.marks.getByStudent(studentId)
      const subSet: string[] = []
      const examsMap: Record<string, any> = {}
      for (const m of marks) {
        if (!subSet.includes(m.subject_name)) subSet.push(m.subject_name)
        if (!examsMap[m.exam_name]) examsMap[m.exam_name] = { exam: m.exam_name }
        examsMap[m.exam_name][m.subject_name] = m.marks_obtained
      }
      setStudentSubjects(subSet)
      setStudentLineData(Object.values(examsMap))
    } finally { setLoading(false) }
  }

  const colors = ['#6366F1', '#F97316', '#0D9488', '#8B5CF6', '#EC4899', '#14B8A6']

  return (
    <div>
      <Title level={4}>Performance Analytics</Title>

      <Space style={{ marginBottom: 24, flexWrap: 'wrap' }}>
        <Select placeholder="Select Class" style={{ width: 160 }} value={selectedClass} onChange={(v) => { setSelectedClass(v); setSelectedSection(undefined); setSelectedSubject(undefined) }}
          options={classes.map((c) => ({ label: c.name, value: c.id }))} />
        <Select placeholder="Select Section" style={{ width: 160 }} value={selectedSection} onChange={(v) => { setSelectedSection(v); setSelectedSubject(undefined) }}
          options={sections.map((s) => ({ label: s.name, value: s.id }))} />
        <Select placeholder="Select Subject" style={{ width: 160 }} value={selectedSubject} onChange={setSelectedSubject}
          options={subjects.map((s: any) => ({ label: s.name, value: s.id }))} disabled={!selectedSection} />
        <Select placeholder="Select Student" style={{ width: 220 }} value={selectedStudent} onChange={setSelectedStudent}
          showSearch filterOption={(i, o) => (o?.label as string)?.toLowerCase().includes(i.toLowerCase())}
          options={allStudents.map((s: any) => ({ label: `${s.student_uid} — ${s.field_values?.full_name || ''}`, value: s.id }))} />
      </Space>

      {atRisk.length > 0 && (
        <Card size="small" style={{ marginBottom: 24, background: '#FFF7ED', borderColor: '#FDBA74', borderTop: '3px solid #F97316' }}
          title={`At-Risk Students (${atRisk.length})`}>
          {atRisk.map((s) => (
            <Tag key={s.id} color="orange" style={{ marginBottom: 4 }}>{s.student_uid} — {s.field_values?.full_name || 'Unknown'} ({s.avgMarks}%)</Tag>
          ))}
        </Card>
      )}

      {studentLineData.length > 0 ? (
        <Card title="Individual Student Performance" loading={loading} style={{ marginBottom: 16 }}>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={studentLineData} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="exam" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <ReferenceLine y={passingThreshold} stroke="#EF4444" strokeDasharray="5 5" label={{ value: `Passing (${passingThreshold})`, position: "insideLeft" }} />
              {studentSubjects.map((sub, i) => (
                <Area key={sub} type="monotone" dataKey={sub} stroke={colors[i % colors.length]} fill={colors[i % colors.length]} fillOpacity={0.1} strokeWidth={2} dot={{ r: 4 }} connectNulls />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      ) : null}

      {barData.length > 0 && (
        <Card title={`Section Marks — ${subjects.find((s: any) => s.id === selectedSubject)?.name || ''}`} loading={loading}>
          <Text type="secondary">Passing: {passingThreshold}% | Class Average: {classAverage}%</Text>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={barData} margin={{ top: 20, right: 20, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} />
              <Tooltip formatter={(v: any) => `${v}%`} />
              <ReferenceLine y={passingThreshold} stroke="#EF4444" strokeDasharray="5 5" label={{ value: "Passing", position: "insideLeft" }} />
              <ReferenceLine y={classAverage} stroke="#6366F1" strokeDasharray="3 3" label={{ value: "Avg", position: "insideLeft" }} />
              <Bar dataKey="marks" fill="#6366F1" radius={[6, 6, 0, 0]} maxBarSize={40} />
              <Bar dataKey="noData" fill="#E2E8F0" radius={[6, 6, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  )
}

