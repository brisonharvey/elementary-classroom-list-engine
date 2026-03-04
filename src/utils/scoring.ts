import { Classroom, Grade, RoomStats, Student } from "../types"

export function getMapBand(score: number | undefined): number {
  if (score === undefined || score === null) return 2.5
  if (score < 25) return 1
  if (score < 50) return 2
  if (score < 75) return 3
  return 4
}

export function gradeToNum(grade: Grade | string): number {
  if (grade === "K") return 0
  const n = parseInt(String(grade), 10)
  return isNaN(n) ? 0 : n
}

export function getIReadyRelative(label: string | undefined, studentGrade: Grade | undefined): number | null {
  if (!label || !studentGrade) return null

  const match = label.trim().match(/^(Early|Mid|Late)\s+(K|\d)$/i)
  if (!match) return null

  const [, timing, gradeStr] = match
  const labelGradeNum = gradeStr.toUpperCase() === "K" ? 0 : parseInt(gradeStr, 10)
  const studentGradeNum = gradeToNum(studentGrade)

  let base = labelGradeNum - studentGradeNum
  const t = timing.toLowerCase()
  if (t === "early") base -= 0.3
  else if (t === "late") base += 0.3

  return base
}

export function iReadyRelativeToScore(relative: number): number {
  return Math.max(1, Math.min(4, relative + 2.5))
}

export function getStudentReadingScore(student: Student): number {
  const parts: number[] = []

  if (student.mapReading !== undefined) {
    parts.push(getMapBand(student.mapReading))
  }

  const rel = getIReadyRelative(student.ireadyReading, student.grade)
  if (rel !== null) {
    parts.push(iReadyRelativeToScore(rel))
  }

  if (parts.length === 0) return 2.5
  return parts.reduce((a, b) => a + b, 0) / parts.length
}

export function getStudentMathScore(student: Student): number {
  const parts: number[] = []

  if (student.mapMath !== undefined) {
    parts.push(getMapBand(student.mapMath))
  }

  const rel = getIReadyRelative(student.ireadyMath, student.grade)
  if (rel !== null) {
    parts.push(iReadyRelativeToScore(rel))
  }

  if (parts.length === 0) return 2.5
  return parts.reduce((a, b) => a + b, 0) / parts.length
}

export function getStudentSupportLoad(student: Student): number {
  let load = 0
  load += student.intervention.academicTier
  load += student.behaviorTier
  if (student.specialEd.status === "IEP") load += 2
  else if (student.specialEd.status === "Referral") load += 1
  load += student.referrals ?? 0
  return load
}

function getStudentAcademicNeed(student: Student): number {
  const readingGap = Math.abs(getStudentReadingScore(student) - 2.5)
  const mathGap = Math.abs(getStudentMathScore(student) - 2.5)
  return student.intervention.academicTier + (readingGap + mathGap) / 2
}

function getStudentBehavioralNeed(student: Student): number {
  return student.behaviorTier + (student.referrals ?? 0)
}

export function getRoomSupportLoad(classroom: Classroom): number {
  if (classroom.students.length === 0) return 0
  const total = classroom.students.reduce((sum, s) => sum + getStudentSupportLoad(s), 0)
  return total / classroom.students.length
}

export function getRoomReadingAvg(classroom: Classroom): number {
  if (classroom.students.length === 0) return 2.5
  const total = classroom.students.reduce((sum, s) => sum + getStudentReadingScore(s), 0)
  return total / classroom.students.length
}

export function getRoomMathAvg(classroom: Classroom): number {
  if (classroom.students.length === 0) return 2.5
  const total = classroom.students.reduce((sum, s) => sum + getStudentMathScore(s), 0)
  return total / classroom.students.length
}

export function computeRoomStats(classroom: Classroom): RoomStats {
  return {
    id: classroom.id,
    size: classroom.students.length,
    supportLoad: getRoomSupportLoad(classroom),
    readingAvg: getRoomReadingAvg(classroom),
    mathAvg: getRoomMathAvg(classroom),
    iepCount: classroom.students.filter((s) => s.specialEd.status === "IEP").length,
    referralCount: classroom.students.filter((s) => s.specialEd.status === "Referral").length,
    maleCount: classroom.students.filter((s) => s.gender === "M").length,
    femaleCount: classroom.students.filter((s) => s.gender === "F").length,
    ellCount: classroom.students.filter((s) => s.ell).length,
    section504Count: classroom.students.filter((s) => s.section504).length,
  }
}

export interface ScoreWeights {
  academic: number
  behavioral: number
  demographic: number
}

function ratio(count: number, size: number): number {
  if (size <= 0) return 0
  return count / size
}

function getDemographicPenalty(student: Student, stats: RoomStats): number {
  const size = stats.size
  if (size === 0) return 0

  const sameGenderRatio = student.gender === "F" ? ratio(stats.femaleCount, size) : ratio(stats.maleCount, size)
  const ellRatio = student.ell ? ratio(stats.ellCount, size) : 0
  const section504Ratio = student.section504 ? ratio(stats.section504Count, size) : 0
  const iepRatio = student.specialEd.status === "IEP" ? ratio(stats.iepCount, size) : 0
  const referralRatio = student.specialEd.status === "Referral" ? ratio(stats.referralCount, size) : 0

  return sameGenderRatio + ellRatio + section504Ratio + iepRatio + referralRatio
}

export interface PlacementSoftContext {
  assignedRoomByStudentId?: Map<number, string>
}

const SAME_ROOM_SUGGESTION_BONUS = 1.75
const SPLIT_ROOM_SUGGESTION_PENALTY = 1.25

export function scoreStudentForRoom(
  student: Student,
  classroom: Classroom,
  stats: RoomStats,
  weights: ScoreWeights,
  context: PlacementSoftContext = {}
): number {
  const loadScore = (stats.size / classroom.maxSize) * 10

  const roomAcademicAvg =
    classroom.students.length > 0
      ? classroom.students.reduce((sum, s) => sum + getStudentAcademicNeed(s), 0) / classroom.students.length
      : 0
  const academicPenalty = Math.abs(roomAcademicAvg - getStudentAcademicNeed(student)) * (weights.academic / 100) * 4
  const roomBehaviorAvg =
    classroom.students.length > 0
      ? classroom.students.reduce((sum, s) => sum + getStudentBehavioralNeed(s), 0) / classroom.students.length
      : 0
  const behavioralPenalty = Math.abs(getStudentBehavioralNeed(student) - roomBehaviorAvg) * (weights.behavioral / 100) * 4
  const demographicPenalty = getDemographicPenalty(student, stats) * (weights.demographic / 100) * 3

  const assignedRoomByStudentId = context.assignedRoomByStudentId
  const preferredPeerIds = student.preferredWith ?? []
  let preferredTogetherAdjustment = 0

  if (assignedRoomByStudentId && preferredPeerIds.length > 0) {
    for (const peerId of preferredPeerIds) {
      const assignedRoomId = assignedRoomByStudentId.get(peerId)
      if (!assignedRoomId) continue

      if (assignedRoomId === classroom.id) {
        preferredTogetherAdjustment -= SAME_ROOM_SUGGESTION_BONUS
      } else {
        preferredTogetherAdjustment += SPLIT_ROOM_SUGGESTION_PENALTY
      }
    }
  }

  return loadScore + supportPenalty + behaviorPenalty + readingPenalty + mathPenalty + preferredTogetherAdjustment
}
