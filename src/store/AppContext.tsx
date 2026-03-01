import React, { createContext, Dispatch, useContext, useEffect, useReducer } from "react"
import { AppState } from "../types"
import { Action, initialState, reducer } from "./reducer"

interface AppContextValue {
  state: AppState
  dispatch: Dispatch<Action>
}

const AppContext = createContext<AppContextValue | null>(null)

const STORAGE_KEY = "classroom-placement-state-v1"

function loadPersistedState(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialState
    const parsed = JSON.parse(raw) as AppState
    return {
      ...initialState,
      ...parsed,
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
