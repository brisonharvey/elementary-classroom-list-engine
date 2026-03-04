import { Grade, Student } from "../types"

export const CSV_FIELD_OPTIONS = [
  { key: "id", label: "Student ID", required: true },
  { key: "grade", label: "Grade", required: true },
  { key: "firstName", label: "First name", required: true },
  { key: "lastName", label: "Last name", required: true },
  { key: "gender", label: "Gender", required: false },
  { key: "status", label: "Special education status", required: false },
  { key: "requiresCoTeachReading", label: "Requires co-teach reading", required: false },
  { key: "requiresCoTeachMath", label: "Requires co-teach math", required: false },
  { key: "academicTier", label: "Academic tier", required: false },
  { key: "behaviorTier", label: "Behavior tier", required: false },
  { key: "noContactWith", label: "No-contact IDs", required: false },
  { key: "mapReading", label: "MAP reading", required: false },
  { key: "mapMath", label: "MAP math", required: false },
  { key: "ireadyReading", label: "i-Ready reading", required: false },
  { key: "ireadyMath", label: "i-Ready math", required: false },
  { key: "referrals", label: "Referrals", required: false },
  { key: "teacher", label: "Assigned teacher", required: false },
  { key: "ell", label: "ELL", required: false },
  { key: "section504", label: "504 plan", required: false },
  { key: "homeroom", label: "Homeroom", required: false },
  { key: "notes", label: "Notes", required: false },
] as const

export type CsvFieldKey = (typeof CSV_FIELD_OPTIONS)[number]["key"]
export type CsvFieldMapping = Partial<Record<CsvFieldKey, string>>

const FIELD_ALIASES: Record<CsvFieldKey, string[]> = {
  // "student.studentnumber" (Infinite Campus) before generic "studentnumber"
  id: ["id", "studentid", "student.studentnumber", "studentnumber", "sisid", "localid", "student.personid", "personid"],
  grade: ["grade", "gradelevel", "studentgrade", "grd"],
  // "student.firstname" before generic "firstname" so SIS exports match first
  firstName: ["student.firstname", "firstname", "first", "givenname", "studentfirstname"],
  lastName: ["student.lastname", "lastname", "last", "surname", "familyname", "studentlastname"],
  gender: ["gender", "sex", "f/m"],
  // "sped" = normalized "Sp Ed"; "specialeducation" = iReady column
  status: ["status", "spedstatus", "specialedstatus", "specialeducationstatus", "sped", "specialeducation"],
  requiresCoTeachReading: ["requirescoteachreading", "coteachreading", "readingcoteach"],
  requiresCoTeachMath: ["requirescoteachmath", "coteachmath", "mathcoteach"],
  // "activeintervention|acad" = normalized "Active Intervention | Acad" (Infinite Campus)
  academicTier: ["academictier", "academicsupporttier", "tiersupport", "activeintervention|acad"],
  // "activeintervention|seb" = normalized "Active Intervention | SEB"
  behaviorTier: ["behaviortier", "behaviourtier", "behaviorsupporttier", "activeintervention|seb"],
  noContactWith: ["nocontactwith", "separatefrom", "donotpairwith"],
  // Winter MAP preferred over Fall MAP (most recent data)
  mapReading: ["mapreading", "readingmap", "mapreadingscore", "mapwinterreading|rit", "mapfallreading|rit"],
  mapMath: ["mapmath", "mathmap", "mapmathscore", "mapwintermath|rit", "mapfallmath|rit"],
  // iReady ELA winter placement; math has diagnostic suffix
  ireadyReading: ["ireadyreading", "ireadingreading", "ireadyreadinglevel", "winter(november16-march1)|overallplacement"],
  ireadyMath: ["ireadymath", "ireadymathlevel", "winter(november16-march1)|overallplacement(diagnostic_results_math_confidential(1).csv)"],
  // "disc.referrals" = normalized "Disc. Referrals" (Infinite Campus behavior)
  referrals: ["referrals", "referralcount", "disciplinereferrals", "disc.referrals"],
  // "schedulingteam" = Infinite Campus teacher last name group; "classteacher(s)" = iReady
  teacher: ["teacher", "assignedteacher", "homeroomteacher", "schedulingteam", "classteacher(s)"],
  // "el" = Infinite Campus EL column; "englishlanguagelearner" = iReady column
  ell: ["ell", "el", "englishlearner", "esl", "englishlanguagelearner"],
  // "program504" = normalized "Program 504" (Infinite Campus)
  section504: ["section504", "plan504", "program504", "504"],
  homeroom: ["homeroom", "homeroomid", "room"],
  notes: ["notes", "comments", "placementnotes"],
}

