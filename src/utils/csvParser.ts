import { Grade, Student } from "../types"

function parseBool(val: string): boolean {
  const v = val.trim().toLowerCase()
  return v === "true" || v === "1" || v === "yes"
}

function parseTier(val: string): 1 | 2 | 3 {
  const n = parseInt(val.trim(), 10)
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
  return "None"
}

function parseGrade(val: string): Grade {
  const v = val.trim()
  if (v === "K" || v === "1" || v === "2" || v === "3" || v === "4" || v === "5") return v
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

export function parseCSV(text: string): ParseResult {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) {
    return { students: [], errors: ["CSV must have a header row and at least one data row."], skipped: 0 }
  }

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, ""))
  const errors: string[] = []
  const students: Student[] = []
  let skipped = 0

  const get = (values: string[], col: string): string => {
    const idx = header.indexOf(col)
    return idx >= 0 ? (values[idx] ?? "").trim() : ""
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values = parseCSVLine(line)
    const idStr = get(values, "id")
    const id = parseInt(idStr, 10)

    if (isNaN(id)) {
      errors.push(`Row ${i + 1}: Invalid or missing ID "${idStr}" — skipped.`)
      skipped++
      continue
    }

    try {
      students.push({
        id,
        grade: parseGrade(get(values, "grade")),
        firstName: get(values, "firstname") || `Student`,
        lastName: get(values, "lastname") || `${id}`,
        gender: get(values, "gender").toUpperCase() === "F" ? "F" : "M",
        specialEd: {
          status: parseStatus(get(values, "status")),
          requiresCoTeachReading: parseBool(get(values, "requirescoteachreading")),
          requiresCoTeachMath: parseBool(get(values, "requirescoteachmath")),
        },
        intervention: {
          academicTier: parseTier(get(values, "academictier")),
        },
        behaviorTier: parseTier(get(values, "behaviortier")),
        referrals: parseOptionalInt(get(values, "referrals")) ?? 0,
        mapReading: parseOptionalFloat(get(values, "mapreading")),
        mapMath: parseOptionalFloat(get(values, "mapmath")),
        ireadyReading: parseOptionalString(get(values, "ireadyreading")),
        ireadyMath: parseOptionalString(get(values, "ireadymath")),
        noContactWith: parseNoContact(get(values, "nocontactwith")),
        locked: false,
        // Accept "teacher" or "assignedteacher" column
        preassignedTeacher: parseOptionalString(
          get(values, "teacher") || get(values, "assignedteacher")
        ),
      })
    } catch (e) {
      errors.push(`Row ${i + 1}: Unexpected error — skipped.`)
      skipped++
    }
  }

  // Validate no-contact IDs reference real students
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

/** Generate a sample CSV string for download/reference */
export function generateSampleCSV(): string {
  const header =
    "id,grade,firstName,lastName,gender,status,requiresCoTeachReading,requiresCoTeachMath,academicTier,behaviorTier,noContactWith,mapReading,mapMath,ireadyReading,ireadyMath,referrals,teacher"
  const rows = [
    // teacher column: pre-assigns student to a named teacher (classroom auto-mapped)
    // noContactWith: semicolon-separated IDs — supports multiple: e.g. "2;3"
    "1,K,Alice,Smith,F,IEP,true,false,3,2,,18,22,Early K,Mid K,2,Ms. Johnson",
    "2,K,Bob,Jones,M,None,false,false,1,1,3,82,78,Late 1,Mid 1,0,Ms. Johnson",
    "3,K,Carol,Brown,F,Referral,false,false,2,3,1;2,35,40,Mid K,Early K,3,",
    "4,K,David,Wilson,M,IEP,true,true,3,3,,12,15,Early K,Early K,1,",
    "5,K,Emma,Taylor,F,None,false,false,1,1,,90,88,Late 1,Late 1,0,Ms. Patel",
    "6,1,Frank,Davis,M,None,false,false,2,2,,55,60,Mid 1,Mid 1,1,",
    "7,1,Grace,Miller,F,IEP,true,false,3,2,,20,30,Early 1,Mid 1,0,Mr. Rivera",
    "8,1,Henry,Moore,M,None,false,false,1,1,9,78,80,Late 2,Late 2,0,",
    "9,1,Isabel,Jackson,F,Referral,false,false,2,2,8,42,38,Mid 1,Early 1,2,",
    "10,1,Jack,Martin,M,None,false,false,1,3,,65,70,Mid 2,Late 2,4,Mr. Rivera",
  ]
  return [header, ...rows].join("\n")
}
