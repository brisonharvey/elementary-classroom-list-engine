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
  "Needs strong routine",
  "Needs frequent redirection",
  "Easily frustrated",
  "Needs reassurance",
  "Sensitive to correction",
  "Struggles with peer conflict",
  "High energy",
  "Needs movement breaks",
  "Extended time for assignments",
  "Needs enrichment",
  "Independent worker",
  "Low academic confidence",
] as const

export type StudentTag = (typeof STUDENT_TAGS)[number]

export const LEGACY_STUDENT_TAG_ALIASES: Record<string, StudentTag> = {
  "Easily influenced by peers": "Struggles with peer conflict",
  "Needs positive peer models": "Struggles with peer conflict",
}

export const TEACHER_CHARACTERISTIC_KEYS = [
  "structure",
  "regulationBehaviorSupport",
  "socialEmotionalSupport",
  "instructionalExpertise",
] as const

export type TeacherCharacteristicKey = (typeof TEACHER_CHARACTERISTIC_KEYS)[number]

export type TeacherCharacteristics = Record<TeacherCharacteristicKey, 1 | 2 | 3 | 4 | 5>

export interface TeacherProfile {
  id: string
  grade: Grade
  teacherName: string
  characteristics: TeacherCharacteristics
}

export const EL_SUPPORT_LEVELS = ["low", "mid", "high"] as const
export type ELSupportLevel = (typeof EL_SUPPORT_LEVELS)[number]

export const INTERVENTION_SUPPORT_LEVELS = ["low", "mid", "high"] as const
export type InterventionSupportLevel = (typeof INTERVENTION_SUPPORT_LEVELS)[number]

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
    academicTier: number
  }
  behaviorTier: number
  academicTierNotes?: string
  behaviorTierNotes?: string
  referrals?: number
  briganceReadiness?: number
  mapReading?: number
  mapMath?: number
  ireadyReading?: string
  ireadyMath?: string
  tags?: StudentTag[]
  preassignedTeacher?: string
  parentRequestedTeacher?: string
  noContactWith?: number[]
  preferredWith?: number[]
  locked?: boolean
  ell?: boolean
  elLevel?: ELSupportLevel
  elNeedsCoTeach?: boolean
  section504?: boolean
  raceEthnicity?: string
  teacherNotes?: string
  avoidTeachers?: string[]
  interventionLevel?: InterventionSupportLevel
  interventionNeedsCoTeach?: boolean
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
  type: "NO_CONTACT" | "DO_NOT_SEPARATE" | "LINKED"
  studentIds: [number, number]
  note?: string
  createdAt: number
  grade: Grade
  scope?: "grade" | "multiYear"
}

export interface GradeSettings {
  maxIEPPerRoom: number
  maxReferralsPerRoom: number
  ellConcentrationSoftCap: number
  genderBalanceTolerance: number
  classSizeVarianceLimit: number
  roomFillPenaltyWeight: number
  academicBalancePenaltyWeight: number
  behavioralBalancePenaltyWeight: number
  demographicBalancePenaltyWeight: number
  preferredPeerBonus: number
  preferredPeerSplitPenalty: number
  keepTogetherBonus: number
  keepTogetherSplitPenalty: number
  ellOverCapPenaltyWeight: number
  genderImbalancePenaltyWeight: number
  classSizeVariancePenaltyWeight: number
  tagTotalBalancePenaltyWeight: number
  tagBehavioralPenaltyWeight: number
  tagEmotionalPenaltyWeight: number
  tagInstructionalPenaltyWeight: number
  tagEnergyPenaltyWeight: number
  tagHotspotPenaltyWeight: number
  tagHotspotThreshold: number
  parentTeacherRequestBonus: number
  showClassroomHeaderTagSupportLoad: boolean
  showClassroomHeaderIepCount: boolean
  showClassroomHeaderGenderCounts: boolean
  showClassroomHeaderMapReadingAverage: boolean
  showClassroomHeaderMapMathAverage: boolean
}

export type GradeSettingsMap = Record<Grade, GradeSettings>

export interface AppState {
  allStudents: Student[]
  teacherProfiles: TeacherProfile[]
  classrooms: Classroom[]
  schoolName: string
  schoolYear: string
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
