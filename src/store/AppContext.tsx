import React, { createContext, Dispatch, useContext, useEffect, useReducer } from "react"
import { AppState } from "../types"
import { Action, initialState, reducer } from "./reducer"

interface AppContextValue {
  state: AppState
  dispatch: Dispatch<Action>
}

const AppContext = createContext<AppContextValue | null>(null)

const STORAGE_KEY = "classroom-placement-state-v1"

function normalizeIdList(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry) && entry > 0)
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return [value]
  }
  return []
}

function normalizeStudentLists<T extends { noContactWith?: unknown; preferredWith?: unknown }>(student: T): T {
  return {
    ...student,
    noContactWith: normalizeIdList(student.noContactWith),
    preferredWith: normalizeIdList(student.preferredWith),
  }
}

function loadPersistedState(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialState
    const parsed = JSON.parse(raw) as AppState
    const allStudents = (parsed.allStudents ?? []).map((s) => normalizeStudentLists(s))
    const classrooms = (parsed.classrooms ?? []).map((classroom) => ({
      ...classroom,
      students: (classroom.students ?? []).map((s) => normalizeStudentLists(s)),
    }))

    return {
      ...initialState,
      ...parsed,
      allStudents,
      classrooms,
      weights: { ...initialState.weights, ...parsed.weights },
    }
  } catch {
    return initialState
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState, loadPersistedState)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}