function parseBool(val: string): boolean {
  const v = val.trim().toLowerCase()
  return v === "true" || v === "1" || v === "yes" || v === "y"
}

/** Parse ELL status — handles "EL"/"ELL" (Infinite Campus) as well as boolean strings */
function parseELL(val: string): boolean {
  const v = val.trim().toLowerCase()
  return v === "el" || v === "ell" || v === "true" || v === "1" || v === "yes" || v === "y"
}

function parseTier(val: string): 1 | 2 | 3 {
  const v = val.trim()
  // "Yes"/"Y" = active intervention → tier 2 (Infinite Campus boolean intervention columns)
  if (v.toLowerCase() === "yes" || v.toLowerCase() === "y") return 2
  const n = parseInt(v, 10)
  if (n === 2) return 2
  if (n === 3) return 3
  return 1
}

function parseNoContact(val: string): number[] {
  if (!val || !val.trim()) return []
  return val
    .split(";")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0)
}

function parseStatus(val: string): "None" | "IEP" | "Referral" {
  const v = val.trim()
  if (v === "IEP") return "IEP"
  if (v === "Referral") return "Referral"
  // "Y"/"Yes" = student has special education services (Infinite Campus "Sp Ed" column)
  if (v.toLowerCase() === "y" || v.toLowerCase() === "yes") return "IEP"
  return "None"
}

function parseGrade(val: string): Grade {
  const v = val.trim()
  // Plain grade letters/numbers
  if (v === "K" || v === "1" || v === "2" || v === "3" || v === "4" || v === "5") return v
  // Two-digit school codes: "00"→K, "01"→1, "02"→2 (Infinite Campus export)
  if (/^\d{2}$/.test(v)) {
    const n = parseInt(v, 10)
    if (n === 0) return "K"
    if (n >= 1 && n <= 5) return String(n) as Grade
  }
  // "0" as a standalone
  if (v === "0") return "K"
  // "KG" or "Kindergarten" prefix
  const upper = v.toUpperCase()
  if (upper === "KG" || upper.startsWith("KIND")) return "K"
  // Ordinal suffixes: "1st", "2nd", "02nd", "3rd", "4th", "5th"
  const ord = v.match(/^0?([1-5])(?:st|nd|rd|th)/i)
  if (ord) return ord[1] as Grade
  return "K"
}

function parseOptionalFloat(val: string): number | undefined {
  if (!val || !val.trim()) return undefined
  const n = parseFloat(val.trim())
  return isNaN(n) ? undefined : n
}

function parseOptionalInt(val: string): number | undefined {
  if (!val || !val.trim()) return undefined
  const n = parseInt(val.trim(), 10)
  return isNaN(n) ? undefined : n
}

function parseOptionalString(val: string): string | undefined {
  const v = val.trim()
  return v || undefined
}

/** Handle quoted CSV fields (RFC 4180) */
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

export function suggestFieldMapping(headers: string[]): CsvFieldMapping {
  const normalized = headers.map(normalizeHeader)
  const mapping: CsvFieldMapping = {}

  for (const field of CSV_FIELD_OPTIONS) {
    const aliases = FIELD_ALIASES[field.key]
    const index = normalized.findIndex((h) => aliases.includes(h))
    if (index >= 0) mapping[field.key] = headers[index]
  }

  return mapping
}

/** Returns a map of csvHeader → sample value (first non-empty value across first few rows) */
export function buildSampleValues(headers: string[], rows: string[][]): Record<string, string> {
  const samples: Record<string, string> = {}
  headers.forEach((header, idx) => {
    for (const row of rows) {
      const val = (row[idx] ?? "").trim()
      if (val) {
        samples[header] = val.length > 24 ? val.slice(0, 22) + "…" : val
        break
      }
    }
  })
  return samples
}

