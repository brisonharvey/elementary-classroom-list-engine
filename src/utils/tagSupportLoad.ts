import { Classroom, Grade, Student, StudentTag, TeacherCharacteristicKey } from "../types"

export type TagSupportLoadCategory = "behavioral" | "emotional" | "instructional" | "energy"

export const TAG_SUPPORT_LOAD_CATEGORY_LABELS: Record<TagSupportLoadCategory, string> = {
  behavioral: "Behavioral",
  emotional: "Emotional",
  instructional: "Instructional",
  energy: "Energy",
}

export const STUDENT_TAG_TEACHER_CHARACTERISTIC_REQUIREMENTS: Record<
  StudentTag,
  Partial<Record<TeacherCharacteristicKey, number>>
> = {
  "Needs strong routine": { structure: 1.5, regulationBehaviorSupport: 0.5 },
  "Needs frequent redirection": { regulationBehaviorSupport: 1.5, structure: 0.5 },
  "Easily frustrated": { socialEmotionalSupport: 1.5, regulationBehaviorSupport: 0.5 },
  "Needs reassurance": { socialEmotionalSupport: 1.7, instructionalExpertise: 0.3 },
  "Sensitive to correction": { socialEmotionalSupport: 1.7, instructionalExpertise: 0.3 },
  "Struggles with peer conflict": { socialEmotionalSupport: 1.2, regulationBehaviorSupport: 0.8 },
  "High energy": { regulationBehaviorSupport: 1.4, structure: 0.6 },
  "Needs movement breaks": { regulationBehaviorSupport: 1.5, structure: 0.5 },
  "Needs enrichment": { instructionalExpertise: 1.7, structure: 0.3 },
  "Independent worker": { instructionalExpertise: 1.1, structure: 0.9 },
  "Low academic confidence": { socialEmotionalSupport: 1.2, instructionalExpertise: 0.8 },
}

export const STUDENT_TAG_SUPPORT_WEIGHTS: Record<StudentTag, number> = {
  "Needs strong routine": 2,
  "Needs frequent redirection": 4,
  "Easily frustrated": 3,
  "Needs reassurance": 2,
  "Sensitive to correction": 2,
  "Struggles with peer conflict": 3,
  "High energy": 2,
  "Needs movement breaks": 2,
  "Needs enrichment": 1,
  "Independent worker": -1,
  "Low academic confidence": 2,
}

export const TAG_SUPPORT_LOAD_CATEGORIES: Record<TagSupportLoadCategory, StudentTag[]> = {
  behavioral: ["Needs strong routine", "Needs frequent redirection", "Struggles with peer conflict"],
  emotional: ["Easily frustrated", "Needs reassurance", "Sensitive to correction", "Low academic confidence"],
  instructional: ["Needs enrichment", "Independent worker"],
  energy: ["High energy", "Needs movement breaks"],
}

export interface StudentTagSupportContribution {
  tag: StudentTag
  weight: number
  categories: TagSupportLoadCategory[]
}

export interface TagSupportLoadBreakdown {
  total: number
  behavioral: number
  emotional: number
  instructional: number
  energy: number
  contributions: StudentTagSupportContribution[]
}

export interface GradeTagSupportLoadSummary {
  averageTotal: number
  highestTotal: number
  lowestTotal: number
  rangeTotal: number
  averageByCategory: Record<TagSupportLoadCategory, number>
  highestByCategory: Record<TagSupportLoadCategory, number>
  lowestByCategory: Record<TagSupportLoadCategory, number>
  rangeByCategory: Record<TagSupportLoadCategory, number>
}

function createEmptyBreakdown(): Omit<TagSupportLoadBreakdown, "contributions"> {
  return {
    total: 0,
    behavioral: 0,
    emotional: 0,
    instructional: 0,
    energy: 0,
  }
}

const TAG_TO_CATEGORIES = new Map<StudentTag, TagSupportLoadCategory[]>()
for (const [category, tags] of Object.entries(TAG_SUPPORT_LOAD_CATEGORIES) as Array<[TagSupportLoadCategory, StudentTag[]]>) {
  for (const tag of tags) {
    const existing = TAG_TO_CATEGORIES.get(tag) ?? []
    TAG_TO_CATEGORIES.set(tag, [...existing, category])
  }
}

export function getStudentTagSupportContributions(student: Student): StudentTagSupportContribution[] {
  return (student.tags ?? []).map((tag) => ({
    tag,
    weight: STUDENT_TAG_SUPPORT_WEIGHTS[tag] ?? 0,
    categories: TAG_TO_CATEGORIES.get(tag) ?? [],
  }))
}

