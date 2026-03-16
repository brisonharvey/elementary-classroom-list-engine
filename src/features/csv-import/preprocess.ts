import { AutoPivotConfig, DeduplicationConfig, FlattenConfig, PreprocessConfig, RowFilterConfig } from "../../lib/csv"

export const DEFAULT_ROW_FILTER: RowFilterConfig = {
  enabled: false,
  column: "",
  type: "equals",
  value: "",
}

export const DEFAULT_DEDUPE: DeduplicationConfig = {
  enabled: false,
  column: "",
  keep: "first",
}

export const DEFAULT_PIVOT: AutoPivotConfig = {
  enabled: false,
  idColumn: "",
  labelColumns: [],
  dataColumns: [],
}

export const DEFAULT_FLATTEN: FlattenConfig = {
  enabled: false,
  idColumns: [],
  variableName: "Assessment",
  valueName: "Score",
  removePlaceholders: false,
  placeholderValues: ["-", "Absent", "–"],
}

export function createDefaultPreprocessConfig(): PreprocessConfig {
  return {
    sheetName: undefined,
    skipRows: 0,
    headerRow: 0,
    mergeGroupHeaders: false,
    groupHeaderRow: 0,
    rowFilter: { ...DEFAULT_ROW_FILTER },
    dedupe: { ...DEFAULT_DEDUPE },
    autoPivot: { ...DEFAULT_PIVOT },
    flatten: { ...DEFAULT_FLATTEN },
  }
}

export function getPreprocessDefaults(fileName: string): Pick<PreprocessConfig, "skipRows" | "headerRow" | "mergeGroupHeaders" | "groupHeaderRow"> {
  if (fileName.toLowerCase().endsWith(".xlsx")) {
    return { skipRows: 4, headerRow: 1, mergeGroupHeaders: true, groupHeaderRow: 0 }
  }

  return { skipRows: 0, headerRow: 0, mergeGroupHeaders: false, groupHeaderRow: 0 }
}
