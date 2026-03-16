import { ChangeEvent, useMemo, useState } from "react"
import { useApp } from "../../store/AppContext"
import {
  buildBlendedStudentCsv,
  buildSampleValues,
  preprocessTable,
  PreprocessConfig,
  RawSheetData,
  readSpreadsheetFile,
  StudentIdentityColumns,
  StudentMatchType,
  STUDENT_CSV_FIELD_OPTIONS,
  StudentCsvFieldKey,
  StudentCsvFieldMapping,
  parseStudentCSVWithMapping,
  suggestStudentFieldMapping,
  suggestStudentIdentityColumns,
  suggestStudentSupplementMatch,
} from "../../lib/csv"
import { CsvValidationIssue } from "../../types/csvImport"
import { Student } from "../../types"
import { createDefaultPreprocessConfig, getPreprocessDefaults } from "./preprocess"

type Step = "upload" | "configure" | "review"
type SourceKind = "master" | "supplement"

type SourceConfig = {
  id: string
  kind: SourceKind
  name: string
  rawSheets: RawSheetData[]
  preprocess: PreprocessConfig
  fieldMapping: StudentCsvFieldMapping
  matchColumn: string
  matchType?: StudentMatchType
  identityColumns: StudentIdentityColumns
}

type ReviewState = {
  studentsToImport: Student[]
  duplicateCount: number
  issues: CsvValidationIssue[]
  skipped: number
}

const MASTER_REQUIRED_FIELDS: StudentCsvFieldKey[] = ["id", "grade", "firstName", "lastName"]
const IDENTITY_TYPES: Array<{ key: StudentMatchType; label: string }> = [
  { key: "personId", label: "Person ID" },
  { key: "stateId", label: "State ID" },
  { key: "studentNumber", label: "Student ID / Number" },
]
const SUPPLEMENT_ALLOWED_FIELDS = STUDENT_CSV_FIELD_OPTIONS.filter((field) => !MASTER_REQUIRED_FIELDS.includes(field.key as StudentCsvFieldKey))
const EXACT_MAPPING = Object.fromEntries(STUDENT_CSV_FIELD_OPTIONS.map((field) => [field.key, field.key])) as StudentCsvFieldMapping

function pickAllowedMappings(mapping: StudentCsvFieldMapping, allowedFields: readonly StudentCsvFieldKey[]): StudentCsvFieldMapping {
  const allowed = new Set<StudentCsvFieldKey>(allowedFields)
  return Object.fromEntries(
    Object.entries(mapping).filter(([field, column]) => allowed.has(field as StudentCsvFieldKey) && Boolean(column))
  ) as StudentCsvFieldMapping
}

function isMasterReady(master: SourceConfig | null): boolean {
  if (!master) return false
  const requiredFieldMappingsComplete = MASTER_REQUIRED_FIELDS.every((field) => Boolean(master.fieldMapping[field]))
  const requiredIdMappingsComplete = IDENTITY_TYPES.every((identity) => Boolean(master.identityColumns[identity.key]))
  return requiredFieldMappingsComplete && requiredIdMappingsComplete
}

function isSupplementReady(source: SourceConfig): boolean {
  return Boolean(source.matchColumn) && Boolean(source.matchType)
}

function countMappedFields(mapping: StudentCsvFieldMapping): number {
  return Object.values(mapping).filter(Boolean).length
}

function countIssues(issues: CsvValidationIssue[]) {
  return issues.reduce(
    (summary, issue) => {
      summary[issue.severity] += 1
      return summary
    },
    { error: 0, warning: 0 }
  )
}

function getProcessedTable(source: SourceConfig | null) {
  if (!source) return { headers: [], rows: [] }
  const sheet = source.rawSheets.find((entry) => entry.name === source.preprocess.sheetName) ?? source.rawSheets[0]
  if (!sheet) return { headers: [], rows: [] }
  return preprocessTable(sheet.rows, source.preprocess)
}

