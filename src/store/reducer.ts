import {
  AppState,
  Classroom,
  Grade,
  RelationshipRule,
  Snapshot,
  Student,
  Weights,
} from "../types"
import {
  createClassroom,
  createDefaultGradeSettingsMap,
  getClassroomsForGrade,
  getRoomLabelFromIndex,
  initializeClassrooms,
} from "../utils/classroomInit"
import { runPlacement } from "../engine/placementEngine"
import { normalizeCoTeachMinutes } from "../utils/coTeach"

export type Action =
  | { type: "LOAD_STUDENTS"; payload: Student[] }
  | { type: "SET_ACTIVE_GRADE"; payload: Grade }
  | { type: "SET_WEIGHTS"; payload: Partial<Weights> }
  | { type: "AUTO_PLACE" }
  | { type: "MOVE_STUDENT"; payload: { studentId: number; fromId: string | null; toId: string | null } }
  | { type: "TOGGLE_LOCK"; payload: number }
  | { type: "UPDATE_CLASSROOM"; payload: Partial<Classroom> & { id: string } }
  | { type: "ADD_CLASSROOM"; payload: { grade: Grade } }
  | { type: "DELETE_CLASSROOM"; payload: { classroomId: string; moveToUnassigned: boolean } }
  | { type: "SAVE_SNAPSHOT"; payload: { name: string; note?: string } }
  | { type: "RESTORE_SNAPSHOT"; payload: string }
  | { type: "DELETE_SNAPSHOT"; payload: string }
  | { type: "RENAME_SNAPSHOT"; payload: { id: string; name: string } }
  | { type: "EDIT_SNAPSHOT_NOTE"; payload: { id: string; note: string } }
  | { type: "DUPLICATE_SNAPSHOT"; payload: string }
  | { type: "UPSERT_RELATIONSHIP_RULE"; payload: RelationshipRule }
  | { type: "DELETE_RELATIONSHIP_RULE"; payload: string }
  | { type: "UPDATE_GRADE_SETTINGS"; payload: { grade: Grade; updates: Partial<AppState["gradeSettings"][Grade]> } }
  | { type: "RESET_GRADE_SETTINGS"; payload: Grade }
  | { type: "RESET_GRADE" }
  | { type: "CLEAR_ALL" }

