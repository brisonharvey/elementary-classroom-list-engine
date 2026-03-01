import React, { memo, useState } from "react"
import { Classroom } from "../types"
import { useApp } from "../store/AppContext"
import { useDrag } from "../store/DragContext"
import { StudentCard } from "./StudentCard"
import { getManualMoveWarnings } from "../utils/constraints"
import { computeRoomStats } from "../utils/scoring"

interface ClassroomColumnProps {
  classroom: Classroom
}

export const ClassroomColumn = memo(function ClassroomColumn({ classroom }: ClassroomColumnProps) {
  const { state, dispatch } = useApp()
  const { drag, clearDrag } = useDrag()
  const [isOver, setIsOver] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(classroom.teacherName)

  const stats = computeRoomStats(classroom)
  const isFull = stats.size >= classroom.maxSize
  const fillPct = Math.min(100, Math.round((stats.size / classroom.maxSize) * 100))

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setIsOver(true)
  }

  const onDragLeave = () => setIsOver(false)

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsOver(false)
    if (drag.studentId === null || drag.fromId === classroom.id) {
      clearDrag()
      return
    }

    // Warn about constraint violations (manual moves are allowed but warned)
    const student = state.allStudents.find((s) => s.id === drag.studentId)
      ?? state.classrooms.flatMap((c) => c.students).find((s) => s.id === drag.studentId)

    if (student) {
      const warnings = getManualMoveWarnings(student, classroom)
      if (warnings.length > 0) {
        const proceed = window.confirm(
          `Warning — placing ${student.firstName} ${student.lastName} here may violate constraints:\n\n` +
            warnings.map((w) => `• ${w}`).join("\n") +
            "\n\nProceed anyway?"
        )
        if (!proceed) {
          clearDrag()
          return
        }
      }
    }

    dispatch({
      type: "MOVE_STUDENT",
      payload: { studentId: drag.studentId, fromId: drag.fromId, toId: classroom.id },
    })
    clearDrag()
  }

  const saveName = () => {
    dispatch({ type: "UPDATE_CLASSROOM", payload: { id: classroom.id, teacherName: nameInput } })
    setEditingName(false)
  }

  const toggleCoTeach = (type: "reading" | "math") => {
    dispatch({
      type: "UPDATE_CLASSROOM",
      payload: {
        id: classroom.id,
        coTeach: {
          ...classroom.coTeach,
          [type]: !classroom.coTeach[type],
        },
      },
    })
  }

  const updateMaxSize = (val: number) => {
    if (val >= 1 && val <= 50) {
      dispatch({ type: "UPDATE_CLASSROOM", payload: { id: classroom.id, maxSize: val } })
    }
  }

  // IEP count per-room indicator
  const iepCount = classroom.students.filter((s) => s.specialEd.status === "IEP").length
  const referralCount = classroom.students.filter((s) => s.specialEd.status === "Referral").length
  const maleCount = classroom.students.filter((s) => s.gender === "M").length
  const femaleCount = classroom.students.filter((s) => s.gender === "F").length

  return (
    <div
      className={`classroom-column ${isOver ? "drop-over" : ""} ${isFull ? "at-capacity" : ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* ── Header ── */}
      <div className="classroom-header">
        <div className="classroom-id">{classroom.id}</div>

        {/* Teacher name */}
        {editingName ? (
          <div className="name-edit">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName()
                if (e.key === "Escape") setEditingName(false)
              }}
              autoFocus
              placeholder="Teacher name"
              className="name-input"
            />
            <button className="btn-icon" onClick={saveName} title="Save">✓</button>
            <button className="btn-icon" onClick={() => setEditingName(false)} title="Cancel">✕</button>
          </div>
        ) : (
          <div className="teacher-name" onClick={() => setEditingName(true)} title="Click to edit teacher name">
            {classroom.teacherName || <em>Unnamed teacher</em>}
            <span className="edit-hint">✎</span>
          </div>
        )}

        {/* Capacity bar */}
        <div className="capacity-row">
          <div className="capacity-bar">
            <div
              className="capacity-fill"
              style={{
                width: `${fillPct}%`,
                backgroundColor: isFull ? "#ef4444" : fillPct > 85 ? "#f59e0b" : "#22c55e",
              }}
            />
          </div>
          <span className="capacity-text">
            {stats.size}/
            <input
              type="number"
              value={classroom.maxSize}
              onChange={(e) => updateMaxSize(Number(e.target.value))}
              className="max-size-input"
              min={1}
              max={50}
              title="Max class size"
            />
          </span>
        </div>

        {/* Co-teach toggles */}
        <div className="coteach-row">
          <button
            className={`coteach-btn ${classroom.coTeach.reading ? "active" : ""}`}
            onClick={() => toggleCoTeach("reading")}
            title="Toggle Reading Co-teach"
          >
            CT-Read
          </button>
          <button
            className={`coteach-btn ${classroom.coTeach.math ? "active" : ""}`}
            onClick={() => toggleCoTeach("math")}
            title="Toggle Math Co-teach"
          >
            CT-Math
          </button>
        </div>

        {/* Quick stats */}
        <div className="room-quick-stats">
          {iepCount > 0 && <span className="qs-badge qs-iep">{iepCount} IEP</span>}
          {referralCount > 0 && <span className="qs-badge qs-ref">{referralCount} Ref</span>}
          <span className="qs-badge qs-gender">{maleCount}M {femaleCount}F</span>
        </div>
      </div>

      {/* ── Student list ── */}
      <div className="student-list">
        {classroom.students.length === 0 ? (
          <div className="empty-placeholder">Drop students here</div>
        ) : (
          classroom.students.map((s) => (
            <StudentCard key={s.id} student={s} classroomId={classroom.id} />
          ))
        )}
      </div>
    </div>
  )
})
