import { CoTeachCategory, Grade, Student, StudentTag } from "../types"
import { MAX_COTEACH_MINUTES, normalizeCoTeachMinutes } from "./coTeach"
import { normalizeStudentTag } from "./tagSupportLoad"

export interface CsvFieldOption {
  key: string
  label: string
  required: boolean
}

export const STUDENT_CSV_FIELD_OPTIONS = [
  { key: "id", label: "Student ID", required: true },
  { key: "grade", label: "Grade", required: true },
  { key: "firstName", label: "First name", required: true },
  { key: "lastName", label: "Last name", required: true },
  { key: "gender", label: "Gender", required: false },
  { key: "status", label: "Special education status", required: false },
  { key: "coTeachReadingMinutes", label: "CoTeach Reading Minutes", required: false },
  { key: "coTeachWritingMinutes", label: "CoTeach Writing Minutes", required: false },
  { key: "coTeachScienceSocialStudiesMinutes", label: "CoTeach Science/Social Studies Minutes", required: false },
  { key: "coTeachMathMinutes", label: "CoTeach Math Minutes", required: false },
  { key: "coTeachBehaviorMinutes", label: "CoTeach Behavior Minutes", required: false },
  { key: "coTeachSocialMinutes", label: "CoTeach Social Minutes", required: false },
  { key: "coTeachVocationalMinutes", label: "CoTeach Vocational Minutes", required: false },
  { key: "requiresCoTeachReading", label: "(Legacy) Requires co-teach reading", required: false },
  { key: "requiresCoTeachMath", label: "(Legacy) Requires co-teach math", required: false },
  { key: "academicTier", label: "Academic tier", required: false },
  { key: "behaviorTier", label: "Behavior tier", required: false },
  { key: "noContactWith", label: "No-contact IDs", required: false },
  { key: "preferredWith", label: "Prefer with IDs", required: false },
  { key: "briganceReadiness", label: "Brigance readiness", required: false },
  { key: "mapReading", label: "MAP reading", required: false },
  { key: "mapMath", label: "MAP math", required: false },
  { key: "ireadyReading", label: "i-Ready reading", required: false },
  { key: "ireadyMath", label: "i-Ready math", required: false },
  { key: "referrals", label: "Referrals", required: false },
  { key: "ell", label: "ELL", required: false },
  { key: "section504", label: "504 plan", required: false },
  { key: "raceEthnicity", label: "Race/ethnicity", required: false },
  { key: "studentTags", label: "Student tags", required: false },
  { key: "teacherNotes", label: "Teacher notes", required: false },
] as const satisfies readonly CsvFieldOption[]

export type StudentCsvFieldKey = (typeof STUDENT_CSV_FIELD_OPTIONS)[number]["key"]
export type StudentCsvFieldMapping = Partial<Record<StudentCsvFieldKey, string>>

