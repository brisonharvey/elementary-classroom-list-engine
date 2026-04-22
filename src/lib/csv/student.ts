import { CoTeachCategory, Grade, LEGACY_STUDENT_TAG_ALIASES, RelationshipRule, STUDENT_TAGS, Student, StudentTag } from "../../types"
import { CsvFieldOption, CsvValidationIssue } from "../../types/csvImport"
import { MAX_COTEACH_MINUTES, normalizeCoTeachMinutes } from "../../utils/coTeach"
import type { StudentIdentityColumns, StudentMatchType } from "./blend"
import { normalizeHeader, parseCSVPreview, scoreHeaderAliasMatch, suggestBestHeader, suggestFieldMapping } from "./core"

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
  { key: "assignedTeacher", label: "Assigned teacher", required: false },
  { key: "avoidTeachers", label: "Blocked teacher classrooms", required: false },
  { key: "ell", label: "ELL", required: false },
  { key: "section504", label: "504 plan", required: false },
  { key: "raceEthnicity", label: "Race/ethnicity", required: false },
  { key: "studentTags", label: "Student characteristics", required: false },
  { key: "teacherNotes", label: "Teacher notes", required: false },
  { key: "linkedClassroom", label: "Linked classroom group", required: false },
] as const satisfies readonly CsvFieldOption[]

export type StudentCsvFieldKey = (typeof STUDENT_CSV_FIELD_OPTIONS)[number]["key"]
export type StudentCsvFieldMapping = Partial<Record<StudentCsvFieldKey, string>>

export interface StudentParseResult {
  students: Student[]
  issues: CsvValidationIssue[]
  errors: string[]
  skipped: number
  linkedRules: RelationshipRule[]
}

const FIELD_ALIASES: Record<StudentCsvFieldKey, string[]> = {
  id: ["id", "studentid", "student.studentnumber", "studentnumber", "sisid", "localid", "student.personid", "personid"],
  grade: ["grade", "gradelevel", "studentgrade", "grd"],
  firstName: ["student.firstname", "student first name", "firstname", "first name", "first", "givenname", "studentfirstname"],
  lastName: ["student.lastname", "student last name", "lastname", "last name", "last", "surname", "familyname", "studentlastname"],
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
  assignedTeacher: ["assignedteacher", "assigned teacher", "teachername", "homeroomteacher", "classteacher", "classteacher(s)"],
  avoidTeachers: ["avoidteachers", "blockedteacherclassrooms", "blockedteachers", "teacherstoavoid", "avoidteacherclassrooms", "avoid teacher classrooms"],
  ell: ["ell", "el", "englishlearner", "esl", "englishlanguagelearner"],
  section504: ["section504", "plan504", "program504", "504"],
  raceEthnicity: ["raceethnicity", "race/ethnicity", "ethnicity", "race", "studentrace", "studentethnicity"],
  studentTags: ["studentcharacteristics", "studenttags", "tags", "placementtags", "supporttags"],
  teacherNotes: ["teachernotes", "teacher notes", "teacher notes placement", "notes", "comments", "placementnotes"],
  linkedClassroom: ["linkedclassroom", "linkedgroup", "linkgroup", "classlink", "linked", "linkedclass", "staytogethergroup", "keeptogethergroup", "linkedclassroomgroup"],
}

const STUDENT_IDENTITY_ALIASES: Record<StudentMatchType, string[]> = {
  personId: [
    "person id",
    "personid",
    "student.personid",
    "person identifier",
    "internal person id",
    "person number",
    "individual id",
  ],
  stateId: [
    "state id",
    "stateid",
    "state identifier",
    "student state id",
    "state student id",
    "ssid",
    "sasid",
    "unique state id",
  ],
  studentNumber: [
    "student id",
    "studentid",
    "student number",
    "studentnumber",
    "student no",
    "local id",
    "localid",
    "sis id",
    "sisid",
    "school id",
  ],
}

function countPopulatedValues(rows: string[][], columnIndex: number): number {
  let populated = 0
  for (const row of rows.slice(0, 25)) {
    if ((row[columnIndex] ?? "").trim()) populated += 1
  }
  return populated
}

