import { CsvFieldOption, CsvPreview } from "../../types/csvImport"

export function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let index = 0; index < line.length; index++) {
    const character = line[index]
    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index++
      } else {
        inQuotes = !inQuotes
      }
    } else if (character === "," && !inQuotes) {
      result.push(current)
      current = ""
    } else {
      current += character
    }
  }

  result.push(current)
  return result
}

export function parseCSVPreview(text: string): CsvPreview {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) {
    return { headers: [], rows: [] }
  }

  const headers = parseCSVLine(lines[0]).map((header) => header.trim())
  const rows = lines.slice(1).map(parseCSVLine)
  return { headers, rows }
}

export function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
}

function tokenizeHeader(value: string): string[] {
  const normalized = value
    .replace(/^\uFEFF/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

  return normalized ? normalized.split(/\s+/).filter(Boolean) : []
}

export function scoreHeaderAliasMatch(header: string, alias: string): number {
  const normalizedHeader = normalizeHeader(header)
  const normalizedAlias = normalizeHeader(alias)
  if (!normalizedHeader || !normalizedAlias) return 0
  if (normalizedHeader === normalizedAlias) return 100

  const headerTokens = tokenizeHeader(header)
  const aliasTokens = tokenizeHeader(alias)
  const aliasTokenSet = new Set(aliasTokens)
  const headerTokenSet = new Set(headerTokens)

  if (aliasTokens.length > 0 && aliasTokens.every((token) => headerTokenSet.has(token))) {
    return 88 + Math.min(aliasTokens.length, 4)
  }

  if (normalizedAlias.length >= 6 && (normalizedHeader.includes(normalizedAlias) || normalizedAlias.includes(normalizedHeader))) {
    return 82
  }

  if (aliasTokenSet.size > 0) {
    let overlap = 0
    for (const token of aliasTokenSet) {
      if (headerTokenSet.has(token)) overlap += 1
    }

    if (overlap > 0) {
      const coverage = overlap / aliasTokenSet.size
      if (coverage >= 0.75 && aliasTokenSet.size >= 2) return 76
      if (coverage >= 0.5 && aliasTokenSet.size >= 2) return 70
    }
  }

  return 0
}

export function suggestBestHeader(headers: string[], aliases: string[]): { header?: string; score: number } {
  let bestHeader: string | undefined
  let bestScore = 0

  for (const header of headers) {
    const score = aliases.reduce((max, alias) => Math.max(max, scoreHeaderAliasMatch(header, alias)), 0)
    if (score > bestScore) {
      bestScore = score
      bestHeader = header
    }
  }

  return {
    header: bestHeader,
    score: bestScore,
  }
}

export function suggestFieldMapping<TFieldKey extends string>(
  headers: string[],
  fieldOptions: readonly (CsvFieldOption<TFieldKey> & { key: TFieldKey })[],
  fieldAliases: Record<TFieldKey, string[]>
): Partial<Record<TFieldKey, string>> {
  const mapping: Partial<Record<TFieldKey, string>> = {}
  const usedHeaders = new Set<number>()

  for (const field of fieldOptions) {
    const aliases = fieldAliases[field.key] ?? []
    let bestIndex = -1
    let bestScore = 0

    headers.forEach((header, index) => {
      if (usedHeaders.has(index)) return
      const score = aliases.reduce((max, alias) => Math.max(max, scoreHeaderAliasMatch(header, alias)), 0)
      if (score > bestScore) {
        bestScore = score
        bestIndex = index
      }
    })

    if (bestIndex >= 0 && bestScore >= 82) {
      mapping[field.key] = headers[bestIndex]
      usedHeaders.add(bestIndex)
    }
  }

  return mapping
}

export function buildSampleValues(headers: string[], rows: string[][]): Record<string, string> {
  const samples: Record<string, string> = {}

  headers.forEach((header, index) => {
    for (const row of rows) {
      const value = (row[index] ?? "").trim()
      if (!value) continue
      samples[header] = value.length > 24 ? `${value.slice(0, 21)}...` : value
      break
    }
  })

  return samples
}
