import React, { memo, useMemo, useState } from "react"
import { Classroom, CoTeachCategory } from "../types"
import { useApp } from "../store/AppContext"
import { useDrag } from "../store/DragContext"
import { StudentCard } from "./StudentCard"
import { getManualMoveWarnings } from "../utils/constraints"
import { computeRoomStats } from "../utils/scoring"
import { CO_TEACH_CATEGORIES, CO_TEACH_LABELS } from "../utils/coTeach"
import { getClassroomsForGrade } from "../utils/classroomInit"
import { getGradeTagSupportLoadSummary } from "../utils/tagSupportLoad"

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
  const canShowTeacherName = state.showTeacherNames
  const isFull = stats.size >= classroom.maxSize
  const fillPct = Math.min(100, Math.round((stats.size / classroom.maxSize) * 100))
  const gradeRooms = useMemo(() => getClassroomsForGrade(state.classrooms, classroom.grade), [classroom.grade, state.classrooms])
  const tagSummary = useMemo(() => getGradeTagSupportLoadSummary(gradeRooms, classroom.grade), [classroom.grade, gradeRooms])
  const tagLoadAboveAverage = stats.tagSupportLoad - tagSummary.averageTotal
  const tagLoadWarn = tagLoadAboveAverage >= 3

  const coverageSummary = useMemo(() => {
    if (classroom.coTeachCoverage.length === 0) return "Co-teach: None"
    return `Co-teach: ${classroom.coTeachCoverage.map((category) => CO_TEACH_LABELS[category]).join(", ")}`
  }, [classroom.coTeachCoverage])

  const setCoverage = (coTeachCoverage: CoTeachCategory[]) => {
    dispatch({ type: "UPDATE_CLASSROOM", payload: { id: classroom.id, coTeachCoverage } })
  }

  const toggleCoverage = (category: CoTeachCategory) => {
    const exists = classroom.coTeachCoverage.includes(category)
    setCoverage(exists ? classroom.coTeachCoverage.filter((entry) => entry !== category) : [...classroom.coTeachCoverage, category])
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsOver(false)
    if (drag.studentId === null || drag.fromId === classroom.id) {
      clearDrag()
      return
    }

    const student =
      state.allStudents.find((entry) => entry.id === drag.studentId) ?? state.classrooms.flatMap((room) => room.students).find((entry) => entry.id === drag.studentId)

    if (student) {
      const warnings = getManualMoveWarnings(student, classroom, {
        settings: state.gradeSettings[state.activeGrade],
        relationshipRules: state.relationshipRules,
        gradeRooms,
      })
      if (warnings.length > 0) {
        const proceed = window.confirm(
          `Warning - placing ${student.firstName} ${student.lastName} here may violate constraints or increase imbalance:\n\n${warnings
            .map((warning) => `* ${warning}`)
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
    { label: "Tag", value: Math.min(1, Math.max(0, stats.tagSupportLoad) / 12), text: `${stats.tagSupportLoad.toFixed(1)} total` },
    { label: "CoT", value: Math.min(1, stats.avgCoTeachMinutes / 60), text: `${stats.avgCoTeachMinutes.toFixed(1)} avg min` },
  ]

  return (
    <div
      className={`classroom-column ${isOver ? "drop-over" : ""} ${isFull ? "at-capacity" : ""} ${tagLoadWarn ? "classroom-column-tag-warn" : ""}`}
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
        {editingName && canShowTeacherName ? (
          <div className="name-edit">
            <input type="text" value={nameInput} onChange={(e) => setNameInput(e.target.value)} className="name-input" />
            <button
              className="btn-icon"
              onClick={() => {
                dispatch({ type: "UPDATE_CLASSROOM", payload: { id: classroom.id, teacherName: nameInput } })
                setEditingName(false)
              }}
            >
              Save
            </button>
          </div>
        ) : (
          <div className="teacher-name" onClick={() => canShowTeacherName && setEditingName(true)}>
            {canShowTeacherName ? classroom.teacherName || <em>Unnamed teacher</em> : <em>Teacher hidden</em>}
            {canShowTeacherName ? <span className="edit-hint">Edit</span> : null}
          </div>
        )}

        <div className="coverage-control">
          <button
            className="btn btn-ghost btn-sm"
            aria-haspopup="menu"
            aria-expanded={coverageOpen}
            aria-label={`Manage co-teach coverage for room ${classroom.label}`}
            onClick={() => setCoverageOpen((value) => !value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setCoverageOpen(false)
            }}
            title={coverageSummary}
          >
            Co-teach v
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

        <div className="room-quick-stats">
          <span className={`qs-badge ${tagLoadWarn ? "qs-tag-warn" : "qs-tag"}`}>Tag Load: {stats.tagSupportLoad.toFixed(1)}</span>
          <span className="qs-badge qs-tag">Beh: {stats.behavioralTagSupportLoad.toFixed(1)}</span>
          <span className="qs-badge qs-tag">Emo: {stats.emotionalTagSupportLoad.toFixed(1)}</span>
          <span className="qs-badge qs-tag">Inst: {stats.instructionalTagSupportLoad.toFixed(1)}</span>
          <span className="qs-badge qs-tag">Energy: {stats.energyTagSupportLoad.toFixed(1)}</span>
        </div>

        <div className="heatmap-row">
          {quickHeat.map((heat) => (
            <div key={heat.label} className="heat-tile" title={`${heat.label}: ${heat.text}`} aria-label={`${heat.label} ${heat.text}`}>
              <span>{heat.label}</span>
              <div className="heat-level" style={{ opacity: 0.25 + heat.value * 0.75 }} />
            </div>
          ))}
        </div>
      </div>

      <div className="student-list">
        {classroom.students.length === 0
          ? <div className="empty-placeholder">Drop students here</div>
          : classroom.students.map((student) => <StudentCard key={student.id} student={student} classroomId={classroom.id} />)}
      </div>
    </div>
  )
})
