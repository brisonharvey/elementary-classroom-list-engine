import { useState } from "react"
import { CsvImportEntity } from "../../types/csvImport"
import { StudentBlendImport } from "./StudentBlendImport"
import { TeacherCsvImport } from "./TeacherCsvImport"

export function CsvImportPanel({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<CsvImportEntity>("students")

  return (
    <div className="slide-panel-content csv-import-panel">
      <div className="slide-panel-header">
        <div>
          <strong>CSV Import</strong>
          <p className="csv-import-subtitle">Students use a master-roster blend flow. Teachers still import as a single preprocessed file.</p>
          {mode === "students" ? <p className="csv-import-subtitle">To update existing students in bulk, re-import them with the same student `id` values.</p> : null}
          {mode === "students" ? <p className="csv-import-subtitle">The first student import should also set the school name and school year for this placement file.</p> : null}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
      </div>

      <div className="csv-import-mode-toggle" role="tablist" aria-label="CSV import type">
        <button className={`btn btn-sm ${mode === "students" ? "btn-primary" : "btn-ghost"}`} onClick={() => setMode("students")}>Students</button>
        <button className={`btn btn-sm ${mode === "teachers" ? "btn-primary" : "btn-ghost"}`} onClick={() => setMode("teachers")}>Teachers</button>
      </div>

      {mode === "students" ? <StudentBlendImport /> : <TeacherCsvImport />}
    </div>
  )
}
