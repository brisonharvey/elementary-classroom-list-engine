import { Classroom, Student } from "../types"

export interface ConstraintResult {
  valid: boolean
  reason?: string
}

/**
 * Hard constraints that must all pass before a student can be placed in a classroom.
 * Returns { valid: true } if all pass, or { valid: false, reason } on first failure.
 */
export function checkHardConstraints(
  student: Student,
  classroom: Classroom,
  proposedSize?: number // optional: if incrementing during placement
): ConstraintResult {
  const currentSize = proposedSize ?? classroom.students.length

  // 1. Max capacity
  if (currentSize >= classroom.maxSize) {
    return { valid: false, reason: `Classroom at max capacity (${classroom.maxSize})` }
  }

  // 2. Reading co-teach requirement
  if (student.specialEd.requiresCoTeachReading && !classroom.coTeach.reading) {
    return { valid: false, reason: "Student requires reading co-teach" }
  }

  // 3. Math co-teach requirement
  if (student.specialEd.requiresCoTeachMath && !classroom.coTeach.math) {
    return { valid: false, reason: "Student requires math co-teach" }
  }

  // 4. No-contact rules (bidirectional)
  const studentNoContact = new Set(student.noContactWith ?? [])
  for (const roomStudent of classroom.students) {
    // Does this student have a no-contact with a room member?
    if (studentNoContact.has(roomStudent.id)) {
      return {
        valid: false,
        reason: `No-contact conflict with ${roomStudent.firstName} ${roomStudent.lastName} (#${roomStudent.id})`,
      }
    }
    // Does a room member have a no-contact with this student?
    if ((roomStudent.noContactWith ?? []).includes(student.id)) {
      return {
        valid: false,
        reason: `No-contact conflict: ${roomStudent.firstName} ${roomStudent.lastName} (#${roomStudent.id}) lists this student`,
      }
    }
  }

  return { valid: true }
}

/**
 * Validates a student can be moved manually (softer check — does not block, just warns).
 * Returns an array of warning strings (empty = no issues).
 */
export function getManualMoveWarnings(student: Student, classroom: Classroom): string[] {
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

  const studentNoContact = new Set(student.noContactWith ?? [])
  for (const roomStudent of classroom.students) {
    if (studentNoContact.has(roomStudent.id) || (roomStudent.noContactWith ?? []).includes(student.id)) {
      warnings.push(
        `No-contact conflict with ${roomStudent.firstName} ${roomStudent.lastName} (#${roomStudent.id})`
      )
    }
  }

  return warnings
}
