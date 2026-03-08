import { Grade, TEACHER_CHARACTERISTIC_KEYS, TeacherProfile } from "../types"
import { CsvFieldOption, CSVPreview, parseCSVPreview } from "./csvParser"

export const TEACHER_CSV_FIELD_OPTIONS = [
  { key: "grade", label: "Grade", required: true },
  { key: "teacherName", label: "Teacher name", required: true },
  { key: "classroomStructure", label: "Classroom structure", required: true },
  { key: "behaviorManagementStrength", label: "Behavior management strength", required: true },
  { key: "emotionalSupportNurturing", label: "Emotional support/nurturing", required: true },
  { key: "academicEnrichmentStrength", label: "Academic enrichment strength", required: true },
  { key: "independenceScaffolding", label: "Independence scaffolding", required: true },
  { key: "movementFlexibility", label: "Movement flexibility", required: true },
  { key: "peerSocialCoaching", label: "Peer social coaching", required: true },
  { key: "confidenceBuilding", label: "Confidence building", required: true },
] as const satisfies readonly CsvFieldOption[]

export type TeacherCsvFieldKey = (typeof TEACHER_CSV_FIELD_OPTIONS)[number]["key"]
export type TeacherCsvFieldMapping = Partial<Record<TeacherCsvFieldKey, string>>

const FIELD_ALIASES: Record<TeacherCsvFieldKey, string[]> = {
  grade: ["grade", "gradelevel", "teachergrade"],
  teacherName: ["teacher", "teachername", "name", "homeroomteacher"],
  classroomStructure: ["classroomstructure", "routine", "structure"],
  behaviorManagementStrength: ["behaviormanagementstrength", "behaviorstrength", "classroommanagement"],
  emotionalSupportNurturing: ["emotionalsupportnurturing", "emotionalsupport", "nurturing"],
  academicEnrichmentStrength: ["academicenrichmentstrength", "academicenrichment", "enrichment"],
  independenceScaffolding: ["independencescaffolding", "independence", "scaffolding"],
  movementFlexibility: ["movementflexibility", "movement", "movementbreaks"],
  peerSocialCoaching: ["peersocialcoaching", "peercoaching", "socialcoaching"],
  confidenceBuilding: ["confidencebuilding", "confidence", "academicconfidence"],
}

export interface TeacherParseResult {
  teachers: TeacherProfile[]
  errors: string[]
  skipped: number
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "")
}

function parseGrade(val: string): Grade {
  const v = val.trim()
  if (v === "K" || v === "1" || v === "2" || v === "3" || v === "4" || v === "5") return v
  if (v === "0" || v.toUpperCase() === "KG" || v.toUpperCase().startsWith("KIND")) return "K"
  const parsed = parseInt(v, 10)
  if (parsed >= 1 && parsed <= 5) return String(parsed) as Grade
  return "K"
}

function parseRating(raw: string, rowIndex: number, label: string, errors: string[]): 1 | 2 | 3 | 4 | 5 {
  const token = raw.trim()
  if (!token) {
    errors.push(`Row ${rowIndex + 2}: ${label} missing; defaulted to 3.`)
    return 3
  }

  const parsed = parseInt(token, 10)
  if (!Number.isFinite(parsed)) {
    errors.push(`Row ${rowIndex + 2}: ${label} value "${raw}" is not numeric; defaulted to 3.`)
    return 3
  }

  if (parsed < 1 || parsed > 5) {
    const clamped = Math.max(1, Math.min(5, parsed)) as 1 | 2 | 3 | 4 | 5
    errors.push(`Row ${rowIndex + 2}: ${label} must be between 1 and 5; clamped to ${clamped}.`)
    return clamped
  }

  return parsed as 1 | 2 | 3 | 4 | 5
}