function getIdentityHeaderScore(type: StudentMatchType, header: string, rows: string[][], columnIndex: number): number {
  const aliasScore = STUDENT_IDENTITY_ALIASES[type].reduce((max, alias) => Math.max(max, scoreHeaderAliasMatch(header, alias)), 0)
  const normalizedHeader = normalizeHeader(header)
  const populatedValues = countPopulatedValues(rows, columnIndex)
  let score = aliasScore

  if (!normalizedHeader || populatedValues === 0) return score

  if (type === "personId" && normalizedHeader.includes("person")) score += 10
  if (type === "stateId" && (normalizedHeader.includes("state") || normalizedHeader.includes("ssid") || normalizedHeader.includes("sasid"))) score += 10
  if (type === "studentNumber" && (normalizedHeader.includes("studentnumber") || normalizedHeader.includes("studentno") || normalizedHeader.includes("localid") || normalizedHeader.includes("sisid"))) score += 10

  if (normalizedHeader === "id") score -= 20
  if (normalizedHeader.includes("teacher") || normalizedHeader.includes("grade") || normalizedHeader.includes("name")) score -= 25

  return score
}

export function suggestStudentIdentityColumns(headers: string[], rows: string[][]): StudentIdentityColumns {
  const mapping: StudentIdentityColumns = {
    personId: undefined,
    stateId: undefined,
    studentNumber: undefined,
  }
  const usedHeaders = new Set<string>()

  ;(Object.keys(STUDENT_IDENTITY_ALIASES) as StudentMatchType[]).forEach((type) => {
    let bestHeader: string | undefined
    let bestScore = 0

    headers.forEach((header, columnIndex) => {
      if (usedHeaders.has(header)) return
      const score = getIdentityHeaderScore(type, header, rows, columnIndex)
      if (score > bestScore) {
        bestScore = score
        bestHeader = header
      }
    })

    if (bestHeader && bestScore >= 88) {
      mapping[type] = bestHeader
      usedHeaders.add(bestHeader)
    }
  })

  return mapping
}

export function suggestStudentSupplementMatch(
  headers: string[],
  rows: string[][],
  masterIdentityColumns?: StudentIdentityColumns
): { matchColumn?: string; matchType?: StudentMatchType } {
  let bestMatchType: StudentMatchType | undefined
  let bestMatchColumn: string | undefined
  let bestScore = 0

  ;(Object.keys(STUDENT_IDENTITY_ALIASES) as StudentMatchType[]).forEach((type) => {
    const suggested = suggestBestHeader(headers, STUDENT_IDENTITY_ALIASES[type])
    if (!suggested.header) return

    const columnIndex = headers.indexOf(suggested.header)
    const identityScore = columnIndex >= 0 ? getIdentityHeaderScore(type, suggested.header, rows, columnIndex) : suggested.score
    const masterBonus = masterIdentityColumns?.[type] ? 6 : 0
    const totalScore = identityScore + masterBonus

    if (totalScore > bestScore) {
      bestScore = totalScore
      bestMatchType = type
      bestMatchColumn = suggested.header
    }
  })

  if (bestScore < 88) {
    return { matchColumn: undefined, matchType: undefined }
  }

  return {
    matchColumn: bestMatchColumn,
    matchType: bestMatchType,
  }
}

function toResult(students: Student[], issues: CsvValidationIssue[], skipped: number, linkedRules: RelationshipRule[] = []): StudentParseResult {
  return {
    students,
    issues,
    errors: issues.map((issue) => issue.message),
    skipped,
    linkedRules,
  }
}

function buildLinkedRules(
  students: Student[],
  linkedClassroomByStudentId: Map<number, string>
): RelationshipRule[] {
  // Group students by (grade, normalized linkedClassroom value)
  const groups = new Map<string, Student[]>()
  for (const student of students) {
    const raw = linkedClassroomByStudentId.get(student.id)
    if (!raw) continue
    const normalized = raw.trim().toLowerCase()
    if (!normalized) continue
    const key = `${student.grade}:${normalized}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(student)
  }

  const rules: RelationshipRule[] = []
  const now = Date.now()

  for (const [key, group] of groups) {
    if (group.length < 2) continue
    const grade = group[0].grade
    // All pairwise combinations so every student in the group is directly linked
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]
        const b = group[j]
        const pairId = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`
        rules.push({
          id: `linked-import-${key}-${pairId}-${now}`,
          type: "LINKED",
          studentIds: a.id < b.id ? [a.id, b.id] : [b.id, a.id],
          grade,
          scope: "grade",
          createdAt: now,
        })
      }
    }
  }

  return rules
}

