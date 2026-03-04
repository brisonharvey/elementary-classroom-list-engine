import { Classroom, Grade, RoomStats, Student } from "../types"

// ─────────────────────────────────────────────
// MAP Band (0–100 percentile-style score → 1–4)
// ─────────────────────────────────────────────
export function getMapBand(score: number | undefined): number {
  if (score === undefined || score === null) return 2.5 // midpoint when unknown
  if (score < 25) return 1
  if (score < 50) return 2
  if (score < 75) return 3
  return 4
}

// ─────────────────────────────────────────────
// iReady Relative Score
// Parses "Early K", "Mid 3", "Late 4" → numeric grade relative to student grade
// ─────────────────────────────────────────────
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
  // "mid" needs no adjustment

  return base
}

/** Convert iReady relative score (grade-level diff) to 1–4 band */
export function iReadyRelativeToScore(relative: number): number {
  // Map: ≤-3 → 1, 0 → 2.5, ≥+1.5 → 4
  return Math.max(1, Math.min(4, relative + 2.5))
}

// ─────────────────────────────────────────────
// Per-student composite scores (1–4 scale)
// ─────────────────────────────────────────────
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

/** Support load for a single student (unbounded integer, higher = more intensive) */
export function getStudentSupportLoad(student: Student): number {
  let load = 0
  load += student.intervention.academicTier       // 1–3
  load += student.behaviorTier                    // 1–3
  if (student.specialEd.status === "IEP") load += 2
  else if (student.specialEd.status === "Referral") load += 1
  load += student.referrals ?? 0
  return load
}

// ─────────────────────────────────────────────
// Room aggregate stats
// ─────────────────────────────────────────────
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

/** Precompute room stats snapshot (used for fast batch scoring) */
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
  }
}

// ─────────────────────────────────────────────
// Scoring — lower score = better fit
// ─────────────────────────────────────────────
export interface ScoreWeights {
  support: number // 0–100
  behavior: number // 0–100
  reading: number // 0–100
  math: number    // 0–100
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
  // Base load score (0–10): favours emptier classrooms
  const loadScore = (stats.size / classroom.maxSize) * 10

  // Support balance: penalise deviation of room support avg from student support load
  const studentSupport = getStudentSupportLoad(student)
  const supportPenalty = Math.abs(stats.supportLoad - studentSupport) * (weights.support / 100) * 5

  // Behavior balance: penalise deviation from room behavior intensity
  const roomBehaviorAvg =
    classroom.students.length > 0
      ? classroom.students.reduce((sum, s) => sum + (s.behaviorTier + (s.referrals ?? 0)), 0) / classroom.students.length
      : 0
  const studentBehavior = student.behaviorTier + (student.referrals ?? 0)
  const behaviorPenalty = Math.abs(roomBehaviorAvg - studentBehavior) * (weights.behavior / 100) * 4

  // Reading balance: penalise deviation of room reading avg from student reading score
  const studentReading = getStudentReadingScore(student)
  const readingPenalty = Math.abs(stats.readingAvg - studentReading) * (weights.reading / 100) * 3

  // Math balance: penalise deviation of room math avg from student math score
  const studentMath = getStudentMathScore(student)
  const mathPenalty = Math.abs(stats.mathAvg - studentMath) * (weights.math / 100) * 3

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
