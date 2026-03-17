import * as XLSX from "xlsx"

export interface RawSheetData {
  name: string
  rows: string[][]
}

export interface RowFilterConfig {
  enabled: boolean
  column: string
  type: "equals" | "notEmpty" | "contains"
  value: string
}

export interface DeduplicationConfig {
  enabled: boolean
  column: string
  keep: "first" | "last"
}

export interface AutoPivotConfig {
  enabled: boolean
  idColumn: string
  labelColumns: string[]
  dataColumns: string[]
}

export interface FlattenConfig {
  enabled: boolean
  idColumns: string[]
  variableName: string
  valueName: string
  removePlaceholders: boolean
  placeholderValues: string[]
}

export interface PreprocessConfig {
  sheetName?: string
  skipRows: number
  headerRow: number
  mergeGroupHeaders: boolean
  groupHeaderRow: number
  rowFilter: RowFilterConfig
  dedupe: DeduplicationConfig
  autoPivot: AutoPivotConfig
  flatten: FlattenConfig
}

export interface TableData {
  headers: string[]
  rows: string[][]
}

function parseCsvText(text: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ""
  let inQuotes = false

  for (let index = 0; index < text.length; index++) {
    const character = text[index]
    const nextCharacter = text[index + 1]

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentCell += '"'
        index++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (character === "," && !inQuotes) {
      currentRow.push(currentCell)
      currentCell = ""
      continue
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") index++
      currentRow.push(currentCell)
      rows.push(currentRow.map(stringifyCell))
      currentRow = []
      currentCell = ""
      continue
    }

    currentCell += character
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell)
    rows.push(currentRow.map(stringifyCell))
  }

  return rows.filter((row) => row.some((cell) => cell !== ""))
}

function stringifyCell(value: unknown): string {
  if (value == null) return ""
  return String(value).trim()
}

function padRows(rows: string[][]): string[][] {
  const maxLen = rows.reduce((max, row) => Math.max(max, row.length), 0)
  return rows.map((row) => row.concat(Array.from({ length: maxLen - row.length }, () => "")))
}

export async function readSpreadsheetFile(file: File): Promise<RawSheetData[]> {
  if (file.name.toLowerCase().endsWith(".xlsx")) {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: "array" })

    return workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name]
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as unknown[][]
      return {
        name,
        rows: rows.map((row) => row.map(stringifyCell)),
      }
    })
  }

  const text = await file.text()
  return [
    {
      name: "Sheet1",
      rows: parseCsvText(text),
    },
  ]
}

function sanitizeHeader(value: string, index: number): string {
  const trimmed = stringifyCell(value)
  return trimmed || `col_${index}`
}

export function buildTableFromRawRows(rawRows: string[][], config: Pick<PreprocessConfig, "skipRows" | "headerRow" | "mergeGroupHeaders" | "groupHeaderRow">): TableData {
  const rows = padRows(rawRows.slice(config.skipRows))
  if (rows.length === 0 || config.headerRow >= rows.length) {
    return { headers: [], rows: [] }
  }

  const headerSource = rows[config.headerRow] ?? []
  let headers = headerSource.map(sanitizeHeader)
  let dataStart = config.headerRow + 1

  if (config.mergeGroupHeaders && config.groupHeaderRow < rows.length && config.groupHeaderRow !== config.headerRow) {
    const groupSource = rows[config.groupHeaderRow] ?? []
    const filledGroups: string[] = []
    let current = ""

    headers = headers.map((header, index) => {
      const group = stringifyCell(groupSource[index] ?? "")
      if (group) current = group
      filledGroups[index] = current
      return current && header !== `col_${index}` ? `${current} | ${header}` : header
    })

    dataStart = Math.max(config.headerRow, config.groupHeaderRow) + 1
  }

  const dataRows = rows.slice(dataStart).filter((row) => row.some((cell) => stringifyCell(cell) !== ""))
  return { headers, rows: dataRows }
}

function columnIndex(headers: string[], column: string): number {
  return headers.indexOf(column)
}

export function applyRowFilter(table: TableData, config: RowFilterConfig): TableData {
  if (!config.enabled || !config.column) return table
  const index = columnIndex(table.headers, config.column)
  if (index < 0) return table

  const rows = table.rows.filter((row) => {
    const value = stringifyCell(row[index] ?? "")
    if (config.type === "notEmpty") return value !== ""
    if (config.type === "contains") return config.value ? value.toLowerCase().includes(config.value.toLowerCase()) : true
    return config.value === "" ? true : value === config.value
  })

  return { ...table, rows }
}

export function applyDeduplication(table: TableData, config: DeduplicationConfig): TableData {
  if (!config.enabled || !config.column) return table
  const index = columnIndex(table.headers, config.column)
  if (index < 0) return table

  const rows = config.keep === "last" ? [...table.rows].reverse() : [...table.rows]
  const seen = new Set<string>()
  const deduped: string[][] = []

  for (const row of rows) {
    const key = stringifyCell(row[index] ?? "")
    if (!key || seen.has(key)) continue
    seen.add(key)
    deduped.push(row)
  }

  return { ...table, rows: config.keep === "last" ? deduped.reverse() : deduped }
}