function pushIssue(issues: CsvValidationIssue[], severity: CsvValidationIssue["severity"], message: string) {
  issues.push({ severity, message })
}

function parseBool(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "y"
}

function parseELL(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return normalized === "el" || normalized === "ell" || normalized.startsWith("rfep") || parseBool(value)
}

interface ParsedTier {
  score: number
  notes?: string
}

function parseTier(value: string): ParsedTier {
  const raw = value.trim()
  if (!raw) return { score: 1 }

  const normalized = raw.toLowerCase()
  if (normalized === "yes" || normalized === "y") return { score: 2 }

  const tierMatches = [...raw.matchAll(/tier\s*[-:]?\s*([1-3])/gi)]
  if (tierMatches.length > 0) {
    return {
      score: tierMatches.reduce((sum, match) => sum + Number(match[1]), 0),
      notes: raw,
    }
  }

  if (/^\d+$/.test(raw)) {
    const parsed = Number(raw)
    return { score: Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1 }
  }

  return { score: 1, notes: raw }
}

function parseStrictPositiveInt(value: string): number | undefined {
  const token = value.trim()
  if (!/^\d+$/.test(token)) return undefined

  const parsed = Number(token)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return undefined
  return parsed
}

interface ParsedIdList {
  ids: number[]
  invalidTokens: string[]
}

