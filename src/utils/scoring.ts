import { Classroom, CoTeachCategory, Grade, GradeSettings, RelationshipRule, RoomStats, Student } from "../types"
import { CO_TEACH_CATEGORIES, getStudentCoTeachTotal } from "./coTeach"
import {
  getClassroomTagSupportLoadBreakdown,
  getProjectedClassroomTagSupportLoadBreakdown,
  TagSupportLoadBreakdown,
} from "./tagSupportLoad"

export function getAssessmentBand(score: number | undefined): number {
  if (score === undefined || score === null) return 2.5
  if (score < 25) return 1
  if (score < 50) return 2
  if (score < 75) return 3
  return 4
}

export function gradeToNum(grade: Grade | string): number {
  if (grade === "K") return 0
  const n = parseInt(String(grade), 10)
  return Number.isNaN(n) ? 0 : n
}

export function getIReadyRelative(label: string | undefined, studentGrade: Grade | undefined): number | null {
  if (!label || !studentGrade) return null

  const match = label.trim().match(/^(Early|Mid|Late)\s+(K|\d)$/i)
  if (!match) return null

  const [, timing, gradeStr] = match
  const labelGradeNum = gradeStr.toUpperCase() === "K" ? 0 : parseInt(gradeStr, 10)
  const studentGradeNum = gradeToNum(studentGrade)

  let base = labelGradeNum - studentGradeNum
  const normalizedTiming = timing.toLowerCase()
  if (normalizedTiming === "early") base -= 0.3
  else if (normalizedTiming === "late") base += 0.3

  return base
}

export function iReadyRelativeToScore(relative: number): number {
  return Math.max(1, Math.min(4, relative + 2.5))
}

export function getStudentReadingScore(student: Student): number {
  if (student.grade === "K" && student.briganceReadiness !== undefined) {
    return getAssessmentBand(student.briganceReadiness)
  }

  const parts: number[] = []

  if (student.mapReading !== undefined) {
    parts.push(getAssessmentBand(student.mapReading))
  }

  const rel = getIReadyRelative(student.ireadyReading, student.grade)
  if (rel !== null) {
    parts.push(iReadyRelativeToScore(rel))
  }

  if (parts.length === 0) return 2.5
  return parts.reduce((sum, part) => sum + part, 0) / parts.length
}

export function getStudentMathScore(student: Student): number {
  if (student.grade === "K" && student.briganceReadiness !== undefined) {
    return getAssessmentBand(student.briganceReadiness)
  }

  const parts: number[] = []

  if (student.mapMath !== undefined) {
    parts.push(getAssessmentBand(student.mapMath))
  }

  const rel = getIReadyRelative(student.ireadyMath, student.grade)
  if (rel !== null) {
    parts.push(iReadyRelativeToScore(rel))
  }

  if (parts.length === 0) return 2.5
  return parts.reduce((sum, part) => sum + part, 0) / parts.length
}

export function getStudentCoTeachLoadScore(student: Student): number {
  return Math.max(0, Math.min(2, getStudentCoTeachTotal(student) / 60))
}

export function getStudentSupportLoad(student: Student): number {
  let load = 0
  load += student.intervention.academicTier
  load += student.behaviorTier
  if (student.specialEd.status === "IEP") load += 2
  else if (student.specialEd.status === "Referral") load += 1
  load += student.referrals ?? 0
  load += getStudentCoTeachLoadScore(student)
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
  const total = classroom.students.reduce((sum, student) => sum + getStudentSupportLoad(student), 0)
  return total / classroom.students.length
}

export function getRoomReadingAvg(classroom: Classroom): number {
  if (classroom.students.length === 0) return 2.5
  const total = classroom.students.reduce((sum, student) => sum + getStudentReadingScore(student), 0)
  return total / classroom.students.length
}

export function getRoomMathAvg(classroom: Classroom): number {
  if (classroom.students.length === 0) return 2.5
  const total = classroom.students.reduce((sum, student) => sum + getStudentMathScore(student), 0)
  return total / classroom.students.length
}

function getRoomCoTeachByCategory(classroom: Classroom): Record<CoTeachCategory, number> {
  return CO_TEACH_CATEGORIES.reduce((acc, category) => {
    acc[category] = classroom.students.reduce((sum, student) => sum + (student.coTeachMinutes[category] ?? 0), 0)
    return acc
  }, {} as Record<CoTeachCategory, number>)
}

