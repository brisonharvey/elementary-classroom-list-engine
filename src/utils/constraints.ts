import { Classroom, CoTeachCategory, GradeSettings, RelationshipRule, Student } from "../types"
import { CO_TEACH_LABELS, getStudentRequiredCoTeachCategories } from "./coTeach"

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

function getMissingCoverage(student: Student, classroom: Classroom): CoTeachCategory[] {
  const required = getStudentRequiredCoTeachCategories(student)
  return required.filter((category) => !classroom.coTeachCoverage.includes(category)).map((category) => category)
}

function formatMissingCoverageWithMinutes(student: Student, missing: CoTeachCategory[]): string {
  return missing.map((category) => `${CO_TEACH_LABELS[category]} (${student.coTeachMinutes[category] ?? 0} min)`).join(", ")
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

  return warnings
}