export function getStudentTagSupportLoad(student: Student): number {
  return getStudentTagSupportContributions(student).reduce((sum, contribution) => sum + contribution.weight, 0)
}

export function getStudentTagSupportLoadBreakdown(student: Student): TagSupportLoadBreakdown {
  const contributions = getStudentTagSupportContributions(student)
  const totals = createEmptyBreakdown()

  for (const contribution of contributions) {
    totals.total += contribution.weight
    for (const category of contribution.categories) {
      totals[category] += contribution.weight
    }
  }

  return {
    ...totals,
    contributions,
  }
}

export function getClassroomTagSupportLoadBreakdown(classroom: Classroom): TagSupportLoadBreakdown {
  const totals = createEmptyBreakdown()
  const contributions: StudentTagSupportContribution[] = []

  for (const student of classroom.students) {
    const breakdown = getStudentTagSupportLoadBreakdown(student)
    totals.total += breakdown.total
    totals.behavioral += breakdown.behavioral
    totals.emotional += breakdown.emotional
    totals.instructional += breakdown.instructional
    totals.energy += breakdown.energy
    contributions.push(...breakdown.contributions)
  }

  return {
    ...totals,
    contributions,
  }
}

export function getClassroomTagSupportLoad(classroom: Classroom): number {
  return getClassroomTagSupportLoadBreakdown(classroom).total
}

export function getBehavioralTagSupportLoad(classroom: Classroom): number {
  return getClassroomTagSupportLoadBreakdown(classroom).behavioral
}

export function getEmotionalTagSupportLoad(classroom: Classroom): number {
  return getClassroomTagSupportLoadBreakdown(classroom).emotional
}

export function getInstructionalTagSupportLoad(classroom: Classroom): number {
  return getClassroomTagSupportLoadBreakdown(classroom).instructional
}

export function getEnergyTagSupportLoad(classroom: Classroom): number {
  return getClassroomTagSupportLoadBreakdown(classroom).energy
}

export function getProjectedClassroomTagSupportLoadBreakdown(classroom: Classroom, student: Student): TagSupportLoadBreakdown {
  return getClassroomTagSupportLoadBreakdown({
    ...classroom,
    students: [...classroom.students, student],
  })
}

export function getGradeTagSupportLoadSummary(classrooms: Classroom[], grade: Grade): GradeTagSupportLoadSummary {
  const gradeRooms = classrooms.filter((classroom) => classroom.grade === grade)
  const averageByCategory: Record<TagSupportLoadCategory, number> = {
    behavioral: 0,
    emotional: 0,
    instructional: 0,
    energy: 0,
  }
  const highestByCategory: Record<TagSupportLoadCategory, number> = {
    behavioral: 0,
    emotional: 0,
    instructional: 0,
    energy: 0,
  }
  const lowestByCategory: Record<TagSupportLoadCategory, number> = {
    behavioral: 0,
    emotional: 0,
    instructional: 0,
    energy: 0,
  }
  const rangeByCategory: Record<TagSupportLoadCategory, number> = {
    behavioral: 0,
    emotional: 0,
    instructional: 0,
    energy: 0,
  }

  if (gradeRooms.length === 0) {
    return {
      averageTotal: 0,
      highestTotal: 0,
      lowestTotal: 0,
      rangeTotal: 0,
      averageByCategory,
      highestByCategory,
      lowestByCategory,
      rangeByCategory,
    }
  }

  const breakdowns = gradeRooms.map((classroom) => getClassroomTagSupportLoadBreakdown(classroom))
  const categories = Object.keys(TAG_SUPPORT_LOAD_CATEGORIES) as TagSupportLoadCategory[]

  for (const category of categories) {
    const values = breakdowns.map((breakdown) => breakdown[category])
    averageByCategory[category] = values.reduce((sum, value) => sum + value, 0) / values.length
    highestByCategory[category] = Math.max(...values)
    lowestByCategory[category] = Math.min(...values)
    rangeByCategory[category] = highestByCategory[category] - lowestByCategory[category]
  }

  const totals = breakdowns.map((breakdown) => breakdown.total)
  const highestTotal = Math.max(...totals)
  const lowestTotal = Math.min(...totals)

  return {
    averageTotal: totals.reduce((sum, value) => sum + value, 0) / totals.length,
    highestTotal,
    lowestTotal,
    rangeTotal: highestTotal - lowestTotal,
    averageByCategory,
    highestByCategory,
    lowestByCategory,
    rangeByCategory,
  }
}
