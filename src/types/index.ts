export type Grade = "K" | "1" | "2" | "3" | "4" | "5"

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
    requiresCoTeachReading: boolean
    requiresCoTeachMath: boolean
  }
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
  locked?: boolean
  /** Teacher name pre-assigned at import time. Populated from the CSV `teacher` column. */
  preassignedTeacher?: string
  ell?: boolean
  section504?: boolean
  homeroom?: string
  notes?: string
}

export interface Classroom {
  id: string
  grade: Grade
  teacherName: string
  maxSize: number
  coTeach: {
    reading: boolean
    math: boolean
  }
  students: Student[]
}

export interface Weights {
  support: number
  behavior: number
  reading: number
  math: number
}

export interface Snapshot {
  id: string
  name: string
  timestamp: number
  classrooms: Classroom[]
}

export interface AppState {
  allStudents: Student[]
  classrooms: Classroom[]
  activeGrade: Grade
  weights: Weights
  snapshots: Snapshot[]
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
}
