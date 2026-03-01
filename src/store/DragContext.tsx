import React, { createContext, useCallback, useContext, useState } from "react"

interface DragState {
  studentId: number | null
  fromId: string | null // null = from unassigned panel
}

interface DragContextValue {
  drag: DragState
  startDrag: (studentId: number, fromId: string | null) => void
  clearDrag: () => void
}

const DragContext = createContext<DragContextValue>({
  drag: { studentId: null, fromId: null },
  startDrag: () => {},
  clearDrag: () => {},
})

export function DragProvider({ children }: { children: React.ReactNode }) {
  const [drag, setDrag] = useState<DragState>({ studentId: null, fromId: null })

  const startDrag = useCallback((studentId: number, fromId: string | null) => {
    setDrag({ studentId, fromId })
  }, [])

  const clearDrag = useCallback(() => {
    setDrag({ studentId: null, fromId: null })
  }, [])

  return (
    <DragContext.Provider value={{ drag, startDrag, clearDrag }}>
      {children}
    </DragContext.Provider>
  )
}

export function useDrag() {
  return useContext(DragContext)
}
