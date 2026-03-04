import { CoTeachCategory, Student } from "../types"

export const CO_TEACH_CATEGORIES: CoTeachCategory[] = [
  "reading",
  "writing",
  "scienceSocialStudies",
  "math",
  "behavior",
  "social",
  "vocational",
]

export const CO_TEACH_LABELS: Record<CoTeachCategory, string> = {
  reading: "Reading",
  writing: "Writing",
  scienceSocialStudies: "Science/Social Studies",
  math: "Math",
  behavior: "Behavior",
  social: "Social",
  vocational: "Vocational",
}

export const MAX_COTEACH_MINUTES = 999

export function normalizeCoTeachMinutes(
  input: Partial<Record<CoTeachCategory, number>> | undefined
): Partial<Record<CoTeachCategory, number>> {
  const normalized: Partial<Record<CoTeachCategory, number>> = {}
  for (const category of CO_TEACH_CATEGORIES) {
    const raw = input?.[category] ?? 0
    if (!Number.isFinite(raw) || raw <= 0) continue
    normalized[category] = Math.min(MAX_COTEACH_MINUTES, Math.max(0, raw))
  }
  return normalized
}

export function getStudentCoTeachTotal(student: Student): number {
  return CO_TEACH_CATEGORIES.reduce((sum, category) => sum + (student.coTeachMinutes[category] ?? 0), 0)
}

export function getStudentRequiredCoTeachCategories(student: Student): CoTeachCategory[] {
  return CO_TEACH_CATEGORIES.filter((category) => (student.coTeachMinutes[category] ?? 0) > 0)
}