const FIELD_ALIASES: Record<StudentCsvFieldKey, string[]> = {
  id: ["id", "studentid", "student.studentnumber", "studentnumber", "sisid", "localid", "student.personid", "personid"],
  grade: ["grade", "gradelevel", "studentgrade", "grd"],
  firstName: ["student.firstname", "firstname", "first", "givenname", "studentfirstname"],
  lastName: ["student.lastname", "lastname", "last", "surname", "familyname", "studentlastname"],
  gender: ["gender", "sex", "f/m"],
  status: ["status", "spedstatus", "specialedstatus", "specialeducationstatus", "sped", "specialeducation"],
  coTeachReadingMinutes: ["coteachreadingminutes", "serviceminutesreading", "readingcoteachminutes"],
  coTeachWritingMinutes: ["coteachwritingminutes", "writingcoteachminutes"],
  coTeachScienceSocialStudiesMinutes: ["coteachscience/socialstudiesminutes", "coteachsciencesocialstudiesminutes", "sciencesocialstudiescoteachminutes"],
  coTeachMathMinutes: ["coteachmathminutes", "serviceminutesmath", "mathcoteachminutes"],
  coTeachBehaviorMinutes: ["coteachbehaviorminutes", "behaviorcoteachminutes"],
  coTeachSocialMinutes: ["coteachsocialminutes", "socialcoteachminutes"],
  coTeachVocationalMinutes: ["coteachvocationalminutes", "vocationalcoteachminutes"],
  requiresCoTeachReading: ["requirescoteachreading", "coteachreading", "readingcoteach"],
  requiresCoTeachMath: ["requirescoteachmath", "coteachmath", "mathcoteach"],
  academicTier: ["academictier", "academicsupporttier", "tiersupport", "activeintervention|acad"],
  behaviorTier: ["behaviortier", "behaviourtier", "behaviorsupporttier", "activeintervention|seb"],
  noContactWith: ["nocontactwith", "separatefrom", "donotpairwith"],
  preferredWith: ["preferredwith", "preferwith", "sameclasswith", "sameroomwith", "keepwith", "withstudents"],
  briganceReadiness: ["brigance", "brigancereadiness", "brigancekindergartenreadiness", "brigancereadinessscore"],
  mapReading: ["mapreading", "readingmap", "mapreadingscore", "mapwinterreading|rit", "mapfallreading|rit"],
  mapMath: ["mapmath", "mathmap", "mapmathscore", "mapwintermath|rit", "mapfallmath|rit"],
  ireadyReading: ["ireadyreading", "ireadingreading", "ireadyreadinglevel", "winter(november16-march1)|overallplacement"],
  ireadyMath: ["ireadymath", "ireadymathlevel", "winter(november16-march1)|overallplacement(diagnostic_results_math_confidential(1).csv)"],
  referrals: ["referrals", "referralcount", "disciplinereferrals", "disc.referrals"],
  ell: ["ell", "el", "englishlearner", "esl", "englishlanguagelearner"],
  section504: ["section504", "plan504", "program504", "504"],
  raceEthnicity: ["raceethnicity", "race/ethnicity", "ethnicity", "race", "studentrace", "studentethnicity"],
  studentTags: ["studenttags", "tags", "placementtags", "supporttags"],
  teacherNotes: ["teachernotes", "notes", "comments", "placementnotes"],
}

function parseBool(val: string): boolean {
  const v = val.trim().toLowerCase()
  return v === "true" || v === "1" || v === "yes" || v === "y"
}

function parseELL(val: string): boolean {
  const v = val.trim().toLowerCase()
  return v === "el" || v === "ell" || v === "true" || v === "1" || v === "yes" || v === "y"
}

function parseTier(val: string): 1 | 2 | 3 {
  const v = val.trim()
  if (v.toLowerCase() === "yes" || v.toLowerCase() === "y") return 2
  const n = parseInt(v, 10)
  if (n === 2) return 2
  if (n === 3) return 3
  return 1
}

function parseStrictPositiveInt(val: string): number | undefined {
  const token = val.trim()
  if (!/^\d+$/.test(token)) return undefined

  const parsed = Number(token)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return undefined
  return parsed
}

interface ParsedIdList {
  ids: number[]
  invalidTokens: string[]
}

function parseIdList(val: string): ParsedIdList {
  if (!val || !val.trim()) return { ids: [], invalidTokens: [] }

  const ids: number[] = []
  const invalidTokens: string[] = []

  for (const rawToken of val.split(/[;,|]/)) {
    const token = rawToken.trim()
    if (!token) continue

    const parsed = parseStrictPositiveInt(token)
    if (parsed === undefined) {
      invalidTokens.push(token)
      continue
    }

    ids.push(parsed)
  }

  return { ids, invalidTokens }
}

function parseStatus(val: string): "None" | "IEP" | "Referral" {
  const v = val.trim()
  if (v === "IEP") return "IEP"
  if (v === "Referral") return "Referral"
  if (v.toLowerCase() === "y" || v.toLowerCase() === "yes") return "IEP"
  return "None"
}

