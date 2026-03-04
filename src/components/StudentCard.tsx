import { memo, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Student } from "../types"
import { useApp } from "../store/AppContext"
import { useDrag } from "../store/DragContext"

interface StudentCardProps {
  student: Student
  classroomId: string | null // null = in unassigned panel
}

function tierClass(tier: 1 | 2 | 3): string {
  if (tier === 3) return "tier-3"
  if (tier === 2) return "tier-2"
  return "tier-1"
}

export const StudentCard = memo(function StudentCard({ student, classroomId }: StudentCardProps) {
  const { state, dispatch } = useApp()
  const { startDrag, clearDrag } = useDrag()

  const { specialEd, intervention, behaviorTier, locked } = student
  const isPreassigned = !!student.preassignedTeacher

  // ── Tooltip state ─────────────────────────────────────────────
  const cardRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    return () => clearTimeout(timerRef.current)
  }, [])

  const onMouseEnter = () => {
    timerRef.current = setTimeout(() => {
      if (!cardRef.current) return
      const TOOLTIP_W = 260
      const TOOLTIP_H = 320
      const rect = cardRef.current.getBoundingClientRect()
      let x = rect.right + 8
      if (x + TOOLTIP_W > window.innerWidth - 8) x = rect.left - TOOLTIP_W - 8
      let y = rect.top
      if (y + TOOLTIP_H > window.innerHeight - 8) y = window.innerHeight - TOOLTIP_H - 8
      setTooltip({ x, y })
    }, 500)
  }

  const onMouseLeave = () => {
    clearTimeout(timerRef.current)
    setTooltip(null)
  }

  // ── Card class ────────────────────────────────────────────────
  const cardClass = [
    "student-card",
    specialEd.status === "IEP" ? "card-iep" : specialEd.status === "Referral" ? "card-referral" : "",
    locked ? "card-locked" : "",
    isPreassigned ? "card-preassigned" : "",
  ]
    .filter(Boolean)
    .join(" ")

  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move"
    startDrag(student.id, classroomId)
  }

  const onDragEnd = () => {
    clearDrag()
  }

  const toggleLock = (e: React.MouseEvent) => {
    e.stopPropagation()
    dispatch({ type: "TOGGLE_LOCK", payload: student.id })
  }

  // ── No-contact name lookup ────────────────────────────────────
  const noContactNames = (student.noContactWith ?? []).map((id) => {
    const nc = state.allStudents.find((s) => s.id === id)
    return nc ? `${nc.firstName} ${nc.lastName}` : `#${id}`
  })

  return (
    <>
      <div
        ref={cardRef}
        className={cardClass}
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        title={`${student.firstName} ${student.lastName}${isPreassigned ? ` — Pre-assigned to ${student.preassignedTeacher}` : ""} — Drag to move. Click lock to pin.`}
      >
        {/* Drag handle */}
        <span className="drag-handle" aria-hidden>⠿</span>

        {/* Main info */}
        <div className="card-body">
          <div className="card-name">
            {student.lastName}, {student.firstName}
          </div>
          <div className="card-badges">
            {/* Gender */}
            <span className={`badge badge-gender badge-${student.gender.toLowerCase()}`}>
              {student.gender}
            </span>

            {/* Special Ed status */}
            {specialEd.status !== "None" && (
              <span className={`badge badge-sped badge-${specialEd.status.toLowerCase()}`}>
                {specialEd.status}
              </span>
            )}

            {/* Co-teach indicators */}
            {specialEd.requiresCoTeachReading && (
              <span className="badge badge-coteach" title="Requires Reading Co-teach">CTR</span>
            )}
            {specialEd.requiresCoTeachMath && (
              <span className="badge badge-coteach" title="Requires Math Co-teach">CTM</span>
            )}

            {/* Academic tier */}
            <span
              className={`badge badge-tier ${tierClass(intervention.academicTier)}`}
              title={`Academic Tier ${intervention.academicTier}`}
            >
              A{intervention.academicTier}
            </span>

            {/* Behavior tier */}
            <span
              className={`badge badge-tier ${tierClass(behaviorTier)}`}
              title={`Behavior Tier ${behaviorTier}`}
            >
              B{behaviorTier}
            </span>

            {/* Referrals */}
            {(student.referrals ?? 0) > 0 && (
              <span className="badge badge-referrals" title={`${student.referrals} referral(s)`}>
                {student.referrals}R
              </span>
            )}

            {/* Pre-assigned teacher */}
            {isPreassigned && (
              <span
                className="badge badge-preassigned"
                title={`Pre-assigned to ${student.preassignedTeacher}`}
              >
                📌 {student.preassignedTeacher}
              </span>
            )}

            {/* MAP scores */}
            {student.mapReading !== undefined && (
              <span className="badge badge-map" title={`MAP Reading: ${student.mapReading}`}>
                MR:{student.mapReading}
              </span>
            )}
            {student.mapMath !== undefined && (
              <span className="badge badge-map" title={`MAP Math: ${student.mapMath}`}>
                MM:{student.mapMath}
              </span>
            )}
          </div>
        </div>

        {/* Lock button */}
        <button
          className={`lock-btn ${locked ? "locked" : ""}`}
          onClick={toggleLock}
          title={locked ? "Unlock student (allow auto-placement)" : "Lock student (preserve placement)"}
          aria-label={locked ? "Unlock" : "Lock"}
        >
          {locked ? "🔒" : "🔓"}
        </button>
      </div>

      {/* ── Hover tooltip ─────────────────────────────────────── */}
      {tooltip &&
        createPortal(
          <div
            className="student-tooltip"
            style={{ position: "fixed", top: tooltip.y, left: tooltip.x }}
          >
            <div className="tt-header">
              <span className="tt-name">{student.lastName}, {student.firstName}</span>
              <span className="tt-grade">Grade {student.grade}</span>
            </div>
            <div className="tt-body">
              <div className="tt-row">
                <span className="tt-label">ID</span>
                <span>#{student.id}</span>
              </div>
              <div className="tt-row">
                <span className="tt-label">Gender</span>
                <span>{student.gender === "F" ? "Female" : "Male"}</span>
              </div>
              <div className="tt-row">
                <span className="tt-label">Status</span>
                <span className={specialEd.status !== "None" ? "tt-flag" : ""}>
                  {specialEd.status === "None" ? "General Ed" : specialEd.status}
                </span>
              </div>
              {(specialEd.requiresCoTeachReading || specialEd.requiresCoTeachMath) && (
                <div className="tt-row">
                  <span className="tt-label">Co-teach</span>
                  <span>
                    {[
                      specialEd.requiresCoTeachReading && "Reading",
                      specialEd.requiresCoTeachMath && "Math",
                    ]
                      .filter(Boolean)
                      .join(" + ")}
                  </span>
                </div>
              )}
              <div className="tt-row">
                <span className="tt-label">Acad. Tier</span>
                <span className={intervention.academicTier === 3 ? "tt-flag" : ""}>
                  {intervention.academicTier}
                </span>
              </div>
              <div className="tt-row">
                <span className="tt-label">Behavior Tier</span>
                <span className={behaviorTier === 3 ? "tt-flag" : ""}>{behaviorTier}</span>
              </div>
              {(student.referrals ?? 0) > 0 && (
                <div className="tt-row">
                  <span className="tt-label">Referrals</span>
                  <span className="tt-flag">{student.referrals}</span>
                </div>
              )}

              {/* Scores */}
              {(student.mapReading !== undefined ||
                student.mapMath !== undefined ||
                student.ireadyReading ||
                student.ireadyMath) && (
                <>
                  <hr className="tt-sep" />
                  {student.mapReading !== undefined && (
                    <div className="tt-row">
                      <span className="tt-label">MAP Reading</span>
                      <span>{student.mapReading}</span>
                    </div>
                  )}
                  {student.mapMath !== undefined && (
                    <div className="tt-row">
                      <span className="tt-label">MAP Math</span>
                      <span>{student.mapMath}</span>
                    </div>
                  )}
                  {student.ireadyReading && (
                    <div className="tt-row">
                      <span className="tt-label">iReady Read</span>
                      <span>{student.ireadyReading}</span>
                    </div>
                  )}
                  {student.ireadyMath && (
                    <div className="tt-row">
                      <span className="tt-label">iReady Math</span>
                      <span>{student.ireadyMath}</span>
                    </div>
                  )}
                </>
              )}


              {student.teacherNotes && (
                <>
                  <hr className="tt-sep" />
                  <div className="tt-row">
                    <span className="tt-label">Teacher Notes</span>
                    <span className="tt-no-contact">{student.teacherNotes}</span>
                  </div>
                </>
              )}

              {/* No-contact */}
              {noContactNames.length > 0 && (
                <>
                  <hr className="tt-sep" />
                  <div className="tt-row">
                    <span className="tt-label">No-contact</span>
                    <span className="tt-no-contact">{noContactNames.join(", ")}</span>
                  </div>
                </>
              )}

              {/* Pre-assigned / lock */}
              {(isPreassigned || locked) && (
                <>
                  <hr className="tt-sep" />
                  {isPreassigned && (
                    <div className="tt-row">
                      <span className="tt-label">Pre-assigned</span>
                      <span>📌 {student.preassignedTeacher}</span>
                    </div>
                  )}
                  {locked && (
                    <div className="tt-row">
                      <span className="tt-label">Placement</span>
                      <span>🔒 Locked</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  )
})