export function computeRoomStats(classroom: Classroom): RoomStats {
  const coTeachMinutesByCategory = getRoomCoTeachByCategory(classroom)
  const totalCoTeachMinutes = Object.values(coTeachMinutesByCategory).reduce((sum, value) => sum + value, 0)
  const tagBreakdown = getClassroomTagSupportLoadBreakdown(classroom)
  return {
    id: classroom.id,
    size: classroom.students.length,
    supportLoad: getRoomSupportLoad(classroom),
    readingAvg: getRoomReadingAvg(classroom),
    mathAvg: getRoomMathAvg(classroom),
    iepCount: classroom.students.filter((student) => student.specialEd.status === "IEP").length,
    referralCount: classroom.students.filter((student) => student.specialEd.status === "Referral").length,
    maleCount: classroom.students.filter((student) => student.gender === "M").length,
    femaleCount: classroom.students.filter((student) => student.gender === "F").length,
    ellCount: classroom.students.filter((student) => student.ell).length,
    section504Count: classroom.students.filter((student) => student.section504).length,
    totalCoTeachMinutes,
    avgCoTeachMinutes: classroom.students.length ? totalCoTeachMinutes / classroom.students.length : 0,
    coTeachMinutesByCategory,
    tagSupportLoad: tagBreakdown.total,
    behavioralTagSupportLoad: tagBreakdown.behavioral,
    emotionalTagSupportLoad: tagBreakdown.emotional,
    instructionalTagSupportLoad: tagBreakdown.instructional,
    energyTagSupportLoad: tagBreakdown.energy,
  }
}

export interface ScoreWeights {
  academic: number
  behavioral: number
  demographic: number
  tagSupportLoad: number
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
  relationshipRules?: RelationshipRule[]
  gradeSettings?: GradeSettings
  gradeRooms?: Classroom[]
}

const SAME_ROOM_SUGGESTION_BONUS = 1.75
const SPLIT_ROOM_SUGGESTION_PENALTY = 1.25
const TAG_CATEGORY_PENALTY_MULTIPLIERS = {
  behavioral: 0.65,
  emotional: 0.55,
  instructional: 0.4,
  energy: 0.5,
} as const

function getPreferredTogetherAdjustment(student: Student, classroomId: string, context: PlacementSoftContext): number {
  const assignedRoomByStudentId = context.assignedRoomByStudentId
  const preferredPeerIds = student.preferredWith ?? []
  if (!assignedRoomByStudentId || preferredPeerIds.length === 0) return 0

  let adjustment = 0
  for (const peerId of preferredPeerIds) {
    const assignedRoomId = assignedRoomByStudentId.get(peerId)
    if (!assignedRoomId) continue

    if (assignedRoomId === classroomId) {
      adjustment -= SAME_ROOM_SUGGESTION_BONUS
    } else {
      adjustment += SPLIT_ROOM_SUGGESTION_PENALTY
    }
  }

  return adjustment
}

function getDoNotSeparateAdjustment(student: Student, classroomId: string, context: PlacementSoftContext): number {
  const assignedRoomByStudentId = context.assignedRoomByStudentId
  const rules = context.relationshipRules ?? []
  if (!assignedRoomByStudentId) return 0

  let adjustment = 0
  for (const rule of rules) {
    if (rule.type !== "DO_NOT_SEPARATE" || rule.grade !== student.grade) continue
    if (!rule.studentIds.includes(student.id)) continue
    const peerId = rule.studentIds[0] === student.id ? rule.studentIds[1] : rule.studentIds[0]
    const peerRoom = assignedRoomByStudentId.get(peerId)
    if (!peerRoom) continue
    adjustment += peerRoom === classroomId ? -2.25 : 1.5
  }
  return adjustment
}

function getSettingsPenalty(student: Student, stats: RoomStats, context: PlacementSoftContext): number {
  const settings = context.gradeSettings
  const gradeRooms = context.gradeRooms
  if (!settings || !gradeRooms) return 0

  let penalty = 0
  const newSize = stats.size + 1
  const nextEllRatio = student.ell ? (stats.ellCount + 1) / newSize : stats.ellCount / newSize
  if (nextEllRatio > settings.ellConcentrationSoftCap) {
    penalty += (nextEllRatio - settings.ellConcentrationSoftCap) * 10
  }

  const nextMale = stats.maleCount + (student.gender === "M" ? 1 : 0)
  const nextFemale = stats.femaleCount + (student.gender === "F" ? 1 : 0)
  if (Math.abs(nextMale - nextFemale) > settings.genderBalanceTolerance) {
    penalty += 2
  }

  const sizes = gradeRooms.map((room) => room.students.length)
  const currentMin = Math.min(...sizes)
  const currentMax = Math.max(...sizes)
  const minRoomCount = sizes.filter((size) => size === currentMin).length
  const simulatedMax = Math.max(currentMax, newSize)
  const simulatedMin =
    stats.size === currentMin && minRoomCount === 1
      ? Math.min(...sizes.map((size) => (size === currentMin ? currentMin + 1 : size)))
      : currentMin
  const variance = simulatedMax - simulatedMin
  if (variance > settings.classSizeVarianceLimit) {
    penalty += variance - settings.classSizeVarianceLimit
  }

  return penalty
}

