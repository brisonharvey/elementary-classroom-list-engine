import { StudentCsvFieldKey } from "./student"
import { CsvValidationIssue } from "../../types/csvImport"
import { TableData } from "./spreadsheet"

export interface StudentBlendSource {
  id: string
  name: string
  table: TableData
  matchColumn: string
  matchType?: StudentMatchType
  masterIdColumns?: StudentIdentityColumns
  fieldMapping: Partial<Record<StudentCsvFieldKey, string>>
}

export type StudentMatchType = "personId" | "stateId" | "studentNumber"

export type StudentIdentityColumns = Record<StudentMatchType, string | undefined>

export interface StudentBlendResult {
  csvText: string
  issues: CsvValidationIssue[]
  headers: StudentCsvFieldKey[]
}

const REQUIRED_MASTER_FIELDS: StudentCsvFieldKey[] = ["id", "firstName", "lastName"]
const REQUIRED_MASTER_IDS: StudentMatchType[] = ["personId", "stateId", "studentNumber"]

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function getRowValue(headers: string[], row: string[], column: string | undefined): string {
  if (!column) return ""
  const index = headers.indexOf(column)
  return index >= 0 ? (row[index] ?? "").trim() : ""
}

function normalizeMatchKey(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ""

  if (/^\d+\.0+$/.test(trimmed)) {
    return trimmed.replace(/\.0+$/, "").replace(/^0+(\d)/, "$1")
  }

  if (/^\d+$/.test(trimmed)) {
    return trimmed.replace(/^0+(\d)/, "$1")
  }

  return trimmed.toLowerCase()
}

function translateRelationshipValue(
  rawValue: string,
  relationshipLookup: Map<string, string>,
  issuePrefix: string,
  issues: CsvValidationIssue[]
): string {
  if (!rawValue.trim()) return ""

  const translatedIds: string[] = []
  const unresolvedTokens: string[] = []

  for (const rawToken of rawValue.split(/[;,|\s]+/)) {
    const token = rawToken.trim()
    if (!token) continue

    const translated = relationshipLookup.get(normalizeMatchKey(token))
    if (!translated) {
      unresolvedTokens.push(token)
      continue
    }

    if (!translatedIds.includes(translated)) {
      translatedIds.push(translated)
    }
  }

  if (unresolvedTokens.length > 0) {
    issues.push({
      severity: "warning",
      message: `${issuePrefix}: could not translate relationship ID(s) ${unresolvedTokens.join(", ")} into master student IDs.`,
    })
  }

  return translatedIds.join(";")
}

