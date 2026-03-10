import React, { createContext, Dispatch, useContext, useEffect, useReducer } from "react"
import { AppState, Classroom, LEGACY_STUDENT_TAG_ALIASES, Snapshot, STUDENT_TAGS, Student, TeacherProfile } from "../types"
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

const STORAGE_KEY = "classroom-placement-state-v5"

type LegacyTeacherCharacteristics = {
  classroomStructure?: unknown
  behaviorManagementStrength?: unknown
  emotionalSupportNurturing?: unknown
  academicEnrichmentStrength?: unknown
  independenceScaffolding?: unknown
  movementFlexibility?: unknown
  peerSocialCoaching?: unknown
  confidenceBuilding?: unknown
}

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

  const normalizedTags = value
    .map((entry) => {
      if (typeof entry !== "string") return null
      if (STUDENT_TAGS.includes(entry as (typeof STUDENT_TAGS)[number])) return entry as (typeof STUDENT_TAGS)[number]
      return LEGACY_STUDENT_TAG_ALIASES[entry] ?? null
    })
    .filter((entry): entry is (typeof STUDENT_TAGS)[number] => entry != null)

  return Array.from(new Set(normalizedTags))
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
    academicTierNotes: student.academicTierNotes?.trim() || undefined,
    behaviorTierNotes: student.behaviorTierNotes?.trim() || undefined,
    teacherNotes: student.teacherNotes?.trim() || undefined,
    ireadyReading: student.ireadyReading?.trim() || undefined,
    ireadyMath: student.ireadyMath?.trim() || undefined,
    preassignedTeacher: student.preassignedTeacher?.trim() || undefined,
    raceEthnicity: student.raceEthnicity?.trim() || undefined,
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

  const normalizeAverage = (entries: Array<{ value: unknown; weight: number }>): 1 | 2 | 3 | 4 | 5 => {
    const usable = entries
      .map(({ value, weight }) => ({ value: typeof value === "number" && Number.isFinite(value) ? value : null, weight }))
      .filter((entry): entry is { value: number; weight: number } => entry.value != null)

    if (usable.length === 0) return 3

    const totalWeight = usable.reduce((sum, entry) => sum + entry.weight, 0)
    const weightedAverage = usable.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / totalWeight
    return normalizeRating(weightedAverage)
  }

  const characteristics = (profile.characteristics ?? {}) as TeacherProfile["characteristics"] & LegacyTeacherCharacteristics

  const hasNewCharacteristics =
    characteristics.structure != null ||
    characteristics.regulationBehaviorSupport != null ||
    characteristics.socialEmotionalSupport != null ||
    characteristics.instructionalExpertise != null

  return {
    ...profile,
    id: profile.id || `${profile.grade}:${profile.teacherName.trim().toLowerCase()}`,
    teacherName: profile.teacherName?.trim() || "",
    characteristics: hasNewCharacteristics
      ? {
          structure: normalizeRating(characteristics.structure),
          regulationBehaviorSupport: normalizeRating(characteristics.regulationBehaviorSupport),
          socialEmotionalSupport: normalizeRating(characteristics.socialEmotionalSupport),
          instructionalExpertise: normalizeRating(characteristics.instructionalExpertise),
        }
      : {
          structure: normalizeAverage([
            { value: characteristics.classroomStructure, weight: 0.75 },
            { value: characteristics.independenceScaffolding, weight: 0.25 },
          ]),
          regulationBehaviorSupport: normalizeAverage([
            { value: characteristics.behaviorManagementStrength, weight: 0.55 },
            { value: characteristics.classroomStructure, weight: 0.2 },
            { value: characteristics.movementFlexibility, weight: 0.25 },
          ]),
          socialEmotionalSupport: normalizeAverage([
            { value: characteristics.emotionalSupportNurturing, weight: 0.5 },
            { value: characteristics.peerSocialCoaching, weight: 0.25 },
            { value: characteristics.confidenceBuilding, weight: 0.25 },
          ]),
          instructionalExpertise: normalizeAverage([
            { value: characteristics.academicEnrichmentStrength, weight: 0.6 },
            { value: characteristics.independenceScaffolding, weight: 0.25 },
            { value: characteristics.confidenceBuilding, weight: 0.15 },
          ]),
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
      window.localStorage.getItem("classroom-placement-state-v4") ??
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
    const hadLegacyStudentTags = (parsed.allStudents ?? []).some((student) =>
      ((student as Student).tags ?? []).some((tag) => typeof tag === "string" && LEGACY_STUDENT_TAG_ALIASES[tag] != null)
    )
    const hadLegacyTeacherCharacteristics = (parsed.teacherProfiles ?? []).some((profile) => {
      const characteristics = (profile as TeacherProfile).characteristics as TeacherProfile["characteristics"] & LegacyTeacherCharacteristics
      return characteristics?.structure == null && characteristics?.classroomStructure != null
    })

    const defaultSettings = createDefaultGradeSettingsMap()
    const migrationWarnings: string[] = []
    if (hadLegacyStudentFlags) {
      migrationWarnings.push("Migrated legacy student co-teach flags to 30-minute category defaults (reading/math). Please review minutes.")
    }
    if (hadLegacyRoomFlags) {
      migrationWarnings.push("Migrated legacy room co-teach toggles to category coverage.")
    }
    if (hadLegacyStudentTags) {
      migrationWarnings.push("Mapped retired student characteristics to the current characteristic list.")
    }
    if (hadLegacyTeacherCharacteristics) {
      migrationWarnings.push("Mapped retired teacher characteristics into the current four-category teacher profile.")
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
