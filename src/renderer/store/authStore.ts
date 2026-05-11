import { create } from 'zustand'

interface AuthState {
  isAuthenticated: boolean
  isSetupComplete: boolean
  setAuthenticated: (value: boolean) => void
  setSetupComplete: (value: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isSetupComplete: false,
  setAuthenticated: (value) => set({ isAuthenticated: value }),
  setSetupComplete: (value) => set({ isSetupComplete: value }),
  logout: () => set({ isAuthenticated: false })
}))