function parseGrade(val: string): Grade {
  const v = val.trim()
  if (v === "K" || v === "1" || v === "2" || v === "3" || v === "4" || v === "5") return v
  if (/^\d{2}$/.test(v)) {
    const n = parseInt(v, 10)
    if (n === 0) return "K"
    if (n >= 1 && n <= 5) return String(n) as Grade
  }
  if (v === "0") return "K"
  const upper = v.toUpperCase()
  if (upper === "KG" || upper.startsWith("KIND")) return "K"
  const ord = v.match(/^0?([1-5])(?:st|nd|rd|th)/i)
  if (ord) return ord[1] as Grade
  return "K"
}

function parseOptionalFloat(val: string): number | undefined {
  if (!val || !val.trim()) return undefined
  const n = parseFloat(val.trim())
  return Number.isNaN(n) ? undefined : n
}

function parseOptionalInt(val: string): number | undefined {
  if (!val || !val.trim()) return undefined
  const n = parseInt(val.trim(), 10)
  return Number.isNaN(n) ? undefined : n
}

function parseOptionalString(val: string): string | undefined {
  const v = val.trim()
  return v || undefined
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

export interface ParseResult {
  students: Student[]
  errors: string[]
  skipped: number
}

export interface CSVPreview {
  headers: string[]
  rows: string[][]
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "")
}

export function parseCSVPreview(text: string): CSVPreview {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) {
    return { headers: [], rows: [] }
  }

  const headers = parseCSVLine(lines[0]).map((h) => h.trim())
  const rows = lines.slice(1).map(parseCSVLine)
  return { headers, rows }
}

export function buildSampleValues(headers: string[], rows: string[][]): Record<string, string> {
  const samples: Record<string, string> = {}
  headers.forEach((header, idx) => {
    for (const row of rows) {
      const val = (row[idx] ?? "").trim()
      if (val) {
        samples[header] = val.length > 24 ? `${val.slice(0, 21)}...` : val
        break
      }
    }
  })
  return samples
}

export function suggestStudentFieldMapping(headers: string[]): StudentCsvFieldMapping {
  const normalized = headers.map(normalizeHeader)
  const mapping: StudentCsvFieldMapping = {}

  for (const field of STUDENT_CSV_FIELD_OPTIONS) {
    const aliases = FIELD_ALIASES[field.key]
    const index = normalized.findIndex((header) => aliases.includes(header))
    if (index >= 0) mapping[field.key] = headers[index]
  }

  return mapping
}

function parseCoTeachMinutes(raw: string, rowIndex: number, label: string, errors: string[]): number {
  if (!raw || !raw.trim()) return 0
  const parsed = Number(raw.trim())
  if (!Number.isFinite(parsed)) {
    errors.push(`Row ${rowIndex + 2}: ${label} value "${raw}" is not numeric; defaulted to 0.`)
    return 0
  }
  if (parsed < 0) return 0
  if (parsed > MAX_COTEACH_MINUTES) {
    errors.push(`Row ${rowIndex + 2}: ${label} exceeded ${MAX_COTEACH_MINUTES}; clamped.`)
    return MAX_COTEACH_MINUTES
  }
  return parsed
}

