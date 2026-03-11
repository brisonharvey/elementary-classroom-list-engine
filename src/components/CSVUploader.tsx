import React, { useCallback, useMemo, useRef, useState } from "react"
import { useApp } from "../store/AppContext"
import {
  STUDENT_CSV_FIELD_OPTIONS,
  StudentCsvFieldMapping,
  buildSampleValues,
  generateStudentSampleCSV,
  generateStudentTemplateCSV,
  parseCSVPreview,
  parseStudentCSVWithMapping,
  suggestStudentFieldMapping,
} from "../utils/csvParser"
import {
  TEACHER_CSV_FIELD_OPTIONS,
  TeacherCsvFieldMapping,
  generateTeacherSampleCSV,
  generateTeacherTemplateCSV,
  parseTeacherCSVWithMapping,
  suggestTeacherFieldMapping,
} from "../utils/teacherCsvParser"
import { downloadFile } from "../utils/exportUtils"

type UploadStep = "upload" | "mapping"
type UploadMode = "students" | "teachers"
type GenericMapping = Record<string, string | undefined>

export function CSVUploader() {
  const { state, dispatch } = useApp()
  const [mode, setMode] = useState<UploadMode>("students")
  const [status, setStatus] = useState<{ type: "idle" | "success" | "error"; message: string }>({
    type: "idle",
    message: "",
  })
  const [dragging, setDragging] = useState(false)
  const [step, setStep] = useState<UploadStep>("upload")
  const [csvText, setCsvText] = useState("")
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<GenericMapping>({})
  const [autoMatched, setAutoMatched] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)

  const config = useMemo(() => {
    if (mode === "teachers") {
      return {
        fieldOptions: TEACHER_CSV_FIELD_OPTIONS,
        requiredKeys: ["grade", "teacherName"] as const,
        suggest: (headers: string[]) => suggestTeacherFieldMapping(headers),
        sampleFilename: "sample-teachers.csv",
        templateFilename: "teacher-import-template.csv",
        sampleContent: generateTeacherSampleCSV,
        templateContent: generateTeacherTemplateCSV,
        importLabel: "Import teachers",
        uploadLabel: "Teacher CSV",
        ariaLabel: "Upload teacher CSV file",
        process: (text: string, fieldMapping: GenericMapping) => {
          const { teachers, errors, skipped } = parseTeacherCSVWithMapping(text, fieldMapping as TeacherCsvFieldMapping)
          if (teachers.length === 0) {
            setStatus({ type: "error", message: `No valid teachers found. ${errors[0] ?? ""}` })
            return
          }

          dispatch({ type: "LOAD_TEACHERS", payload: teachers })
          const warn = skipped > 0 ? ` (${skipped} rows skipped)` : ""
          const errNote = errors.length > 0 ? ` - ${errors.length} warning(s)` : ""
          setStatus({
            type: "success",
            message: `Loaded ${teachers.length} teacher profiles${warn}${errNote}.`,
          })
          if (errors.length > 0) {
            console.warn("[Teacher CSV Import Warnings]", errors)
          }
          setStep("upload")
        },
      }
    }

    return {
      fieldOptions: STUDENT_CSV_FIELD_OPTIONS,
      requiredKeys: ["id", "grade", "firstName", "lastName"] as const,
      suggest: (headers: string[]) => suggestStudentFieldMapping(headers),
      sampleFilename: "sample-students.csv",
      templateFilename: "student-import-template.csv",
      sampleContent: generateStudentSampleCSV,
      templateContent: generateStudentTemplateCSV,
      importLabel: state.allStudents.length > 0 ? "Add student batch" : "Import students",
      uploadLabel: "Student CSV",
      ariaLabel: "Upload student CSV file",
      process: (text: string, fieldMapping: GenericMapping) => {
        const { students, errors, skipped } = parseStudentCSVWithMapping(text, fieldMapping as StudentCsvFieldMapping)
        if (students.length === 0) {
          setStatus({ type: "error", message: `No valid students found. ${errors[0] ?? ""}` })
          return
        }

        const existingIds = new Set(state.allStudents.map((student) => student.id))
        const seenIds = new Set<number>()
        const newStudents = students.filter((student) => {
          if (existingIds.has(student.id) || seenIds.has(student.id)) return false
          seenIds.add(student.id)
          return true
        })
        const duplicateCount = students.length - newStudents.length

        if (newStudents.length === 0) {
          const skippedNote = skipped > 0 ? ` ${skipped} row(s) were already skipped during parsing.` : ""
          setStatus({
            type: "error",
            message: `No new students were added. ${duplicateCount} duplicate ID(s) matched the current roster or repeated in the file.${skippedNote}`,
          })
          return
        }

        dispatch({ type: "LOAD_STUDENTS", payload: newStudents })
        const warn = skipped > 0 ? ` (${skipped} rows skipped)` : ""
        const duplicateNote = duplicateCount > 0 ? ` (${duplicateCount} duplicate ID${duplicateCount === 1 ? "" : "s"} ignored)` : ""
        const errNote = errors.length > 0 ? ` - ${errors.length} warning(s)` : ""
        setStatus({
          type: "success",
          message: `${state.allStudents.length > 0 ? "Added" : "Loaded"} ${newStudents.length} student${newStudents.length === 1 ? "" : "s"} across grades K-5${duplicateNote}${warn}${errNote}.`,
        })
        if (errors.length > 0) {
          console.warn("[Student CSV Import Warnings]", errors)
        }
        setStep("upload")
      },
    }
  }, [dispatch, mode, state.allStudents])

  const mappedHeaderSet = useMemo(() => new Set(Object.values(mapping).filter(Boolean)), [mapping])
  const sampleValues = useMemo(() => buildSampleValues(csvHeaders, csvRows), [csvHeaders, csvRows])
  const matchedCount = useMemo(() => Object.values(mapping).filter(Boolean).length, [mapping])
  const autoMatchCount = useMemo(() => [...autoMatched].filter((key) => mapping[key] != null).length, [autoMatched, mapping])

  const processMappedCSV = useCallback(() => {
    config.process(csvText, mapping)
  }, [config, csvText, mapping])

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      setStatus({ type: "error", message: "Please upload a .csv file." })
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const preview = parseCSVPreview(text)
      if (preview.headers.length === 0) {
        setStatus({ type: "error", message: "CSV must have a header row and at least one data row." })
        return
      }

      const suggested = config.suggest(preview.headers)
      setCsvText(text)
      setCsvHeaders(preview.headers)
      setCsvRows(preview.rows.slice(0, 5))
      setMapping(suggested as GenericMapping)
      setAutoMatched(new Set(Object.keys(suggested)))
      setStep("mapping")
      setStatus({ type: "idle", message: "" })
    }
    reader.readAsText(file)
  }, [config])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ""
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }

  const switchMode = (nextMode: UploadMode) => {
    setMode(nextMode)
    setStep("upload")
    setCsvText("")
    setCsvHeaders([])
    setCsvRows([])
    setMapping({})
    setAutoMatched(new Set())
    setStatus({ type: "idle", message: "" })
  }

  return (
    <div className="csv-uploader">
      <div className="import-mode-toggle" role="tablist" aria-label="Import type selector">
        <button className={`btn btn-sm ${mode === "students" ? "btn-primary" : "btn-ghost"}`} onClick={() => switchMode("students")}>Students</button>
        <button className={`btn btn-sm ${mode === "teachers" ? "btn-primary" : "btn-ghost"}`} onClick={() => switchMode("teachers")}>Teachers</button>
      </div>

      {step === "upload" && (
        <>
          <div
            className={`drop-zone ${dragging ? "dragging" : ""}`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={() => setDragging(false)}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
            aria-label={config.ariaLabel}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Drop {config.uploadLabel} here or click to upload</span>
          </div>
          <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={onFileChange} hidden />
          {mode === "students" && state.allStudents.length > 0 && (
            <span className="upload-hint">Additional student imports append new IDs and ignore duplicates.</span>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => downloadFile(config.templateContent(), config.templateFilename)}>
            Template CSV
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => downloadFile(config.sampleContent(), config.sampleFilename)}>
            Sample CSV
          </button>
        </>
      )}

      {step === "mapping" && (
        <div className="mapping-panel">
          <div className="mapping-header">
            <span>Match CSV columns to import fields</span>
            <span className="mapping-stats">
              {csvHeaders.length} columns detected · {matchedCount}/{config.fieldOptions.length} fields mapped
              {autoMatchCount > 0 && <span className="mapping-stats-auto"> ({autoMatchCount} auto-matched)</span>}
            </span>
          </div>
          <div className="mapping-grid">
            {config.fieldOptions.map((field) => {
              const isAutoMatched = autoMatched.has(field.key)
              const currentCol = mapping[field.key]
              const sample = currentCol ? sampleValues[currentCol] : undefined

              return (
                <label key={field.key} className="mapping-row">
                  <div className="mapping-label-row">
                    <span className="mapping-label-text">
                      {field.label}
                      {field.required && <span className="mapping-required"> *</span>}
                    </span>
                    {isAutoMatched && currentCol && <span className="mapping-auto-badge">auto</span>}
                  </div>
                  <select
                    value={currentCol ?? ""}
                    className={currentCol ? "mapping-select-matched" : ""}
                    onChange={(e) => {
                      const value = e.target.value
                      setMapping((prev) => ({
                        ...prev,
                        [field.key]: value || undefined,
                      }))
                    }}
                  >
                    <option value="">- not mapped -</option>
                    {csvHeaders.map((header) => {
                      const inUse = mappedHeaderSet.has(header) && currentCol !== header
                      return (
                        <option key={`${field.key}-${header}`} value={header} disabled={inUse}>
                          {header}
                        </option>
                      )
                    })}
                  </select>
                  {sample && (
                    <span className="mapping-sample" title={sampleValues[currentCol!]}>
                      e.g. {sample}
                    </span>
                  )}
                </label>
              )
            })}
          </div>
          <div className="mapping-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setStep("upload")}>
              Back
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={processMappedCSV}
              disabled={config.requiredKeys.some((key) => !mapping[key])}
            >
              {config.importLabel}
            </button>
          </div>
        </div>
      )}

      {status.type !== "idle" && <div className={`upload-status status-${status.type}`}>{status.message}</div>}
    </div>
  )
}
