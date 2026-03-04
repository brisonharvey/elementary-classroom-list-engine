import { Classroom, Grade, RoomStats, Student, Weights } from "../types"
import { checkHardConstraints } from "../utils/constraints"
import {
  computeRoomStats,
  getStudentMathScore,
  getStudentReadingScore,
  getStudentSupportLoad ,
  scoreStudentForRoom,
} from "../utils/scoring"

function deepCloneClassrooms(classrooms: Classroom[]): Classroom[] {
  return classrooms.map((c) => ({ ...c, students: c.students.map((s) => ({ ...s })) }))
}

export function getUnassignedStudents(allStudents: Student[], classrooms: Classroom[], grade: Grade): Student[] {
  const assignedIds = new Set(
    classrooms
      .filter((c) => c.grade === grade)
      .flatMap((c) => c.students.map((s) => s.id))
  )
  return allStudents.filter((s) => s.grade === grade && !assignedIds.has(s.id))
}

function prioritySort(students: Student[]): Student[] {
  return [...students].sort((a, b) => {
    const aCoT = (a.specialEd.requiresCoTeachReading ? 2 : 0) + (a.specialEd.requiresCoTeachMath ? 2 : 0)
    const bCoT = (b.specialEd.requiresCoTeachReading ? 2 : 0) + (b.specialEd.requiresCoTeachMath ? 2 : 0)
    if (bCoT !== aCoT) return bCoT - aCoT

    const statusRank = (s: Student) => (s.specialEd.status === "IEP" ? 2 : s.specialEd.status === "Referral" ? 1 : 0)
    if (statusRank(b) !== statusRank(a)) return statusRank(b) - statusRank(a)

    return getStudentSupportLoad(b) - getStudentSupportLoad(a)
  })
}

export interface PlacementResult {
  classrooms: Classroom[]
  unresolved: Student[]
  warnings: string[]
}

function formatConstraintCategory(reason: string): string {
  if (reason.startsWith("Classroom at max capacity")) return "At max capacity"
  if (reason.includes("reading co-teach")) return "Missing reading co-teach"
  if (reason.includes("math co-teach")) return "Missing math co-teach"
  if (reason.startsWith("No-contact conflict")) return "No-contact conflicts"
  return "Other hard constraints"
}

export function runPlacement(
  allStudents: Student[],
  allClassrooms: Classroom[],
  activeGrade: Grade,
  weights: Weights
): PlacementResult {
  const warnings: string[] = []
  const classrooms = deepCloneClassrooms(allClassrooms)
  const gradeRooms = classrooms.filter((c) => c.grade === activeGrade)

  for (const room of gradeRooms) {
    room.students = room.students.filter((s) => s.locked)
  }

  const lockedIds = new Set(gradeRooms.flatMap((r) => r.students.map((s) => s.id)))
  const gradeStudents = allStudents.filter((s) => s.grade === activeGrade)
  const unplaced = gradeStudents.filter((s) => !lockedIds.has(s.id))
  const sorted = prioritySort(unplaced)

  const needsReadingCoTeach = sorted.some((s) => s.specialEd.requiresCoTeachReading)
  const needsMathCoTeach = sorted.some((s) => s.specialEd.requiresCoTeachMath)
  const hasReadingCoTeach = gradeRooms.some((r) => r.coTeach.reading)
  const hasMathCoTeach = gradeRooms.some((r) => r.coTeach.math)

  if (needsReadingCoTeach && !hasReadingCoTeach) {
    warnings.push(
      `Grade ${activeGrade}: Students require reading co-teach but no classroom has it enabled. Check classroom settings.`
    )
  }
  if (needsMathCoTeach && !hasMathCoTeach) {
    warnings.push(
      `Grade ${activeGrade}: Students require math co-teach but no classroom has it enabled. Check classroom settings.`
    )
  }

  const unresolved: Student[] = []
  const unresolvedReasons = new Map<number, Set<string>>()
  const roomStatsMap = new Map<string, RoomStats>(gradeRooms.map((r) => [r.id, computeRoomStats(r)]))

  for (const student of sorted) {
    let bestRoom: Classroom | null = null
    let bestScore = Infinity
    const reasons = new Set<string>()

    for (const room of gradeRooms) {
      const stats = roomStatsMap.get(room.id)!
      const { valid, reason } = checkHardConstraints(student, room, stats.size)
      if (!valid) {
        if (reason) reasons.add(reason)
        continue
      }

      const score = scoreStudentForRoom(student, room, stats, weights)
      if (score < bestScore) {
        bestScore = score
        bestRoom = room
      }
    }

    if (bestRoom) {
      bestRoom.students.push(student)
      const stats = roomStatsMap.get(bestRoom.id)!
      roomStatsMap.set(bestRoom.id, {
        ...stats,
        size: stats.size + 1,
        supportLoad:
          (stats.supportLoad * stats.size + getStudentSupportLoad(student)) / (stats.size + 1),
        readingAvg:
          (stats.readingAvg * stats.size + getStudentReadingScore(student)) / (stats.size + 1),
        mathAvg:
          (stats.mathAvg * stats.size + getStudentMathScore(student)) / (stats.size + 1),
        iepCount: stats.iepCount + (student.specialEd.status === "IEP" ? 1 : 0),
        referralCount: stats.referralCount + (student.specialEd.status === "Referral" ? 1 : 0),
        maleCount: stats.maleCount + (student.gender === "M" ? 1 : 0),
        femaleCount: stats.femaleCount + (student.gender === "F" ? 1 : 0),
        ellCount: stats.ellCount + (student.ell ? 1 : 0),
        section504Count: stats.section504Count + (student.section504 ? 1 : 0),
      })
    } else {
      unresolved.push(student)
      unresolvedReasons.set(student.id, reasons)
    }
  }

  if (unresolved.length > 0) {
    warnings.push(
      `${unresolved.length} student(s) could not be placed due to constraint conflicts.`
    )

    const grouped = new Map<string, string[]>()
    for (const student of unresolved) {
      const reasons = unresolvedReasons.get(student.id) ?? new Set<string>(["No valid room met hard constraints"])
      for (const reason of reasons) {
        const category = formatConstraintCategory(reason)
        if (!grouped.has(category)) grouped.set(category, [])
        grouped.get(category)!.push(`${student.firstName} ${student.lastName} — ${reason}`)
      }
    }

    for (const [category, entries] of grouped) {
      warnings.push(`${category}: ${entries.join("; ")}`)
    }
  }

  return { classrooms, unresolved, warnings }
}
