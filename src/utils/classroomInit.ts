import { Classroom, Grade, GRADES, GradeSettings, GradeSettingsMap, TeacherProfile } from "../types"

const DEFAULT_ROOM_COUNT = 4

const DEFAULT_GRADE_SETTINGS: GradeSettings = {
  maxIEPPerRoom: 6,
  maxReferralsPerRoom: 6,
  ellConcentrationSoftCap: 0.35,
  genderBalanceTolerance: 2,
  classSizeVarianceLimit: 3,
  roomFillPenaltyWeight: 10,
  academicBalancePenaltyWeight: 4,
  behavioralBalancePenaltyWeight: 4,
  demographicBalancePenaltyWeight: 3,
  preferredPeerBonus: 1.75,
  preferredPeerSplitPenalty: 1.25,
  keepTogetherBonus: 2.25,
  keepTogetherSplitPenalty: 1.5,
  ellOverCapPenaltyWeight: 10,
  genderImbalancePenaltyWeight: 2,
  classSizeVariancePenaltyWeight: 1,
  tagTotalBalancePenaltyWeight: 1,
  tagBehavioralPenaltyWeight: 0.65,
  tagEmotionalPenaltyWeight: 0.55,
  tagInstructionalPenaltyWeight: 0.4,
  tagEnergyPenaltyWeight: 0.5,
  tagHotspotPenaltyWeight: 1.5,
  tagHotspotThreshold: 3,
  parentRequestBonus: 0.75,
  showClassroomHeaderTagSupportLoad: false,
  showClassroomHeaderIepCount: false,
  showClassroomHeaderGenderCounts: false,
  showClassroomHeaderMapReadingAverage: false,
  showClassroomHeaderMapMathAverage: false,
}

function readNumber(value: unknown, fallback: number, minimum = 0, maximum?: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  const clampedMinimum = Math.max(minimum, value)
  const clamped = maximum === undefined ? clampedMinimum : Math.min(clampedMinimum, maximum)
  return clamped
}

function readWholeNumber(value: unknown, fallback: number, minimum = 0): number {
  return Math.round(readNumber(value, fallback, minimum))
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}

export function getDefaultGradeSettings(): GradeSettings {
  return { ...DEFAULT_GRADE_SETTINGS }
}

export function normalizeGradeSettings(settings: Partial<GradeSettings> | null | undefined): GradeSettings {
  const defaults = getDefaultGradeSettings()

  return {
    maxIEPPerRoom: readWholeNumber(settings?.maxIEPPerRoom, defaults.maxIEPPerRoom),
    maxReferralsPerRoom: readWholeNumber(settings?.maxReferralsPerRoom, defaults.maxReferralsPerRoom),
    ellConcentrationSoftCap: readNumber(settings?.ellConcentrationSoftCap, defaults.ellConcentrationSoftCap, 0),
    genderBalanceTolerance: readWholeNumber(settings?.genderBalanceTolerance, defaults.genderBalanceTolerance),
    classSizeVarianceLimit: readWholeNumber(settings?.classSizeVarianceLimit, defaults.classSizeVarianceLimit),
    roomFillPenaltyWeight: readNumber(settings?.roomFillPenaltyWeight, defaults.roomFillPenaltyWeight),
    academicBalancePenaltyWeight: readNumber(settings?.academicBalancePenaltyWeight, defaults.academicBalancePenaltyWeight),
    behavioralBalancePenaltyWeight: readNumber(settings?.behavioralBalancePenaltyWeight, defaults.behavioralBalancePenaltyWeight),
    demographicBalancePenaltyWeight: readNumber(settings?.demographicBalancePenaltyWeight, defaults.demographicBalancePenaltyWeight),
    preferredPeerBonus: readNumber(settings?.preferredPeerBonus, defaults.preferredPeerBonus),
    preferredPeerSplitPenalty: readNumber(settings?.preferredPeerSplitPenalty, defaults.preferredPeerSplitPenalty),
    keepTogetherBonus: readNumber(settings?.keepTogetherBonus, defaults.keepTogetherBonus),
    keepTogetherSplitPenalty: readNumber(settings?.keepTogetherSplitPenalty, defaults.keepTogetherSplitPenalty),
    ellOverCapPenaltyWeight: readNumber(settings?.ellOverCapPenaltyWeight, defaults.ellOverCapPenaltyWeight),
    genderImbalancePenaltyWeight: readNumber(settings?.genderImbalancePenaltyWeight, defaults.genderImbalancePenaltyWeight),
    classSizeVariancePenaltyWeight: readNumber(settings?.classSizeVariancePenaltyWeight, defaults.classSizeVariancePenaltyWeight),
    tagTotalBalancePenaltyWeight: readNumber(settings?.tagTotalBalancePenaltyWeight, defaults.tagTotalBalancePenaltyWeight),
    tagBehavioralPenaltyWeight: readNumber(settings?.tagBehavioralPenaltyWeight, defaults.tagBehavioralPenaltyWeight),
    tagEmotionalPenaltyWeight: readNumber(settings?.tagEmotionalPenaltyWeight, defaults.tagEmotionalPenaltyWeight),
    tagInstructionalPenaltyWeight: readNumber(settings?.tagInstructionalPenaltyWeight, defaults.tagInstructionalPenaltyWeight),
    tagEnergyPenaltyWeight: readNumber(settings?.tagEnergyPenaltyWeight, defaults.tagEnergyPenaltyWeight),
    tagHotspotPenaltyWeight: readNumber(settings?.tagHotspotPenaltyWeight, defaults.tagHotspotPenaltyWeight),
    tagHotspotThreshold: readNumber(settings?.tagHotspotThreshold, defaults.tagHotspotThreshold),
    parentRequestBonus: readNumber(
      settings?.parentRequestBonus ?? (settings as Partial<GradeSettings> & { parentTeacherRequestBonus?: unknown } | null | undefined)?.parentTeacherRequestBonus,
      defaults.parentRequestBonus
    ),
    showClassroomHeaderTagSupportLoad: readBoolean(settings?.showClassroomHeaderTagSupportLoad, defaults.showClassroomHeaderTagSupportLoad),
    showClassroomHeaderIepCount: readBoolean(settings?.showClassroomHeaderIepCount, defaults.showClassroomHeaderIepCount),
    showClassroomHeaderGenderCounts: readBoolean(settings?.showClassroomHeaderGenderCounts, defaults.showClassroomHeaderGenderCounts),
    showClassroomHeaderMapReadingAverage: readBoolean(settings?.showClassroomHeaderMapReadingAverage, defaults.showClassroomHeaderMapReadingAverage),
    showClassroomHeaderMapMathAverage: readBoolean(settings?.showClassroomHeaderMapMathAverage, defaults.showClassroomHeaderMapMathAverage),
  }
}

