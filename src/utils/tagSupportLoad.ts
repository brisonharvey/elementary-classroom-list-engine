import { Classroom, Grade, Student, StudentTag, TeacherCharacteristicKey } from "../types"

export type TagSupportLoadCategory = "behavioral" | "emotional" | "instructional" | "energy"

export const TAG_SUPPORT_LOAD_CATEGORY_LABELS: Record<TagSupportLoadCategory, string> = {
  behavioral: "Behavioral",
  emotional: "Emotional",
  instructional: "Instructional",
  energy: "Energy",
}

export const LEGACY_STUDENT_TAG_ALIASES = {
  "Needs strong routine": "Needs structure",
  "Needs frequent redirection": "Needs redirection support",
  "Easily frustrated": "Needs emotional reassurance",
  "Needs reassurance": "Needs emotional reassurance",
  "Sensitive to correction": "Needs emotional reassurance",
  "Easily influenced by peers": "Needs peer support",
  "Needs positive peer models": "Needs peer support",
  "High energy": "Needs movement support",
  "Needs movement breaks": "Needs movement support",
  "Needs enrichment": "Needs academic enrichment",
  "Low academic confidence": "Needs emotional reassurance",
} as const satisfies Record<string, StudentTag>

const STUDENT_TAG_NORMALIZATION_LOOKUP = new Map<string, StudentTag>([
  ["needs structure", "Needs structure"],
  ["needs redirection support", "Needs redirection support"],
  ["needs emotional reassurance", "Needs emotional reassurance"],
  ["needs peer support", "Needs peer support"],
  ["needs movement support", "Needs movement support"],
  ["needs academic enrichment", "Needs academic enrichment"],
  ["independent worker", "Independent worker"],
  ...Object.entries(LEGACY_STUDENT_TAG_ALIASES).map(([legacy, normalized]) => [legacy.trim().toLowerCase(), normalized] as const),
])

export function normalizeStudentTag(raw: string): StudentTag | null {
  return STUDENT_TAG_NORMALIZATION_LOOKUP.get(raw.trim().toLowerCase()) ?? null
}

export function normalizeStudentTagList(values: unknown): StudentTag[] {
  if (!Array.isArray(values)) return []

  const normalized: StudentTag[] = []
  for (const entry of values) {
    if (typeof entry !== "string") continue
    const tag = normalizeStudentTag(entry)
    if (tag && !normalized.includes(tag)) normalized.push(tag)
  }
  return normalized
}

export const STUDENT_TAG_TEACHER_CHARACTERISTIC_REQUIREMENTS: Record<
  StudentTag,
  Partial<Record<TeacherCharacteristicKey, number>>
> = {
  "Needs structure": { classroomStructure: 1.2, behaviorManagementStrength: 0.8 },
  "Needs redirection support": { behaviorManagementStrength: 1.4, classroomStructure: 0.6 },
  "Needs emotional reassurance": { emotionalSupportNurturing: 1.1, confidenceBuilding: 0.9 },
  "Needs peer support": { peerSocialCoaching: 1.2, classroomStructure: 0.5 },
  "Needs movement support": { movementFlexibility: 1.2, behaviorManagementStrength: 0.8 },
  "Needs academic enrichment": { academicEnrichmentStrength: 1.5 },
  "Independent worker": { independenceScaffolding: 1.5 },
}

export const STUDENT_TAG_SUPPORT_WEIGHTS: Record<StudentTag, number> = {
  "Needs structure": 3,
  "Needs redirection support": 4,
  "Needs emotional reassurance": 4,
  "Needs peer support": 3,
  "Needs movement support": 3,
  "Needs academic enrichment": 1,
  "Independent worker": -1,
}

export const TAG_SUPPORT_LOAD_CATEGORIES: Record<TagSupportLoadCategory, StudentTag[]> = {
  behavioral: ["Needs redirection support", "Needs peer support"],
  emotional: ["Needs emotional reassurance"],
  instructional: ["Needs structure", "Needs academic enrichment", "Independent worker"],
  energy: ["Needs movement support"],
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
