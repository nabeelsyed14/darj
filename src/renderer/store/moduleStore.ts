import { create } from 'zustand'

interface ModuleState {
  attendance: boolean
  marks: boolean
  promotions: boolean
  setModules: (modules: { attendance: boolean; marks: boolean; promotions: boolean }) => void
  toggleModule: (key: 'attendance' | 'marks' | 'promotions') => void
}

export const useModuleStore = create<ModuleState>((set) => ({
  attendance: false,
  marks: false,
  promotions: false,
  setModules: (modules) => set(modules),
  toggleModule: (key) => set((state) => ({ [key]: !state[key] }))
}))
