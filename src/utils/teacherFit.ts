import {
  Classroom,
  Student,
  StudentTag,
  TeacherCharacteristicKey,
  TeacherProfile,
} from "../types"
import { STUDENT_TAG_TEACHER_CHARACTERISTIC_REQUIREMENTS } from "./tagSupportLoad"

export const TEACHER_CHARACTERISTIC_LABELS: Record<TeacherCharacteristicKey, string> = {
  classroomStructure: "Classroom structure",
  behaviorManagementStrength: "Behavior management strength",
  emotionalSupportNurturing: "Emotional support/nurturing",
  academicEnrichmentStrength: "Academic enrichment strength",
  independenceScaffolding: "Independence scaffolding",
  movementFlexibility: "Movement flexibility",
  peerSocialCoaching: "Peer social coaching",
  confidenceBuilding: "Confidence building",
}

const DEFAULT_MISSING_PROFILE_PENALTY = 0.4
const POOR_FIT_THRESHOLD = 0.5

export interface TeacherFitAssessment {
  penalty: number
  score: number
  isPoorFit: boolean
  missingProfile: boolean
  matchedTags: StudentTag[]
  weakestTags: StudentTag[]
}

function normalizeTeacherName(name: string): string {
  return name.trim().toLowerCase()
}

export function getTeacherProfileForClassroom(classroom: Classroom, teacherProfiles: TeacherProfile[]): TeacherProfile | undefined {
  const teacherName = normalizeTeacherName(classroom.teacherName)
  if (!teacherName) return undefined
  return teacherProfiles.find(
    (profile) => profile.grade === classroom.grade && normalizeTeacherName(profile.teacherName) === teacherName
  )
}

export function assessStudentTeacherFit(
  student: Student,
  teacherProfile: TeacherProfile | undefined,
  hasTeacherProfiles: boolean
): TeacherFitAssessment {
  const matchedTags = (student.tags ?? []).filter((tag) => STUDENT_TAG_TEACHER_CHARACTERISTIC_REQUIREMENTS[tag] != null)
  if (matchedTags.length === 0) {
    return {
      penalty: 0,
      score: 1,
      isPoorFit: false,
      missingProfile: false,
      matchedTags: [],
      weakestTags: [],
    }
  }

  if (!teacherProfile) {
    const penalty = hasTeacherProfiles ? DEFAULT_MISSING_PROFILE_PENALTY : 0
    return {
      penalty,
      score: 1 - penalty,
      isPoorFit: penalty >= POOR_FIT_THRESHOLD,
      missingProfile: hasTeacherProfiles,
      matchedTags,
      weakestTags: matchedTags.slice(0, 2),
    }
  }

  const tagPenalties = matchedTags.map((tag) => {
    const requirements = STUDENT_TAG_TEACHER_CHARACTERISTIC_REQUIREMENTS[tag]
    let weightedGap = 0
    let weightTotal = 0

    for (const [key, weight] of Object.entries(requirements) as Array<[TeacherCharacteristicKey, number]>) {
      const rating = teacherProfile.characteristics[key]
      weightedGap += ((5 - rating) / 4) * weight
      weightTotal += weight
    }

    return {
      tag,
      penalty: weightTotal === 0 ? 0 : weightedGap / weightTotal,
    }
  })

  const penalty = tagPenalties.reduce((sum, item) => sum + item.penalty, 0) / tagPenalties.length
  const weakestTags = [...tagPenalties]
    .sort((a, b) => b.penalty - a.penalty)
    .filter((item) => item.penalty > 0.35)
    .slice(0, 2)
    .map((item) => item.tag)

  return {
    penalty,
    score: 1 - penalty,
    isPoorFit: penalty >= POOR_FIT_THRESHOLD,
    missingProfile: false,
    matchedTags,
    weakestTags,
  }
}

export function getStudentTeacherFitForClassroom(
  student: Student,
  classroom: Classroom,
  teacherProfiles: TeacherProfile[]
): TeacherFitAssessment {
  return assessStudentTeacherFit(student, getTeacherProfileForClassroom(classroom, teacherProfiles), teacherProfiles.length > 0)
}

export function getPoorFitStudentCount(classroom: Classroom, teacherProfiles: TeacherProfile[]): number {
  return classroom.students.filter((student) => getStudentTeacherFitForClassroom(student, classroom, teacherProfiles).isPoorFit).length
}
