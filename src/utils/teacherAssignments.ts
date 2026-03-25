import { Classroom, Student } from "../types"

function normalizeTeacherName(name: string): string {
  return name.trim().toLowerCase()
}

function isBlockedAssignedTeacher(student: Student, teacherName: string): boolean {
  return (student.avoidTeachers ?? []).some((entry) => normalizeTeacherName(entry) === normalizeTeacherName(teacherName))
}

function getPlacedRoomForStudent(classrooms: Classroom[], studentId: number): Classroom | undefined {
  return classrooms.find((classroom) => classroom.students.some((student) => student.id === studentId))
}

export function getMatchingTeacherClassrooms(classrooms: Classroom[], student: Student): Classroom[] {
  const teacherName = student.preassignedTeacher?.trim()
  if (!teacherName) return []

  const normalizedTeacherName = normalizeTeacherName(teacherName)
  return classrooms.filter(
    (classroom) => classroom.grade === student.grade && normalizeTeacherName(classroom.teacherName) === normalizedTeacherName
  )
}

export function getAssignedTeacherPlacementIssue(classrooms: Classroom[], student: Student): string | null {
  const teacherName = student.preassignedTeacher?.trim()
  if (!teacherName) return null

  if (isBlockedAssignedTeacher(student, teacherName)) {
    return `Assigned teacher ${teacherName} conflicts with this student's blocked-teacher restriction.`
  }

  const placedRoom = getPlacedRoomForStudent(classrooms, student.id)
  const matchingRooms = getMatchingTeacherClassrooms(classrooms, student)
  if (placedRoom && matchingRooms.some((classroom) => classroom.id === placedRoom.id)) return null

  if (matchingRooms.length === 0) {
    return `Assigned teacher ${teacherName} does not have a matching classroom in Grade ${student.grade}.`
  }

  const roomWithSeat = matchingRooms.find((classroom) => classroom.students.length < classroom.maxSize)
  if (!roomWithSeat) {
    const fullLabels = matchingRooms.map((classroom) => classroom.label).join(", ")
    return `Assigned teacher ${teacherName} could not place this student because classroom ${fullLabels} is full.`
  }

  if (placedRoom) {
    return `Assigned teacher ${teacherName} is set, but the student is currently placed in ${placedRoom.grade}-${placedRoom.label}.`
  }

  return `Assigned teacher ${teacherName} is set, but the student is still unassigned.`
}

export function collectAssignedTeacherPlacementIssues(
  allStudents: Student[],
  classrooms: Classroom[]
): Record<number, string[]> {
  const issues: Record<number, string[]> = {}

  for (const student of allStudents) {
    const issue = getAssignedTeacherPlacementIssue(classrooms, student)
    if (issue) {
      issues[student.id] = [issue]
    }
  }

  return issues
}
