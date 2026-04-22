import { Classroom, CoTeachCategory, Grade, GradeSettings, RelationshipRule, RoomStats, Student } from "../types"
import { getDefaultGradeSettings } from "./classroomInit"
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

const EL_LEVEL_WEIGHT: Record<string, number> = { low: 0.5, mid: 1.0, high: 1.5 }
const INTERVENTION_LEVEL_WEIGHT: Record<string, number> = { low: 0.5, mid: 1.0, high: 1.5 }

export function getStudentSupportLoad(student: Student): number {
  let load = 0
  load += student.intervention.academicTier
  load += student.behaviorTier
  if (student.specialEd.status === "IEP") load += 2
  else if (student.specialEd.status === "Referral") load += 1
  load += student.referrals ?? 0
  load += getStudentCoTeachLoadScore(student)
  if (student.elLevel) load += EL_LEVEL_WEIGHT[student.elLevel] ?? 0
  if (student.interventionLevel) load += INTERVENTION_LEVEL_WEIGHT[student.interventionLevel] ?? 0
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

function getPlacementSettings(settings: GradeSettings | undefined): GradeSettings {
  return settings ?? getDefaultGradeSettings()
}

function getPreferredTogetherAdjustment(student: Student, classroomId: string, context: PlacementSoftContext): number {
  const assignedRoomByStudentId = context.assignedRoomByStudentId
  const preferredPeerIds = student.preferredWith ?? []
  if (!assignedRoomByStudentId || preferredPeerIds.length === 0) return 0

  const settings = getPlacementSettings(context.gradeSettings)
  let adjustment = 0
  for (const peerId of preferredPeerIds) {
    const assignedRoomId = assignedRoomByStudentId.get(peerId)
    if (!assignedRoomId) continue

    if (assignedRoomId === classroomId) {
      adjustment -= settings.preferredPeerBonus
    } else {
      adjustment += settings.preferredPeerSplitPenalty
    }
  }

  return adjustment
}

function getDoNotSeparateAdjustment(student: Student, classroomId: string, context: PlacementSoftContext): number {
  const assignedRoomByStudentId = context.assignedRoomByStudentId
  const rules = context.relationshipRules ?? []
  if (!assignedRoomByStudentId) return 0

  const settings = getPlacementSettings(context.gradeSettings)
  let adjustment = 0
  for (const rule of rules) {
    if (rule.type !== "DO_NOT_SEPARATE" || rule.grade !== student.grade) continue
    if (!rule.studentIds.includes(student.id)) continue
    const peerId = rule.studentIds[0] === student.id ? rule.studentIds[1] : rule.studentIds[0]
    const peerRoom = assignedRoomByStudentId.get(peerId)
    if (!peerRoom) continue
    adjustment += peerRoom === classroomId ? -settings.keepTogetherBonus : settings.keepTogetherSplitPenalty
  }
  return adjustment
}

function getSettingsPenalty(student: Student, stats: RoomStats, settings: GradeSettings, gradeRooms: Classroom[] | undefined): number {
  if (!gradeRooms) return 0

  let penalty = 0
  const newSize = stats.size + 1
  const nextEllRatio = student.ell ? (stats.ellCount + 1) / newSize : stats.ellCount / newSize
  if (nextEllRatio > settings.ellConcentrationSoftCap) {
    penalty += (nextEllRatio - settings.ellConcentrationSoftCap) * settings.ellOverCapPenaltyWeight
  }

  const nextMale = stats.maleCount + (student.gender === "M" ? 1 : 0)
  const nextFemale = stats.femaleCount + (student.gender === "F" ? 1 : 0)
  if (Math.abs(nextMale - nextFemale) > settings.genderBalanceTolerance) {
    penalty += settings.genderImbalancePenaltyWeight
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
    penalty += (variance - settings.classSizeVarianceLimit) * settings.classSizeVariancePenaltyWeight
  }

  return penalty
}

function getRoomFillPenalty(classroom: Classroom, stats: RoomStats, gradeRooms: Classroom[] | undefined, settings: GradeSettings): number {
  const projectedOccupancy = (stats.size + 1) / classroom.maxSize
  if (!gradeRooms || gradeRooms.length === 0) {
    return projectedOccupancy * settings.roomFillPenaltyWeight
  }

  const projectedSizes = gradeRooms.map((room) => (room.id === classroom.id ? room.students.length + 1 : room.students.length))
  const smallestProjectedSize = Math.min(...projectedSizes)
  const targetProjectedSize = stats.size + 1
  const sizeGapPenalty = targetProjectedSize - smallestProjectedSize

  return (projectedOccupancy + sizeGapPenalty) * settings.roomFillPenaltyWeight
}

function getAverageProjectedCategory(
  projectedBreakdowns: TagSupportLoadBreakdown[],
  key: keyof Pick<TagSupportLoadBreakdown, "behavioral" | "emotional" | "instructional" | "energy">
): number {
  return projectedBreakdowns.reduce((sum, breakdown) => sum + breakdown[key], 0) / projectedBreakdowns.length
}

export function getTagSupportLoadPenalty(
  student: Student,
  classroom: Classroom,
  gradeRooms: Classroom[],
  gradeSettings?: GradeSettings
): number {
  if (gradeRooms.length === 0) return 0

  const settings = getPlacementSettings(gradeSettings)
  const projectedBreakdowns = gradeRooms.map((room) =>
    room.id === classroom.id ? getProjectedClassroomTagSupportLoadBreakdown(room, student) : getClassroomTagSupportLoadBreakdown(room)
  )
  const targetBreakdown = projectedBreakdowns[gradeRooms.findIndex((room) => room.id === classroom.id)]
  if (!targetBreakdown) return 0

  const projectedAverageTotal = projectedBreakdowns.reduce((sum, breakdown) => sum + breakdown.total, 0) / projectedBreakdowns.length
  let penalty = Math.max(0, targetBreakdown.total - projectedAverageTotal) * settings.tagTotalBalancePenaltyWeight

  const averageBehavioral = getAverageProjectedCategory(projectedBreakdowns, "behavioral")
  const averageEmotional = getAverageProjectedCategory(projectedBreakdowns, "emotional")
  const averageInstructional = getAverageProjectedCategory(projectedBreakdowns, "instructional")
  const averageEnergy = getAverageProjectedCategory(projectedBreakdowns, "energy")

  penalty += Math.max(0, targetBreakdown.behavioral - averageBehavioral) * settings.tagBehavioralPenaltyWeight
  penalty += Math.max(0, targetBreakdown.emotional - averageEmotional) * settings.tagEmotionalPenaltyWeight
  penalty += Math.max(0, targetBreakdown.instructional - averageInstructional) * settings.tagInstructionalPenaltyWeight
  penalty += Math.max(0, targetBreakdown.energy - averageEnergy) * settings.tagEnergyPenaltyWeight

  const highestOtherTotal = Math.max(
    0,
    ...projectedBreakdowns.filter((_, index) => gradeRooms[index].id !== classroom.id).map((breakdown) => breakdown.total)
  )
  if (targetBreakdown.total > highestOtherTotal && targetBreakdown.total - projectedAverageTotal >= settings.tagHotspotThreshold) {
    penalty += settings.tagHotspotPenaltyWeight
  }

  return penalty
}

function getParentTeacherRequestAdjustment(student: Student, classroom: Classroom, settings: GradeSettings): number {
  if (!student.parentRequestedTeacher?.trim()) return 0
  const requested = student.parentRequestedTeacher.trim().toLowerCase()
  const classroomTeacher = classroom.teacherName.trim().toLowerCase()
  if (!classroomTeacher) return 0
  return classroomTeacher === requested ? -settings.parentTeacherRequestBonus : 0
}

function getCoTeachSuggestionAdjustment(student: Student, classroom: Classroom, settings: GradeSettings): number {
  if (!student.elNeedsCoTeach && !student.interventionNeedsCoTeach) return 0
  const hasCoTeach = classroom.coTeachCoverage.length > 0
  const bonus = settings.parentTeacherRequestBonus * 0.75
  return hasCoTeach ? -bonus : bonus
}

export function scoreStudentForRoom(
  student: Student,
  classroom: Classroom,
  stats: RoomStats,
  weights: ScoreWeights,
  context: PlacementSoftContext = {}
): number {
  const settings = getPlacementSettings(context.gradeSettings)
  const classSizePenalty = getRoomFillPenalty(classroom, stats, context.gradeRooms, settings) * (weights.demographic / 100)

  const roomAcademicAvg =
    classroom.students.length > 0
      ? classroom.students.reduce((sum, roomStudent) => sum + getStudentAcademicNeed(roomStudent), 0) / classroom.students.length
      : 0
  const academicPenalty =
    Math.abs(roomAcademicAvg - getStudentAcademicNeed(student)) * (weights.academic / 100) * settings.academicBalancePenaltyWeight
  const roomBehaviorAvg =
    classroom.students.length > 0
      ? classroom.students.reduce((sum, roomStudent) => sum + getStudentBehavioralNeed(roomStudent), 0) / classroom.students.length
      : 0
  const behavioralPenalty =
    Math.abs(getStudentBehavioralNeed(student) - roomBehaviorAvg) * (weights.behavioral / 100) * settings.behavioralBalancePenaltyWeight
  const demographicPenalty = getDemographicPenalty(student, stats) * (weights.demographic / 100) * settings.demographicBalancePenaltyWeight
  const preferredTogetherAdjustment = getPreferredTogetherAdjustment(student, classroom.id, context)
  const doNotSeparateAdjustment = getDoNotSeparateAdjustment(student, classroom.id, context)
  const settingsPenalty = getSettingsPenalty(student, stats, settings, context.gradeRooms) * (weights.demographic / 100)
  const tagSupportLoadPenalty = context.gradeRooms
    ? getTagSupportLoadPenalty(student, classroom, context.gradeRooms, settings) * (weights.tagSupportLoad / 100)
    : 0
  const parentRequestAdjustment = getParentTeacherRequestAdjustment(student, classroom, settings)
  const coTeachSuggestionAdjustment = getCoTeachSuggestionAdjustment(student, classroom, settings)

  return (
    classSizePenalty +
    academicPenalty +
    behavioralPenalty +
    demographicPenalty +
    preferredTogetherAdjustment +
    doNotSeparateAdjustment +
    settingsPenalty +
    tagSupportLoadPenalty +
    parentRequestAdjustment +
    coTeachSuggestionAdjustment
  )
}