function buildCoTeachMinutes(values: string[], rowIndex: number, get: (values: string[], field: StudentCsvFieldKey) => string, errors: string[]) {
  const coTeachMinutes: Partial<Record<CoTeachCategory, number>> = {
    reading: parseCoTeachMinutes(get(values, "coTeachReadingMinutes"), rowIndex, "CoTeach Reading Minutes", errors),
    writing: parseCoTeachMinutes(get(values, "coTeachWritingMinutes"), rowIndex, "CoTeach Writing Minutes", errors),
    scienceSocialStudies: parseCoTeachMinutes(
      get(values, "coTeachScienceSocialStudiesMinutes"),
      rowIndex,
      "CoTeach Science/Social Studies Minutes",
      errors
    ),
    math: parseCoTeachMinutes(get(values, "coTeachMathMinutes"), rowIndex, "CoTeach Math Minutes", errors),
    behavior: parseCoTeachMinutes(get(values, "coTeachBehaviorMinutes"), rowIndex, "CoTeach Behavior Minutes", errors),
    social: parseCoTeachMinutes(get(values, "coTeachSocialMinutes"), rowIndex, "CoTeach Social Minutes", errors),
    vocational: parseCoTeachMinutes(get(values, "coTeachVocationalMinutes"), rowIndex, "CoTeach Vocational Minutes", errors),
  }

  if ((coTeachMinutes.reading ?? 0) === 0 && parseBool(get(values, "requiresCoTeachReading"))) {
    coTeachMinutes.reading = 30
    errors.push(`Row ${rowIndex + 2}: legacy requiresCoTeachReading converted to 30 reading minutes.`)
  }

  if ((coTeachMinutes.math ?? 0) === 0 && parseBool(get(values, "requiresCoTeachMath"))) {
    coTeachMinutes.math = 30
    errors.push(`Row ${rowIndex + 2}: legacy requiresCoTeachMath converted to 30 math minutes.`)
  }

  return normalizeCoTeachMinutes(coTeachMinutes)
}

function parseStudentTags(raw: string): { tags: StudentTag[]; invalidTokens: string[] } {
  if (!raw || !raw.trim()) return { tags: [], invalidTokens: [] }

  const tags: StudentTag[] = []
  const invalidTokens: string[] = []
  for (const rawToken of raw.split(/[;,|]/)) {
    const token = rawToken.trim()
    if (!token) continue
    const matched = normalizeStudentTag(token)
    if (!matched) {
      invalidTokens.push(token)
      continue
    }
    if (!tags.includes(matched)) tags.push(matched)
  }

  return { tags, invalidTokens }
}

