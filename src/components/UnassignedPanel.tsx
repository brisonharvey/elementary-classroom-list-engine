import { getStudentCoTeachTotal } from "../utils/coTeach"
import React, { memo, useState } from "react"
import { useApp } from "../store/AppContext"
import { useDrag } from "../store/DragContext"
import { StudentCard } from "./StudentCard"
import { StudentEditorModal } from "./StudentEditorModal"
import { getUnassignedStudents } from "../engine/placementEngine"
import { getManualUnassignedWarnings } from "../utils/constraints"

export const UnassignedPanel = memo(function UnassignedPanel() {
  const { state, dispatch } = useApp()
  const { drag, clearDrag } = useDrag()
  const [isOver, setIsOver] = useState(false)
  const [filter, setFilter] = useState<"all" | "IEP" | "Referral" | "coteach">("all")
  const [addingStudent, setAddingStudent] = useState(false)

  const unassigned = getUnassignedStudents(state.allStudents, state.classrooms, state.activeGrade)

  const filtered = unassigned.filter((s) => {
    if (filter === "IEP") return s.specialEd.status === "IEP"
    if (filter === "Referral") return s.specialEd.status === "Referral"
    if (filter === "coteach") return getStudentCoTeachTotal(s) > 0
    return true
  })

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setIsOver(true)
  }

  const onDragLeave = () => setIsOver(false)

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsOver(false)
    if (drag.studentId === null || drag.fromId === null) {
      clearDrag()
      return
    }

    const student =
      state.allStudents.find((entry) => entry.id === drag.studentId) ??
      state.classrooms.flatMap((room) => room.students).find((entry) => entry.id === drag.studentId)

    if (student) {
      const warnings = getManualUnassignedWarnings(student, {
        settings: state.gradeSettings[state.activeGrade],
        relationshipRules: state.relationshipRules,
        gradeRooms: state.classrooms.filter((room) => room.grade === state.activeGrade),
      })
      if (warnings.length > 0) {
        const proceed = window.confirm(
          `Warning - sending ${student.firstName} ${student.lastName} to Unassigned may create issues:\n\n${warnings
            .map((warning) => `* ${warning}`)
            .join("\n")}\n\nProceed anyway?`
        )
        if (!proceed) {
          clearDrag()
          return
        }
      }
    }

    dispatch({
      type: "MOVE_STUDENT",
      payload: { studentId: drag.studentId, fromId: drag.fromId, toId: null },
    })
    clearDrag()
  }

  return (
    <>
      <div
        className={`unassigned-panel ${isOver ? "drop-over" : ""}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="panel-header panel-header-stacked">
          <div className="panel-title-row">
            <div className="panel-title">
              Unassigned
              <span className="panel-count">{unassigned.length}</span>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setAddingStudent(true)}>Add Student</button>
          </div>
          <select
            className="filter-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            aria-label="Filter unassigned students"
          >
            <option value="all">All ({unassigned.length})</option>
            <option value="IEP">IEP ({unassigned.filter((s) => s.specialEd.status === "IEP").length})</option>
            <option value="Referral">Referral ({unassigned.filter((s) => s.specialEd.status === "Referral").length})</option>
            <option value="coteach">CoTeach Needed ({unassigned.filter((s) => getStudentCoTeachTotal(s) > 0).length})</option>
          </select>
        </div>

        <div className="student-list">
          {state.allStudents.length === 0 ? (
            <div className="empty-placeholder">Upload a CSV or add a student manually to begin.</div>
          ) : filtered.length === 0 ? (
            <div className="empty-placeholder">
              {unassigned.length === 0 ? "All students placed!" : "No students match this filter"}
            </div>
          ) : (
            filtered.map((s) => (
              <div key={s.id}>
                <StudentCard student={s} classroomId={null} />
                {(state.unresolvedReasons[s.id] ?? []).length > 0 && (
                  <div className="unresolved-reasons">Reason: {(state.unresolvedReasons[s.id] ?? []).join("; ")}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {addingStudent && <StudentEditorModal defaultGrade={state.activeGrade} onClose={() => setAddingStudent(false)} />}
    </>
  )
})