export function createDefaultGradeSettingsMap(): GradeSettingsMap {
  return GRADES.reduce((acc, grade) => {
    acc[grade] = getDefaultGradeSettings()
    return acc
  }, {} as GradeSettingsMap)
}

export function normalizeGradeSettingsMap(
  settingsMap: Partial<Record<Grade, Partial<GradeSettings>>> | null | undefined
): GradeSettingsMap {
  return GRADES.reduce((acc, grade) => {
    acc[grade] = normalizeGradeSettings(settingsMap?.[grade])
    return acc
  }, {} as GradeSettingsMap)
}

export function getRoomLabelFromIndex(index: number): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  if (index < alphabet.length) return alphabet[index]
  return `R${index + 1}`
}

export function createClassroom(grade: Grade, index: number): Classroom {
  return {
    id: `${grade}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    grade,
    label: getRoomLabelFromIndex(index),
    teacherName: "",
    maxSize: 28,
    coTeachCoverage: index === 0 ? ["reading"] : [],
    students: [],
  }
}

export function initializeClassrooms(): Classroom[] {
  const classrooms: Classroom[] = []

  for (const grade of GRADES) {
    for (let i = 0; i < DEFAULT_ROOM_COUNT; i++) {
      classrooms.push(createClassroom(grade, i))
    }
  }

  return classrooms
}

export function getClassroomsForGrade(classrooms: Classroom[], grade: Grade): Classroom[] {
  return classrooms.filter((c) => c.grade === grade)
}

function normalizeTeacherName(name: string): string {
  return name.trim().toLowerCase()
}

export function syncClassroomsWithTeacherProfiles(classrooms: Classroom[], teacherProfiles: TeacherProfile[]): Classroom[] {
  let next = classrooms.map((classroom) => ({ ...classroom, students: [...classroom.students] }))

  for (const grade of GRADES) {
    const gradeProfiles = teacherProfiles.filter((profile) => profile.grade === grade)
    if (gradeProfiles.length === 0) continue

    const gradeRooms = getClassroomsForGrade(next, grade)
    const matchedRoomIds = new Set<string>()
    const assignments = new Map<string, string>()
    const unmatchedProfiles: TeacherProfile[] = []

    for (const profile of gradeProfiles) {
      const exactRoom = gradeRooms.find(
        (room) => !matchedRoomIds.has(room.id) && normalizeTeacherName(room.teacherName) === normalizeTeacherName(profile.teacherName)
      )

      if (exactRoom) {
        matchedRoomIds.add(exactRoom.id)
        assignments.set(exactRoom.id, profile.teacherName)
        continue
      }

      unmatchedProfiles.push(profile)
    }

    for (const profile of unmatchedProfiles) {
      const blankRoom = gradeRooms.find((room) => !matchedRoomIds.has(room.id) && !room.teacherName.trim())
      if (blankRoom) {
        matchedRoomIds.add(blankRoom.id)
        assignments.set(blankRoom.id, profile.teacherName)
        continue
      }

      const newRoom = createClassroom(grade, getClassroomsForGrade(next, grade).length)
      matchedRoomIds.add(newRoom.id)
      assignments.set(newRoom.id, profile.teacherName)
      next = [...next, newRoom]
    }

    next = next.map((classroom) =>
      classroom.grade !== grade || !assignments.has(classroom.id)
        ? classroom
        : {
            ...classroom,
            teacherName: assignments.get(classroom.id) ?? classroom.teacherName,
          }
    )
  }

  return next
}