export function parseCSVWithMapping(text: string, mapping: CsvFieldMapping): ParseResult {
  const { headers, rows } = parseCSVPreview(text)
  if (headers.length === 0 || rows.length === 0) {
    return { students: [], errors: ["CSV must have a header row and at least one data row."], skipped: 0 }
  }

  const headerLookup = new Map(headers.map((header, index) => [normalizeHeader(header), index]))
  const errors: string[] = []
  const students: Student[] = []
  let skipped = 0

  const get = (values: string[], field: CsvFieldKey): string => {
    const mapped = mapping[field]
    if (!mapped) return ""
    const idx = headerLookup.get(normalizeHeader(mapped))
    return idx === undefined ? "" : (values[idx] ?? "").trim()
  }

  const getByHeader = (values: string[], headerName: string): string => {
    const idx = headerLookup.get(normalizeHeader(headerName))
    return idx === undefined ? "" : (values[idx] ?? "").trim()
  }

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const values = rows[rowIndex]
    const idStr = get(values, "id")
    const id = parseInt(idStr, 10)

    if (isNaN(id)) {
      errors.push(`Row ${rowIndex + 2}: Invalid or missing ID "${idStr}" — skipped.`)
      skipped++
      continue
    }

    students.push({
      id,
      grade: parseGrade(get(values, "grade")),
      firstName: get(values, "firstName") || "Student",
      lastName: get(values, "lastName") || `${id}`,
      gender: get(values, "gender").toUpperCase() === "F" ? "F" : "M",
      specialEd: {
        status: parseStatus(get(values, "status")),
        requiresCoTeachReading: parseBool(get(values, "requiresCoTeachReading")),
        requiresCoTeachMath: parseBool(get(values, "requiresCoTeachMath")),
      },
      intervention: {
        academicTier: parseTier(get(values, "academicTier")),
      },
      behaviorTier: parseTier(get(values, "behaviorTier")),
      referrals: parseOptionalInt(get(values, "referrals")) ?? 0,
      mapReading: parseOptionalFloat(get(values, "mapReading")),
      mapMath: parseOptionalFloat(get(values, "mapMath")),
      ireadyReading: parseOptionalString(get(values, "ireadyReading")),
      ireadyMath: parseOptionalString(get(values, "ireadyMath")),
      noContactWith: parseNoContact(get(values, "noContactWith")),
      preassignedTeacher:
        parseOptionalString(get(values, "teacher")) ||
        parseOptionalString(getByHeader(values, "teacher")) ||
        parseOptionalString(getByHeader(values, "assignedteacher")),
      ell: parseELL(get(values, "ell")),
      section504: parseBool(get(values, "section504")),
      homeroom: parseOptionalString(get(values, "homeroom")),
      notes: parseOptionalString(get(values, "notes")),
      locked: false,
    })
  }

  const idSet = new Set(students.map((s) => s.id))
  for (const student of students) {
    const invalid = (student.noContactWith ?? []).filter((nc) => !idSet.has(nc))
    if (invalid.length > 0) {
      errors.push(
        `Student ${student.id} (${student.firstName} ${student.lastName}): noContactWith references unknown IDs: ${invalid.join(", ")}`
      )
    }
  }

  return { students, errors, skipped }
}

export function parseCSV(text: string): ParseResult {
  const preview = parseCSVPreview(text)
  const mapping = suggestFieldMapping(preview.headers)
  return parseCSVWithMapping(text, mapping)
}

/** Generate a sample CSV string for download/reference */
export function generateSampleCSV(): string {
  const header =
    "id,grade,firstName,lastName,gender,status,requiresCoTeachReading,requiresCoTeachMath,academicTier,behaviorTier,noContactWith,mapReading,mapMath,ireadyReading,ireadyMath,referrals,teacher,ell,section504,homeroom,notes"
  const rows = [
    // teacher column: pre-assigns student to a named teacher (classroom auto-mapped)
    // noContactWith: semicolon-separated IDs — supports multiple: e.g. "2;3"
    "1,K,Alice,Smith,F,IEP,true,false,3,2,,18,22,Early K,Mid K,2,Ms. Johnson,true,false,K-101,Prefers front row",
    "2,K,Bob,Jones,M,None,false,false,1,1,3,82,78,Late 1,Mid 1,0,Ms. Johnson,false,false,K-101,",
    "3,K,Carol,Brown,F,Referral,false,false,2,3,1;2,35,40,Mid K,Early K,3,,true,true,K-102,Needs quiet transitions",
    "4,K,David,Wilson,M,IEP,true,true,3,3,,12,15,Early K,Early K,1,,false,true,K-102,",
    "5,K,Emma,Taylor,F,None,false,false,1,1,,90,88,Late 1,Late 1,0,Ms. Patel,false,false,K-103,",
    "6,1,Frank,Davis,M,None,false,false,2,2,,55,60,Mid 1,Mid 1,1,,false,false,1-201,",
    "7,1,Grace,Miller,F,IEP,true,false,3,2,,20,30,Early 1,Mid 1,0,Mr. Rivera,true,true,1-202,Speech services",
    "8,1,Henry,Moore,M,None,false,false,1,1,9,78,80,Late 2,Late 2,0,,false,false,1-201,",
    "9,1,Isabel,Jackson,F,Referral,false,false,2,2,8,42,38,Mid 1,Early 1,2,,true,false,1-202,",
    "10,1,Jack,Martin,M,None,false,false,1,3,,65,70,Mid 2,Late 2,4,Mr. Rivera,false,false,1-203,Watch peer pairings",
  ]
  return [header, ...rows].join("\n")
}
