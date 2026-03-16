import { Grade, TEACHER_CHARACTERISTIC_KEYS, TeacherProfile } from "../../types"
import { CsvFieldOption, CsvValidationIssue } from "../../types/csvImport"
import { normalizeHeader, parseCSVPreview, suggestFieldMapping } from "./core"

export const TEACHER_CSV_FIELD_OPTIONS = [
  { key: "grade", label: "Grade", required: true },
  { key: "teacherName", label: "Teacher name", required: true },
  { key: "structure", label: "Structure", required: true },
  { key: "regulationBehaviorSupport", label: "Regulation/Behavior Support", required: true },
  { key: "socialEmotionalSupport", label: "Social/Emotional Support", required: true },
  { key: "instructionalExpertise", label: "Instructional Expertise", required: true },
] as const satisfies readonly CsvFieldOption[]

export type TeacherCsvFieldKey = (typeof TEACHER_CSV_FIELD_OPTIONS)[number]["key"]
export type TeacherCsvFieldMapping = Partial<Record<TeacherCsvFieldKey, string>>

export interface TeacherParseResult {
  teachers: TeacherProfile[]
  issues: CsvValidationIssue[]
  errors: string[]
  skipped: number
}

const FIELD_ALIASES: Record<TeacherCsvFieldKey, string[]> = {
  grade: ["grade", "gradelevel", "teachergrade"],
  teacherName: ["teacher", "teachername", "name", "homeroomteacher"],
  structure: ["structure", "classroomstructure", "routine"],
  regulationBehaviorSupport: [
    "regulation/behaviorsupport",
    "regulationbehaviorsupport",
    "behaviorsupport",
    "regulationsupport",
    "behaviormanagementstrength",
    "behaviorstrength",
    "classroommanagement",
    "movementflexibility",
  ],
  socialEmotionalSupport: [
    "social/emotionalsupport",
    "socialemotionalsupport",
    "socialemotionalsupport",
    "emotionalsupportnurturing",
    "emotionalsupport",
    "nurturing",
    "peersocialcoaching",
    "peercoaching",
    "socialcoaching",
    "confidencebuilding",
    "confidence",
  ],
  instructionalExpertise: [
    "instructionalexpertise",
    "academicenrichmentstrength",
    "academicenrichment",
    "enrichment",
    "independencescaffolding",
    "independence",
    "scaffolding",
  ],
}

function toResult(teachers: TeacherProfile[], issues: CsvValidationIssue[], skipped: number): TeacherParseResult {
  return {
    teachers,
    issues,
    errors: issues.map((issue) => issue.message),
    skipped,
  }
}

function pushIssue(issues: CsvValidationIssue[], severity: CsvValidationIssue["severity"], message: string) {
  issues.push({ severity, message })
}

function parseGrade(value: string): Grade {
  const normalized = value.trim()
  if (normalized === "K" || normalized === "1" || normalized === "2" || normalized === "3" || normalized === "4" || normalized === "5") return normalized
  if (normalized === "0" || normalized.toUpperCase() === "KG" || normalized.toUpperCase().startsWith("KIND")) return "K"
  const parsed = parseInt(normalized, 10)
  if (parsed >= 1 && parsed <= 5) return String(parsed) as Grade
  return "K"
}

function parseRating(raw: string, rowIndex: number, label: string, issues: CsvValidationIssue[]): 1 | 2 | 3 | 4 | 5 {
  const token = raw.trim()
  if (!token) {
    pushIssue(issues, "warning", `Row ${rowIndex + 2}: ${label} missing; defaulted to 3.`)
    return 3
  }

  const parsed = parseInt(token, 10)
  if (!Number.isFinite(parsed)) {
    pushIssue(issues, "warning", `Row ${rowIndex + 2}: ${label} value "${raw}" is not numeric; defaulted to 3.`)
    return 3
  }

  if (parsed < 1 || parsed > 5) {
    const clamped = Math.max(1, Math.min(5, parsed)) as 1 | 2 | 3 | 4 | 5
    pushIssue(issues, "warning", `Row ${rowIndex + 2}: ${label} must be between 1 and 5; clamped to ${clamped}.`)
    return clamped
  }

  return parsed as 1 | 2 | 3 | 4 | 5
}

export function suggestTeacherFieldMapping(headers: string[]): TeacherCsvFieldMapping {
  return suggestFieldMapping(headers, TEACHER_CSV_FIELD_OPTIONS, FIELD_ALIASES)
}

export function parseTeacherCSVWithMapping(text: string, mapping: TeacherCsvFieldMapping): TeacherParseResult {
  const { headers, rows } = parseCSVPreview(text)
  if (headers.length === 0 || rows.length === 0) {
    return toResult([], [{ severity: "error", message: "CSV must have a header row and at least one data row." }], 0)
  }

  const headerLookup = new Map(headers.map((header, index) => [normalizeHeader(header), index]))
  const issues: CsvValidationIssue[] = []
  const teachers: TeacherProfile[] = []
  const seenTeacherIds = new Set<string>()
  let skipped = 0

  const get = (values: string[], field: TeacherCsvFieldKey): string => {
    const mapped = mapping[field]
    if (!mapped) return ""
    const index = headerLookup.get(normalizeHeader(mapped))
    return index === undefined ? "" : (values[index] ?? "").trim()
  }

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const values = rows[rowIndex]
    const teacherName = get(values, "teacherName")
    if (!teacherName) {
      pushIssue(issues, "error", `Row ${rowIndex + 2}: Missing teacher name - skipped.`)
      skipped++
      continue
    }

    const grade = parseGrade(get(values, "grade"))
    const id = `${grade}:${teacherName.trim().toLowerCase()}`
    if (seenTeacherIds.has(id)) {
      pushIssue(issues, "error", `Row ${rowIndex + 2}: Duplicate teacher "${teacherName}" in grade ${grade} - skipped.`)
      skipped++
      continue
    }
    seenTeacherIds.add(id)

    teachers.push({
      id,
      grade,
      teacherName,
      characteristics: {
        structure: parseRating(get(values, "structure"), rowIndex, "Structure", issues),
        regulationBehaviorSupport: parseRating(get(values, "regulationBehaviorSupport"), rowIndex, "Regulation/Behavior Support", issues),
        socialEmotionalSupport: parseRating(get(values, "socialEmotionalSupport"), rowIndex, "Social/Emotional Support", issues),
        instructionalExpertise: parseRating(get(values, "instructionalExpertise"), rowIndex, "Instructional Expertise", issues),
      },
    })
  }

  return toResult(teachers, issues, skipped)
}

const TEACHER_TEMPLATE_HEADER = ["grade", "teacherName", ...TEACHER_CHARACTERISTIC_KEYS]

export function generateTeacherTemplateCSV(): string {
  return TEACHER_TEMPLATE_HEADER.join(",")
}

export function generateTeacherSampleCSV(): string {
  const rows: string[] = []
  const grades: Grade[] = ["K", "1", "2", "3", "4", "5"]
  const suffixes = ["A", "B", "C", "D"]

  for (const grade of grades) {
    suffixes.forEach((suffix, index) => {
      rows.push([grade, `Ms. Grade${grade}${suffix}`, 5 - (index % 2), 4 + (index % 2), 5 - (index === 3 ? 1 : 0), 3 + (index % 3)].join(","))
    })
  }

  return [generateTeacherTemplateCSV(), ...rows].join("\n")
}
