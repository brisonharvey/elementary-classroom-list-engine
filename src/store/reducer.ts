import { AppState, Classroom, Grade, Snapshot, Student, Weights } from "../types"
import { initializeClassrooms } from "../utils/classroomInit"
import { runPlacement } from "../engine/placementEngine"

// ─────────────────────────────────────────────
// Action types
// ─────────────────────────────────────────────
export type Action =
  | { type: "LOAD_STUDENTS"; payload: Student[] }
  | { type: "SET_ACTIVE_GRADE"; payload: Grade }
  | { type: "SET_WEIGHTS"; payload: Partial<Weights> }
  | { type: "AUTO_PLACE" }
  | { type: "MOVE_STUDENT"; payload: { studentId: number; fromId: string | null; toId: string | null } }
  | { type: "TOGGLE_LOCK"; payload: number }
  | { type: "UPDATE_CLASSROOM"; payload: Partial<Classroom> & { id: string } }
  | { type: "SAVE_SNAPSHOT"; payload: string }
  | { type: "RESTORE_SNAPSHOT"; payload: string }
  | { type: "DELETE_SNAPSHOT"; payload: string }
  | { type: "RESET_GRADE" }
  | { type: "CLEAR_ALL" }

// ─────────────────────────────────────────────
// Initial state
// ─────────────────────────────────────────────
export const initialState: AppState = {
  allStudents: [],
  classrooms: initializeClassrooms(),
  activeGrade: "K",
  weights: { academic: 50, behavioral: 50, demographic: 50 },
  snapshots: [],
  placementWarnings: [],
}

// ─────────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────────
export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    // ── Load students from CSV ──────────────────
    case "LOAD_STUDENTS": {
      const freshClassrooms = initializeClassrooms()
      const rawStudents = action.payload

      // ── Step 1: Build teacher name → classroom ID mapping ──────────────────
      // Collect unique (grade, teacherName) pairs in first-appearance order,
      // then assign them to classrooms A → D within each grade.
      const seen = new Set<string>()
      const combos: Array<{ grade: string; teacherName: string }> = []
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
        const gradeRooms = freshClassrooms.filter((c) => c.grade === grade)
        // Reuse a classroom that already has this teacher name assigned
        const existing = gradeRooms.find((c) => c.teacherName === teacherName)
        if (existing) {
          teacherToClassroomId.set(`${grade}:${teacherName}`, existing.id)
          continue
        }
        // Otherwise claim the next classroom without a teacher name
        const available = gradeRooms.find((c) => !c.teacherName)
        if (available) {
          available.teacherName = teacherName
          teacherToClassroomId.set(`${grade}:${teacherName}`, available.id)
        }
        // If all 4 classrooms are already claimed, the student will remain unassigned
      }

      // ── Step 2: Mark pre-assigned students as locked ───────────────────────
      const allStudents = rawStudents.map((s) =>
        s.preassignedTeacher ? { ...s, locked: true } : s
      )

      // ── Step 3: Place pre-assigned students into their classrooms ──────────
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
        placementWarnings: [],
      }
    }

    // ── Active grade ────────────────────────────
    case "SET_ACTIVE_GRADE": {
      return { ...state, activeGrade: action.payload }
    }

    // ── Weight sliders ──────────────────────────
    case "SET_WEIGHTS": {
      return { ...state, weights: { ...state.weights, ...action.payload } }
    }

    // ── Auto-placement ──────────────────────────
    case "AUTO_PLACE": {
      const { classrooms, warnings } = runPlacement(
        state.allStudents,
        state.classrooms,
        state.activeGrade,
        state.weights
      )
      return { ...state, classrooms, placementWarnings: warnings }
    }

    // ── Manual student move ─────────────────────
    case "MOVE_STUDENT": {
      const { studentId, fromId, toId } = action.payload
      if (fromId === toId) return state

      let movedStudent: Student | null = null
      let classrooms = state.classrooms.map((c) => {
        if (c.id === fromId) {
          const found = c.students.find((s) => s.id === studentId)
          if (found) movedStudent = { ...found, locked: false } // unlock on manual move
          return { ...c, students: c.students.filter((s) => s.id !== studentId) }
        }
        return c
      })

      // If not found in any classroom, look in allStudents (was unassigned)
      if (!movedStudent) {
        movedStudent = state.allStudents.find((s) => s.id === studentId) ?? null
      }

      if (!movedStudent) return state

      if (toId !== null) {
        classrooms = classrooms.map((c) => {
          if (c.id === toId) {
            return { ...c, students: [...c.students, movedStudent!] }
          }
          return c
        })
      }

      return { ...state, classrooms }
    }

    // ── Lock/unlock toggle ──────────────────────
    case "TOGGLE_LOCK": {
      const id = action.payload
      const classrooms = state.classrooms.map((c) => ({
        ...c,
        students: c.students.map((s) => (s.id === id ? { ...s, locked: !s.locked } : s)),
      }))
      const allStudents = state.allStudents.map((s) => (s.id === id ? { ...s, locked: !s.locked } : s))
      return { ...state, classrooms, allStudents }
    }

    // ── Classroom settings update ───────────────
    case "UPDATE_CLASSROOM": {
      const { id, ...updates } = action.payload
      const classrooms = state.classrooms.map((c) => (c.id === id ? { ...c, ...updates } : c))
      return { ...state, classrooms }
    }

    // ── Snapshots ───────────────────────────────
    case "SAVE_SNAPSHOT": {
      const snapshot: Snapshot = {
        id: `snap-${Date.now()}`,
        name: action.payload,
        timestamp: Date.now(),
        classrooms: JSON.parse(JSON.stringify(state.classrooms)),
      }
      return { ...state, snapshots: [...state.snapshots, snapshot] }
    }

    case "RESTORE_SNAPSHOT": {
      const snap = state.snapshots.find((s) => s.id === action.payload)
      if (!snap) return state
      return { ...state, classrooms: JSON.parse(JSON.stringify(snap.classrooms)) }
    }

    case "DELETE_SNAPSHOT": {
      return { ...state, snapshots: state.snapshots.filter((s) => s.id !== action.payload) }
    }

    // ── Reset active grade (clear unlocked) ─────
    case "RESET_GRADE": {
      const classrooms = state.classrooms.map((c) => {
        if (c.grade !== state.activeGrade) return c
        return { ...c, students: c.students.filter((s) => s.locked) }
      })
      return { ...state, classrooms, placementWarnings: [] }
    }

    // ── Full reset ──────────────────────────────
    case "CLEAR_ALL": {
      return { ...initialState }
    }

    default:
      return state
  }
}
