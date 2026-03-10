import React, { createContext, Dispatch, useContext, useEffect, useReducer } from "react"
import { AppState, Classroom, Snapshot, STUDENT_TAGS, Student, TeacherProfile } from "../types"
import {
  createDefaultGradeSettingsMap,
  getRoomLabelFromIndex,
  normalizeGradeSettings,
  normalizeGradeSettingsMap,
} from "../utils/classroomInit"
import { normalizeCoTeachMinutes } from "../utils/coTeach"
import { Action, initialState, reducer } from "./reducer"

interface AppContextValue {
  state: AppState
  dispatch: Dispatch<Action>
}

const AppContext = createContext<AppContextValue | null>(null)

const STORAGE_KEY = "classroom-placement-state-v4"

function normalizeIdList(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry) && entry > 0)
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return [value]
  }
  return []
}

function normalizeTagList(value: unknown): Student["tags"] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (entry): entry is (typeof STUDENT_TAGS)[number] =>
      typeof entry === "string" && STUDENT_TAGS.includes(entry as (typeof STUDENT_TAGS)[number])
  )
}

function normalizeStudentLists<T extends { noContactWith?: unknown; preferredWith?: unknown; tags?: unknown }>(student: T): T {
  return {
    ...student,
    noContactWith: normalizeIdList(student.noContactWith),
    preferredWith: normalizeIdList(student.preferredWith),
    tags: normalizeTagList(student.tags),
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
    locked: Boolean(student.locked),
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
    students: (classroom.students ?? []).map((student) => normalizeStudent(student)),
  }
}

function normalizeTeacherProfile(profile: TeacherProfile): TeacherProfile {
  const normalizeRating = (value: unknown): 1 | 2 | 3 | 4 | 5 => {
    if (typeof value !== "number" || !Number.isFinite(value)) return 3
    return Math.max(1, Math.min(5, Math.round(value))) as 1 | 2 | 3 | 4 | 5
  }

  return {
    ...profile,
    id: profile.id || `${profile.grade}:${profile.teacherName.trim().toLowerCase()}`,
    teacherName: profile.teacherName?.trim() || "",
    characteristics: {
      classroomStructure: normalizeRating(profile.characteristics?.classroomStructure),
      behaviorManagementStrength: normalizeRating(profile.characteristics?.behaviorManagementStrength),
      emotionalSupportNurturing: normalizeRating(profile.characteristics?.emotionalSupportNurturing),
      academicEnrichmentStrength: normalizeRating(profile.characteristics?.academicEnrichmentStrength),
      independenceScaffolding: normalizeRating(profile.characteristics?.independenceScaffolding),
      movementFlexibility: normalizeRating(profile.characteristics?.movementFlexibility),
      peerSocialCoaching: normalizeRating(profile.characteristics?.peerSocialCoaching),
      confidenceBuilding: normalizeRating(profile.characteristics?.confidenceBuilding),
    },
  }
}

function normalizeSnapshot(snapshot: Snapshot): Snapshot {
  return {
    ...snapshot,
    payload: {
      classrooms: (snapshot.payload?.classrooms ?? []).map((classroom, index) => normalizeClassroom(classroom, index)),
      settings: normalizeGradeSettings(snapshot.payload?.settings),
    },
  }
}

function loadPersistedState(): AppState {
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem("classroom-placement-state-v3") ??
      window.localStorage.getItem("classroom-placement-state-v2") ??
      window.localStorage.getItem("classroom-placement-state-v1")
    if (!raw) return initialState
    const parsed = JSON.parse(raw) as Partial<AppState>
    const allStudents = (parsed.allStudents ?? []).map((student) => normalizeStudent(student as Student))
    const classroomSource = parsed.classrooms && parsed.classrooms.length > 0 ? parsed.classrooms : initialState.classrooms
    const classrooms = classroomSource.map((classroom, index) => normalizeClassroom(classroom, index))
    const teacherProfiles = (parsed.teacherProfiles ?? []).map((profile) => normalizeTeacherProfile(profile as TeacherProfile))
    const snapshots = (parsed.snapshots ?? []).map((snapshot) => normalizeSnapshot(snapshot as Snapshot))

    const hadLegacyStudentFlags = (parsed.allStudents ?? []).some(
      (student) => (student as Student).specialEd?.requiresCoTeachReading || (student as Student).specialEd?.requiresCoTeachMath
    )
    const hadLegacyRoomFlags = (parsed.classrooms ?? []).some((classroom) => (classroom as Classroom & { coTeach?: unknown }).coTeach)

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
      teacherProfiles,
      classrooms,
      snapshots,
      gradeSettings: parsed.gradeSettings ? normalizeGradeSettingsMap(parsed.gradeSettings) : defaultSettings,
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
