export type Grade = "K" | "1" | "2" | "3" | "4" | "5"

export type CoTeachCategory =
  | "reading"
  | "writing"
  | "scienceSocialStudies"
  | "math"
  | "behavior"
  | "social"
  | "vocational"

export const GRADES: Grade[] = ["K", "1", "2", "3", "4", "5"]
export const LETTERS = ["A", "B", "C", "D"] as const

export const STUDENT_TAGS = [
  "Needs structure",
  "Needs redirection support",
  "Needs emotional reassurance",
  "Needs peer support",
  "Needs movement support",
  "Needs academic enrichment",
  "Independent worker",
] as const

export type StudentTag = (typeof STUDENT_TAGS)[number]

export const TEACHER_CHARACTERISTIC_KEYS = [
  "classroomStructure",
  "behaviorManagementStrength",
  "emotionalSupportNurturing",
  "academicEnrichmentStrength",
  "independenceScaffolding",
  "movementFlexibility",
  "peerSocialCoaching",
  "confidenceBuilding",
] as const

export type TeacherCharacteristicKey = (typeof TEACHER_CHARACTERISTIC_KEYS)[number]

export type TeacherCharacteristics = Record<TeacherCharacteristicKey, 1 | 2 | 3 | 4 | 5>

export interface TeacherProfile {
  id: string
  grade: Grade
  teacherName: string
  characteristics: TeacherCharacteristics
}

export interface Student {
  id: number
  grade: Grade
  firstName: string
  lastName: string
  gender: "M" | "F"
  specialEd: {
    status: "None" | "IEP" | "Referral"
    requiresCoTeachReading?: boolean
    requiresCoTeachMath?: boolean
  }
  coTeachMinutes: Partial<Record<CoTeachCategory, number>>
  intervention: {
    academicTier: 1 | 2 | 3
  }
  behaviorTier: 1 | 2 | 3
  referrals?: number
  briganceReadiness?: number
  mapReading?: number
  mapMath?: number
  ireadyReading?: string
  ireadyMath?: string
  tags?: StudentTag[]
  noContactWith?: number[]
  preferredWith?: number[]
  locked?: boolean
  ell?: boolean
  section504?: boolean
  raceEthnicity?: string
  teacherNotes?: string
}

export interface Classroom {
  id: string
  grade: Grade
  label: string
  teacherName: string
  maxSize: number
  coTeachCoverage: CoTeachCategory[]
  students: Student[]
}

export interface Weights {
  academic: number
  behavioral: number
  demographic: number
  tagSupportLoad: number
}

export interface Snapshot {
  id: string
  grade: Grade
  name: string
  note?: string
  createdAt: number
  payload: {
    classrooms: Classroom[]
    settings: GradeSettings
  }
}

export interface RelationshipRule {
  id: string
  type: "NO_CONTACT" | "DO_NOT_SEPARATE"
  studentIds: [number, number]
  note?: string
  createdAt: number
  grade: Grade
}

export interface GradeSettings {
  maxIEPPerRoom: number
  maxReferralsPerRoom: number
  ellConcentrationSoftCap: number
  genderBalanceTolerance: number
  classSizeVarianceLimit: number
}

export type GradeSettingsMap = Record<Grade, GradeSettings>

export interface AppState {
  allStudents: Student[]
  teacherProfiles: TeacherProfile[]
  classrooms: Classroom[]
  activeGrade: Grade
  showTeacherNames: boolean
  weights: Weights
  snapshots: Snapshot[]
  relationshipRules: RelationshipRule[]
  gradeSettings: GradeSettingsMap
  unresolvedReasons: Record<number, string[]>
  placementWarnings: string[]
}

export interface RoomStats {
  id: string
  size: number
  supportLoad: number
  readingAvg: number
  mathAvg: number
  iepCount: number
  referralCount: number
  maleCount: number
  femaleCount: number
  ellCount: number
  section504Count: number
  totalCoTeachMinutes: number
  avgCoTeachMinutes: number
  coTeachMinutesByCategory: Record<CoTeachCategory, number>
  tagSupportLoad: number
  behavioralTagSupportLoad: number
  emotionalTagSupportLoad: number
  instructionalTagSupportLoad: number
  energyTagSupportLoad: number
}
