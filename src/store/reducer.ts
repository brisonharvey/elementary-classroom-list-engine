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
  normalizeGradeSettings,
  syncClassroomsWithTeacherProfiles,
} from "../utils/classroomInit"
import { runPlacement } from "../engine/placementEngine"
import { normalizeCoTeachMinutes } from "../utils/coTeach"
import { collectAssignedTeacherPlacementIssues } from "../utils/teacherAssignments"

export type Action =
  | { type: "LOAD_STUDENTS"; payload: Student[] }
  | { type: "LOAD_TEACHERS"; payload: TeacherProfile[] }
  | { type: "UPSERT_STUDENT"; payload: { student: Student; previousId?: number } }
  | { type: "DELETE_STUDENT"; payload: number }
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
  | { type: "UPSERT_NO_CONTACT_PAIR"; payload: { grade: Grade; studentIds: [number, number]; note?: string } }
  | { type: "DELETE_NO_CONTACT_PAIR"; payload: { grade: Grade; studentIds: [number, number] } }
  | { type: "UPDATE_GRADE_SETTINGS"; payload: { grade: Grade; updates: Partial<AppState["gradeSettings"][Grade]> } }
  | { type: "APPLY_GRADE_SETTINGS_TO_ALL"; payload: GradeSettingsPayload }
  | { type: "RESET_GRADE_SETTINGS"; payload: Grade }
  | { type: "RESET_GRADE" }
  | { type: "CLEAR_ALL" }

interface GradeSettingsPayload extends Partial<AppState["gradeSettings"][Grade]> {}

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

function uniqueStudentIds(ids: number[] | undefined, selfId: number): number[] {
  return Array.from(new Set((ids ?? []).filter((id) => Number.isFinite(id) && id > 0 && id !== selfId)))
}

function normalizeStudentRecord(student: Student): Student {
  return {
    ...student,
    firstName: student.firstName.trim() || "Student",
    lastName: student.lastName.trim() || `${student.id}`,
    preassignedTeacher: student.preassignedTeacher?.trim() || undefined,
    raceEthnicity: student.raceEthnicity?.trim() || undefined,
    teacherNotes: student.teacherNotes?.trim() || undefined,
    academicTierNotes: student.academicTierNotes?.trim() || undefined,
    behaviorTierNotes: student.behaviorTierNotes?.trim() || undefined,
    ireadyReading: student.ireadyReading?.trim() || undefined,
    ireadyMath: student.ireadyMath?.trim() || undefined,
    tags: student.tags ? Array.from(new Set(student.tags)) : [],
    coTeachMinutes: normalizeCoTeachMinutes(student.coTeachMinutes),
    noContactWith: uniqueStudentIds(student.noContactWith, student.id),
    preferredWith: uniqueStudentIds(student.preferredWith, student.id),
    locked: Boolean(student.locked),
  }
}

function normalizeStudentRelationships(students: Student[]): Student[] {
  const studentsById = new Map(students.map((student) => [student.id, student]))

  return students.map((student) => ({
    ...student,
    noContactWith: uniqueStudentIds(student.noContactWith, student.id).filter((peerId) => studentsById.has(peerId)),
    preferredWith: uniqueStudentIds(student.preferredWith, student.id).filter((peerId) => {
      const peer = studentsById.get(peerId)
      return peer != null && peer.grade === student.grade
    }),
  }))
}

function replaceStudentId(ids: number[] | undefined, previousId: number, nextId: number, selfId: number): number[] {
  return Array.from(
    new Set((ids ?? []).map((id) => (id === previousId ? nextId : id)).filter((id) => Number.isFinite(id) && id > 0 && id !== selfId))
  )
}

function normalizePair(studentIds: [number, number]): [number, number] {
  return studentIds[0] < studentIds[1]
    ? [studentIds[0], studentIds[1]]
    : [studentIds[1], studentIds[0]]
}

