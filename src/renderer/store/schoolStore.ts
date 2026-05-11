import { create } from 'zustand'

interface SchoolData {
  id: number
  name: string
  address: string
  principal_name: string
  academic_year: string
  uid_prefix: string
}

interface SchoolState {
  school: SchoolData | null
  setSchool: (school: SchoolData) => void
  updateSchool: (data: Partial<SchoolData>) => void
}

export const useSchoolStore = create<SchoolState>((set) => ({
  school: null,
  setSchool: (school) => set({ school }),
  updateSchool: (data) => set((state) => ({
    school: state.school ? { ...state.school, ...data } : null
  }))
}))