export function parseStudentCSVWithMapping(text: string, mapping: StudentCsvFieldMapping): ParseResult {
  const { headers, rows } = parseCSVPreview(text)
  if (headers.length === 0 || rows.length === 0) {
    return { students: [], errors: ["CSV must have a header row and at least one data row."], skipped: 0 }
  }

  const headerLookup = new Map(headers.map((header, index) => [normalizeHeader(header), index]))
  const errors: string[] = []
  const students: Student[] = []
  const seenIds = new Set<number>()
  let skipped = 0

  const get = (values: string[], field: StudentCsvFieldKey): string => {
    const mapped = mapping[field]
    if (!mapped) return ""
    const idx = headerLookup.get(normalizeHeader(mapped))
    return idx === undefined ? "" : (values[idx] ?? "").trim()
  }

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const values = rows[rowIndex]
    const idStr = get(values, "id")
    const id = parseStrictPositiveInt(idStr)

    if (id === undefined) {
      errors.push(`Row ${rowIndex + 2}: Invalid or missing ID "${idStr}" - skipped.`)
      skipped++
      continue
    }
    if (seenIds.has(id)) {
      errors.push(`Row ${rowIndex + 2}: Duplicate ID "${id}" - skipped. IDs must be unique.`)
      skipped++
      continue
    }
    seenIds.add(id)

    const noContactRaw = get(values, "noContactWith")
    const preferredWithRaw = get(values, "preferredWith")
    const parsedNoContact = parseIdList(noContactRaw)
    const parsedPreferredWith = parseIdList(preferredWithRaw)
    const parsedTags = parseStudentTags(get(values, "studentTags"))

    if (parsedNoContact.invalidTokens.length > 0) {
      errors.push(
        `Row ${rowIndex + 2}: Invalid noContactWith token(s): ${parsedNoContact.invalidTokens.join(", ")} - expected positive whole-number IDs.`
      )
    }

    if (parsedPreferredWith.invalidTokens.length > 0) {
      errors.push(
        `Row ${rowIndex + 2}: Invalid preferredWith token(s): ${parsedPreferredWith.invalidTokens.join(", ")} - expected positive whole-number IDs.`
      )
    }

    if (parsedTags.invalidTokens.length > 0) {
      errors.push(
        `Row ${rowIndex + 2}: Unknown student tag(s): ${parsedTags.invalidTokens.join(", ")} - ignored.`
      )
    }

    students.push({
      id,
      grade: parseGrade(get(values, "grade")),
      firstName: get(values, "firstName") || "Student",
      lastName: get(values, "lastName") || `${id}`,
      gender: get(values, "gender").toUpperCase() === "F" ? "F" : "M",
      specialEd: {
        status: parseStatus(get(values, "status")),
      },
      coTeachMinutes: buildCoTeachMinutes(values, rowIndex, get, errors),
      intervention: {
        academicTier: parseTier(get(values, "academicTier")),
      },
      behaviorTier: parseTier(get(values, "behaviorTier")),
      referrals: parseOptionalInt(get(values, "referrals")) ?? 0,
      briganceReadiness: parseOptionalFloat(get(values, "briganceReadiness")),
      mapReading: parseOptionalFloat(get(values, "mapReading")),
      mapMath: parseOptionalFloat(get(values, "mapMath")),
      ireadyReading: parseOptionalString(get(values, "ireadyReading")),
      ireadyMath: parseOptionalString(get(values, "ireadyMath")),
      tags: parsedTags.tags,
      noContactWith: parsedNoContact.ids,
      preferredWith: parsedPreferredWith.ids,
      ell: parseELL(get(values, "ell")),
      section504: parseBool(get(values, "section504")),
      raceEthnicity: parseOptionalString(get(values, "raceEthnicity")),
      teacherNotes: parseOptionalString(get(values, "teacherNotes")),
      locked: false,
    })
  }

  const studentsById = new Map(students.map((student) => [student.id, student]))
  const idSet = new Set(studentsById.keys())

  for (const student of students) {
    student.coTeachMinutes = normalizeCoTeachMinutes(student.coTeachMinutes)
    const invalidNoContact = (student.noContactWith ?? []).filter((entry) => !idSet.has(entry))
    if (invalidNoContact.length > 0) {
      errors.push(
        `Student ${student.id} (${student.firstName} ${student.lastName}): noContactWith references unknown IDs: ${invalidNoContact.join(", ")}`
      )
    }

    student.noContactWith = (student.noContactWith ?? []).filter((entry) => entry !== student.id)

    const invalidPreferred = (student.preferredWith ?? []).filter((peerId) => !idSet.has(peerId))
    if (invalidPreferred.length > 0) {
      errors.push(
        `Student ${student.id} (${student.firstName} ${student.lastName}): preferredWith references unknown IDs: ${invalidPreferred.join(", ")}`
      )
    }

    const crossGradePreferred = (student.preferredWith ?? []).filter((peerId) => {
      const peer = studentsById.get(peerId)
      return peer != null && peer.grade !== student.grade
    })
    if (crossGradePreferred.length > 0) {
      errors.push(
        `Student ${student.id} (${student.firstName} ${student.lastName}): preferredWith references students in different grades (${crossGradePreferred.join(", ")}); these were ignored.`
      )
    }

    student.preferredWith = (student.preferredWith ?? [])
      .filter((peerId) => peerId !== student.id && idSet.has(peerId))
      .filter((peerId) => studentsById.get(peerId)?.grade === student.grade)
      .filter((peerId, idx, list) => list.indexOf(peerId) === idx)
  }

  return { students, errors, skipped }
}

export function parseStudentCSV(text: string): ParseResult {
  const preview = parseCSVPreview(text)
  const mapping = suggestStudentFieldMapping(preview.headers)
  return parseStudentCSVWithMapping(text, mapping)
}

