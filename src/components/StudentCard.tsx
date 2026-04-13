import { memo, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Student } from "../types"
import { CO_TEACH_LABELS, getStudentCoTeachTotal, getStudentRequiredCoTeachCategories } from "../utils/coTeach"
import { useApp } from "../store/AppContext"
import { useDrag } from "../store/DragContext"
import { getStudentTeacherFitForClassroom } from "../utils/teacherFit"
import { StudentEditorModal } from "./StudentEditorModal"

interface StudentCardProps {
  student: Student
  classroomId: string | null
}

function TierPips({ tier, label }: { tier: number; label: string }) {
  const clampedTier = Math.min(Math.max(tier, 1), 3)
  const title = `${label === "ACA" ? "Academic" : "Behavior"} Tier ${tier}`
  return (
    <span className={`tier-pips tier-pips-${clampedTier}`} title={title}>
      <span className="tier-pip-label">{label}</span>
      {[1, 2, 3].map((i) => (
        <span key={i} className={`tier-pip${i <= tier ? " filled" : ""}`} />
      ))}
    </span>
  )
}

export const StudentCard = memo(function StudentCard({ student, classroomId }: StudentCardProps) {
  const { state, dispatch } = useApp()
  const { startDrag, clearDrag } = useDrag()
  const showTeacherDetails = state.showTeacherNames

  const { specialEd, intervention, behaviorTier, locked } = student
  const cardRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null)
  const [editingStudent, setEditingStudent] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    return () => clearTimeout(timerRef.current)
  }, [editingStudent])

  const currentClassroom = useMemo(
    () => (classroomId ? state.classrooms.find((classroom) => classroom.id === classroomId) ?? null : null),
    [classroomId, state.classrooms]
  )
  const teacherFit =
    showTeacherDetails && currentClassroom
      ? getStudentTeacherFitForClassroom(student, currentClassroom, state.teacherProfiles)
      : null
  const isPoorTeacherFit = Boolean(teacherFit?.isPoorFit)
  const isTeacherFixed = Boolean(student.preassignedTeacher?.trim())

  const onMouseEnter = () => {
    timerRef.current = setTimeout(() => {
      if (!cardRef.current) return
      const tooltipWidth = 320
      const tooltipHeight = 460
      const rect = cardRef.current.getBoundingClientRect()
      let x = rect.right + 8
      if (x + tooltipWidth > window.innerWidth - 8) x = rect.left - tooltipWidth - 8
      let y = rect.top
      if (y + tooltipHeight > window.innerHeight - 8) y = window.innerHeight - tooltipHeight - 8
      if (!editingStudent && !expanded) setTooltip({ x, y })
    }, 500)
  }

  const onMouseLeave = () => {
    clearTimeout(timerRef.current)
    setTooltip(null)
  }

  const cardClass = [
    "student-card",
    specialEd.status === "IEP" ? "card-iep" : specialEd.status === "Referral" ? "card-referral" : "",
    locked ? "card-locked" : "",
    isPoorTeacherFit ? "card-poor-fit" : "",
    isTeacherFixed ? "card-teacher-fixed" : "",
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

  const suppressCardDrag = (e: React.MouseEvent | React.PointerEvent | React.DragEvent) => {
    e.stopPropagation()
    if ("preventDefault" in e) {
      e.preventDefault()
    }
  }

  const toggleLock = (e: React.MouseEvent) => {
    e.stopPropagation()
    dispatch({ type: "TOGGLE_LOCK", payload: student.id })
  }

  const relatedRuleCount = state.relationshipRules.filter((rule) => rule.grade === student.grade && rule.studentIds.includes(student.id)).length
  const coTeachCategories = getStudentRequiredCoTeachCategories(student)
  const totalCoTeachMinutes = getStudentCoTeachTotal(student)
  const noContactNames = (student.noContactWith ?? []).map((id) => {
    const noContact = state.allStudents.find((entry) => entry.id === id)
    return noContact ? `${noContact.firstName} ${noContact.lastName}` : `#${id}`
  })

  // Build co-teach detail string for tooltip
  const coTeachDetailString = coTeachCategories
    .map((cat) => `${CO_TEACH_LABELS[cat]} (${student.coTeachMinutes[cat]}m)`)
    .join(", ")

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
        title={`${student.firstName} ${student.lastName} - Drag to move. Use Edit to update student data.`}
      >
        <div className="student-card-main">
          <span className="drag-handle" aria-hidden>...</span>

          <div className="card-body">
            <div className={`card-name ${isPoorTeacherFit ? "card-name-poor-fit" : ""}`}>
              {student.lastName}, {student.firstName}
            </div>
            <div className="card-badges">
              <span className={`badge badge-gender badge-${student.gender.toLowerCase()}`}>{student.gender}</span>

              {specialEd.status !== "None" && (
                <span className={`badge badge-sped badge-${specialEd.status.toLowerCase()}`}>{specialEd.status}</span>
              )}

              <TierPips tier={intervention.academicTier} label="ACA" />
              <TierPips tier={behaviorTier} label="SEB" />

              {student.ell && <span className="badge badge-ell" title="English Language Learner">EL</span>}
              {student.section504 && <span className="badge badge-504" title="Section 504 plan">504</span>}

              {(student.referrals ?? 0) > 0 && (
                <span className="badge badge-referrals" title={`${student.referrals} referral(s)`}>
                  {student.referrals}R
                </span>
              )}

              {totalCoTeachMinutes > 0 && (
                <span
                  className="badge badge-coteach-total"
                  title={`Co-teach required: ${totalCoTeachMinutes} minutes total${coTeachDetailString ? ` — ${coTeachDetailString}` : ""}`}
                >
                  CT:{totalCoTeachMinutes}
                </span>
              )}

              {(student.tags?.length ?? 0) > 0 && (
                <span className="badge badge-tags" title={(student.tags ?? []).join(", ")}>
                  Chars:{student.tags!.length}
                </span>
              )}

              {isTeacherFixed && (
                <span className="badge badge-assigned-teacher" title={`Assigned teacher: ${student.preassignedTeacher}`}>
                  Teacher Fixed
                </span>
              )}

              {isPoorTeacherFit && <span className="badge badge-poor-fit">Poor Fit</span>}

              {relatedRuleCount > 0 && <span className="badge badge-referrals" title={`${relatedRuleCount} relationship rule(s)`}>Link:{relatedRuleCount}</span>}
            </div>
          </div>

          <div className="student-card-actions">
            <button
              className="card-action-btn"
              draggable={false}
              onMouseDown={suppressCardDrag}
              onPointerDown={suppressCardDrag}
              onDragStart={suppressCardDrag}
              onClick={(e) => {
                e.stopPropagation()
                setEditingStudent(true)
              }}
              title="Edit student data"
              aria-label="Edit student"
            >
              Edit
            </button>
            <button
              className={`lock-btn ${locked ? "locked" : ""}`}
              disabled={isTeacherFixed}
              draggable={false}
              onMouseDown={suppressCardDrag}
              onPointerDown={suppressCardDrag}
              onDragStart={suppressCardDrag}
              onClick={toggleLock}
              title={isTeacherFixed ? "Assigned teacher students stay locked until the assigned teacher is cleared in Edit." : locked ? "Unlock student (allow auto-placement)" : "Lock student (preserve placement)"}
              aria-label={isTeacherFixed ? "Teacher-fixed lock" : locked ? "Unlock" : "Lock"}
            >
              {locked ? "\uD83D\uDD12" : "\uD83D\uDD13"}
            </button>
            <button
              className={`expand-btn ${expanded ? "expanded" : ""}`}
              draggable={false}
              onMouseDown={suppressCardDrag}
              onPointerDown={suppressCardDrag}
              onDragStart={suppressCardDrag}
              onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
              title={expanded ? "Collapse details" : "Expand details"}
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? "▴" : "▾"}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="card-expanded-detail">
            {coTeachDetailString && (
              <div className="card-detail-row">
                <span className="card-detail-label">Co-teach</span>
                <span className="card-detail-value">{coTeachDetailString}</span>
              </div>
            )}
            {student.briganceReadiness !== undefined && (
              <div className="card-detail-row">
                <span className="card-detail-label">Brigance</span>
                <span className="card-detail-value">{student.briganceReadiness}</span>
              </div>
            )}
            {student.mapReading !== undefined && (
              <div className="card-detail-row">
                <span className="card-detail-label">MAP R</span>
                <span className="card-detail-value">{student.mapReading}</span>
              </div>
            )}
            {student.mapMath !== undefined && (
              <div className="card-detail-row">
                <span className="card-detail-label">MAP M</span>
                <span className="card-detail-value">{student.mapMath}</span>
              </div>
            )}
            {student.ireadyReading && (
              <div className="card-detail-row">
                <span className="card-detail-label">iR Read</span>
                <span className="card-detail-value">{student.ireadyReading}</span>
              </div>
            )}
            {student.ireadyMath && (
              <div className="card-detail-row">
                <span className="card-detail-label">iR Math</span>
                <span className="card-detail-value">{student.ireadyMath}</span>
              </div>
            )}
            {student.academicTierNotes && (
              <div className="card-detail-row">
                <span className="card-detail-label">Acad. Notes</span>
                <span className="card-detail-value">{student.academicTierNotes}</span>
              </div>
            )}
            {student.behaviorTierNotes && (
              <div className="card-detail-row">
                <span className="card-detail-label">Beh. Notes</span>
                <span className="card-detail-value">{student.behaviorTierNotes}</span>
              </div>
            )}
            {(student.tags?.length ?? 0) > 0 && (
              <div className="card-detail-row">
                <span className="card-detail-label">Chars</span>
                <span className="card-detail-value">{student.tags!.join(", ")}</span>
              </div>
            )}
            {showTeacherDetails && teacherFit && currentClassroom && (
              <div className="card-detail-row">
                <span className="card-detail-label">Teacher Fit</span>
                <span className={`card-detail-value ${teacherFit.isPoorFit ? "card-detail-flag" : ""}`}>
                  {teacherFit.isPoorFit ? "Poor fit" : teacherFit.missingProfile ? "No profile" : "OK"}
                </span>
              </div>
            )}
            {student.teacherNotes && (
              <div className="card-detail-row">
                <span className="card-detail-label">Notes</span>
                <span className="card-detail-value">{student.teacherNotes}</span>
              </div>
            )}
            {noContactNames.length > 0 && (
              <div className="card-detail-row">
                <span className="card-detail-label">No-contact</span>
                <span className="card-detail-value card-detail-flag">{noContactNames.join(", ")}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {editingStudent && <StudentEditorModal student={student} defaultGrade={student.grade} onClose={() => setEditingStudent(false)} />}

      {tooltip && !editingStudent && !expanded &&
        createPortal(
          <div className="student-tooltip" style={{ position: "fixed", top: tooltip.y, left: tooltip.x }}>
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
              {student.ell && (
                <div className="tt-row">
                  <span className="tt-label">EL</span>
                  <span>English Language Learner</span>
                </div>
              )}
              {student.section504 && (
                <div className="tt-row">
                  <span className="tt-label">504</span>
                  <span>Section 504 plan</span>
                </div>
              )}
              {coTeachCategories.length > 0 && (
                <div className="tt-row">
                  <span className="tt-label">Co-teach</span>
                  <span>{coTeachDetailString}</span>
                </div>
              )}
              <div className="tt-row">
                <span className="tt-label">Acad. Tier</span>
                <span className={intervention.academicTier >= 3 ? "tt-flag" : ""}>{intervention.academicTier}</span>
              </div>
              <div className="tt-row">
                <span className="tt-label">Behavior Tier</span>
                <span className={behaviorTier >= 3 ? "tt-flag" : ""}>{behaviorTier}</span>
              </div>
              {student.academicTierNotes && (
                <div className="tt-row">
                  <span className="tt-label">Academic Notes</span>
                  <span className="tt-no-contact">{student.academicTierNotes}</span>
                </div>
              )}
              {student.behaviorTierNotes && (
                <div className="tt-row">
                  <span className="tt-label">Behavior Notes</span>
                  <span className="tt-no-contact">{student.behaviorTierNotes}</span>
                </div>
              )}
              {(student.referrals ?? 0) > 0 && (
                <div className="tt-row">
                  <span className="tt-label">Referrals</span>
                  <span className="tt-flag">{student.referrals}</span>
                </div>
              )}

              {((student.briganceReadiness !== undefined) ||
                (student.mapReading !== undefined || student.mapMath !== undefined || student.ireadyReading || student.ireadyMath)) && (
                <>
                  <hr className="tt-sep" />
                  {student.briganceReadiness !== undefined && (
                    <div className="tt-row">
                      <span className="tt-label">Brigance</span>
                      <span>{student.briganceReadiness}</span>
                    </div>
                  )}
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

              {(student.tags?.length ?? 0) > 0 && (
                <>
                  <hr className="tt-sep" />
                  <div className="tt-row">
                    <span className="tt-label">Student Characteristics</span>
                    <span className="tt-no-contact">{student.tags?.join(", ")}</span>
                  </div>
                </>
              )}

              {showTeacherDetails && teacherFit && currentClassroom && (student.tags?.length ?? 0) > 0 && (
                <>
                  <hr className="tt-sep" />
                  <div className="tt-row">
                    <span className="tt-label">Teacher Fit</span>
                    <span className={teacherFit.isPoorFit ? "tt-poor-fit" : ""}>
                      {teacherFit.isPoorFit ? "Poor fit" : teacherFit.missingProfile ? "No teacher profile" : "Acceptable fit"}
                    </span>
                  </div>
                  <div className="tt-row">
                    <span className="tt-label">Teacher</span>
                    <span>{currentClassroom.teacherName || "Unnamed teacher"}</span>
                  </div>
                  {teacherFit.weakestTags.length > 0 && (
                    <div className="tt-row">
                      <span className="tt-label">Watchouts</span>
                      <span className="tt-no-contact">{teacherFit.weakestTags.join(", ")}</span>
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

              {noContactNames.length > 0 && (
                <>
                  <hr className="tt-sep" />
                  <div className="tt-row">
                    <span className="tt-label">No-contact</span>
                    <span className="tt-no-contact">{noContactNames.join(", ")}</span>
                  </div>
                </>
              )}

              {locked && (
                <>
                  <hr className="tt-sep" />
                  <div className="tt-row">
                    <span className="tt-label">Placement</span>
                    <span>{isTeacherFixed ? `Teacher-fixed (${student.preassignedTeacher})` : "Locked"}</span>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  )
})
