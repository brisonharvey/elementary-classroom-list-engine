import {
  AppState,
  Classroom,
  Grade,
  RelationshipRule,
  Snapshot,
  Student,
  TeacherProfile,
  Weights,
} from "../types"
import {
  createDefaultGradeSettingsMap,
  createClassroom,
  getClassroomsForGrade,
  initializeClassrooms,
  syncClassroomsWithTeacherProfiles,
} from "../utils/classroomInit"
import { runPlacement } from "../engine/placementEngine"
import { normalizeCoTeachMinutes } from "../utils/coTeach"

export type Action =
  | { type: "LOAD_STUDENTS"; payload: Student[] }
  | { type: "LOAD_TEACHERS"; payload: TeacherProfile[] }
  | { type: "SET_ACTIVE_GRADE"; payload: Grade }
  | { type: "SET_SHOW_TEACHER_NAMES"; payload: boolean }
  | { type: "SET_WEIGHTS"; payload: Partial<Weights> }
  | { type: "SORT_CLASSROOMS_BY_LAST_NAME" }
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
  teacherProfiles: [],
  classrooms: initializeClassrooms(),
  activeGrade: "K",
  showTeacherNames: true,
  weights: { academic: 50, behavioral: 50, demographic: 50, tagSupportLoad: 50 },
  snapshots: [],
  relationshipRules: [],
  gradeSettings: createDefaultGradeSettingsMap(),
  unresolvedReasons: {},
  placementWarnings: [],
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function compareStudentsByName(a: Student, b: Student): number {
  const byLast = a.lastName.localeCompare(b.lastName, undefined, { sensitivity: "base" })
  if (byLast !== 0) return byLast
  const byFirst = a.firstName.localeCompare(b.firstName, undefined, { sensitivity: "base" })
  if (byFirst !== 0) return byFirst
  return a.id - b.id
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "LOAD_STUDENTS": {
      const freshClassrooms = syncClassroomsWithTeacherProfiles(initializeClassrooms(), state.teacherProfiles)
      const allStudents = action.payload.map((student) => ({
        ...student,
        coTeachMinutes: normalizeCoTeachMinutes(student.coTeachMinutes),
        locked: false,
      }))

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
    case "LOAD_TEACHERS": {
      const classrooms = syncClassroomsWithTeacherProfiles(state.classrooms, action.payload)
      return {
        ...state,
        teacherProfiles: action.payload,
        classrooms,
        unresolvedReasons: {},
        placementWarnings: [],
      }
    }
    case "SET_ACTIVE_GRADE":
      return { ...state, activeGrade: action.payload }
    case "SET_SHOW_TEACHER_NAMES":
      return { ...state, showTeacherNames: action.payload }
    case "SET_WEIGHTS":
      return { ...state, weights: { ...state.weights, ...action.payload } }
    case "SORT_CLASSROOMS_BY_LAST_NAME":
      return {
        ...state,
        classrooms: state.classrooms.map((classroom) => ({
          ...classroom,
          students: [...classroom.students].sort(compareStudentsByName),
        })),
      }
    case "AUTO_PLACE": {
      const settings = state.gradeSettings[state.activeGrade]
      const { classrooms, warnings, unresolvedReasons } = runPlacement(
        state.allStudents,
        state.teacherProfiles,
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
      let classrooms = state.classrooms.map((classroom) => {
        if (classroom.id === fromId) {
          const found = classroom.students.find((student) => student.id === studentId)
          if (found) movedStudent = { ...found, locked: false }
          return { ...classroom, students: classroom.students.filter((student) => student.id !== studentId) }
        }
        return classroom
      })

      if (!movedStudent) movedStudent = state.allStudents.find((student) => student.id === studentId) ?? null
      if (!movedStudent) return state

      if (toId !== null) {
        classrooms = classrooms.map((classroom) =>
          classroom.id === toId ? { ...classroom, students: [...classroom.students, movedStudent!] } : classroom
        )
      }

      return { ...state, classrooms }
    }
    case "TOGGLE_LOCK": {
      const id = action.payload
      const classrooms = state.classrooms.map((classroom) => ({
        ...classroom,
        students: classroom.students.map((student) => (student.id === id ? { ...student, locked: !student.locked } : student)),
      }))
      const allStudents = state.allStudents.map((student) => (student.id === id ? { ...student, locked: !student.locked } : student))
      return { ...state, classrooms, allStudents }
    }
    case "UPDATE_CLASSROOM": {
      const { id, ...updates } = action.payload
      return { ...state, classrooms: state.classrooms.map((classroom) => (classroom.id === id ? { ...classroom, ...updates } : classroom)) }
    }
    case "ADD_CLASSROOM": {
      const gradeRooms = getClassroomsForGrade(state.classrooms, action.payload.grade)
      const newRoom = createClassroom(action.payload.grade, gradeRooms.length)
      const classrooms = [...state.classrooms, newRoom]
      return { ...state, classrooms }
    }
    case "DELETE_CLASSROOM": {
      const room = state.classrooms.find((classroom) => classroom.id === action.payload.classroomId)
      if (!room) return state
      if (room.students.length > 0 && !action.payload.moveToUnassigned) return state
      const classrooms = state.classrooms
        .map((classroom) => (classroom.id === room.id ? { ...classroom, students: [] } : classroom))
        .filter((classroom) => classroom.id !== room.id)
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
          classrooms: deepClone(state.classrooms.filter((classroom) => classroom.grade === state.activeGrade)),
          settings: deepClone(state.gradeSettings[state.activeGrade]),
        },
      }
      return { ...state, snapshots: [...state.snapshots, snapshot] }
    }
    case "RESTORE_SNAPSHOT": {
      const snapshot = state.snapshots.find((entry) => entry.id === action.payload)
      if (!snapshot) return state
      const classrooms = [
        ...state.classrooms.filter((classroom) => classroom.grade !== snapshot.grade),
        ...deepClone(snapshot.payload.classrooms),
      ]
      return {
        ...state,
        activeGrade: snapshot.grade,
        classrooms,
        gradeSettings: { ...state.gradeSettings, [snapshot.grade]: deepClone(snapshot.payload.settings) },
      }
    }
    case "DELETE_SNAPSHOT":
      return { ...state, snapshots: state.snapshots.filter((snapshot) => snapshot.id !== action.payload) }
    case "RENAME_SNAPSHOT":
      return {
        ...state,
        snapshots: state.snapshots.map((snapshot) =>
          snapshot.id === action.payload.id ? { ...snapshot, name: action.payload.name } : snapshot
        ),
      }
    case "EDIT_SNAPSHOT_NOTE":
      return {
        ...state,
        snapshots: state.snapshots.map((snapshot) =>
          snapshot.id === action.payload.id ? { ...snapshot, note: action.payload.note } : snapshot
        ),
      }
    case "DUPLICATE_SNAPSHOT": {
      const original = state.snapshots.find((snapshot) => snapshot.id === action.payload)
      if (!original) return state
      const duplicate: Snapshot = {
        ...deepClone(original),
        id: `snap-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
        name: `${original.name} (Copy)`,
        createdAt: Date.now(),
      }
      return { ...state, snapshots: [...state.snapshots, duplicate] }
    }
    case "UPSERT_RELATIONSHIP_RULE": {
      const existing = state.relationshipRules.find((rule) => rule.id === action.payload.id)
      const relationshipRules = existing
        ? state.relationshipRules.map((rule) => (rule.id === action.payload.id ? action.payload : rule))
        : [...state.relationshipRules, action.payload]
      return { ...state, relationshipRules }
    }
    case "DELETE_RELATIONSHIP_RULE":
      return { ...state, relationshipRules: state.relationshipRules.filter((rule) => rule.id !== action.payload) }
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
      const classrooms = state.classrooms.map((classroom) =>
        classroom.grade !== state.activeGrade ? classroom : { ...classroom, students: classroom.students.filter((student) => student.locked) }
      )
      return { ...state, classrooms, placementWarnings: [], unresolvedReasons: {} }
    }
    case "CLEAR_ALL":
      return { ...initialState }
    default:
      return state
  }
}

