import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useSchoolStore } from './store/schoolStore'
import { useModuleStore } from './store/moduleStore'
import Login from './components/Login/Login'
import SetupWizard from './components/SetupWizard/SetupWizard'
import Layout from './components/Layout/Layout'
import Students from './components/Students/StudentList'
import Classes from './components/Classes/ClassSectionManager'
import Settings from './components/Settings/Settings'
import ExportPanel from './components/Export/ExportPanel'
import AttendanceSheet from './components/Attendance/AttendanceSheet'
import MarksEntry from './components/Marks/MarksEntry'
import PromotionReview from './components/Promotions/PromotionReview'
import YearEndRollover from './components/YearEnd/YearEndRollover'
import StudentAnalytics from './components/Analytics/StudentAnalytics'
import type { Api } from './utils/api'

declare global {
  interface Window {
    api: Api
  }
}

function App() {
  const { isAuthenticated, isSetupComplete, setAuthenticated, setSetupComplete } = useAuthStore()
  const { setSchool } = useSchoolStore()
  const { setModules } = useModuleStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const setupDone = await window.api.app.isSetupComplete()
      setSetupComplete(setupDone)

      if (setupDone) {
        const school = await window.api.app.getSchool()
        if (school) {
          setSchool(school)
        }
      }
      setLoading(false)
    }
    init()
  }, [])

  // Load modules whenever authentication state or setup changes
  useEffect(() => {
    if (!isSetupComplete) return
    const loadMods = async () => {
      const school = await window.api.app.getSchool()
      if (school) {
        const mods = await window.api.modules.get(school.id)
        const modMap = { attendance: false, marks: false, promotions: false }
        for (const m of mods) {
          if (m.module_key === 'attendance') modMap.attendance = m.is_enabled === 1
          if (m.module_key === 'marks') modMap.marks = m.is_enabled === 1
          if (m.module_key === 'promotions') modMap.promotions = m.is_enabled === 1
        }
        setModules(modMap)
      }
    }
    loadMods()
  }, [isSetupComplete, isAuthenticated])

  if (loading) return null

  return (
    <Routes>
      {!isSetupComplete ? (
        <Route path="/*" element={<SetupWizard onComplete={() => setSetupComplete(true)} />} />
      ) : !isAuthenticated ? (
        <Route path="/*" element={<Login onLogin={() => setAuthenticated(true)} />} />
      ) : (
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/students" replace />} />
          <Route path="students" element={<Students />} />
          <Route path="classes" element={<Classes />} />
          <Route path="attendance" element={<AttendanceSheet />} />
          <Route path="marks" element={<MarksEntry />} />
          <Route path="promotions" element={<PromotionReview />} />
          <Route path="yearEnd" element={<YearEndRollover />} />
          <Route path="analytics" element={<StudentAnalytics />} />
          <Route path="export" element={<ExportPanel />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/students" replace />} />
        </Route>
      )}
    </Routes>
  )
}

export default App
