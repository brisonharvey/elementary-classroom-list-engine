import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useApp } from "../store/AppContext"
import { buildPlacementCSV, downloadFile, openGradePlacementPdf } from "../utils/exportUtils"

interface ControlBarProps {
  onOpenImport: () => void
  onOpenRules: () => void
  onOpenSettings: () => void
  onShowSummary: () => void
}

export function ControlBar({ onOpenImport, onOpenRules, onOpenSettings, onShowSummary }: ControlBarProps) {
  const { state, dispatch } = useApp()
  const [showWarnings, setShowWarnings] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  const hasStudents = state.allStudents.length > 0

  // Show warnings panel whenever a new (non-empty) warnings array arrives from AUTO_PLACE
  useEffect(() => {
    if (state.placementWarnings.length > 0) {
      setShowWarnings(true)
    }
  }, [state.placementWarnings])

  const autoPlace = () => {
    dispatch({ type: "AUTO_PLACE" })
  }
  const sortClassroomsByLastName = () => {
    dispatch({ type: "SORT_CLASSROOMS_BY_LAST_NAME" })
  }
  const toggleTeacherNames = () => {
    dispatch({ type: "SET_SHOW_TEACHER_NAMES", payload: !state.showTeacherNames })
  }

  const resetGrade = () => {
    const ok = window.confirm(
      `Reset all unlocked placements for Grade ${state.activeGrade}? Locked students will be preserved.`
    )
    if (ok) {
      dispatch({ type: "RESET_GRADE" })
      setShowWarnings(false)
    }
  }


  const exportGrade = () => {
    const csv = buildPlacementCSV(state.classrooms, state.allStudents, state.activeGrade)
    downloadFile(csv, `placement-grade-${state.activeGrade}.csv`)
  }

  const exportAll = () => {
    const csv = buildPlacementCSV(state.classrooms, state.allStudents)
    downloadFile(csv, `placement-all-grades.csv`)
  }

  const exportGradePdf = () => {
    openGradePlacementPdf(state.classrooms, state.allStudents, state.activeGrade, state.showTeacherNames)
  }

  const getWarningPos = (): React.CSSProperties => {
    if (!barRef.current) return { position: "fixed", top: 200, left: 20, zIndex: 1000 }
    const rect = barRef.current.getBoundingClientRect()
    return { position: "fixed", top: rect.bottom + 4, left: rect.left, zIndex: 1000 }
  }

  return (
    <div className="control-bar" ref={barRef}>
      <div className="control-actions">
        <div className="control-group">
          <button
            className="btn btn-primary"
            onClick={autoPlace}
            disabled={!hasStudents}
            title="Auto-place unlocked students for the active grade"
          >
            Auto-Place Grade {state.activeGrade}
          </button>
          <button
            className="btn btn-warning"
            onClick={resetGrade}
            disabled={!hasStudents}
            title="Clear unlocked placements for active grade"
          >
            Reset Grade
          </button>
          <button
            className="btn btn-ghost"
            onClick={sortClassroomsByLastName}
            disabled={!hasStudents}
            title="Sort each classroom by student last name (A-Z)"
          >
            Sort A-Z
          </button>
        </div>

        <div className="control-group">
          <button
            className="btn btn-ghost"
            onClick={exportGrade}
            disabled={!hasStudents}
            title="Export current grade to CSV"
          >
            Export Grade {state.activeGrade}
          </button>
          <button
            className="btn btn-ghost"
            onClick={exportGradePdf}
            disabled={!hasStudents}
            title="Open a print-ready PDF layout for the current grade"
          >
            Print Grade PDF
          </button>
          <button
            className="btn btn-ghost"
            onClick={exportAll}
            disabled={!hasStudents}
            title="Export all grades to CSV"
          >
            Export All
          </button>
        </div>

        <div className="control-group control-group-secondary">
          <button
            className="btn btn-ghost"
            onClick={toggleTeacherNames}
            title="Toggle teacher names and teacher-fit details throughout the app"
          >
            {state.showTeacherNames ? "Hide Teacher Names" : "Show Teacher Names"}
          </button>
        </div>
      </div>

      {showWarnings &&
        state.placementWarnings.length > 0 &&
        createPortal(
          <div className="placement-warnings" style={getWarningPos()}>
            <div className="warnings-header">
              <span>⚠ Placement Warnings</span>
              <button className="btn-icon" onClick={() => setShowWarnings(false)}>
                ✕
              </button>
            </div>
            <ul className="warnings-list">
              {state.placementWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
            <div className="warnings-actions">
              <button className="btn btn-ghost btn-sm" onClick={onShowSummary}>Show Summary</button>
              <button className="btn btn-ghost btn-sm" onClick={onOpenRules}>Open Rules</button>
              <button className="btn btn-ghost btn-sm" onClick={onOpenImport}>Open Import</button>
              <button className="btn btn-ghost btn-sm" onClick={onOpenSettings}>Open Settings</button>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