export function buildBlendedStudentCsv(master: StudentBlendSource, supplements: StudentBlendSource[]): StudentBlendResult {
  const issues: CsvValidationIssue[] = []
  const headers = master.table.headers
  const mappedMasterFields = new Set(Object.keys(master.fieldMapping) as StudentCsvFieldKey[])
  const identityColumns = master.masterIdColumns ?? {
    personId: undefined,
    stateId: undefined,
    studentNumber: undefined,
  }

  for (const key of REQUIRED_MASTER_FIELDS) {
    if (!mappedMasterFields.has(key)) {
      issues.push({ severity: "error", message: `Master roster is missing a mapping for required field "${key}".` })
    }
  }

  for (const idType of REQUIRED_MASTER_IDS) {
    if (!identityColumns[idType]) {
      issues.push({ severity: "error", message: `Master roster is missing a "${idType}" identity column mapping.` })
    }
  }

  const canonicalHeaders = Object.keys(master.fieldMapping).length > 0
    ? ([
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
        "requiresCoTeachReading",
        "requiresCoTeachMath",
        "academicTier",
        "behaviorTier",
        "noContactWith",
        "preferredWith",
        "parentPreferredWith",
        "parentAvoidWith",
        "briganceReadiness",
        "mapReading",
        "mapMath",
        "ireadyReading",
        "ireadyMath",
        "referrals",
        "assignedTeacher",
        "ell",
        "section504",
        "raceEthnicity",
        "studentTags",
        "teacherNotes",
      ] satisfies StudentCsvFieldKey[])
    : ([] as StudentCsvFieldKey[])

  const masterRecords = master.table.rows.map((row, rowIndex) => {
    const record: Partial<Record<StudentCsvFieldKey, string>> = {}
    for (const [field, column] of Object.entries(master.fieldMapping) as Array<[StudentCsvFieldKey, string | undefined]>) {
      const value = getRowValue(headers, row, column)
      if (value) record[field] = value
    }

    return {
      rowIndex,
      row,
      record,
      matchedSupplement: false,
    }
  })

  for (const requiredField of REQUIRED_MASTER_FIELDS) {
    masterRecords.forEach((entry, index) => {
      if (!entry.record[requiredField]?.trim()) {
        issues.push({ severity: "error", message: `Master roster row ${index + 2} is missing required field "${requiredField}".` })
      }
    })
  }

  for (const supplement of supplements) {
    if (!supplement.matchColumn || !supplement.matchType) {
      issues.push({ severity: "error", message: `${supplement.name} is missing match column configuration.` })
      continue
    }

    const masterLookup = new Map<string, typeof masterRecords>()
    const relationshipLookup = new Map<string, string>()
    for (const entry of masterRecords) {
      const key = normalizeMatchKey(getRowValue(master.table.headers, entry.row, identityColumns[supplement.matchType]))
      if (key) {
        const bucket = masterLookup.get(key) ?? []
        bucket.push(entry)
        masterLookup.set(key, bucket)
      }

      for (const idType of REQUIRED_MASTER_IDS) {
        const identityValue = normalizeMatchKey(getRowValue(master.table.headers, entry.row, identityColumns[idType]))
        const canonicalId = entry.record.id?.trim()
        if (!identityValue || !canonicalId) continue
        relationshipLookup.set(identityValue, canonicalId)
      }

      const canonicalIdKey = normalizeMatchKey(entry.record.id ?? "")
      if (canonicalIdKey && entry.record.id?.trim()) {
        relationshipLookup.set(canonicalIdKey, entry.record.id.trim())
      }
    }

    supplement.table.rows.forEach((row, rowIndex) => {
      const rawKey = getRowValue(supplement.table.headers, row, supplement.matchColumn)
      const key = normalizeMatchKey(rawKey)
      if (!key) return

      const matches = masterLookup.get(key) ?? []
      if (matches.length === 0) {
        issues.push({ severity: "warning", message: `${supplement.name} row ${rowIndex + 2} did not match any master roster row on "${supplement.matchColumn}" -> ${supplement.matchType}.` })
        return
      }

      if (matches.length > 1) {
        issues.push({ severity: "warning", message: `${supplement.name} row ${rowIndex + 2} matched multiple master roster rows for key "${key}". First match was used.` })
      }

      const target = matches[0]
      target.matchedSupplement = true
      for (const [field, column] of Object.entries(supplement.fieldMapping) as Array<[StudentCsvFieldKey, string | undefined]>) {
        const value = getRowValue(supplement.table.headers, row, column)
        if (!value) continue
        if (field === "noContactWith" || field === "preferredWith" || field === "parentPreferredWith" || field === "parentAvoidWith") {
          target.record[field] = translateRelationshipValue(
            value,
            relationshipLookup,
            `${supplement.name} row ${rowIndex + 2} ${field}`,
            issues
          )
          continue
        }
        target.record[field] = value
      }
    })
  }

  const recordsToExport = supplements.length > 0
    ? masterRecords.filter((entry) => entry.matchedSupplement)
    : masterRecords

  if (supplements.length > 0) {
    const skippedMasterRecords = masterRecords.filter((entry) => !entry.matchedSupplement)
    skippedMasterRecords.forEach((entry, index) => {
      issues.push({
        severity: "warning",
        message: `Master roster row ${entry.rowIndex + 2} did not match any supplemental file and was skipped (${index + 1} of ${skippedMasterRecords.length}).`,
      })
    })
  }

  const csvRows = recordsToExport.map((entry) =>
    canonicalHeaders.map((header) => escapeCsvCell(entry.record[header] ?? "")).join(",")
  )

  return {
    csvText: [canonicalHeaders.join(","), ...csvRows].join("\n"),
    issues,
    headers: canonicalHeaders,
  }
}
