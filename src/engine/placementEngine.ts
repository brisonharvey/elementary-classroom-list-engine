import { Classroom, Grade, GradeSettings, RelationshipRule, RoomStats, Student, Weights } from "../types"
import { checkHardConstraints } from "../utils/constraints"
import { CO_TEACH_CATEGORIES, CO_TEACH_LABELS, getStudentCoTeachTotal } from "../utils/coTeach"
import { computeRoomStats, getStudentSupportLoad, scoreStudentForRoom } from "../utils/scoring"

function deepCloneClassrooms(classrooms: Classroom[]): Classroom[] {
  return classrooms.map((c) => ({ ...c, students: c.students.map((s) => ({ ...s })) }))
}

export function getUnassignedStudents(allStudents: Student[], classrooms: Classroom[], grade: Grade): Student[] {
  const assignedIds = new Set(classrooms.filter((c) => c.grade === grade).flatMap((c) => c.students.map((s) => s.id)))
  return allStudents.filter((s) => s.grade === grade && !assignedIds.has(s.id))
}

function prioritySort(students: Student[]): Student[] {
  return [...students].sort((a, b) => {
    const aCoTeach = getStudentCoTeachTotal(a)
    const bCoTeach = getStudentCoTeachTotal(b)
    const aHas = aCoTeach > 0 ? 1 : 0
    const bHas = bCoTeach > 0 ? 1 : 0
    if (bHas !== aHas) return bHas - aHas
    if (bCoTeach !== aCoTeach) return bCoTeach - aCoTeach

    const statusRank = (s: Student) => (s.specialEd.status === "IEP" ? 2 : s.specialEd.status === "Referral" ? 1 : 0)
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
  const needed = CO_TEACH_CATEGORIES.filter((category) => gradeStudents.some((s) => (s.coTeachMinutes[category] ?? 0) > 0))
  const covered = new Set(gradeRooms.flatMap((room) => room.coTeachCoverage))
  const missing = needed.filter((category) => !covered.has(category))
  if (missing.length === 0) return null
  return `No classrooms in Grade ${activeGrade} provide co-teach coverage for: ${missing.map((c) => CO_TEACH_LABELS[c]).join(", ")}`
}

export function runPlacement(
  allStudents: Student[],
  allClassrooms: Classroom[],
  activeGrade: Grade,
  weights: Weights,
  gradeSettings: GradeSettings,
  relationshipRules: RelationshipRule[]
): PlacementResult {
  const warnings: string[] = []
  const classrooms = deepCloneClassrooms(allClassrooms)
  const gradeRooms = classrooms.filter((c) => c.grade === activeGrade)

  for (const room of gradeRooms) {
    room.students = room.students.filter((s) => s.locked)
  }

  const lockedIds = new Set(gradeRooms.flatMap((r) => r.students.map((s) => s.id)))
  const gradeStudents = allStudents.filter((s) => s.grade === activeGrade)
  const coverageWarning = getMissingGradeCoverageWarning(gradeRooms, gradeStudents, activeGrade)
  if (coverageWarning) warnings.push(coverageWarning)
  const unplaced = gradeStudents.filter((s) => !lockedIds.has(s.id))
  const sorted = prioritySort(unplaced)

  const unresolved: Student[] = []
  const unresolvedReasons = new Map<number, Set<string>>()
  const roomStatsMap = new Map<string, RoomStats>(gradeRooms.map((r) => [r.id, computeRoomStats(r)]))
  const assignedRoomByStudentId = new Map<number, string>()

  for (const room of gradeRooms) {
    for (const student of room.students) {
      assignedRoomByStudentId.set(student.id, room.id)
    }
  }

  for (const student of sorted) {
    let bestRoom: Classroom | null = null
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

      const score = scoreStudentForRoom(student, room, stats, weights, {
        assignedRoomByStudentId,
        relationshipRules,
        gradeSettings,
        gradeRooms,
      })
      if (score < bestScore) {
        bestScore = score
        bestRoom = room
      }
    }

    if (bestRoom) {
      bestRoom.students.push(student)
      assignedRoomByStudentId.set(student.id, bestRoom.id)
      roomStatsMap.set(bestRoom.id, computeRoomStats({ ...bestRoom, students: [...bestRoom.students] }))
    } else {
      unresolved.push(student)
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
        grouped.get(category)!.push(`${student.firstName} ${student.lastName} — ${reason}`)
      }
    }

    for (const [category, entries] of grouped) {
      warnings.push(`${category}: ${entries.join("; ")}`)
    }
  }

  return {
    classrooms,
    unresolved,
    unresolvedReasons: Object.fromEntries(Array.from(unresolvedReasons.entries()).map(([id, rs]) => [id, Array.from(rs)])),
    warnings,
  }
}
