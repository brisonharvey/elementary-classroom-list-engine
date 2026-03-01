import React, { useCallback, useRef, useState } from "react"
import { useApp } from "../store/AppContext"
import { generateSampleCSV, parseCSV } from "../utils/csvParser"
import { downloadFile } from "../utils/exportUtils"

export function CSVUploader() {
  const { dispatch } = useApp()
  const [status, setStatus] = useState<{ type: "idle" | "success" | "error"; message: string }>({
    type: "idle",
    message: "",
  })
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
        setStatus({ type: "error", message: "Please upload a .csv file." })
        return
      }
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        const { students, errors, skipped } = parseCSV(text)
        if (students.length === 0) {
          setStatus({ type: "error", message: `No valid students found. ${errors[0] ?? ""}` })
          return
        }
        dispatch({ type: "LOAD_STUDENTS", payload: students })
        const warn = skipped > 0 ? ` (${skipped} rows skipped)` : ""
        const errNote = errors.length > 0 ? ` — ${errors.length} warning(s)` : ""
        setStatus({
          type: "success",
          message: `Loaded ${students.length} students across grades K–5${warn}${errNote}.`,
        })
        if (errors.length > 0) {
          console.warn("[CSV Import Warnings]", errors)
        }
      }
      reader.readAsText(file)
    },
    [dispatch]
  )

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

  const downloadSample = () => {
    downloadFile(generateSampleCSV(), "sample-students.csv")
  }

  return (
    <div className="csv-uploader">
      <div
        className={`drop-zone ${dragging ? "dragging" : ""}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={() => setDragging(false)}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        aria-label="Upload student CSV file"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span>Drop CSV here or click to upload</span>
      </div>
      <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={onFileChange} hidden />
      <button className="btn btn-ghost btn-sm" onClick={downloadSample} title="Download sample CSV format">
        Download sample CSV
      </button>
      {status.type !== "idle" && (
        <div className={`upload-status status-${status.type}`}>{status.message}</div>
      )}
    </div>
  )
}