export function getPivotColumnSuggestions(table: TableData, idColumn: string, labelColumns: string[]): { constantColumns: string[]; variableColumns: string[] } {
  const idIndex = columnIndex(table.headers, idColumn)
  const labelIndexes = labelColumns.map((column) => columnIndex(table.headers, column)).filter((index) => index >= 0)
  if (idIndex < 0 || labelIndexes.length === 0) {
    return { constantColumns: [], variableColumns: table.headers.filter((header) => header !== idColumn && !labelColumns.includes(header)) }
  }

  const excluded = new Set([idColumn, ...labelColumns])
  const candidateHeaders = table.headers.filter((header) => !excluded.has(header))
  const rowsById = new Map<string, string[][]>()

  for (const row of table.rows) {
    const idValue = stringifyCell(row[idIndex] ?? "")
    if (!idValue) continue
    const bucket = rowsById.get(idValue) ?? []
    bucket.push(row)
    rowsById.set(idValue, bucket)
  }

  const constantColumns: string[] = []
  const variableColumns: string[] = []

  for (const header of candidateHeaders) {
    const index = columnIndex(table.headers, header)
    let hasData = false
    let varies = false

    for (const rows of rowsById.values()) {
      const values = Array.from(new Set(rows.map((row) => stringifyCell(row[index] ?? "")).filter(Boolean)))
      if (values.length > 0) hasData = true
      if (values.length > 1) {
        varies = true
        break
      }
    }

    if (!hasData) continue
    if (varies) variableColumns.push(header)
    else constantColumns.push(header)
  }

  return { constantColumns, variableColumns }
}

export function applyAutoPivot(table: TableData, config: AutoPivotConfig): TableData {
  if (!config.enabled || !config.idColumn || config.labelColumns.length === 0 || config.dataColumns.length === 0) return table

  const idIndex = columnIndex(table.headers, config.idColumn)
  const labelIndexes = config.labelColumns.map((column) => columnIndex(table.headers, column))
  const dataIndexes = config.dataColumns.map((column) => columnIndex(table.headers, column))
  if (idIndex < 0 || labelIndexes.some((index) => index < 0) || dataIndexes.some((index) => index < 0)) return table

  const { constantColumns } = getPivotColumnSuggestions(table, config.idColumn, config.labelColumns)
  const constantIndexes = constantColumns.map((column) => columnIndex(table.headers, column))
  const byId = new Map<string, Record<string, string>>()

  for (const row of table.rows) {
    const idValue = stringifyCell(row[idIndex] ?? "")
    if (!idValue) continue

    const label = labelIndexes.map((index) => stringifyCell(row[index] ?? "")).filter(Boolean).join(" | ")
    const entry = byId.get(idValue) ?? { [config.idColumn]: idValue }

    constantIndexes.forEach((index, position) => {
      const header = constantColumns[position]
      if (!(header in entry)) entry[header] = stringifyCell(row[index] ?? "")
    })

    dataIndexes.forEach((index, position) => {
      const dataHeader = config.dataColumns[position]
      const value = stringifyCell(row[index] ?? "")
      if (!value) return
      const nextHeader = label ? `${label} | ${dataHeader}` : dataHeader
      if (!(nextHeader in entry)) entry[nextHeader] = value
    })

    byId.set(idValue, entry)
  }

  const headers = [config.idColumn, ...constantColumns]
  const dynamicHeaders = Array.from(
    new Set(
      Array.from(byId.values()).flatMap((entry) =>
        Object.keys(entry).filter((header) => !headers.includes(header))
      )
    )
  )

  const allHeaders = [...headers, ...dynamicHeaders]
  const rows = Array.from(byId.values()).map((entry) => allHeaders.map((header) => entry[header] ?? ""))
  return { headers: allHeaders, rows }
}

export function applyFlatten(table: TableData, config: FlattenConfig): TableData {
  if (!config.enabled || config.idColumns.length === 0) return table

  const idIndexes = config.idColumns.map((column) => columnIndex(table.headers, column)).filter((index) => index >= 0)
  const idSet = new Set(config.idColumns)
  const valueColumns = table.headers.filter((header) => !idSet.has(header))
  const valueIndexes = valueColumns.map((column) => columnIndex(table.headers, column))

  const rows: string[][] = []
  for (const row of table.rows) {
    const idValues = idIndexes.map((index) => stringifyCell(row[index] ?? ""))

    valueIndexes.forEach((index, position) => {
      const value = stringifyCell(row[index] ?? "")
      const isPlaceholder = config.removePlaceholders && (value === "" || config.placeholderValues.includes(value))
      if (isPlaceholder) return
      rows.push([...idValues, valueColumns[position], value])
    })
  }

  return {
    headers: [...config.idColumns, config.variableName || "Variable", config.valueName || "Value"],
    rows,
  }
}

export function preprocessTable(rawRows: string[][], config: PreprocessConfig): TableData {
  let table = buildTableFromRawRows(rawRows, config)
  table = applyRowFilter(table, config.rowFilter)
  table = applyDeduplication(table, config.dedupe)
  table = applyAutoPivot(table, config.autoPivot)
  table = applyFlatten(table, config.flatten)
  return table
}

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function tableToCsv(table: TableData): string {
  return [table.headers, ...table.rows].map((row) => row.map((cell) => escapeCsvCell(stringifyCell(cell))).join(",")).join("\n")
}
