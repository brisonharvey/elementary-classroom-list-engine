import { Classroom, Grade, GRADES, GradeSettings, GradeSettingsMap, TeacherProfile } from "../types"

const DEFAULT_ROOM_COUNT = 4

export function getDefaultGradeSettings(): GradeSettings {
  return {
    maxIEPPerRoom: 6,
    maxReferralsPerRoom: 6,
    ellConcentrationSoftCap: 0.35,
    genderBalanceTolerance: 2,
    classSizeVarianceLimit: 3,
  }
}

export function createDefaultGradeSettingsMap(): GradeSettingsMap {
  return GRADES.reduce((acc, grade) => {
    acc[grade] = getDefaultGradeSettings()
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

export function syncClassroomsWithTeacherProfiles(classrooms: Classroom[], teacherProfiles: TeacherProfile[]): Classroom[] {
  let next = classrooms.map((classroom) => ({ ...classroom, students: [...classroom.students] }))

  for (const grade of GRADES) {
    const gradeProfiles = teacherProfiles.filter((profile) => profile.grade === grade)
    if (gradeProfiles.length === 0) continue

    let gradeRooms = getClassroomsForGrade(next, grade)
    while (gradeRooms.length < gradeProfiles.length) {
      next = [...next, createClassroom(grade, gradeRooms.length)]
      gradeRooms = getClassroomsForGrade(next, grade)
    }

    next = next.map((classroom) => {
      if (classroom.grade !== grade) return classroom
      const index = gradeRooms.findIndex((room) => room.id === classroom.id)
      const teacherProfile = gradeProfiles[index]
      return {
        ...classroom,
        teacherName: teacherProfile?.teacherName ?? "",
      }
    })
  }

  return next
}
