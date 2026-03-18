import { Classroom, Grade, GradeSettings, RelationshipRule, RoomStats, Student, TeacherProfile, Weights } from "../types"
import { checkHardConstraints } from "../utils/constraints"
import { CO_TEACH_CATEGORIES, CO_TEACH_LABELS, getStudentCoTeachTotal } from "../utils/coTeach"
import { computeRoomStats, getStudentSupportLoad, scoreStudentForRoom } from "../utils/scoring"
import { getStudentTeacherFitForClassroom } from "../utils/teacherFit"
import { getMatchingTeacherClassrooms } from "../utils/teacherAssignments"

function deepCloneClassrooms(classrooms: Classroom[]): Classroom[] {
  return classrooms.map((classroom) => ({ ...classroom, students: classroom.students.map((student) => ({ ...student })) }))
}

export function getUnassignedStudents(allStudents: Student[], classrooms: Classroom[], grade: Grade): Student[] {
  const assignedIds = new Set(classrooms.filter((classroom) => classroom.grade === grade).flatMap((classroom) => classroom.students.map((student) => student.id)))
  return allStudents.filter((student) => student.grade === grade && !assignedIds.has(student.id))
}

function prioritySort(students: Student[]): Student[] {
  return [...students].sort((a, b) => {
    const aCoTeach = getStudentCoTeachTotal(a)
    const bCoTeach = getStudentCoTeachTotal(b)
    const aHas = aCoTeach > 0 ? 1 : 0
    const bHas = bCoTeach > 0 ? 1 : 0
    if (bHas !== aHas) return bHas - aHas
    if (bCoTeach !== aCoTeach) return bCoTeach - aCoTeach

    const statusRank = (student: Student) => (student.specialEd.status === "IEP" ? 2 : student.specialEd.status === "Referral" ? 1 : 0)
    if (statusRank(b) !== statusRank(a)) return statusRank(b) - statusRank(a)

    return getStudentSupportLoad(b) - getStudentSupportLoad(a)
  })
}

export interface PlacementResult {
  classrooms: Classroom[]
  unresolved: Student[]
  unresolvedReasons: Record<number, string[]>
  warnings: string[]
}

function formatConstraintCategory(reason: string): string {
  if (reason.startsWith("Classroom at max capacity")) return "At max capacity"
  if (reason.includes("Missing co-teach coverage")) return "Missing co-teach coverage"
  if (reason.startsWith("No-contact")) return "No-contact conflicts"
  if (reason.includes("IEP cap")) return "IEP cap reached"
  if (reason.includes("referral cap")) return "Referral cap reached"
  return "Other hard constraints"
}

function getMissingGradeCoverageWarning(gradeRooms: Classroom[], gradeStudents: Student[], activeGrade: Grade): string | null {
  const needed = CO_TEACH_CATEGORIES.filter((category) => gradeStudents.some((student) => (student.coTeachMinutes[category] ?? 0) > 0))
  const covered = new Set(gradeRooms.flatMap((room) => room.coTeachCoverage))
  const missing = needed.filter((category) => !covered.has(category))
  if (missing.length === 0) return null
  return `No classrooms in Grade ${activeGrade} provide co-teach coverage for: ${missing.map((category) => CO_TEACH_LABELS[category]).join(", ")}`
}

