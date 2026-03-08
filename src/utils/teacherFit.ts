import {
  Classroom,
  Student,
  StudentTag,
  TeacherCharacteristicKey,
  TeacherProfile,
} from "../types"

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

const STUDENT_TAG_REQUIREMENTS: Record<StudentTag, Partial<Record<TeacherCharacteristicKey, number>>> = {
  "Needs strong routine": { classroomStructure: 1.4, behaviorManagementStrength: 0.6 },
  "Needs frequent redirection": { behaviorManagementStrength: 1.5, classroomStructure: 0.5 },
  "Easily frustrated": { emotionalSupportNurturing: 1.2, confidenceBuilding: 0.8 },
  "Needs reassurance": { emotionalSupportNurturing: 1, confidenceBuilding: 1 },
  "Sensitive to correction": { emotionalSupportNurturing: 1.3, confidenceBuilding: 0.7 },
  "Easily influenced by peers": { peerSocialCoaching: 1.2, classroomStructure: 0.4 },
  "Needs positive peer models": { peerSocialCoaching: 1.4, classroomStructure: 0.3 },
  "High energy": { movementFlexibility: 1, behaviorManagementStrength: 1 },
  "Needs movement breaks": { movementFlexibility: 1.5 },
  "Needs enrichment": { academicEnrichmentStrength: 1.5 },
  "Independent worker": { independenceScaffolding: 1.5 },
  "Low academic confidence": { confidenceBuilding: 1.2, emotionalSupportNurturing: 0.6 },
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
  const matchedTags = (student.tags ?? []).filter((tag) => STUDENT_TAG_REQUIREMENTS[tag] != null)
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
    const requirements = STUDENT_TAG_REQUIREMENTS[tag]
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
