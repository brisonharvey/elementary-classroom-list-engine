import { Classroom, Grade, Student, Weights } from "../types"
import { checkHardConstraints } from "../utils/constraints"
import {
  computeRoomStats,
  getStudentMathScore,
  getStudentReadingScore,
  getStudentSupportLoad,
  scoreStudentForRoom,
  RoomStats,
} from "../utils/scoring"

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function deepCloneClassrooms(classrooms: Classroom[]): Classroom[] {
  return classrooms.map((c) => ({ ...c, students: c.students.map((s) => ({ ...s })) }))
}

/** Students not present in any classroom for a given grade */
export function getUnassignedStudents(allStudents: Student[], classrooms: Classroom[], grade: Grade): Student[] {
  const assignedIds = new Set(
    classrooms
      .filter((c) => c.grade === grade)
      .flatMap((c) => c.students.map((s) => s.id))
  )
  return allStudents.filter((s) => s.grade === grade && !assignedIds.has(s.id))
}

/**
 * Priority sort for unplaced students.
 * Higher-priority students get placed first so constraints are satisfied early.
 */
function prioritySort(students: Student[]): Student[] {
  return [...students].sort((a, b) => {
    // 1. Co-teach requirements (most constrained first)
    const aCoT = (a.specialEd.requiresCoTeachReading ? 2 : 0) + (a.specialEd.requiresCoTeachMath ? 2 : 0)
    const bCoT = (b.specialEd.requiresCoTeachReading ? 2 : 0) + (b.specialEd.requiresCoTeachMath ? 2 : 0)
    if (bCoT !== aCoT) return bCoT - aCoT

    // 2. IEP status
    const statusRank = (s: Student) => (s.specialEd.status === "IEP" ? 2 : s.specialEd.status === "Referral" ? 1 : 0)
    if (statusRank(b) !== statusRank(a)) return statusRank(b) - statusRank(a)

    // 3. Overall support load (descending)
    return getStudentSupportLoad(b) - getStudentSupportLoad(a)
  })
}

// ─────────────────────────────────────────────
// Main placement function
// ─────────────────────────────────────────────

export interface PlacementResult {
  classrooms: Classroom[]
  unresolved: Student[]   // students with no valid classroom
  warnings: string[]
}

export function runPlacement(
  allStudents: Student[],
  allClassrooms: Classroom[],
  activeGrade: Grade,
  weights: Weights
): PlacementResult {
  const warnings: string[] = []

  // Deep-clone all classrooms so we never mutate state
  const classrooms = deepCloneClassrooms(allClassrooms)

  // Classrooms for active grade
  const gradeRooms = classrooms.filter((c) => c.grade === activeGrade)

  // 1. Remove unlocked students from active grade classrooms (preserve locked)
  for (const room of gradeRooms) {
    room.students = room.students.filter((s) => s.locked)
  }

  // 2. Collect all unlocked students for this grade
  const lockedIds = new Set(gradeRooms.flatMap((r) => r.students.map((s) => s.id)))
  const gradeStudents = allStudents.filter((s) => s.grade === activeGrade)
  const unplaced = gradeStudents.filter((s) => !lockedIds.has(s.id))

  // 3. Sort by placement priority
  const sorted = prioritySort(unplaced)

  // 4. Validate co-teach coverage
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

  // 5. Place students
  const unresolved: Student[] = []
  const roomStatsMap = new Map<string, RoomStats>(gradeRooms.map((r) => [r.id, computeRoomStats(r)]))

  for (const student of sorted) {
    let bestRoom: Classroom | null = null
    let bestScore = Infinity

    for (const room of gradeRooms) {
      const stats = roomStatsMap.get(room.id)!
      const { valid } = checkHardConstraints(student, room, stats.size)
      if (!valid) continue

      const score = scoreStudentForRoom(student, room, stats, weights)
      if (score < bestScore) {
        bestScore = score
        bestRoom = room
      }
    }

    if (bestRoom) {
      bestRoom.students.push(student)
      // Incrementally update stats for placed student
      const stats = roomStatsMap.get(bestRoom.id)!
      roomStatsMap.set(bestRoom.id, {
        ...stats,
        size: stats.size + 1,
        // Recalculate running averages incrementally
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
      })
    } else {
      unresolved.push(student)
    }
  }

  if (unresolved.length > 0) {
    warnings.push(
      `${unresolved.length} student(s) could not be placed due to constraint conflicts: ` +
        unresolved.map((s) => `${s.firstName} ${s.lastName}`).join(", ")
    )
  }

  return { classrooms, unresolved, warnings }
}
