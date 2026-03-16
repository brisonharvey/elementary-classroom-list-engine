export type CsvImportEntity = "students" | "teachers"

export type CsvValidationSeverity = "error" | "warning"

export interface CsvFieldOption<TKey extends string = string> {
  key: TKey
  label: string
  required: boolean
  description?: string
}

export interface CsvPreview {
  headers: string[]
  rows: string[][]
}

export interface CsvValidationIssue {
  severity: CsvValidationSeverity
  message: string
}
