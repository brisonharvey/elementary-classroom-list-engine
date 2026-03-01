import { Classroom, Grade, GRADES, LETTERS } from "../types"

export function initializeClassrooms(): Classroom[] {
  const classrooms: Classroom[] = []

  for (const grade of GRADES) {
    for (let i = 0; i < LETTERS.length; i++) {
      const letter = LETTERS[i]
      classrooms.push({
        id: `${grade}-${letter}`,
        grade,
        teacherName: "",
        maxSize: 28,
        coTeach: {
          reading: i === 0, // First classroom per grade defaults to reading co-teach
          math: false,
        },
        students: [],
      })
    }
  }

  return classrooms
}

export function getClassroomsForGrade(classrooms: Classroom[], grade: Grade): Classroom[] {
  return classrooms.filter((c) => c.grade === grade)
}
