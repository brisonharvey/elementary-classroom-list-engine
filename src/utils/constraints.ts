import { Classroom, GradeSettings, RelationshipRule, Student } from "../types"

export interface ConstraintResult {
  valid: boolean
  reason?: string
}

interface HardConstraintOptions {
  settings: GradeSettings
  relationshipRules: RelationshipRule[]
}

function isPairMatch(rule: RelationshipRule, studentA: number, studentB: number): boolean {
  const [a, b] = rule.studentIds
  return (a === studentA && b === studentB) || (a === studentB && b === studentA)
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

  if (student.specialEd.requiresCoTeachReading && !classroom.coTeach.reading) {
    return { valid: false, reason: "Student requires reading co-teach" }
  }

  if (student.specialEd.requiresCoTeachMath && !classroom.coTeach.math) {
    return { valid: false, reason: "Student requires math co-teach" }
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
  if (student.specialEd.requiresCoTeachReading && !classroom.coTeach.reading) {
    warnings.push("Student requires reading co-teach not provided here")
  }
  if (student.specialEd.requiresCoTeachMath && !classroom.coTeach.math) {
    warnings.push("Student requires math co-teach not provided here")
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

  return warnings
}
