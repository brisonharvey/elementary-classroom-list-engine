import React, { memo, useState } from "react"
import { useApp } from "../store/AppContext"
import { useDrag } from "../store/DragContext"
import { StudentCard } from "./StudentCard"
import { getUnassignedStudents } from "../engine/placementEngine"

export const UnassignedPanel = memo(function UnassignedPanel() {
  const { state, dispatch } = useApp()
  const { drag, clearDrag } = useDrag()
  const [isOver, setIsOver] = useState(false)
  const [filter, setFilter] = useState<"all" | "IEP" | "Referral" | "coteach">("all")

  const unassigned = getUnassignedStudents(state.allStudents, state.classrooms, state.activeGrade)

  const filtered = unassigned.filter((s) => {
    if (filter === "IEP") return s.specialEd.status === "IEP"
    if (filter === "Referral") return s.specialEd.status === "Referral"
    if (filter === "coteach") return s.specialEd.requiresCoTeachReading || s.specialEd.requiresCoTeachMath
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
    dispatch({
      type: "MOVE_STUDENT",
      payload: { studentId: drag.studentId, fromId: drag.fromId, toId: null },
    })
    clearDrag()
  }

  return (
    <div
      className={`unassigned-panel ${isOver ? "drop-over" : ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="panel-header">
        <div className="panel-title">
          Unassigned
          <span className="panel-count">{unassigned.length}</span>
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
          <option value="coteach">CoTeach Needed ({unassigned.filter((s) => s.specialEd.requiresCoTeachReading || s.specialEd.requiresCoTeachMath).length})</option>
        </select>
      </div>

      <div className="student-list">
        {state.allStudents.length === 0 ? (
          <div className="empty-placeholder">Upload a CSV to begin</div>
        ) : filtered.length === 0 ? (
          <div className="empty-placeholder">
            {unassigned.length === 0 ? "All students placed!" : "No students match this filter"}
          </div>
        ) : (
          filtered.map((s) => (
            <StudentCard key={s.id} student={s} classroomId={null} />
          ))
        )}
      </div>
    </div>
  )
})