function parseIdList(value: string): ParsedIdList {
  if (!value || !value.trim()) return { ids: [], invalidTokens: [] }

  const ids: number[] = []
  const invalidTokens: string[] = []

  for (const rawToken of value.split(/[;,|\s]+/)) {
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

function parseStatus(value: string): "None" | "IEP" | "Referral" {
  const normalized = value.trim()
  if (normalized === "IEP") return "IEP"
  if (normalized === "Referral") return "Referral"
  if (normalized.toLowerCase() === "y" || normalized.toLowerCase() === "yes") return "IEP"
  return "None"
}

function parseGrade(value: string): Grade | null {
  const normalized = value.trim()
  if (normalized === "K" || normalized === "1" || normalized === "2" || normalized === "3" || normalized === "4" || normalized === "5") return normalized
  if (/^\d{2}$/.test(normalized)) {
    const parsed = parseInt(normalized, 10)
    if (parsed === 0) return "K"
    if (parsed >= 1 && parsed <= 5) return String(parsed) as Grade
  }
  if (normalized === "0") return "K"
  const upper = normalized.toUpperCase()
  if (upper === "KG" || upper.startsWith("KIND")) return "K"
  const ordinal = normalized.match(/^0?([1-5])(?:st|nd|rd|th)/i)
  if (ordinal) return ordinal[1] as Grade
  return null
}

function parseOptionalFloat(value: string): number | undefined {
  if (!value || !value.trim()) return undefined
  const parsed = parseFloat(value.trim())
  return Number.isNaN(parsed) ? undefined : parsed
}

function parseOptionalInt(value: string): number | undefined {
  if (!value || !value.trim()) return undefined
  const parsed = parseInt(value.trim(), 10)
  return Number.isNaN(parsed) ? undefined : parsed
}

function parseOptionalString(value: string): string | undefined {
  const normalized = value.trim()
  return normalized || undefined
}

function parseTeacherList(value: string): string[] {
  const unique: string[] = []
  const seen = new Set<string>()

  for (const rawToken of value.split(/[;,|\n]+/)) {
    const trimmed = rawToken.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(trimmed)
  }

  return unique
}

function parseCoTeachMinutes(raw: string, rowIndex: number, label: string, issues: CsvValidationIssue[]): number {
  if (!raw || !raw.trim()) return 0
  const parsed = Number(raw.trim())
  if (!Number.isFinite(parsed)) {
    pushIssue(issues, "warning", `Row ${rowIndex + 2}: ${label} value "${raw}" is not numeric; defaulted to 0.`)
    return 0
  }
  if (parsed < 0) return 0
  if (parsed > MAX_COTEACH_MINUTES) {
    pushIssue(issues, "warning", `Row ${rowIndex + 2}: ${label} exceeded ${MAX_COTEACH_MINUTES}; clamped.`)
    return MAX_COTEACH_MINUTES
  }
  return parsed
}

function buildCoTeachMinutes(values: string[], rowIndex: number, get: (values: string[], field: StudentCsvFieldKey) => string, issues: CsvValidationIssue[]) {
  const coTeachMinutes: Partial<Record<CoTeachCategory, number>> = {
    reading: parseCoTeachMinutes(get(values, "coTeachReadingMinutes"), rowIndex, "CoTeach Reading Minutes", issues),
    writing: parseCoTeachMinutes(get(values, "coTeachWritingMinutes"), rowIndex, "CoTeach Writing Minutes", issues),
    scienceSocialStudies: parseCoTeachMinutes(get(values, "coTeachScienceSocialStudiesMinutes"), rowIndex, "CoTeach Science/Social Studies Minutes", issues),
    math: parseCoTeachMinutes(get(values, "coTeachMathMinutes"), rowIndex, "CoTeach Math Minutes", issues),
    behavior: parseCoTeachMinutes(get(values, "coTeachBehaviorMinutes"), rowIndex, "CoTeach Behavior Minutes", issues),
    social: parseCoTeachMinutes(get(values, "coTeachSocialMinutes"), rowIndex, "CoTeach Social Minutes", issues),
    vocational: parseCoTeachMinutes(get(values, "coTeachVocationalMinutes"), rowIndex, "CoTeach Vocational Minutes", issues),
  }

  if ((coTeachMinutes.reading ?? 0) === 0 && parseBool(get(values, "requiresCoTeachReading"))) {
    coTeachMinutes.reading = 30
    pushIssue(issues, "warning", `Row ${rowIndex + 2}: legacy requiresCoTeachReading converted to 30 reading minutes.`)
  }

  if ((coTeachMinutes.math ?? 0) === 0 && parseBool(get(values, "requiresCoTeachMath"))) {
    coTeachMinutes.math = 30
    pushIssue(issues, "warning", `Row ${rowIndex + 2}: legacy requiresCoTeachMath converted to 30 math minutes.`)
  }

  return normalizeCoTeachMinutes(coTeachMinutes)
}

const TAG_LOOKUP = new Map<string, StudentTag>([
  ...STUDENT_TAGS.map((tag) => [tag.trim().toLowerCase(), tag] as const),
  ...Object.entries(LEGACY_STUDENT_TAG_ALIASES).map(([legacyTag, currentTag]) => [legacyTag.trim().toLowerCase(), currentTag] as const),
])

function parseStudentTags(raw: string): { tags: StudentTag[]; invalidTokens: string[] } {
  if (!raw || !raw.trim()) return { tags: [], invalidTokens: [] }

  const tags: StudentTag[] = []
  const invalidTokens: string[] = []

  for (const rawToken of raw.split(/[;,|]/)) {
    const token = rawToken.trim()
    if (!token) continue

    const matched = TAG_LOOKUP.get(token.toLowerCase())
    if (!matched) {
      invalidTokens.push(token)
      continue
    }

    if (!tags.includes(matched)) tags.push(matched)
  }

  return { tags, invalidTokens }
}

export function suggestStudentFieldMapping(headers: string[]): StudentCsvFieldMapping {
  return suggestFieldMapping(headers, STUDENT_CSV_FIELD_OPTIONS, FIELD_ALIASES)
}

export function parseStudentCSVWithMapping(text: string, mapping: StudentCsvFieldMapping): StudentParseResult {
  const { headers, rows } = parseCSVPreview(text)
  if (headers.length === 0 || rows.length === 0) {
    return toResult([], [{ severity: "error", message: "CSV must have a header row and at least one data row." }], 0)
  }

  const headerLookup = new Map(headers.map((header, index) => [normalizeHeader(header), index]))
  const issues: CsvValidationIssue[] = []
  const students: Student[] = []
  const seenIds = new Set<number>()
  const linkedClassroomByStudentId = new Map<number, string>()
  let skipped = 0

  const get = (values: string[], field: StudentCsvFieldKey): string => {
    const mapped = mapping[field]
    if (!mapped) return ""
    const index = headerLookup.get(normalizeHeader(mapped))
    return index === undefined ? "" : (values[index] ?? "").trim()
  }

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const values = rows[rowIndex]
    const idText = get(values, "id")
    const id = parseStrictPositiveInt(idText)

    if (id === undefined) {
      pushIssue(issues, "error", `Row ${rowIndex + 2}: Invalid or missing ID "${idText}" - skipped.`)
      skipped++
      continue
    }

    if (seenIds.has(id)) {
      pushIssue(issues, "error", `Row ${rowIndex + 2}: Duplicate ID "${id}" - skipped. IDs must be unique.`)
      skipped++
      continue
    }
    seenIds.add(id)

    const parsedNoContact = parseIdList(get(values, "noContactWith"))
    const parsedPreferredWith = parseIdList(get(values, "preferredWith"))
    const parsedTags = parseStudentTags(get(values, "studentTags"))
    const parsedAcademicTier = parseTier(get(values, "academicTier"))
    const parsedBehaviorTier = parseTier(get(values, "behaviorTier"))

    if (parsedNoContact.invalidTokens.length > 0) {
      pushIssue(issues, "warning", `Row ${rowIndex + 2}: Invalid noContactWith token(s): ${parsedNoContact.invalidTokens.join(", ")} - expected positive whole-number IDs.`)
    }

    if (parsedPreferredWith.invalidTokens.length > 0) {
      pushIssue(issues, "warning", `Row ${rowIndex + 2}: Invalid preferredWith token(s): ${parsedPreferredWith.invalidTokens.join(", ")} - expected positive whole-number IDs.`)
    }

    if (parsedTags.invalidTokens.length > 0) {
      pushIssue(issues, "warning", `Row ${rowIndex + 2}: Unknown student characteristic(s): ${parsedTags.invalidTokens.join(", ")} - ignored.`)
    }

    const rawGrade = get(values, "grade")
    const grade = parseGrade(rawGrade)
    if (grade == null) {
      pushIssue(issues, "warning", `Row ${rowIndex + 2}: Unrecognized grade "${rawGrade}" - skipped.`)
      skipped++
      continue
    }

    const linkedClassroomRaw = get(values, "linkedClassroom")
    if (linkedClassroomRaw.trim()) {
      linkedClassroomByStudentId.set(id, linkedClassroomRaw.trim())
    }

    students.push({
      id,
      grade,
      firstName: get(values, "firstName") || "Student",
      lastName: get(values, "lastName") || `${id}`,
      gender: get(values, "gender").toUpperCase() === "F" ? "F" : "M",
      specialEd: {
        status: parseStatus(get(values, "status")),
      },
      coTeachMinutes: buildCoTeachMinutes(values, rowIndex, get, issues),
      intervention: {
        academicTier: parsedAcademicTier.score,
      },
      behaviorTier: parsedBehaviorTier.score,
      academicTierNotes: parsedAcademicTier.notes,
      behaviorTierNotes: parsedBehaviorTier.notes,
      referrals: parseOptionalInt(get(values, "referrals")) ?? 0,
      preassignedTeacher: parseOptionalString(get(values, "assignedTeacher")),
      avoidTeachers: parseTeacherList(get(values, "avoidTeachers")),
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
      pushIssue(issues, "warning", `Student ${student.id} (${student.firstName} ${student.lastName}): noContactWith references unknown IDs: ${invalidNoContact.join(", ")}`)
    }

    student.noContactWith = (student.noContactWith ?? []).filter((entry) => entry !== student.id)

    const invalidPreferred = (student.preferredWith ?? []).filter((peerId) => !idSet.has(peerId))
    if (invalidPreferred.length > 0) {
      pushIssue(issues, "warning", `Student ${student.id} (${student.firstName} ${student.lastName}): preferredWith references unknown IDs: ${invalidPreferred.join(", ")}`)
    }

    const crossGradePreferred = (student.preferredWith ?? []).filter((peerId) => {
      const peer = studentsById.get(peerId)
      return peer != null && peer.grade !== student.grade
    })
    if (crossGradePreferred.length > 0) {
      pushIssue(issues, "warning", `Student ${student.id} (${student.firstName} ${student.lastName}): preferredWith references students in different grades (${crossGradePreferred.join(", ")}); these were ignored.`)
    }

    student.preferredWith = (student.preferredWith ?? [])
      .filter((peerId) => peerId !== student.id && idSet.has(peerId))
      .filter((peerId) => studentsById.get(peerId)?.grade === student.grade)
      .filter((peerId, index, list) => list.indexOf(peerId) === index)
  }

  const linkedRules = buildLinkedRules(students, linkedClassroomByStudentId)
  if (linkedRules.length > 0) {
    pushIssue(issues, "warning", `Linked classroom import: created ${linkedRules.length} LINKED rule${linkedRules.length === 1 ? "" : "s"} from the Linked Classroom Group column.`)
  }

  return toResult(students, issues, skipped, linkedRules)
}

export function parseStudentCSV(text: string): StudentParseResult {
  const preview = parseCSVPreview(text)
  const mapping = suggestStudentFieldMapping(preview.headers)
  return parseStudentCSVWithMapping(text, mapping)
}

export function generateLinkedRulesSummary(rules: RelationshipRule[]): string {
  if (rules.length === 0) return ""
  const grades = Array.from(new Set(rules.map((r) => r.grade))).sort()
  return `${rules.length} linked pair rule${rules.length === 1 ? "" : "s"} across grade${grades.length === 1 ? "" : "s"} ${grades.join(", ")}`
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
  "assignedTeacher",
  "avoidTeachers",
  "ell",
  "section504",
  "raceEthnicity",
  "studentCharacteristics",
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
    "Needs strong routine;Needs reassurance",
    "Needs frequent redirection;High energy",
    "Needs enrichment;Independent worker",
    "Sensitive to correction;Low academic confidence",
    "Needs movement breaks;High energy",
    "Struggles with peer conflict;Needs strong routine",
    "Easily frustrated;Needs reassurance",
    "Independent worker",
  ]

  const rows: string[] = []
  let id = 1001

  for (const grade of grades) {
    for (let index = 0; index < 8; index++) {
      const isSped = index < 2
      const status = isSped ? (index % 2 === 0 ? "IEP" : "Referral") : "None"
      const gender = index % 2 === 0 ? "F" : "M"
      const academicTier = isSped ? 3 : index % 4 === 0 ? 2 : 1
      const behaviorTier = index % 3 === 0 ? 2 : 1
      const referrals = index % 5 === 0 ? 1 : 0
      const readingMinutes = isSped ? 30 : 0
      const mathMinutes = isSped ? 30 : 0
      const behaviorMinutes = index === 1 ? 20 : 0
      const socialMinutes = index === 5 ? 15 : 0
      const noContact = index === 0 ? `${id + 1}` : ""
      const preferredWith = index === 2 ? `${id + 1}` : ""
      const brigance = grade === "K" ? 48 + index * 5 : ""
      const mapReading = grade === "K" ? "" : 155 + index * 3 + grades.indexOf(grade) * 2
      const mapMath = grade === "K" ? "" : 158 + index * 3 + grades.indexOf(grade) * 2
      const ireadyReading = grade === "K" ? "" : ["Late K", "Early 1", "Mid 1", "Late 1", "Early 2", "Mid 2", "Late 2", "Early 3"][index]
      const ireadyMath = grade === "K" ? "" : ["Mid K", "Late K", "Early 1", "Mid 1", "Late 1", "Early 2", "Mid 2", "Late 2"][index]
      const assignedTeacher = `Ms. Grade${grade}${String.fromCharCode(65 + (index % 4))}`
      const avoidTeachers = index === 6 ? `Ms. Grade${grade}A` : ""
      const ell = index % 4 === 0 ? "TRUE" : "FALSE"
      const section504 = index === 3 ? "TRUE" : "FALSE"
      const race = races[(index + grades.indexOf(grade)) % races.length]
      const note = isSped ? "Requires co-teach support" : index === 4 ? "Monitor confidence in whole group" : ""

      rows.push([
        id,
        grade,
        firstNames[index],
        `${lastNames[(index + grades.indexOf(grade)) % lastNames.length]}${grades.indexOf(grade) + 1}`,
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
        assignedTeacher,
        avoidTeachers,
        ell,
        section504,
        race,
        tagSets[index],
        note,
      ].join(","))

      id += 1
    }
  }

  return [generateStudentTemplateCSV(), ...rows].join("\n")
}
