import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

/*
  Dashboard edit-mode state, shared between the header buttons (Pencil / Plus /
  Trash2, which live in the PageHeader) and the WidgetGrid (which owns the layout
  and measurement). Edit mode is opt-in and always starts OFF on load - a user
  who never clicks the pencil sees the static grid, unchanged.

  WidgetGrid publishes its imperative actions (which widgets can be added, and
  the add/reset handlers - all of which need the grid's live layout + measured
  heights) up through `gridActions` so the header can invoke them.
*/

export interface GridActions {
  // Registry widgets not currently in the layout, offered by the Add menu.
  availableWidgets: { id: string; title: string }[]
  addWidget: (id: string) => void
  resetLayout: () => void
}

interface DashboardEditValue {
  editMode: boolean
  toggleEditMode: () => void
  addMenuOpen: boolean
  openAddMenu: () => void
  closeAddMenu: () => void
  gridActions: GridActions | null
  setGridActions: (actions: GridActions | null) => void
}

const DashboardEditContext = createContext<DashboardEditValue | null>(null)

export function DashboardEditProvider({ children }: { children: ReactNode }) {
  const [editMode, setEditMode] = useState(false)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [gridActions, setGridActions] = useState<GridActions | null>(null)

  const toggleEditMode = useCallback(() => {
    setEditMode((on) => {
      const next = !on
      if (!next) setAddMenuOpen(false) // leaving edit mode closes the add menu
      return next
    })
  }, [])

  // Plus is only meaningful in edit mode: turn edit mode on, then open the menu.
  const openAddMenu = useCallback(() => {
    setEditMode(true)
    setAddMenuOpen(true)
  }, [])
  const closeAddMenu = useCallback(() => setAddMenuOpen(false), [])

  const value = useMemo(
    () => ({
      editMode,
      toggleEditMode,
      addMenuOpen,
      openAddMenu,
      closeAddMenu,
      gridActions,
      setGridActions,
    }),
    [editMode, toggleEditMode, addMenuOpen, openAddMenu, closeAddMenu, gridActions],
  )

  return <DashboardEditContext.Provider value={value}>{children}</DashboardEditContext.Provider>
}

export function useDashboardEdit(): DashboardEditValue {
  const ctx = useContext(DashboardEditContext)
  if (!ctx) throw new Error('useDashboardEdit must be used within a DashboardEditProvider')
  return ctx
}