export function suggestTeacherFieldMapping(headers: string[]): TeacherCsvFieldMapping {
  const normalized = headers.map(normalizeHeader)
  const mapping: TeacherCsvFieldMapping = {}

  for (const field of TEACHER_CSV_FIELD_OPTIONS) {
    const aliases = FIELD_ALIASES[field.key]
    const index = normalized.findIndex((header) => aliases.includes(header))
    if (index >= 0) mapping[field.key] = headers[index]
  }

  return mapping
}

export function parseTeacherCSVWithMapping(text: string, mapping: TeacherCsvFieldMapping): TeacherParseResult {
  const { headers, rows }: CSVPreview = parseCSVPreview(text)
  if (headers.length === 0 || rows.length === 0) {
    return { teachers: [], errors: ["CSV must have a header row and at least one data row."], skipped: 0 }
  }

  const headerLookup = new Map(headers.map((header, index) => [normalizeHeader(header), index]))
  const errors: string[] = []
  const teachers: TeacherProfile[] = []
  const seenTeacherIds = new Set<string>()
  let skipped = 0

  const get = (values: string[], field: TeacherCsvFieldKey): string => {
    const mapped = mapping[field]
    if (!mapped) return ""
    const idx = headerLookup.get(normalizeHeader(mapped))
    return idx === undefined ? "" : (values[idx] ?? "").trim()
  }

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const values = rows[rowIndex]
    const teacherName = get(values, "teacherName")
    if (!teacherName) {
      errors.push(`Row ${rowIndex + 2}: Missing teacher name - skipped.`)
      skipped++
      continue
    }

    const grade = parseGrade(get(values, "grade"))
    const id = `${grade}:${teacherName.trim().toLowerCase()}`
    if (seenTeacherIds.has(id)) {
      errors.push(`Row ${rowIndex + 2}: Duplicate teacher "${teacherName}" in grade ${grade} - skipped.`)
      skipped++
      continue
    }
    seenTeacherIds.add(id)

    teachers.push({
      id,
      grade,
      teacherName,
      characteristics: {
        classroomStructure: parseRating(get(values, "classroomStructure"), rowIndex, "Classroom structure", errors),
        behaviorManagementStrength: parseRating(get(values, "behaviorManagementStrength"), rowIndex, "Behavior management strength", errors),
        emotionalSupportNurturing: parseRating(get(values, "emotionalSupportNurturing"), rowIndex, "Emotional support/nurturing", errors),
        academicEnrichmentStrength: parseRating(get(values, "academicEnrichmentStrength"), rowIndex, "Academic enrichment strength", errors),
        independenceScaffolding: parseRating(get(values, "independenceScaffolding"), rowIndex, "Independence scaffolding", errors),
        movementFlexibility: parseRating(get(values, "movementFlexibility"), rowIndex, "Movement flexibility", errors),
        peerSocialCoaching: parseRating(get(values, "peerSocialCoaching"), rowIndex, "Peer social coaching", errors),
        confidenceBuilding: parseRating(get(values, "confidenceBuilding"), rowIndex, "Confidence building", errors),
      },
    })
  }

  return { teachers, errors, skipped }
}

const TEACHER_TEMPLATE_HEADER = [
  "grade",
  "teacherName",
  ...TEACHER_CHARACTERISTIC_KEYS,
]

export function generateTeacherTemplateCSV(): string {
  return TEACHER_TEMPLATE_HEADER.join(",")
}

export function generateTeacherSampleCSV(): string {
  const rows: string[] = []
  const grades: Grade[] = ["K", "1", "2", "3", "4", "5"]
  const suffixes = ["A", "B", "C", "D"]

  for (const grade of grades) {
    suffixes.forEach((suffix, index) => {
      rows.push([
        grade,
        `Ms. Grade${grade}${suffix}`,
        5 - (index % 2),
        4 + (index % 2),
        5 - (index === 3 ? 1 : 0),
        3 + (index % 3),
        3 + ((index + 1) % 3),
        2 + index,
        4 - (index % 2),
        4 + ((index + 2) % 2),
      ].join(","))
    })
  }

  return [generateTeacherTemplateCSV(), ...rows].join("\n")
}