function syncClassroomStudentCopies(classrooms: Classroom[], allStudents: Student[]): Classroom[] {
  const byId = new Map(allStudents.map((student) => [student.id, student]))

  return classrooms.map((classroom) => ({
    ...classroom,
    students: classroom.students
      .map((student) => byId.get(student.id))
      .filter((student): student is Student => student != null)
      .map((student) => ({ ...student })),
  }))
}

function withNoContactPair(students: Student[], studentIds: [number, number], enabled: boolean): Student[] {
  const [leftId, rightId] = normalizePair(studentIds)

  return normalizeStudentRelationships(
    students.map((student) => {
      if (student.id !== leftId && student.id !== rightId) return student

      const peerId = student.id === leftId ? rightId : leftId
      const nextNoContact = enabled
        ? uniqueStudentIds([...(student.noContactWith ?? []), peerId], student.id)
        : uniqueStudentIds(student.noContactWith, student.id).filter((id) => id !== peerId)

      return normalizeStudentRecord({
        ...student,
        noContactWith: nextNoContact,
      })
    })
  )
}

function findRelationshipRuleByPair(
  relationshipRules: RelationshipRule[],
  grade: Grade,
  type: RelationshipRule["type"],
  studentIds: [number, number]
): RelationshipRule | undefined {
  const pair = normalizePair(studentIds)

  return relationshipRules.find((rule) => {
    if (rule.grade !== grade || rule.type !== type) return false
    const existingPair = normalizePair(rule.studentIds)
    return existingPair[0] === pair[0] && existingPair[1] === pair[1]
  })
}

function cloneClassrooms(classrooms: Classroom[]): Classroom[] {
  return classrooms.map((classroom) => ({ ...classroom, students: [...classroom.students] }))
}

function assignStudentToTeacherClassroom(classrooms: Classroom[], student: Student, previousId: number): Classroom[] {
  const next = cloneClassrooms(classrooms).map((classroom) => ({
    ...classroom,
    students: classroom.students.filter((entry) => entry.id !== previousId && entry.id !== student.id),
  }))

  const teacherName = student.preassignedTeacher?.trim()
  if (!teacherName) return next

  let target = next.find(
    (classroom) => classroom.grade === student.grade && classroom.teacherName.trim().toLowerCase() === teacherName.toLowerCase()
  )

  if (!target) {
    target = next.find((classroom) => classroom.grade === student.grade && !classroom.teacherName.trim())
    if (target) {
      target.teacherName = teacherName
    }
  }

  if (target && target.students.length < target.maxSize) {
    target.students = [...target.students, student]
  }

  return next
}

function dedupeStudentsById(students: Student[], existingIds = new Set<number>()): Student[] {
  const seen = new Set(existingIds)
  const unique: Student[] = []

  for (const student of students) {
    if (seen.has(student.id)) continue
    seen.add(student.id)
    unique.push(student)
  }

  return unique
}

function buildTeacherAssignmentWarnings(issues: Record<number, string[]>, allStudents: Student[]): string[] {
  return Object.entries(issues).map(([studentId, reasons]) => {
    const student = allStudents.find((entry) => entry.id === Number(studentId))
    const studentName = student ? `${student.firstName} ${student.lastName}` : `#${studentId}`
    return `${studentName}: ${reasons.join(" ")}`
  })
}

function withTeacherAssignmentDiagnostics(state: AppState): AppState {
  const unresolvedReasons = collectAssignedTeacherPlacementIssues(state.allStudents, state.classrooms)
  return {
    ...state,
    unresolvedReasons,
    placementWarnings: buildTeacherAssignmentWarnings(unresolvedReasons, state.allStudents),
  }
}