const STUDENT_TEMPLATE_HEADER = [
  "id",
  "grade",
  "firstName",
  "lastName",
  "gender",
  "status",
  "coTeachReadingMinutes",
  "coTeachWritingMinutes",
  "coTeachScienceSocialStudiesMinutes",
  "coTeachMathMinutes",
  "coTeachBehaviorMinutes",
  "coTeachSocialMinutes",
  "coTeachVocationalMinutes",
  "academicTier",
  "behaviorTier",
  "noContactWith",
  "preferredWith",
  "briganceReadiness",
  "mapReading",
  "mapMath",
  "ireadyReading",
  "ireadyMath",
  "referrals",
  "ell",
  "section504",
  "raceEthnicity",
  "studentTags",
  "teacherNotes",
]

export function generateStudentTemplateCSV(): string {
  return STUDENT_TEMPLATE_HEADER.join(",")
}

export function generateStudentSampleCSV(): string {
  const grades: Grade[] = ["K", "1", "2", "3", "4", "5"]
  const firstNames = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Avery", "Parker"]
  const lastNames = ["Anderson", "Brooks", "Carter", "Diaz", "Ellis", "Foster", "Garcia", "Hayes"]
  const races = ["White", "Black", "Hispanic/Latino", "Asian", "Multiracial"]
  const tagSets = [
    "Needs structure;Needs emotional reassurance",
    "Needs redirection support;Needs movement support",
    "Needs academic enrichment;Independent worker",
    "Needs emotional reassurance",
    "Needs movement support",
    "Needs peer support",
    "Needs emotional reassurance",
    "Independent worker",
  ]

  const rows: string[] = []
  let id = 1001

  for (const grade of grades) {
    for (let i = 0; i < 8; i++) {
      const isSped = i < 2
      const status = isSped ? (i % 2 === 0 ? "IEP" : "Referral") : "None"
      const gender = i % 2 === 0 ? "F" : "M"
      const academicTier = isSped ? 3 : i % 4 === 0 ? 2 : 1
      const behaviorTier = i % 3 === 0 ? 2 : 1
      const referrals = i % 5 === 0 ? 1 : 0
      const readingMinutes = isSped ? 30 : 0
      const mathMinutes = isSped ? 30 : 0
      const behaviorMinutes = i === 1 ? 20 : 0
      const socialMinutes = i === 5 ? 15 : 0
      const noContact = i === 0 ? `${id + 1}` : ""
      const preferredWith = i === 2 ? `${id + 1}` : ""
      const brigance = grade === "K" ? 48 + i * 5 : ""
      const mapReading = grade === "K" ? "" : 155 + i * 3 + grades.indexOf(grade) * 2
      const mapMath = grade === "K" ? "" : 158 + i * 3 + grades.indexOf(grade) * 2
      const ireadyReading = grade === "K" ? "" : ["Late K", "Early 1", "Mid 1", "Late 1", "Early 2", "Mid 2", "Late 2", "Early 3"][i]
      const ireadyMath = grade === "K" ? "" : ["Mid K", "Late K", "Early 1", "Mid 1", "Late 1", "Early 2", "Mid 2", "Late 2"][i]
      const ell = i % 4 === 0 ? "TRUE" : "FALSE"
      const section504 = i === 3 ? "TRUE" : "FALSE"
      const race = races[(i + grades.indexOf(grade)) % races.length]
      const note = isSped ? "Requires co-teach support" : i === 4 ? "Monitor confidence in whole group" : ""

      rows.push([
        id,
        grade,
        firstNames[i],
        `${lastNames[(i + grades.indexOf(grade)) % lastNames.length]}${grades.indexOf(grade) + 1}`,
        gender,
        status,
        readingMinutes,
        0,
        0,
        mathMinutes,
        behaviorMinutes,
        socialMinutes,
        0,
        academicTier,
        behaviorTier,
        noContact,
        preferredWith,
        brigance,
        mapReading,
        mapMath,
        ireadyReading,
        ireadyMath,
        referrals,
        ell,
        section504,
        race,
        tagSets[i],
        note,
      ].join(","))

      id += 1
    }
  }

  return [generateStudentTemplateCSV(), ...rows].join("\n")
}