function applyAutoSuggestions(source: SourceConfig, masterIdentityColumns?: StudentIdentityColumns): SourceConfig {
  const table = getProcessedTable(source)
  if (table.headers.length === 0) return source

  const suggestedFieldMapping = suggestStudentFieldMapping(table.headers)
  const fieldMapping =
    source.kind === "master"
      ? { ...suggestedFieldMapping, ...source.fieldMapping }
      : {
          ...pickAllowedMappings(suggestedFieldMapping, SUPPLEMENT_ALLOWED_FIELDS.map((field) => field.key as StudentCsvFieldKey)),
          ...source.fieldMapping,
        }

  if (source.kind === "master") {
    return {
      ...source,
      fieldMapping,
      identityColumns: {
        ...suggestStudentIdentityColumns(table.headers, table.rows),
        ...source.identityColumns,
      },
    }
  }

  const suggestedMatch = suggestStudentSupplementMatch(table.headers, table.rows, masterIdentityColumns)

  return {
    ...source,
    fieldMapping,
    matchColumn: source.matchColumn || suggestedMatch.matchColumn || "",
    matchType: source.matchType ?? suggestedMatch.matchType,
  }
}

export function StudentBlendImport() {
  const { state, dispatch } = useApp()
  const [step, setStep] = useState<Step>("upload")
  const [status, setStatus] = useState<{ type: "idle" | "success" | "error"; message: string }>({ type: "idle", message: "" })
  const [master, setMaster] = useState<SourceConfig | null>(null)
  const [supplements, setSupplements] = useState<SourceConfig[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [review, setReview] = useState<ReviewState | null>(null)

  const sources = useMemo(() => (master ? [master, ...supplements] : supplements), [master, supplements])
  const selectedSource = useMemo(() => sources.find((source) => source.id === selectedId) ?? master, [master, selectedId, sources])
  const selectedTable = useMemo(() => getProcessedTable(selectedSource ?? null), [selectedSource])
  const sampleValues = useMemo(() => buildSampleValues(selectedTable.headers, selectedTable.rows.slice(0, 5)), [selectedTable])
  const reviewSummary = useMemo(() => countIssues(review?.issues ?? []), [review])
  const masterReady = useMemo(() => isMasterReady(master), [master])
  const readySupplementCount = useMemo(() => supplements.filter((source) => isSupplementReady(source)).length, [supplements])

  function reset(statusMessage: { type: "idle" | "success" | "error"; message: string } = { type: "idle", message: "" }) {
    setStep("upload")
    setStatus(statusMessage)
    setMaster(null)
    setSupplements([])
    setSelectedId("")
    setReview(null)
  }

  async function loadSource(file: File, kind: SourceKind) {
    const sheets = await readSpreadsheetFile(file)
    const defaults = getPreprocessDefaults(file.name)
    const nextSource = applyAutoSuggestions({
      id: `${kind}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      kind,
      name: file.name,
      rawSheets: sheets,
      preprocess: {
        ...createDefaultPreprocessConfig(),
        ...defaults,
        sheetName: sheets[0]?.name,
      },
      fieldMapping: {},
      matchColumn: "",
      matchType: undefined,
      identityColumns: {
        personId: undefined,
        stateId: undefined,
        studentNumber: undefined,
      },
    }, master?.identityColumns)

    if (kind === "master") {
      setMaster(nextSource)
      setSelectedId(nextSource.id)
    } else {
      setSupplements((current) => [...current, nextSource])
      setSelectedId(nextSource.id)
    }

    setStatus({ type: "idle", message: "" })
    setStep("configure")
  }

  function updateSource(sourceId: string, updater: (source: SourceConfig) => SourceConfig) {
    if (master?.id === sourceId) {
      setMaster((current) => (current ? updater(current) : current))
      return
    }

    setSupplements((current) => current.map((source) => (source.id === sourceId ? updater(source) : source)))
  }

  function updateSourceWithAuto(sourceId: string, updater: (source: SourceConfig) => SourceConfig) {
    if (master?.id === sourceId) {
      setMaster((current) => (current ? applyAutoSuggestions(updater(current), current.identityColumns) : current))
      return
    }

    setSupplements((current) =>
      current.map((source) => (source.id === sourceId ? applyAutoSuggestions(updater(source), master?.identityColumns) : source))
    )
  }

  function removeSupplement(sourceId: string) {
    setSupplements((current) => current.filter((source) => source.id !== sourceId))
    if (selectedId === sourceId) setSelectedId(master?.id ?? "")
  }

  function buildReview() {
    if (!master) {
      setStatus({ type: "error", message: "Upload and configure a master roster first." })
      return
    }

    const masterTable = getProcessedTable(master)
    if (masterTable.headers.length === 0 || masterTable.rows.length === 0) {
      setStatus({ type: "error", message: "The master roster preprocessing settings produced no rows." })
      return
    }

    const blend = buildBlendedStudentCsv(
      { ...master, table: masterTable, masterIdColumns: master.identityColumns },
      supplements.map((source) => ({ ...source, table: getProcessedTable(source) }))
    )

    const parsed = parseStudentCSVWithMapping(blend.csvText, EXACT_MAPPING)
    const existingIds = new Set(state.allStudents.map((student) => student.id))
    const studentsToImport = parsed.students.filter((student) => !existingIds.has(student.id))

    setReview({
      studentsToImport,
      duplicateCount: parsed.students.length - studentsToImport.length,
      issues: [...blend.issues, ...parsed.issues],
      skipped: parsed.skipped,
    })
    setStep("review")
  }

  function confirmImport() {
    if (!review || review.studentsToImport.length === 0) {
      setStatus({ type: "error", message: "No blended students are ready to import." })
      return
    }

    dispatch({ type: "LOAD_STUDENTS", payload: review.studentsToImport })
    reset({
      type: "success",
      message: `Imported ${review.studentsToImport.length} student${review.studentsToImport.length === 1 ? "" : "s"} from the blended roster.${review.duplicateCount > 0 ? ` ${review.duplicateCount} duplicate ID${review.duplicateCount === 1 ? " was" : "s were"} ignored.` : ""}`,
    })
  }

  return (
    <div className="csv-import-stack">
      <div className="csv-import-section">
        <div className="csv-import-section-header">
          <div>
            <strong>Student Blend Import</strong>
            <p>Start with one master roster that contains all three ID types. Then add supporting files and tell the app which ID type each file uses.</p>
          </div>
        </div>

        <div className="csv-import-guide">
          <strong>Recommended order</strong>
          <ol className="csv-import-guide-list">
            <li>Upload the master roster and map the core student columns plus all three ID columns.</li>
            <li>Add one supplemental file at a time.</li>
            <li>For each supplemental file, choose the file’s match column and which ID type it should use.</li>
            <li>Map only the extra fields that file contributes, then review the blended result.</li>
          </ol>
        </div>

        {step === "upload" && (
          <div className="csv-import-actions">
            <label className="btn btn-primary btn-sm">
              Upload master roster
              <input
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                hidden
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  const file = event.target.files?.[0]
                  if (file) void loadSource(file, "master")
                  event.target.value = ""
                }}
              />
            </label>
          </div>
        )}

        {master && (
          <>
            <div className="csv-import-progress-grid">
              <div className={`csv-import-progress-card ${masterReady ? "complete" : ""}`}>
                <span className="csv-import-progress-label">Master roster</span>
                <strong>{masterReady ? "Ready" : "Needs setup"}</strong>
                <span>Required student fields and all three ID columns must be mapped.</span>
              </div>
              <div className={`csv-import-progress-card ${supplements.length > 0 && readySupplementCount === supplements.length ? "complete" : ""}`}>
                <span className="csv-import-progress-label">Supplemental files</span>
                <strong>{supplements.length === 0 ? "None yet" : `${readySupplementCount}/${supplements.length} ready`}</strong>
                <span>Each file needs a source match column, ID type, and any extra field mappings.</span>
              </div>
              <div className={`csv-import-progress-card ${review != null ? "complete" : ""}`}>
                <span className="csv-import-progress-label">Review</span>
                <strong>{review ? "Built" : "Not started"}</strong>
                <span>Blend everything together, inspect warnings, then confirm import.</span>
              </div>
            </div>

            <div className="csv-import-source-list">
              <button className={`csv-import-source-chip ${selectedId === master.id ? "active" : ""}`} onClick={() => setSelectedId(master.id)}>
                Master: {master.name} {masterReady ? "• Ready" : "• Setup needed"}
              </button>
              {supplements.map((source) => (
                <button key={source.id} className={`csv-import-source-chip ${selectedId === source.id ? "active" : ""}`} onClick={() => setSelectedId(source.id)}>
                  {source.name} {isSupplementReady(source) ? "• Ready" : "• Setup needed"}
                </button>
              ))}
              <label className="btn btn-ghost btn-sm">
                Add supplemental file
                <input
                  type="file"
                  accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  hidden
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    const file = event.target.files?.[0]
                    if (file) void loadSource(file, "supplement")
                    event.target.value = ""
                  }}
                />
              </label>
            </div>

            {selectedSource && (
              <div className="csv-import-card">
                <div className="csv-import-card-header">
                  <strong>{selectedSource.kind === "master" ? "Master roster" : "Supplemental file"}: {selectedSource.name}</strong>
                  {selectedSource.kind === "supplement" && <button className="btn btn-ghost btn-sm" onClick={() => removeSupplement(selectedSource.id)}>Remove</button>}
                </div>

                <div className="csv-import-note">
                  {selectedSource.kind === "master"
                    ? "This file is the hub for student identity. It should include Person ID, State ID, Student ID / Number, and the core student roster fields."
                    : "This file is a spoke. Choose which column identifies the student in this file, then choose which master-roster ID type it matches."}
                </div>

                {selectedSource.rawSheets.length > 1 && (
                  <label className="csv-import-field">
                    <span>Sheet</span>
                    <select value={selectedSource.preprocess.sheetName} onChange={(event) => updateSourceWithAuto(selectedSource.id, (source) => ({ ...source, preprocess: { ...source.preprocess, sheetName: event.target.value } }))}>
                      {selectedSource.rawSheets.map((sheet) => (
                        <option key={sheet.name} value={sheet.name}>{sheet.name}</option>
                      ))}
                    </select>
                  </label>
                )}

                <div className="csv-import-settings-grid">
                  <label className="csv-import-field">
                    <span>Skip rows</span>
                    <input type="number" min={0} value={selectedSource.preprocess.skipRows} onChange={(event) => updateSourceWithAuto(selectedSource.id, (source) => ({ ...source, preprocess: { ...source.preprocess, skipRows: Number(event.target.value) || 0 } }))} />
                  </label>
                  <label className="csv-import-field">
                    <span>Header row</span>
                    <input type="number" min={0} value={selectedSource.preprocess.headerRow} onChange={(event) => updateSourceWithAuto(selectedSource.id, (source) => ({ ...source, preprocess: { ...source.preprocess, headerRow: Number(event.target.value) || 0 } }))} />
                  </label>
                  <label className="csv-import-check">
                    <input type="checkbox" checked={selectedSource.preprocess.mergeGroupHeaders} onChange={(event) => updateSourceWithAuto(selectedSource.id, (source) => ({ ...source, preprocess: { ...source.preprocess, mergeGroupHeaders: event.target.checked } }))} />
                    <span>Merge group headers</span>
                  </label>
                  {selectedSource.preprocess.mergeGroupHeaders && (
                    <label className="csv-import-field">
                      <span>Group header row</span>
                      <input type="number" min={0} value={selectedSource.preprocess.groupHeaderRow} onChange={(event) => updateSourceWithAuto(selectedSource.id, (source) => ({ ...source, preprocess: { ...source.preprocess, groupHeaderRow: Number(event.target.value) || 0 } }))} />
                    </label>
                  )}
                </div>

                {selectedSource.kind === "master" && (
                  <>
                    <div className="csv-import-settings-grid">
                      {IDENTITY_TYPES.map((identity) => (
                        <label key={identity.key} className="csv-import-field">
                          <span>{identity.label}</span>
                          <select
                            value={selectedSource.identityColumns[identity.key] ?? ""}
                            onChange={(event) => updateSource(selectedSource.id, (source) => ({
                              ...source,
                              identityColumns: {
                                ...source.identityColumns,
                                [identity.key]: event.target.value || undefined,
                              },
                            }))}
                          >
                            <option value="">Select column</option>
                            {selectedTable.headers.map((header) => (
                              <option key={`${identity.key}-${header}`} value={header}>{header}</option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                    <div className="csv-import-note">
                      Progress: {IDENTITY_TYPES.filter((identity) => selectedSource.identityColumns[identity.key]).length}/3 ID types mapped. You need all 3.
                    </div>
                    <div className="csv-import-note">
                      Auto-detect is trying to match likely Person ID, State ID, and Student ID / Number columns for you. Review these carefully before blending.
                    </div>
                  </>
                )}

                {selectedSource.kind === "supplement" && (
                  <>
                    <div className="csv-import-settings-grid">
                      <label className="csv-import-field">
                        <span>Source match column</span>
                        <select value={selectedSource.matchColumn} onChange={(event) => updateSource(selectedSource.id, (source) => ({ ...source, matchColumn: event.target.value }))}>
                          <option value="">Select column</option>
                          {selectedTable.headers.map((header) => (
                            <option key={header} value={header}>{header}</option>
                          ))}
                        </select>
                      </label>
                      <label className="csv-import-field">
                        <span>Match against master by</span>
                        <select value={selectedSource.matchType ?? ""} onChange={(event) => updateSource(selectedSource.id, (source) => ({ ...source, matchType: (event.target.value || undefined) as StudentMatchType | undefined }))}>
                          <option value="">Select ID type</option>
                          {IDENTITY_TYPES.map((identity) => (
                            <option key={identity.key} value={identity.key}>{identity.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="csv-import-note">
                      Auto-detect will try to pick the most likely join column from this file. If it guessed wrong, just correct it before review.
                    </div>
                  </>
                )}

                {selectedSource.kind === "supplement" && selectedSource.matchType && (
                  <div className="csv-import-note">
                    Match rule: use this file’s <strong>{selectedSource.matchColumn || "selected source column"}</strong> to find the same student by <strong>{IDENTITY_TYPES.find((identity) => identity.key === selectedSource.matchType)?.label}</strong> in the master roster.
                  </div>
                )}

                <div className="csv-import-note">
                  Mapping progress: {countMappedFields(selectedSource.fieldMapping)} field{countMappedFields(selectedSource.fieldMapping) === 1 ? "" : "s"} mapped.
                  {selectedSource.kind === "master" ? " The four required student fields must be mapped before blending." : " Map only the extra fields this file contributes. The importer will try to pre-fill likely matches first."}
                </div>

                <div className="csv-import-mapping-grid">
                  {(selectedSource.kind === "master" ? STUDENT_CSV_FIELD_OPTIONS : SUPPLEMENT_ALLOWED_FIELDS).map((field) => {
                    const currentHeader = selectedSource.fieldMapping[field.key as StudentCsvFieldKey]
                    return (
                      <label key={field.key} className="csv-import-mapping-row">
                        <span className="csv-import-mapping-label">
                          {field.label}
                          {selectedSource.kind === "master" && MASTER_REQUIRED_FIELDS.includes(field.key as StudentCsvFieldKey) ? <span className="csv-import-required"> *</span> : null}
                        </span>
                        <select
                          value={currentHeader ?? ""}
                          onChange={(event) =>
                            updateSource(selectedSource.id, (source) => ({
                              ...source,
                              fieldMapping: { ...source.fieldMapping, [field.key]: event.target.value || undefined },
                            }))
                          }
                        >
                          <option value="">Not mapped</option>
                          {selectedTable.headers.map((header) => (
                            <option key={`${field.key}-${header}`} value={header}>{header}</option>
                          ))}
                        </select>
                        <span className="csv-import-sample">{currentHeader ? `e.g. ${sampleValues[currentHeader] ?? ""}` : "Optional"}</span>
                      </label>
                    )
                  })}
                </div>

                <div className="csv-import-preview-table-wrap">
                  <table className="csv-import-preview-table">
                    <thead>
                      <tr>
                        {selectedTable.headers.map((header) => (
                          <th key={header}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTable.rows.slice(0, 5).map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {selectedTable.headers.map((header, columnIndex) => (
                            <td key={`${header}-${rowIndex}`}>{row[columnIndex] ?? ""}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="csv-import-footer">
              <button className="btn btn-primary btn-sm" onClick={buildReview} disabled={!masterReady}>
                Blend and review
              </button>
            </div>
          </>
        )}
      </div>

      {step === "review" && review && (
        <div className="csv-import-section csv-import-review">
          <div className="csv-import-review-summary">
            <div className="csv-import-review-card">
              <span className="csv-import-review-label">Ready to import</span>
              <strong>{review.studentsToImport.length}</strong>
            </div>
            <div className="csv-import-review-card">
              <span className="csv-import-review-label">Warnings</span>
              <strong>{reviewSummary.warning}</strong>
            </div>
            <div className="csv-import-review-card">
              <span className="csv-import-review-label">Errors</span>
              <strong>{reviewSummary.error}</strong>
            </div>
            <div className="csv-import-review-card">
              <span className="csv-import-review-label">Skipped</span>
              <strong>{review.skipped}</strong>
            </div>
          </div>

          <div className="csv-import-review-grid">
            <div className="csv-import-review-panel">
              <div className="csv-import-section-header">
                <div>
                  <strong>Blend / validation notes</strong>
                  <p>These include unmatched supplemental rows plus canonical student validation results.</p>
                </div>
              </div>
              <ul className="csv-import-issue-list">
                {review.issues.map((issue, index) => (
                  <li key={`${issue.severity}-${index}`} className={`csv-import-issue csv-import-issue-${issue.severity}`}>
                    <span className="csv-import-issue-pill">{issue.severity}</span>
                    <span>{issue.message}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="csv-import-review-panel">
              <div className="csv-import-section-header">
                <div>
                  <strong>Preview</strong>
                  <p>Showing the first blended students that will be imported.</p>
                </div>
              </div>
              <div className="csv-import-preview-table-wrap">
                <table className="csv-import-preview-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Grade</th>
                      <th>Name</th>
                      <th>Status</th>
                      <th>Teacher</th>
                    </tr>
                  </thead>
                  <tbody>
                    {review.studentsToImport.slice(0, 8).map((student) => (
                      <tr key={student.id}>
                        <td>{student.id}</td>
                        <td>{student.grade}</td>
                        <td>{student.firstName} {student.lastName}</td>
                        <td>{student.specialEd.status}</td>
                        <td>{student.preassignedTeacher ?? "Unassigned"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="csv-import-footer">
            <button className="btn btn-ghost btn-sm" onClick={() => setStep("configure")}>Back to sources</button>
            <button className="btn btn-primary btn-sm" onClick={confirmImport} disabled={review.studentsToImport.length === 0}>Confirm import</button>
          </div>
        </div>
      )}

      {status.type !== "idle" ? <div className={`csv-import-status status-${status.type}`}>{status.message}</div> : null}
    </div>
  )
}
