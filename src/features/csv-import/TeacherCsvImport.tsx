import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react"
import { useApp } from "../../store/AppContext"
import { downloadFile } from "../../utils/exportUtils"
import {
  buildSampleValues,
  generateTeacherSampleCSV,
  generateTeacherTemplateCSV,
  parseTeacherCSVWithMapping,
  preprocessTable,
  readSpreadsheetFile,
  RawSheetData,
  tableToCsv,
  TEACHER_CSV_FIELD_OPTIONS,
  TeacherCsvFieldMapping,
  suggestTeacherFieldMapping,
} from "../../lib/csv"
import { CsvValidationIssue } from "../../types/csvImport"
import { TeacherProfile } from "../../types"
import { createDefaultPreprocessConfig, getPreprocessDefaults } from "./preprocess"

type Step = "upload" | "preprocess" | "mapping" | "review"

export function TeacherCsvImport() {
  const { dispatch } = useApp()
  const inputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>("upload")
  const [status, setStatus] = useState<{ type: "idle" | "success" | "error"; message: string }>({ type: "idle", message: "" })
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState("")
  const [rawSheets, setRawSheets] = useState<RawSheetData[]>([])
  const [preprocess, setPreprocess] = useState(createDefaultPreprocessConfig())
  const [mapping, setMapping] = useState<Record<string, string | undefined>>({})
  const [review, setReview] = useState<{ teachers: TeacherProfile[]; issues: CsvValidationIssue[]; skipped: number } | null>(null)

  const activeSheet = useMemo(() => rawSheets.find((sheet) => sheet.name === preprocess.sheetName) ?? rawSheets[0] ?? null, [preprocess.sheetName, rawSheets])
  const table = useMemo(() => (activeSheet ? preprocessTable(activeSheet.rows, preprocess) : { headers: [], rows: [] }), [activeSheet, preprocess])
  const sampleValues = useMemo(() => buildSampleValues(table.headers, table.rows.slice(0, 5)), [table.headers, table.rows])

  useEffect(() => {
    if (table.headers.length === 0) return
    setMapping((current) => (Object.keys(current).length > 0 ? current : suggestTeacherFieldMapping(table.headers)))
  }, [table.headers])

  async function handleFile(file: File) {
    try {
      const sheets = await readSpreadsheetFile(file)
      const defaults = getPreprocessDefaults(file.name)
      setFileName(file.name)
      setRawSheets(sheets)
      setPreprocess({
        ...createDefaultPreprocessConfig(),
        ...defaults,
        sheetName: sheets[0]?.name,
      })
      setMapping({})
      setReview(null)
      setStatus({ type: "idle", message: "" })
      setStep("preprocess")
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Unable to read the selected file." })
    }
  }

  function buildReview() {
    const result = parseTeacherCSVWithMapping(tableToCsv(table), mapping as TeacherCsvFieldMapping)
    setReview({ teachers: result.teachers, issues: result.issues, skipped: result.skipped })
    setStep("review")
  }

  function confirmImport() {
    if (!review || review.teachers.length === 0) {
      setStatus({ type: "error", message: "No teacher profiles are ready to import." })
      return
    }

    dispatch({ type: "LOAD_TEACHERS", payload: review.teachers })
    setStep("upload")
    setStatus({ type: "success", message: `Imported ${review.teachers.length} teacher profile${review.teachers.length === 1 ? "" : "s"}.` })
    setFileName("")
    setRawSheets([])
    setPreprocess(createDefaultPreprocessConfig())
    setMapping({})
    setReview(null)
  }

  return (
    <div className="csv-import-stack">
      <div className="csv-import-steps">
        <span className={`csv-import-step ${step === "upload" ? "active" : ""}`}>1. Upload</span>
        <span className={`csv-import-step ${step === "preprocess" ? "active" : ""}`}>2. Preprocess</span>
        <span className={`csv-import-step ${step === "mapping" ? "active" : ""}`}>3. Map</span>
        <span className={`csv-import-step ${step === "review" ? "active" : ""}`}>4. Review</span>
      </div>

      {step === "upload" && (
        <div className="csv-import-section">
          <div
            className={`csv-import-drop-zone ${dragging ? "dragging" : ""}`}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              const file = event.dataTransfer.files?.[0]
              if (file) void handleFile(file)
            }}
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
          >
            <strong>Drop a teacher CSV or XLSX here</strong>
            <span>Preprocess, map the teacher columns, then import into the app.</span>
          </div>
          <input ref={inputRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={(event: ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0]
            if (file) void handleFile(file)
            event.target.value = ""
          }} />
          <div className="csv-import-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => downloadFile(generateTeacherTemplateCSV(), "teacher-import-template.csv")}>Template CSV</button>
            <button className="btn btn-ghost btn-sm" onClick={() => downloadFile(generateTeacherSampleCSV(), "sample-teachers.csv")}>Sample CSV</button>
          </div>
        </div>
      )}

      {step === "preprocess" && (
        <div className="csv-import-section">
          <div className="csv-import-section-header">
            <div>
              <strong>{fileName}</strong>
              <p>Adjust the sheet structure before mapping teacher fields.</p>
            </div>
          </div>
          <div className="csv-import-settings-grid">
            <label className="csv-import-field">
              <span>Skip rows</span>
              <input type="number" min={0} value={preprocess.skipRows} onChange={(event) => setPreprocess((current) => ({ ...current, skipRows: Number(event.target.value) || 0 }))} />
            </label>
            <label className="csv-import-field">
              <span>Header row</span>
              <input type="number" min={0} value={preprocess.headerRow} onChange={(event) => setPreprocess((current) => ({ ...current, headerRow: Number(event.target.value) || 0 }))} />
            </label>
          </div>
          <div className="csv-import-preview-table-wrap">
            <table className="csv-import-preview-table">
              <thead>
                <tr>
                  {table.headers.map((header) => (
                    <th key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.slice(0, 5).map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {table.headers.map((header, columnIndex) => (
                      <td key={`${header}-${rowIndex}`}>{row[columnIndex] ?? ""}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="csv-import-footer">
            <button className="btn btn-ghost btn-sm" onClick={() => setStep("upload")}>Back</button>
            <button className="btn btn-primary btn-sm" onClick={() => setStep("mapping")}>Use this table</button>
          </div>
        </div>
      )}

      {step === "mapping" && (
        <div className="csv-import-section">
          <div className="csv-import-mapping-grid">
            {TEACHER_CSV_FIELD_OPTIONS.map((field) => (
              <label key={field.key} className="csv-import-mapping-row">
                <span className="csv-import-mapping-label">{field.label}{field.required ? <span className="csv-import-required"> *</span> : null}</span>
                <select value={mapping[field.key] ?? ""} onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value || undefined }))}>
                  <option value="">Not mapped</option>
                  {table.headers.map((header) => (
                    <option key={`${field.key}-${header}`} value={header}>{header}</option>
                  ))}
                </select>
                <span className="csv-import-sample">{mapping[field.key] ? `e.g. ${sampleValues[mapping[field.key]!] ?? ""}` : "Required where marked"}</span>
              </label>
            ))}
          </div>
          <div className="csv-import-footer">
            <button className="btn btn-ghost btn-sm" onClick={() => setStep("preprocess")}>Back</button>
            <button className="btn btn-primary btn-sm" onClick={buildReview} disabled={!TEACHER_CSV_FIELD_OPTIONS.filter((field) => field.required).every((field) => mapping[field.key])}>Review import</button>
          </div>
        </div>
      )}

      {step === "review" && review && (
        <div className="csv-import-section">
          <div className="csv-import-review-summary">
            <div className="csv-import-review-card"><span className="csv-import-review-label">Teachers</span><strong>{review.teachers.length}</strong></div>
            <div className="csv-import-review-card"><span className="csv-import-review-label">Warnings</span><strong>{review.issues.filter((issue) => issue.severity === "warning").length}</strong></div>
            <div className="csv-import-review-card"><span className="csv-import-review-label">Errors</span><strong>{review.issues.filter((issue) => issue.severity === "error").length}</strong></div>
            <div className="csv-import-review-card"><span className="csv-import-review-label">Skipped</span><strong>{review.skipped}</strong></div>
          </div>
          <div className="csv-import-preview-table-wrap">
            <table className="csv-import-preview-table">
              <thead>
                <tr>
                  <th>Grade</th>
                  <th>Teacher</th>
                  <th>Structure</th>
                  <th>Reg/Behavior</th>
                  <th>Social/Emotional</th>
                  <th>Instructional</th>
                </tr>
              </thead>
              <tbody>
                {review.teachers.slice(0, 8).map((teacher) => (
                  <tr key={teacher.id}>
                    <td>{teacher.grade}</td>
                    <td>{teacher.teacherName}</td>
                    <td>{teacher.characteristics.structure}</td>
                    <td>{teacher.characteristics.regulationBehaviorSupport}</td>
                    <td>{teacher.characteristics.socialEmotionalSupport}</td>
                    <td>{teacher.characteristics.instructionalExpertise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="csv-import-footer">
            <button className="btn btn-ghost btn-sm" onClick={() => setStep("mapping")}>Back</button>
            <button className="btn btn-primary btn-sm" onClick={confirmImport} disabled={review.teachers.length === 0}>Confirm import</button>
          </div>
        </div>
      )}

      {status.type !== "idle" ? <div className={`csv-import-status status-${status.type}`}>{status.message}</div> : null}
    </div>
  )
}
