import React, { memo, useMemo, useState } from "react"
import { Classroom, CoTeachCategory } from "../types"
import { useApp } from "../store/AppContext"
import { useDrag } from "../store/DragContext"
import { StudentCard } from "./StudentCard"
import { getManualMoveWarnings } from "../utils/constraints"
import { computeRoomStats } from "../utils/scoring"
import { CO_TEACH_CATEGORIES, CO_TEACH_LABELS } from "../utils/coTeach"

interface ClassroomColumnProps {
  classroom: Classroom
}

export const ClassroomColumn = memo(function ClassroomColumn({ classroom }: ClassroomColumnProps) {
  const { state, dispatch } = useApp()
  const { drag, clearDrag } = useDrag()
  const [isOver, setIsOver] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(classroom.teacherName)
  const [coverageOpen, setCoverageOpen] = useState(false)

  const stats = computeRoomStats(classroom)
  const isFull = stats.size >= classroom.maxSize
  const fillPct = Math.min(100, Math.round((stats.size / classroom.maxSize) * 100))

  const coverageSummary = useMemo(() => {
    if (classroom.coTeachCoverage.length === 0) return "Co-teach: None"
    return `Co-teach: ${classroom.coTeachCoverage.map((c) => CO_TEACH_LABELS[c]).join(", ")}`
  }, [classroom.coTeachCoverage])

  const setCoverage = (coTeachCoverage: CoTeachCategory[]) => {
    dispatch({ type: "UPDATE_CLASSROOM", payload: { id: classroom.id, coTeachCoverage } })
  }

  const toggleCoverage = (category: CoTeachCategory) => {
    const exists = classroom.coTeachCoverage.includes(category)
    setCoverage(
      exists ? classroom.coTeachCoverage.filter((c) => c !== category) : [...classroom.coTeachCoverage, category]
    )
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsOver(false)
    if (drag.studentId === null || drag.fromId === classroom.id) {
      clearDrag()
      return
    }

    const student =
      state.allStudents.find((s) => s.id === drag.studentId) ?? state.classrooms.flatMap((c) => c.students).find((s) => s.id === drag.studentId)

    if (student) {
      const warnings = getManualMoveWarnings(student, classroom, {
        settings: state.gradeSettings[state.activeGrade],
        relationshipRules: state.relationshipRules,
      })
      if (warnings.length > 0) {
        const proceed = window.confirm(
          `Warning - placing ${student.firstName} ${student.lastName} here may violate constraints:\n\n${warnings
            .map((w) => `* ${w}`)
            .join("\n")}\n\nProceed anyway?`
        )
        if (!proceed) {
          clearDrag()
          return
        }
      }
    }

    dispatch({ type: "MOVE_STUDENT", payload: { studentId: drag.studentId, fromId: drag.fromId, toId: classroom.id } })
    clearDrag()
  }

  const quickHeat = [
    { label: "Read", value: Math.min(1, stats.readingAvg / 4), text: stats.readingAvg.toFixed(2) },
    { label: "Math", value: Math.min(1, stats.mathAvg / 4), text: stats.mathAvg.toFixed(2) },
    { label: "Support", value: Math.min(1, stats.supportLoad / 8), text: stats.supportLoad.toFixed(2) },
    { label: "CoT", value: Math.min(1, stats.avgCoTeachMinutes / 60), text: `${stats.avgCoTeachMinutes.toFixed(1)} avg min` },
  ]

  return (
    <div
      className={`classroom-column ${isOver ? "drop-over" : ""} ${isFull ? "at-capacity" : ""}`}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
        setIsOver(true)
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={onDrop}
    >
      <div className="classroom-header">
        <div className="classroom-id">{classroom.label}</div>
        {editingName ? (
          <div className="name-edit">
            <input type="text" value={nameInput} onChange={(e) => setNameInput(e.target.value)} className="name-input" />
            <button
              className="btn-icon"
              onClick={() => {
                dispatch({ type: "UPDATE_CLASSROOM", payload: { id: classroom.id, teacherName: nameInput } })
                setEditingName(false)
              }}
            >
              ✓
            </button>
          </div>
        ) : (
          <div className="teacher-name" onClick={() => setEditingName(true)}>
            {classroom.teacherName || <em>Unnamed teacher</em>} <span className="edit-hint">✎</span>
          </div>
        )}

        <div className="coverage-control">
          <button
            className="btn btn-ghost btn-sm"
            aria-haspopup="menu"
            aria-expanded={coverageOpen}
            aria-label={`Manage co-teach coverage for room ${classroom.label}`}
            onClick={() => setCoverageOpen((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setCoverageOpen(false)
            }}
            title={coverageSummary}
          >
            Co-teach ▾
          </button>
          {coverageOpen && (
            <div className="coverage-dropdown" role="menu" aria-label="Co-teach coverage categories">
              <div className="coverage-actions">
                <button className="btn-link" onClick={() => setCoverage([...CO_TEACH_CATEGORIES])}>Select all</button>
                <button className="btn-link" onClick={() => setCoverage([])}>Clear</button>
              </div>
              {CO_TEACH_CATEGORIES.map((category) => {
                const checked = classroom.coTeachCoverage.includes(category)
                return (
                  <label key={category} className="coverage-option" aria-label={`Co-teach ${CO_TEACH_LABELS[category]}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCoverage(category)}
                    />
                    <span>{CO_TEACH_LABELS[category]}</span>
                  </label>
                )
              })}
            </div>
          )}
          <div className="coverage-chips">
            {classroom.coTeachCoverage.length === 0 ? (
              <span className="coteach-chip">None</span>
            ) : (
              classroom.coTeachCoverage.map((category) => <span key={category} className="coteach-chip">{CO_TEACH_LABELS[category]}</span>)
            )}
          </div>
        </div>

        <div className="capacity-row">
          <div className="capacity-bar"><div className="capacity-fill" style={{ width: `${fillPct}%` }} /></div>
          <span className="capacity-text">{stats.size}/{classroom.maxSize}</span>
        </div>

        <div className="heatmap-row">
          {quickHeat.map((h) => (
            <div key={h.label} className="heat-tile" title={`${h.label}: ${h.text}`} aria-label={`${h.label} ${h.text}`}>
              <span>{h.label}</span>
              <div className="heat-level" style={{ opacity: 0.25 + h.value * 0.75 }} />
            </div>
          ))}
        </div>
      </div>

      <div className="student-list">
        {classroom.students.length === 0
          ? <div className="empty-placeholder">Drop students here</div>
          : classroom.students.map((s) => <StudentCard key={s.id} student={s} classroomId={classroom.id} />)}
      </div>
    </div>
  )
})
