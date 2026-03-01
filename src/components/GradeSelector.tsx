import { useApp } from "../store/AppContext"
import { Grade, GRADES } from "../types"

const GRADE_LABELS: Record<Grade, string> = {
  K: "Kinder",
  "1": "Grade 1",
  "2": "Grade 2",
  "3": "Grade 3",
  "4": "Grade 4",
  "5": "Grade 5",
}

export function GradeSelector() {
  const { state, dispatch } = useApp()
  const { activeGrade, allStudents, classrooms } = state

  const countForGrade = (grade: Grade) => allStudents.filter((s) => s.grade === grade).length
  const placedForGrade = (grade: Grade) =>
    classrooms.filter((c) => c.grade === grade).reduce((n, c) => n + c.students.length, 0)

  return (
    <div className="grade-selector">
      {GRADES.map((grade) => {
        const total = countForGrade(grade)
        const placed = placedForGrade(grade)
        const isActive = grade === activeGrade
        return (
          <button
            key={grade}
            className={`grade-btn ${isActive ? "active" : ""}`}
            onClick={() => dispatch({ type: "SET_ACTIVE_GRADE", payload: grade })}
            title={`${GRADE_LABELS[grade]}: ${placed}/${total} placed`}
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
