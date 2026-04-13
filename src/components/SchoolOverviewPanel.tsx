import { useMemo } from "react"
import { useApp } from "../store/AppContext"
import { Grade, GRADES } from "../types"

interface SchoolOverviewPanelProps {
  onClose: () => void
  onNavigateToGrade: (grade: Grade) => void
}

const GRADE_LABELS: Record<Grade, string> = {
  K: "Kindergarten",
  "1": "Grade 1",
  "2": "Grade 2",
  "3": "Grade 3",
  "4": "Grade 4",
  "5": "Grade 5",
}

export function SchoolOverviewPanel({ onClose, onNavigateToGrade }: SchoolOverviewPanelProps) {
  const { state } = useApp()

  const gradeData = useMemo(() =>
    GRADES.map((grade) => {
      const total = state.allStudents.filter((s) => s.grade === grade).length
      const placed = state.classrooms
        .filter((c) => c.grade === grade)
        .reduce((sum, c) => sum + c.students.length, 0)
      const rooms = state.classrooms.filter((c) => c.grade === grade).length
      const unresolvedCount = state.allStudents.filter(
        (s) => s.grade === grade && (state.unresolvedReasons[s.id]?.length ?? 0) > 0
      ).length
      const unplaced = total - placed

      let status: "empty" | "complete" | "warning" | "error"
      if (total === 0) status = "empty"
      else if (unresolvedCount > 0) status = "error"
      else if (unplaced > 0) status = "warning"
      else status = "complete"

      return { grade, total, placed, unplaced, unresolvedCount, rooms, status }
    }),
    [state.allStudents, state.classrooms, state.unresolvedReasons]
  )

  const hasAnyStudents = state.allStudents.length > 0
  const allDone = hasAnyStudents && gradeData.every((g) => g.total === 0 || g.status === "complete")
  const totalStudents = state.allStudents.length
  const totalPlaced = gradeData.reduce((sum, g) => sum + g.placed, 0)
  const totalUnresolved = gradeData.reduce((sum, g) => sum + g.unresolvedCount, 0)

  return (
    <div className="slide-panel-content">
      <div className="slide-panel-header">
        <div>
          <h3 className="summary-title">School Overview</h3>
          <p className="settings-panel-intro">Placement status across all grades.</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close school overview">
          X
        </button>
      </div>

      {!hasAnyStudents ? (
        <div className="overview-empty-state">
          No students imported yet. Import students to see placement status here.
        </div>
      ) : (
        <>
          <div className="overview-school-totals">
            <span className="total-pill">{totalStudents} total students</span>
            <span className="total-pill">{totalPlaced} placed</span>
            {totalUnresolved > 0 && (
              <span className="total-pill overview-pill-error">{totalUnresolved} unresolved</span>
            )}
            {allDone && (
              <span className="total-pill overview-pill-complete">All grades placed</span>
            )}
          </div>

          <div className="overview-grade-grid">
            {gradeData.map(({ grade, total, placed, unplaced, unresolvedCount, rooms, status }) => (
              <div key={grade} className={`overview-grade-card overview-grade-${status}`}>
                <div className="overview-grade-header">
                  <span className="overview-grade-label">{GRADE_LABELS[grade]}</span>
                  <span className={`overview-grade-badge overview-badge-${status}`}>
                    {status === "complete" && "Complete"}
                    {status === "warning" && `${unplaced} unplaced`}
                    {status === "error" && `${unresolvedCount} unresolved`}
                    {status === "empty" && "No students"}
                  </span>
                </div>

                {total > 0 && (
                  <div className="overview-grade-stats">
                    <span className="overview-stat">{placed}/{total} placed</span>
                    <span className="overview-stat">{rooms} room{rooms !== 1 ? "s" : ""}</span>
                    {unresolvedCount > 0 && (
                      <span className="overview-stat overview-stat-error">{unresolvedCount} unresolved</span>
                    )}
                    {unplaced > 0 && unresolvedCount === 0 && (
                      <span className="overview-stat overview-stat-warning">{unplaced} not yet placed</span>
                    )}
                  </div>
                )}

                <div className="overview-grade-progress">
                  <div
                    className="overview-grade-progress-fill"
                    style={{ width: total > 0 ? `${Math.round((placed / total) * 100)}%` : "0%" }}
                  />
                </div>

                <button
                  className="btn btn-ghost btn-sm overview-go-btn"
                  onClick={() => onNavigateToGrade(grade)}
                  disabled={total === 0}
                >
                  Go to {grade === "K" ? "Kindergarten" : `Grade ${grade}`}
                </button>
              </div>
            ))}
          </div>

          {allDone && (
            <div className="overview-all-done">
              All grades fully placed. Use Export All or Print Grade PDF to share results.
            </div>
          )}
        </>
      )}
    </div>
  )
}
