import { create } from 'zustand'

type Page = 'students' | 'classes' | 'attendance' | 'marks' | 'promotions' | 'yearEnd' | 'settings' | 'export'

interface UiState {
  currentPage: Page
  sidebarCollapsed: boolean
  setCurrentPage: (page: Page) => void
  toggleSidebar: () => void
}

export const useUiStore = create<UiState>((set) => ({
  currentPage: 'students',
  sidebarCollapsed: false,
  setCurrentPage: (page) => set({ currentPage: page }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }))
}))