export const initialState: AppState = {
  allStudents: [],
  classrooms: initializeClassrooms(),
  activeGrade: "K",
  weights: { academic: 50, behavioral: 50, demographic: 50 },
  snapshots: [],
  relationshipRules: [],
  gradeSettings: createDefaultGradeSettingsMap(),
  unresolvedReasons: {},
  placementWarnings: [],
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "LOAD_STUDENTS": {
      const freshClassrooms = initializeClassrooms()
      const rawStudents = action.payload

      const seen = new Set<string>()
      const combos: Array<{ grade: Grade; teacherName: string }> = []
      for (const s of rawStudents) {
        if (!s.preassignedTeacher) continue
        const key = `${s.grade}:${s.preassignedTeacher}`
        if (!seen.has(key)) {
          seen.add(key)
          combos.push({ grade: s.grade, teacherName: s.preassignedTeacher })
        }
      }

      const teacherToClassroomId = new Map<string, string>()
      for (const { grade, teacherName } of combos) {
        let gradeRooms = getClassroomsForGrade(freshClassrooms, grade)
        const existing = gradeRooms.find((c) => c.teacherName === teacherName)
        if (existing) {
          teacherToClassroomId.set(`${grade}:${teacherName}`, existing.id)
          continue
        }

        let available = gradeRooms.find((c) => !c.teacherName)
        if (!available) {
          const newRoom = createClassroom(grade, gradeRooms.length)
          freshClassrooms.push(newRoom)
          gradeRooms = getClassroomsForGrade(freshClassrooms, grade)
          available = newRoom
          for (const room of gradeRooms) {
            room.label = getRoomLabelFromIndex(gradeRooms.indexOf(room))
          }
        }
        available.teacherName = teacherName
        teacherToClassroomId.set(`${grade}:${teacherName}`, available.id)
      }

      const allStudents = rawStudents.map((s) => ({ ...s, coTeachMinutes: normalizeCoTeachMinutes(s.coTeachMinutes), locked: s.preassignedTeacher ? true : s.locked }))

      for (const student of allStudents) {
        if (!student.preassignedTeacher) continue
        const key = `${student.grade}:${student.preassignedTeacher}`
        const classroomId = teacherToClassroomId.get(key)
        if (!classroomId) continue
        const classroom = freshClassrooms.find((c) => c.id === classroomId)
        if (classroom && classroom.students.length < classroom.maxSize) {
          classroom.students.push({ ...student })
        }
      }

      return {
        ...state,
        allStudents,
        classrooms: freshClassrooms,
        snapshots: [],
        relationshipRules: [],
        unresolvedReasons: {},
        placementWarnings: [],
      }
    }
    case "SET_ACTIVE_GRADE":
      return { ...state, activeGrade: action.payload }
    case "SET_WEIGHTS":
      return { ...state, weights: { ...state.weights, ...action.payload } }
    case "AUTO_PLACE": {
      const settings = state.gradeSettings[state.activeGrade]
      const { classrooms, warnings, unresolvedReasons } = runPlacement(
        state.allStudents,
        state.classrooms,
        state.activeGrade,
        state.weights,
        settings,
        state.relationshipRules
      )
      return { ...state, classrooms, unresolvedReasons, placementWarnings: warnings }
    }
    case "MOVE_STUDENT": {
      const { studentId, fromId, toId } = action.payload
      if (fromId === toId) return state

      let movedStudent: Student | null = null
      let classrooms = state.classrooms.map((c) => {
        if (c.id === fromId) {
          const found = c.students.find((s) => s.id === studentId)
          if (found) movedStudent = { ...found, locked: false }
          return { ...c, students: c.students.filter((s) => s.id !== studentId) }
        }
        return c
      })

      if (!movedStudent) movedStudent = state.allStudents.find((s) => s.id === studentId) ?? null
      if (!movedStudent) return state

      if (toId !== null) {
        classrooms = classrooms.map((c) => (c.id === toId ? { ...c, students: [...c.students, movedStudent!] } : c))
      }

      return { ...state, classrooms }
    }
    case "TOGGLE_LOCK": {
      const id = action.payload
      const classrooms = state.classrooms.map((c) => ({
        ...c,
        students: c.students.map((s) => (s.id === id ? { ...s, locked: !s.locked } : s)),
      }))
      const allStudents = state.allStudents.map((s) => (s.id === id ? { ...s, locked: !s.locked } : s))
      return { ...state, classrooms, allStudents }
    }
    case "UPDATE_CLASSROOM": {
      const { id, ...updates } = action.payload
      return { ...state, classrooms: state.classrooms.map((c) => (c.id === id ? { ...c, ...updates } : c)) }
    }
    case "ADD_CLASSROOM": {
      const gradeRooms = getClassroomsForGrade(state.classrooms, action.payload.grade)
      const newRoom = createClassroom(action.payload.grade, gradeRooms.length)
      const classrooms = [...state.classrooms, newRoom]
      return { ...state, classrooms }
    }
    case "DELETE_CLASSROOM": {
      const room = state.classrooms.find((c) => c.id === action.payload.classroomId)
      if (!room) return state
      if (room.students.length > 0 && !action.payload.moveToUnassigned) return state
      const classrooms = state.classrooms.map((c) => (c.id === room.id ? { ...c, students: [] } : c)).filter((c) => c.id !== room.id)
      return { ...state, classrooms }
    }
    case "SAVE_SNAPSHOT": {
      const snapshot: Snapshot = {
        id: `snap-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
        grade: state.activeGrade,
        name: action.payload.name,
        note: action.payload.note,
        createdAt: Date.now(),
        payload: {
          classrooms: deepClone(state.classrooms.filter((c) => c.grade === state.activeGrade)),
          settings: deepClone(state.gradeSettings[state.activeGrade]),
        },
      }
      return { ...state, snapshots: [...state.snapshots, snapshot] }
    }
    case "RESTORE_SNAPSHOT": {
      const snap = state.snapshots.find((s) => s.id === action.payload)
      if (!snap) return state
      const classrooms = [
        ...state.classrooms.filter((c) => c.grade !== snap.grade),
        ...deepClone(snap.payload.classrooms),
      ]
      return {
        ...state,
        activeGrade: snap.grade,
        classrooms,
        gradeSettings: { ...state.gradeSettings, [snap.grade]: deepClone(snap.payload.settings) },
      }
    }
    case "DELETE_SNAPSHOT":
      return { ...state, snapshots: state.snapshots.filter((s) => s.id !== action.payload) }
    case "RENAME_SNAPSHOT":
      return {
        ...state,
        snapshots: state.snapshots.map((s) => (s.id === action.payload.id ? { ...s, name: action.payload.name } : s)),
      }
    case "EDIT_SNAPSHOT_NOTE":
      return {
        ...state,
        snapshots: state.snapshots.map((s) => (s.id === action.payload.id ? { ...s, note: action.payload.note } : s)),
      }
    case "DUPLICATE_SNAPSHOT": {
      const original = state.snapshots.find((s) => s.id === action.payload)
      if (!original) return state
      const dup: Snapshot = {
        ...deepClone(original),
        id: `snap-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
        name: `${original.name} (Copy)`,
        createdAt: Date.now(),
      }
      return { ...state, snapshots: [...state.snapshots, dup] }
    }
    case "UPSERT_RELATIONSHIP_RULE": {
      const existing = state.relationshipRules.find((r) => r.id === action.payload.id)
      const relationshipRules = existing
        ? state.relationshipRules.map((r) => (r.id === action.payload.id ? action.payload : r))
        : [...state.relationshipRules, action.payload]
      return { ...state, relationshipRules }
    }
    case "DELETE_RELATIONSHIP_RULE":
      return { ...state, relationshipRules: state.relationshipRules.filter((r) => r.id !== action.payload) }
    case "UPDATE_GRADE_SETTINGS":
      return {
        ...state,
        gradeSettings: {
          ...state.gradeSettings,
          [action.payload.grade]: {
            ...state.gradeSettings[action.payload.grade],
            ...action.payload.updates,
          },
        },
      }
    case "RESET_GRADE_SETTINGS":
      return {
        ...state,
        gradeSettings: { ...state.gradeSettings, [action.payload]: createDefaultGradeSettingsMap()[action.payload] },
      }
    case "RESET_GRADE": {
      const classrooms = state.classrooms.map((c) =>
        c.grade !== state.activeGrade ? c : { ...c, students: c.students.filter((s) => s.locked) }
      )
      return { ...state, classrooms, placementWarnings: [], unresolvedReasons: {} }
    }
    case "CLEAR_ALL":
      return { ...initialState }
    default:
      return state
  }
}
