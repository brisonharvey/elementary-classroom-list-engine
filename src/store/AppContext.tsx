import React, { createContext, Dispatch, useContext, useEffect, useReducer } from "react"
import { AppState, Classroom, Student } from "../types"
import { createDefaultGradeSettingsMap, getRoomLabelFromIndex } from "../utils/classroomInit"
import { normalizeCoTeachMinutes } from "../utils/coTeach"
import { Action, initialState, reducer } from "./reducer"

interface AppContextValue {
  state: AppState
  dispatch: Dispatch<Action>
}

const AppContext = createContext<AppContextValue | null>(null)

const STORAGE_KEY = "classroom-placement-state-v2"

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

function normalizeStudent(student: Student): Student {
  const readingLegacy = student.specialEd.requiresCoTeachReading ? 30 : 0
  const mathLegacy = student.specialEd.requiresCoTeachMath ? 30 : 0
  const migratedMinutes = {
    ...student.coTeachMinutes,
    ...(readingLegacy > 0 ? { reading: Math.max(student.coTeachMinutes?.reading ?? 0, readingLegacy) } : {}),
    ...(mathLegacy > 0 ? { math: Math.max(student.coTeachMinutes?.math ?? 0, mathLegacy) } : {}),
  }

  return {
    ...normalizeStudentLists(student),
    coTeachMinutes: normalizeCoTeachMinutes(migratedMinutes),
  }
}

function normalizeClassroom(classroom: Classroom, index: number): Classroom {
  const legacyCoTeach = (classroom as Classroom & { coTeach?: { reading?: boolean; math?: boolean } }).coTeach
  const legacyCoverage = [
    ...(legacyCoTeach?.reading ? ["reading" as const] : []),
    ...(legacyCoTeach?.math ? ["math" as const] : []),
  ]

  return {
    ...classroom,
    label: classroom.label ?? getRoomLabelFromIndex(index % 4),
    coTeachCoverage: Array.from(new Set([...(classroom.coTeachCoverage ?? []), ...legacyCoverage])),
    students: (classroom.students ?? []).map((s) => normalizeStudent(s)),
  }
}

function loadPersistedState(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem("classroom-placement-state-v1")
    if (!raw) return initialState
    const parsed = JSON.parse(raw) as Partial<AppState>
    const allStudents = (parsed.allStudents ?? []).map((s) => normalizeStudent(s as Student))
    const classroomSource = parsed.classrooms && parsed.classrooms.length > 0 ? parsed.classrooms : initialState.classrooms
    const classrooms = classroomSource.map((classroom, index) => normalizeClassroom(classroom, index))

    const hadLegacyStudentFlags = (parsed.allStudents ?? []).some(
      (s) => (s as Student).specialEd?.requiresCoTeachReading || (s as Student).specialEd?.requiresCoTeachMath
    )
    const hadLegacyRoomFlags = (parsed.classrooms ?? []).some((c) => (c as Classroom & { coTeach?: unknown }).coTeach)

    const defaultSettings = createDefaultGradeSettingsMap()
    const migrationWarnings: string[] = []
    if (hadLegacyStudentFlags) {
      migrationWarnings.push("Migrated legacy student co-teach flags to 30-minute category defaults (reading/math). Please review minutes.")
    }
    if (hadLegacyRoomFlags) {
      migrationWarnings.push("Migrated legacy room co-teach toggles to category coverage.")
    }

    return {
      ...initialState,
      ...parsed,
      allStudents,
      classrooms,
      gradeSettings: { ...defaultSettings, ...(parsed.gradeSettings ?? {}) },
      unresolvedReasons: parsed.unresolvedReasons ?? {},
      relationshipRules: parsed.relationshipRules ?? [],
      weights: { ...initialState.weights, ...(parsed.weights ?? {}) },
      placementWarnings: [...(parsed.placementWarnings ?? []), ...migrationWarnings],
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