function applyUpsertStudentCore(state: AppState, studentInput: Student, previousId?: number): AppState {
  const previousStudentId = previousId ?? studentInput.id
  const existing = state.allStudents.find((student) => student.id === previousStudentId)
  const currentPlacement = state.classrooms.find((classroom) => classroom.students.some((student) => student.id === previousStudentId))
  const nextStudent = normalizeStudentRecord({
    ...studentInput,
    locked: studentInput.preassignedTeacher?.trim()
      ? true
      : studentInput.locked ?? existing?.locked ?? false,
  })

  if (state.allStudents.some((student) => student.id === nextStudent.id && student.id !== previousStudentId)) {
    return state
  }

  let allStudents = existing
    ? state.allStudents.map((student) => (student.id === previousStudentId ? nextStudent : student))
    : [...state.allStudents, nextStudent]

  if (existing && previousStudentId !== nextStudent.id) {
    allStudents = allStudents.map((student) =>
      student.id === nextStudent.id
        ? student
        : {
            ...student,
            noContactWith: replaceStudentId(student.noContactWith, previousStudentId, nextStudent.id, student.id),
            preferredWith: replaceStudentId(student.preferredWith, previousStudentId, nextStudent.id, student.id),
          }
    )
  }

  allStudents = normalizeStudentRelationships(allStudents.map((student) => normalizeStudentRecord(student)))

  let relationshipRules = state.relationshipRules
  if (existing && existing.grade !== nextStudent.grade) {
    relationshipRules = relationshipRules.filter((rule) => !rule.studentIds.includes(previousStudentId))
  } else if (existing && previousStudentId !== nextStudent.id) {
    relationshipRules = relationshipRules
      .map((rule) => ({
        ...rule,
        studentIds: rule.studentIds.map((id) => (id === previousStudentId ? nextStudent.id : id)) as [number, number],
      }))
      .filter((rule) => rule.studentIds[0] !== rule.studentIds[1])
  }

  let classrooms: Classroom[]
  if (nextStudent.preassignedTeacher) {
    classrooms = assignStudentToTeacherClassroom(state.classrooms, nextStudent, previousStudentId)
  } else {
    classrooms = state.classrooms.map((classroom) => {
      const roomStudent = classroom.students.find((student) => student.id === previousStudentId)
      if (!roomStudent) return classroom
      if (classroom.grade !== nextStudent.grade) {
        return { ...classroom, students: classroom.students.filter((student) => student.id !== previousStudentId) }
      }

      return {
        ...classroom,
        students: classroom.students.map((student) =>
          student.id === previousStudentId
            ? normalizeStudentRecord({
                ...nextStudent,
                locked: nextStudent.locked,
              })
            : student
        ),
      }
    })

    if (!existing && currentPlacement == null) {
      classrooms = cloneClassrooms(classrooms)
    }
  }

  return {
    ...state,
    allStudents,
    classrooms,
    relationshipRules,
  }
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "LOAD_STUDENTS": {
      const incomingStudents = dedupeStudentsById(
        action.payload.map((student) => ({
          ...student,
          coTeachMinutes: normalizeCoTeachMinutes(student.coTeachMinutes),
          locked: student.preassignedTeacher ? true : false,
        })),
        new Set<number>()
      )

      if (incomingStudents.length === 0) return state

      if (state.allStudents.length === 0) {
        const freshClassrooms = syncClassroomsWithTeacherProfiles(initializeClassrooms(), state.teacherProfiles)
        const allStudents = normalizeStudentRelationships(incomingStudents.map((student) => normalizeStudentRecord(student)))

        const teacherToClassroomId = new Map<string, string>()
        for (const student of allStudents) {
          const teacherName = student.preassignedTeacher?.trim()
          if (!teacherName) continue

          const key = `${student.grade}:${teacherName}`
          if (teacherToClassroomId.has(key)) continue

          const gradeRooms = getClassroomsForGrade(freshClassrooms, student.grade)
          const existing = gradeRooms.find((classroom) => classroom.teacherName.trim().toLowerCase() === teacherName.toLowerCase())
          if (existing) {
            teacherToClassroomId.set(key, existing.id)
            continue
          }

          const available = gradeRooms.find((classroom) => !classroom.teacherName.trim())
          if (available) {
            available.teacherName = teacherName
            teacherToClassroomId.set(key, available.id)
          }
        }

        for (const student of allStudents) {
          const teacherName = student.preassignedTeacher?.trim()
          if (!teacherName) continue

          const classroomId = teacherToClassroomId.get(`${student.grade}:${teacherName}`)
          if (!classroomId) continue

          const classroom = freshClassrooms.find((entry) => entry.id === classroomId)
          if (classroom && classroom.students.length < classroom.maxSize) {
            classroom.students.push({ ...student })
          }
        }

        return withTeacherAssignmentDiagnostics({
          ...state,
          allStudents,
          classrooms: freshClassrooms,
          snapshots: [],
          relationshipRules: [],
        })
      }

      let nextState = { ...state }
      for (const importedStudent of incomingStudents) {
        const existing = nextState.allStudents.find((student) => student.id === importedStudent.id)
        if (existing) {
          const importedTeacher = importedStudent.preassignedTeacher?.trim()
          nextState = applyUpsertStudentCore(nextState, {
            ...existing,
            ...importedStudent,
            locked: importedTeacher
              ? true
              : existing.preassignedTeacher?.trim()
                ? false
                : existing.locked,
          })
          continue
        }

        nextState = applyUpsertStudentCore(nextState, importedStudent, importedStudent.id)
      }

      return withTeacherAssignmentDiagnostics(nextState)
    }
    case "LOAD_TEACHERS": {
      const classrooms = syncClassroomsWithTeacherProfiles(state.classrooms, action.payload)
      return withTeacherAssignmentDiagnostics({
        ...state,
        teacherProfiles: action.payload,
        classrooms,
      })
    }
    case "UPSERT_STUDENT":
      return withTeacherAssignmentDiagnostics(applyUpsertStudentCore(state, action.payload.student, action.payload.previousId))
    case "DELETE_STUDENT": {
      const studentId = action.payload
      if (!state.allStudents.some((student) => student.id === studentId)) return state

      const allStudents = normalizeStudentRelationships(
        state.allStudents
          .filter((student) => student.id !== studentId)
          .map((student) => ({
            ...student,
            noContactWith: (student.noContactWith ?? []).filter((peerId) => peerId !== studentId),
            preferredWith: (student.preferredWith ?? []).filter((peerId) => peerId !== studentId),
          }))
      )

      const classrooms = state.classrooms.map((classroom) => ({
        ...classroom,
        students: classroom.students.filter((student) => student.id !== studentId),
      }))

      const relationshipRules = state.relationshipRules.filter((rule) => !rule.studentIds.includes(studentId))

      return withTeacherAssignmentDiagnostics({
        ...state,
        allStudents,
        classrooms,
        relationshipRules,
      })
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

      const allStudents = state.allStudents.map((student) => (student.id === studentId ? { ...student, locked: false } : student))

      return withTeacherAssignmentDiagnostics({ ...state, classrooms, allStudents })
    }
    case "TOGGLE_LOCK": {
      const id = action.payload
      const targetStudent = state.allStudents.find((student) => student.id === id)
      if (targetStudent?.preassignedTeacher?.trim()) {
        return state
      }
      const classrooms = state.classrooms.map((classroom) => ({
        ...classroom,
        students: classroom.students.map((student) => (student.id === id ? { ...student, locked: !student.locked } : student)),
      }))
      const allStudents = state.allStudents.map((student) => (student.id === id ? { ...student, locked: !student.locked } : student))
      return withTeacherAssignmentDiagnostics({ ...state, classrooms, allStudents })
    }
    case "UPDATE_CLASSROOM": {
      const { id, ...updates } = action.payload
      return withTeacherAssignmentDiagnostics({
        ...state,
        classrooms: state.classrooms.map((classroom) => (classroom.id === id ? { ...classroom, ...updates } : classroom)),
      })
    }
    case "ADD_CLASSROOM": {
      const gradeRooms = getClassroomsForGrade(state.classrooms, action.payload.grade)
      const newRoom = createClassroom(action.payload.grade, gradeRooms.length)
      const classrooms = [...state.classrooms, newRoom]
      return withTeacherAssignmentDiagnostics({ ...state, classrooms })
    }
    case "DELETE_CLASSROOM": {
      const room = state.classrooms.find((classroom) => classroom.id === action.payload.classroomId)
      if (!room) return state
      if (room.students.length > 0 && !action.payload.moveToUnassigned) return state
      const classrooms = state.classrooms
        .map((classroom) => (classroom.id === room.id ? { ...classroom, students: [] } : classroom))
        .filter((classroom) => classroom.id !== room.id)
      return withTeacherAssignmentDiagnostics({ ...state, classrooms })
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
      const restoredGradeClassrooms = syncClassroomStudentCopies(deepClone(snapshot.payload.classrooms), state.allStudents)
      const classrooms = [
        ...state.classrooms.filter((classroom) => classroom.grade !== snapshot.grade),
        ...restoredGradeClassrooms,
      ]
      return withTeacherAssignmentDiagnostics({
        ...state,
        activeGrade: snapshot.grade,
        classrooms,
        gradeSettings: { ...state.gradeSettings, [snapshot.grade]: normalizeGradeSettings(snapshot.payload.settings) },
      })
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
    case "UPSERT_NO_CONTACT_PAIR": {
      const pair = normalizePair(action.payload.studentIds)
      const pairStudents = state.allStudents.filter((student) => pair.includes(student.id))
      if (pairStudents.length !== 2 || pairStudents.some((student) => student.grade !== action.payload.grade)) {
        return state
      }

      const allStudents = withNoContactPair(state.allStudents, pair, true)
      const classrooms = syncClassroomStudentCopies(state.classrooms, allStudents)
      const existing = findRelationshipRuleByPair(state.relationshipRules, action.payload.grade, "NO_CONTACT", pair)
      const trimmedNote = action.payload.note?.trim()
      const shouldPersistRule = Boolean(trimmedNote) || existing != null
      const relationshipRules = shouldPersistRule
        ? (existing
            ? state.relationshipRules.map((rule) =>
                rule.id === existing.id
                  ? {
                      ...rule,
                      studentIds: pair,
                      note: trimmedNote || undefined,
                    }
                  : rule
              )
            : [
                ...state.relationshipRules,
                {
                  id: `rule-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
                  type: "NO_CONTACT" as const,
                  studentIds: pair,
                  note: trimmedNote || undefined,
                  createdAt: Date.now(),
                  grade: action.payload.grade,
                },
              ])
        : state.relationshipRules

      return withTeacherAssignmentDiagnostics({
        ...state,
        allStudents,
        classrooms,
        relationshipRules,
      })
    }
    case "DELETE_NO_CONTACT_PAIR": {
      const pair = normalizePair(action.payload.studentIds)
      const allStudents = withNoContactPair(state.allStudents, pair, false)
      const classrooms = syncClassroomStudentCopies(state.classrooms, allStudents)
      const relationshipRules = state.relationshipRules.filter((rule) => {
        if (rule.grade !== action.payload.grade || rule.type !== "NO_CONTACT") return true
        const existingPair = normalizePair(rule.studentIds)
        return existingPair[0] !== pair[0] || existingPair[1] !== pair[1]
      })

      return withTeacherAssignmentDiagnostics({
        ...state,
        allStudents,
        classrooms,
        relationshipRules,
      })
    }
    case "UPDATE_GRADE_SETTINGS":
      return {
        ...state,
        gradeSettings: {
          ...state.gradeSettings,
          [action.payload.grade]: normalizeGradeSettings({
            ...state.gradeSettings[action.payload.grade],
            ...action.payload.updates,
          }),
        },
      }
    case "APPLY_GRADE_SETTINGS_TO_ALL": {
      const normalized = normalizeGradeSettings(action.payload)
      const gradeSettings = Object.fromEntries(
        Object.keys(state.gradeSettings).map((grade) => [grade, normalized])
      ) as AppState["gradeSettings"]
      return {
        ...state,
        gradeSettings,
      }
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
      return withTeacherAssignmentDiagnostics({ ...state, classrooms })
    }
    case "CLEAR_ALL":
      return { ...initialState }
    default:
      return state
  }
}

