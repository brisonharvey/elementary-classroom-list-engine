import { Classroom, CoTeachCategory, GradeSettings, RelationshipRule, Student } from "../types"
import { CO_TEACH_LABELS, getStudentRequiredCoTeachCategories } from "./coTeach"
import { getClassroomTagSupportLoadBreakdown, getProjectedClassroomTagSupportLoadBreakdown } from "./tagSupportLoad"

export interface ConstraintResult {
  valid: boolean
  reason?: string
}

interface HardConstraintOptions {
  settings: GradeSettings
  relationshipRules: RelationshipRule[]
  gradeRooms?: Classroom[]
}

function isPairMatch(rule: RelationshipRule, studentA: number, studentB: number): boolean {
  const [a, b] = rule.studentIds
  return (a === studentA && b === studentB) || (a === studentB && b === studentA)
}

function getMissingCoverage(student: Student, classroom: Classroom): CoTeachCategory[] {
  const required = getStudentRequiredCoTeachCategories(student)
  return required.filter((category) => !classroom.coTeachCoverage.includes(category)).map((category) => category)
}

function formatMissingCoverageWithMinutes(student: Student, missing: CoTeachCategory[]): string {
  return missing.map((category) => `${CO_TEACH_LABELS[category]} (${student.coTeachMinutes[category] ?? 0} min)`).join(", ")
}

function getTagLoadWarnings(student: Student, classroom: Classroom, gradeRooms: Classroom[]): string[] {
  if (gradeRooms.length === 0) return []

  const projectedBreakdowns = gradeRooms.map((room) =>
    room.id === classroom.id ? getProjectedClassroomTagSupportLoadBreakdown(room, student) : getClassroomTagSupportLoadBreakdown(room)
  )
  const roomIndex = gradeRooms.findIndex((room) => room.id === classroom.id)
  const target = projectedBreakdowns[roomIndex]
  if (!target) return []

  const warnings: string[] = []
  const averageTotal = projectedBreakdowns.reduce((sum, breakdown) => sum + breakdown.total, 0) / projectedBreakdowns.length
  const otherTotals = projectedBreakdowns.filter((_, index) => index !== roomIndex).map((breakdown) => breakdown.total)
  const highestOtherTotal = Math.max(0, ...otherTotals)
  if (target.total > highestOtherTotal && target.total - averageTotal >= 3) {
    warnings.push(`This move would create the highest total tag-support-load room in the grade (${target.total.toFixed(1)} vs avg ${averageTotal.toFixed(1)}).`)
  }

  const categoryConfigs = [
    { key: "behavioral", label: "behavioral" },
    { key: "emotional", label: "emotional" },
    { key: "instructional", label: "instructional" },
    { key: "energy", label: "energy" },
  ] as const

  for (const category of categoryConfigs) {
    const projectedValue = target[category.key]
    const averageValue = projectedBreakdowns.reduce((sum, breakdown) => sum + breakdown[category.key], 0) / projectedBreakdowns.length
    const highestOtherValue = Math.max(0, ...projectedBreakdowns.filter((_, index) => index !== roomIndex).map((breakdown) => breakdown[category.key]))
    if (projectedValue > highestOtherValue && projectedValue - averageValue >= 3) {
      const prefix = category.key === "behavioral" ? "This move would create the highest behavioral tag-load room in the grade" : `This move significantly increases ${category.label} tag-load imbalance`
      warnings.push(`${prefix} (${projectedValue.toFixed(1)} vs avg ${averageValue.toFixed(1)}).`)
    }
  }

  return warnings
}

function getAssignedRoomByStudentId(gradeRooms: Classroom[] | undefined): Map<number, string> {
  const assignedRoomByStudentId = new Map<number, string>()
  for (const room of gradeRooms ?? []) {
    for (const student of room.students) {
      assignedRoomByStudentId.set(student.id, room.id)
    }
  }
  return assignedRoomByStudentId
}

function getDoNotSeparateWarnings(
  student: Student,
  classroom: Classroom | null,
  options: HardConstraintOptions
): string[] {
  if (!options.gradeRooms || options.gradeRooms.length === 0) return []

  const warnings: string[] = []
  const assignedRoomByStudentId = getAssignedRoomByStudentId(options.gradeRooms)
  const targetRoomId = classroom?.id ?? null

  for (const rule of options.relationshipRules) {
    if (rule.type !== "DO_NOT_SEPARATE" || rule.grade !== student.grade) continue
    if (!rule.studentIds.includes(student.id)) continue

    const peerId = rule.studentIds[0] === student.id ? rule.studentIds[1] : rule.studentIds[0]
    const peer = options.gradeRooms.flatMap((room) => room.students).find((roomStudent) => roomStudent.id === peerId)
    const peerRoomId = assignedRoomByStudentId.get(peerId) ?? null
    if (!peerRoomId) continue

    if (targetRoomId !== peerRoomId) {
      const peerRoom = options.gradeRooms.find((room) => room.id === peerRoomId)
      const peerName = peer ? `${peer.firstName} ${peer.lastName}` : `#${peerId}`
      const peerRoomLabel = peerRoom ? `${peerRoom.grade}-${peerRoom.label}` : peerRoomId
      warnings.push(`Do Not Separate rule would split ${peerName} from this student (peer is in ${peerRoomLabel}).`)
    }
  }

  return warnings
}