export function runPlacement(
  allStudents: Student[],
  teacherProfiles: TeacherProfile[],
  allClassrooms: Classroom[],
  activeGrade: Grade,
  weights: Weights,
  gradeSettings: GradeSettings,
  relationshipRules: RelationshipRule[]
): PlacementResult {
  const warnings: string[] = []
  const classrooms = deepCloneClassrooms(allClassrooms)
  const gradeRooms = classrooms.filter((classroom) => classroom.grade === activeGrade)

  for (const room of gradeRooms) {
    room.students = room.students.filter((student) => student.locked)
  }

  const lockedIds = new Set(gradeRooms.flatMap((room) => room.students.map((student) => student.id)))
  const gradeStudents = allStudents.filter((student) => student.grade === activeGrade)
  const coverageWarning = getMissingGradeCoverageWarning(gradeRooms, gradeStudents, activeGrade)
  if (coverageWarning) warnings.push(coverageWarning)
  const unplaced = gradeStudents.filter((student) => !lockedIds.has(student.id))
  const sorted = prioritySort(unplaced)

  const unresolved: Student[] = []
  const unresolvedReasons = new Map<number, Set<string>>()
  const roomStatsMap = new Map<string, RoomStats>(gradeRooms.map((room) => [room.id, computeRoomStats(room)]))
  const assignedRoomByStudentId = new Map<number, string>()
  const teacherFixedHandledIds = new Set<number>()

  for (const room of gradeRooms) {
    for (const student of room.students) {
      assignedRoomByStudentId.set(student.id, room.id)
    }
  }

  for (const student of gradeStudents.filter((entry) => Boolean(entry.preassignedTeacher?.trim()) && !lockedIds.has(entry.id))) {
    teacherFixedHandledIds.add(student.id)
    const matchingRooms = getMatchingTeacherClassrooms(gradeRooms, student)
    if (matchingRooms.length === 0) {
      unresolved.push(student)
      unresolvedReasons.set(
        student.id,
        new Set([`Assigned teacher ${student.preassignedTeacher!.trim()} does not have a matching classroom in Grade ${student.grade}.`])
      )
      continue
    }

    let placed = false
    const reasons = new Set<string>()
    for (const room of matchingRooms) {
      const stats = roomStatsMap.get(room.id)!
      const { valid, reason } = checkHardConstraints(student, room, stats.size, {
        settings: gradeSettings,
        relationshipRules,
      })
      if (!valid) {
        if (reason) reasons.add(reason)
        continue
      }

      const lockedStudent = { ...student, locked: true }
      room.students.push(lockedStudent)
      roomStatsMap.set(room.id, computeRoomStats({ ...room, students: [...room.students] }))
      assignedRoomByStudentId.set(student.id, room.id)
      lockedIds.add(student.id)
      placed = true
      break
    }

    if (!placed) {
      unresolved.push(student)
      unresolvedReasons.set(
        student.id,
        new Set(
          reasons.size > 0
            ? Array.from(reasons).map((reason) => `Assigned teacher ${student.preassignedTeacher!.trim()}: ${reason}`)
            : [`Assigned teacher ${student.preassignedTeacher!.trim()} could not place this student in the matching classroom.`]
        )
      )
    }
  }

  for (const student of sorted.filter((entry) => !lockedIds.has(entry.id) && !teacherFixedHandledIds.has(entry.id))) {
    let bestRoom: Classroom | null = null
    let bestTeacherFitPenalty = Infinity
    let bestScore = Infinity
    const reasons = new Set<string>()

    for (const room of gradeRooms) {
      const stats = roomStatsMap.get(room.id)!
      const { valid, reason } = checkHardConstraints(student, room, stats.size, {
        settings: gradeSettings,
        relationshipRules,
      })
      if (!valid) {
        if (reason) reasons.add(reason)
        continue
      }

      const teacherFit = getStudentTeacherFitForClassroom(student, room, teacherProfiles)
      const score = scoreStudentForRoom(student, room, stats, weights, {
        assignedRoomByStudentId,
        relationshipRules,
        gradeSettings,
        gradeRooms,
      })

      if (
        teacherFit.penalty < bestTeacherFitPenalty ||
        (teacherFit.penalty === bestTeacherFitPenalty && score < bestScore)
      ) {
        bestTeacherFitPenalty = teacherFit.penalty
        bestScore = score
        bestRoom = room
      }
    }

    if (bestRoom) {
      bestRoom.students.push(student)
      assignedRoomByStudentId.set(student.id, bestRoom.id)
      roomStatsMap.set(bestRoom.id, computeRoomStats({ ...bestRoom, students: [...bestRoom.students] }))
    } else {
      if (!unresolved.some((entry) => entry.id === student.id)) {
        unresolved.push(student)
      }
      unresolvedReasons.set(student.id, reasons)
    }
  }

  if (unresolved.length > 0) {
    warnings.push(`${unresolved.length} student(s) could not be placed due to constraint conflicts.`)

    const grouped = new Map<string, string[]>()
    for (const student of unresolved) {
      const reasons = unresolvedReasons.get(student.id) ?? new Set<string>(["No valid room met hard constraints"])
      for (const reason of reasons) {
        const category = formatConstraintCategory(reason)
        if (!grouped.has(category)) grouped.set(category, [])
        grouped.get(category)!.push(`${student.firstName} ${student.lastName} - ${reason}`)
      }
    }

    for (const [category, entries] of grouped) {
      warnings.push(`${category}: ${entries.join("; ")}`)
    }
  }

  const poorFitCount = gradeRooms.reduce(
    (sum, room) => sum + room.students.filter((student) => getStudentTeacherFitForClassroom(student, room, teacherProfiles).isPoorFit).length,
    0
  )
  if (poorFitCount > 0) {
    warnings.push(`${poorFitCount} student(s) are currently marked as poor teacher fits.`)
  }

  return {
    classrooms,
    unresolved,
    unresolvedReasons: Object.fromEntries(Array.from(unresolvedReasons.entries()).map(([id, reasons]) => [id, Array.from(reasons)])),
    warnings,
  }
}