function getAverageProjectedCategory(
  projectedBreakdowns: TagSupportLoadBreakdown[],
  key: keyof Pick<TagSupportLoadBreakdown, "behavioral" | "emotional" | "instructional" | "energy">
): number {
  return projectedBreakdowns.reduce((sum, breakdown) => sum + breakdown[key], 0) / projectedBreakdowns.length
}

export function getTagSupportLoadPenalty(student: Student, classroom: Classroom, gradeRooms: Classroom[]): number {
  if (gradeRooms.length === 0) return 0

  const projectedBreakdowns = gradeRooms.map((room) =>
    room.id === classroom.id ? getProjectedClassroomTagSupportLoadBreakdown(room, student) : getClassroomTagSupportLoadBreakdown(room)
  )
  const targetBreakdown = projectedBreakdowns[gradeRooms.findIndex((room) => room.id === classroom.id)]
  if (!targetBreakdown) return 0

  const projectedAverageTotal = projectedBreakdowns.reduce((sum, breakdown) => sum + breakdown.total, 0) / projectedBreakdowns.length
  let penalty = Math.max(0, targetBreakdown.total - projectedAverageTotal)

  const averageBehavioral = getAverageProjectedCategory(projectedBreakdowns, "behavioral")
  const averageEmotional = getAverageProjectedCategory(projectedBreakdowns, "emotional")
  const averageInstructional = getAverageProjectedCategory(projectedBreakdowns, "instructional")
  const averageEnergy = getAverageProjectedCategory(projectedBreakdowns, "energy")

  penalty += Math.max(0, targetBreakdown.behavioral - averageBehavioral) * TAG_CATEGORY_PENALTY_MULTIPLIERS.behavioral
  penalty += Math.max(0, targetBreakdown.emotional - averageEmotional) * TAG_CATEGORY_PENALTY_MULTIPLIERS.emotional
  penalty += Math.max(0, targetBreakdown.instructional - averageInstructional) * TAG_CATEGORY_PENALTY_MULTIPLIERS.instructional
  penalty += Math.max(0, targetBreakdown.energy - averageEnergy) * TAG_CATEGORY_PENALTY_MULTIPLIERS.energy

  const highestOtherTotal = Math.max(
    0,
    ...projectedBreakdowns.filter((_, index) => gradeRooms[index].id !== classroom.id).map((breakdown) => breakdown.total)
  )
  if (targetBreakdown.total > highestOtherTotal && targetBreakdown.total - projectedAverageTotal >= 3) {
    penalty += 1.5
  }

  return penalty
}

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
      ? classroom.students.reduce((sum, roomStudent) => sum + getStudentAcademicNeed(roomStudent), 0) / classroom.students.length
      : 0
  const academicPenalty = Math.abs(roomAcademicAvg - getStudentAcademicNeed(student)) * (weights.academic / 100) * 4
  const roomBehaviorAvg =
    classroom.students.length > 0
      ? classroom.students.reduce((sum, roomStudent) => sum + getStudentBehavioralNeed(roomStudent), 0) / classroom.students.length
      : 0
  const behavioralPenalty = Math.abs(getStudentBehavioralNeed(student) - roomBehaviorAvg) * (weights.behavioral / 100) * 4
  const demographicPenalty = getDemographicPenalty(student, stats) * (weights.demographic / 100) * 3
  const preferredTogetherAdjustment = getPreferredTogetherAdjustment(student, classroom.id, context)
  const doNotSeparateAdjustment = getDoNotSeparateAdjustment(student, classroom.id, context)
  const settingsPenalty = getSettingsPenalty(student, stats, context) * (weights.demographic / 100)
  const tagSupportLoadPenalty = context.gradeRooms
    ? getTagSupportLoadPenalty(student, classroom, context.gradeRooms) * (weights.tagSupportLoad / 100)
    : 0

  return (
    loadScore +
    academicPenalty +
    behavioralPenalty +
    demographicPenalty +
    preferredTogetherAdjustment +
    doNotSeparateAdjustment +
    settingsPenalty +
    tagSupportLoadPenalty
  )
}
