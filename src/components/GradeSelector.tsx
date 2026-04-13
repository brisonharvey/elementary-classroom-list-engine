import { useApp } from "../store/AppContext"
import { AppState, Grade, GRADES } from "../types"

const GRADE_LABELS: Record<Grade, string> = {
  K: "Kinder",
  "1": "Grade 1",
  "2": "Grade 2",
  "3": "Grade 3",
  "4": "Grade 4",
  "5": "Grade 5",
}

type GradeStatus = "empty" | "complete" | "warning" | "error"

function getGradeStatus(
  grade: Grade,
  allStudents: AppState["allStudents"],
  classrooms: AppState["classrooms"],
  unresolvedReasons: AppState["unresolvedReasons"]
): GradeStatus {
  const total = allStudents.filter((s) => s.grade === grade).length
  if (total === 0) return "empty"
  const placed = classrooms
    .filter((c) => c.grade === grade)
    .reduce((sum, c) => sum + c.students.length, 0)
  const hasUnresolved = allStudents.some(
    (s) => s.grade === grade && (unresolvedReasons[s.id]?.length ?? 0) > 0
  )
  if (hasUnresolved) return "error"
  if (placed < total) return "warning"
  return "complete"
}

export function GradeSelector() {
  const { state, dispatch } = useApp()
  const { activeGrade, allStudents, classrooms, unresolvedReasons } = state

  const countForGrade = (grade: Grade) => allStudents.filter((s) => s.grade === grade).length
  const placedForGrade = (grade: Grade) =>
    classrooms.filter((c) => c.grade === grade).reduce((n, c) => n + c.students.length, 0)

  return (
    <div className="grade-selector">
      {GRADES.map((grade) => {
        const total = countForGrade(grade)
        const placed = placedForGrade(grade)
        const isActive = grade === activeGrade
        const status = getGradeStatus(grade, allStudents, classrooms, unresolvedReasons)
        const statusClass = status !== "empty" ? `grade-btn-${status}` : ""
        const statusTitle =
          status === "error" ? " — has unresolved students" :
          status === "warning" ? " — some students not yet placed" :
          status === "complete" ? " — fully placed" : ""
        return (
          <button
            key={grade}
            className={`grade-btn ${isActive ? "active" : ""} ${statusClass}`}
            onClick={() => dispatch({ type: "SET_ACTIVE_GRADE", payload: grade })}
            title={`${GRADE_LABELS[grade]}: ${placed}/${total} placed${statusTitle}`}
          >
            <span className="grade-btn-label">{grade === "K" ? "K" : grade}</span>
            {total > 0 && (
              <span className="grade-btn-count">
                {placed}/{total}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