export function checkHardConstraints(
  student: Student,
  classroom: Classroom,
  proposedSize: number | undefined,
  options: HardConstraintOptions
): ConstraintResult {
  const currentSize = proposedSize ?? classroom.students.length

  if (currentSize >= classroom.maxSize) {
    return { valid: false, reason: `Classroom at max capacity (${classroom.maxSize})` }
  }

  const missingCoverage = getMissingCoverage(student, classroom)
  if (missingCoverage.length > 0) {
    return { valid: false, reason: `Missing co-teach coverage: ${formatMissingCoverageWithMinutes(student, missingCoverage)}` }
  }

  const iepInRoom = classroom.students.filter((s) => s.specialEd.status === "IEP").length
  if (student.specialEd.status === "IEP" && iepInRoom + 1 > options.settings.maxIEPPerRoom) {
    return { valid: false, reason: `Would exceed max IEP cap (${options.settings.maxIEPPerRoom})` }
  }

  const referralInRoom = classroom.students.filter((s) => s.specialEd.status === "Referral" || (s.referrals ?? 0) > 0).length
  if ((student.specialEd.status === "Referral" || (student.referrals ?? 0) > 0) && referralInRoom + 1 > options.settings.maxReferralsPerRoom) {
    return { valid: false, reason: `Would exceed max referral cap (${options.settings.maxReferralsPerRoom})` }
  }

  const studentNoContact = new Set(student.noContactWith ?? [])
  const gradeRules = options.relationshipRules.filter((r) => r.grade === student.grade)
  for (const roomStudent of classroom.students) {
    if (studentNoContact.has(roomStudent.id) || (roomStudent.noContactWith ?? []).includes(student.id)) {
      return {
        valid: false,
        reason: `No-contact conflict with ${roomStudent.firstName} ${roomStudent.lastName} (#${roomStudent.id})`,
      }
    }

    const explicitNoContact = gradeRules.find((r) => r.type === "NO_CONTACT" && isPairMatch(r, student.id, roomStudent.id))
    if (explicitNoContact) {
      return {
        valid: false,
        reason: `No-contact rule with ${roomStudent.firstName} ${roomStudent.lastName}`,
      }
    }
  }

  return { valid: true }
}

export function getManualMoveWarnings(
  student: Student,
  classroom: Classroom,
  options: HardConstraintOptions
): string[] {
  const warnings: string[] = []

  if (classroom.students.length >= classroom.maxSize) {
    warnings.push(`Classroom is over max capacity (${classroom.maxSize})`)
  }

  const missingCoverage = getMissingCoverage(student, classroom)
  if (missingCoverage.length > 0) {
    warnings.push(`Missing co-teach coverage: ${formatMissingCoverageWithMinutes(student, missingCoverage)}`)
  }

  const iepInRoom = classroom.students.filter((s) => s.specialEd.status === "IEP").length
  if (student.specialEd.status === "IEP" && iepInRoom + 1 > options.settings.maxIEPPerRoom) {
    warnings.push(`Would exceed max IEP cap (${options.settings.maxIEPPerRoom})`)
  }

  const referralInRoom = classroom.students.filter((s) => s.specialEd.status === "Referral" || (s.referrals ?? 0) > 0).length
  if ((student.specialEd.status === "Referral" || (student.referrals ?? 0) > 0) && referralInRoom + 1 > options.settings.maxReferralsPerRoom) {
    warnings.push(`Would exceed max referral cap (${options.settings.maxReferralsPerRoom})`)
  }

  const studentNoContact = new Set(student.noContactWith ?? [])
  for (const roomStudent of classroom.students) {
    if (studentNoContact.has(roomStudent.id) || (roomStudent.noContactWith ?? []).includes(student.id)) {
      warnings.push(`No-contact conflict with ${roomStudent.firstName} ${roomStudent.lastName} (#${roomStudent.id})`)
    }

    const noContactRule = options.relationshipRules.find(
      (r) => r.type === "NO_CONTACT" && r.grade === student.grade && isPairMatch(r, student.id, roomStudent.id)
    )
    if (noContactRule) {
      warnings.push(`No-contact rule conflict with ${roomStudent.firstName} ${roomStudent.lastName}`)
    }
  }

  if (options.gradeRooms) {
    warnings.push(...getTagLoadWarnings(student, classroom, options.gradeRooms))
    warnings.push(...getDoNotSeparateWarnings(student, classroom, options))
  }

  if (student.preassignedTeacher?.trim()) {
    const assignedTeacher = student.preassignedTeacher.trim()
    const roomTeacher = classroom.teacherName.trim()
    if (!roomTeacher || roomTeacher.toLowerCase() !== assignedTeacher.toLowerCase()) {
      warnings.push(`Assigned teacher is ${assignedTeacher}, so this move would override the teacher-fixed placement.`)
    }
  }

  return warnings
}

export function getManualUnassignedWarnings(student: Student, options: HardConstraintOptions): string[] {
  const warnings = getDoNotSeparateWarnings(student, null, options)

  if (student.preassignedTeacher?.trim()) {
    warnings.push(`Assigned teacher is ${student.preassignedTeacher.trim()}, so leaving this student unassigned breaks the teacher-fixed placement.`)
  }

  return warnings
}
