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
  mapReading?: number
  mapMath?: number
  ireadyReading?: string
  ireadyMath?: string
  noContactWith?: number[]
  /** Soft preference: IDs of students this student should ideally be placed with. */
  preferredWith?: number[]
  locked?: boolean
  /** Teacher name pre-assigned at import time. Populated from the CSV `teacher` column. */
  preassignedTeacher?: string
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
  /** Tolerance for M/F count spread across rooms measured in students. */
  genderBalanceTolerance: number
  classSizeVarianceLimit: number
}

export type GradeSettingsMap = Record<Grade, GradeSettings>

export interface AppState {
  allStudents: Student[]
  classrooms: Classroom[]
  activeGrade: Grade
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
}
