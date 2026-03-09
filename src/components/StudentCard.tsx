import { memo, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Student } from "../types"
import { getClassroomsForGrade } from "../utils/classroomInit"
import { CO_TEACH_LABELS, getStudentCoTeachTotal, getStudentRequiredCoTeachCategories } from "../utils/coTeach"
import {
  getClassroomTagSupportLoadBreakdown,
  getGradeTagSupportLoadSummary,
  getStudentTagSupportContributions,
  getStudentTagSupportLoad,
} from "../utils/tagSupportLoad"
import { useApp } from "../store/AppContext"
import { useDrag } from "../store/DragContext"
import { getStudentTeacherFitForClassroom } from "../utils/teacherFit"

interface StudentCardProps {
  student: Student
  classroomId: string | null
}

function tierClass(tier: 1 | 2 | 3): string {
  if (tier === 3) return "tier-3"
  if (tier === 2) return "tier-2"
  return "tier-1"
}

function formatContribution(weight: number): string {
  return weight > 0 ? `+${weight}` : `${weight}`
}

export const StudentCard = memo(function StudentCard({ student, classroomId }: StudentCardProps) {
  const { state, dispatch } = useApp()
  const { startDrag, clearDrag } = useDrag()

  const { specialEd, intervention, behaviorTier, locked } = student
  const cardRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    return () => clearTimeout(timerRef.current)
  }, [])

  const currentClassroom = useMemo(
    () => (classroomId ? state.classrooms.find((classroom) => classroom.id === classroomId) ?? null : null),
    [classroomId, state.classrooms]
  )
  const gradeRooms = useMemo(() => getClassroomsForGrade(state.classrooms, student.grade), [state.classrooms, student.grade])
  const teacherFit = currentClassroom ? getStudentTeacherFitForClassroom(student, currentClassroom, state.teacherProfiles) : null
  const isPoorTeacherFit = Boolean(teacherFit?.isPoorFit)
  const isKindergarten = student.grade === "K"
  const tagSupportLoad = useMemo(() => getStudentTagSupportLoad(student), [student])
  const tagContributions = useMemo(() => getStudentTagSupportContributions(student), [student])
  const roomTagBreakdown = useMemo(
    () => (currentClassroom ? getClassroomTagSupportLoadBreakdown(currentClassroom) : null),
    [currentClassroom]
  )
  const gradeTagSummary = useMemo(() => getGradeTagSupportLoadSummary(gradeRooms, student.grade), [gradeRooms, student.grade])

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
      setTooltip({ x, y })
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

  const relatedRuleCount = state.relationshipRules.filter((rule) => rule.grade === student.grade && rule.studentIds.includes(student.id)).length
  const coTeachCategories = getStudentRequiredCoTeachCategories(student)
  const totalCoTeachMinutes = getStudentCoTeachTotal(student)
  const noContactNames = (student.noContactWith ?? []).map((id) => {
    const noContact = state.allStudents.find((entry) => entry.id === id)
    return noContact ? `${noContact.firstName} ${noContact.lastName}` : `#${id}`
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
        title={`${student.firstName} ${student.lastName} - Drag to move. Click lock to pin.`}
      >
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

            {totalCoTeachMinutes > 0 && (
              <span className="badge badge-coteach" title={`Co-teach required: ${totalCoTeachMinutes} minutes total`}>
                CT:{totalCoTeachMinutes}
              </span>
            )}

            <span className={`badge badge-tier ${tierClass(intervention.academicTier)}`} title={`Academic Tier ${intervention.academicTier}`}>
              A{intervention.academicTier}
            </span>

            <span className={`badge badge-tier ${tierClass(behaviorTier)}`} title={`Behavior Tier ${behaviorTier}`}>
              B{behaviorTier}
            </span>

            {(student.referrals ?? 0) > 0 && (
              <span className="badge badge-referrals" title={`${student.referrals} referral(s)`}>
                {student.referrals}R
              </span>
            )}

            {isKindergarten && student.briganceReadiness !== undefined && (
              <span className="badge badge-map" title={`Brigance readiness: ${student.briganceReadiness}`}>
                BR:{student.briganceReadiness}
              </span>
            )}

            {!isKindergarten && student.mapReading !== undefined && (
              <span className="badge badge-map" title={`MAP Reading: ${student.mapReading}`}>
                MR:{student.mapReading}
              </span>
            )}
            {!isKindergarten && student.mapMath !== undefined && (
              <span className="badge badge-map" title={`MAP Math: ${student.mapMath}`}>
                MM:{student.mapMath}
              </span>
            )}

            {tagContributions.length > 0 && (
              <span className={`badge badge-tag-load ${tagSupportLoad < 0 ? "badge-tag-load-negative" : ""}`} title={`Tag-based support load: ${tagSupportLoad}`}>
                TSL:{tagSupportLoad}
              </span>
            )}

            {(student.tags?.length ?? 0) > 0 && (
              <span className="badge badge-tags" title={(student.tags ?? []).join(", ")}>
                Tags:{student.tags!.length}
              </span>
            )}

            {isPoorTeacherFit && <span className="badge badge-poor-fit">Poor Fit</span>}

            {relatedRuleCount > 0 && <span className="badge badge-referrals" title={`${relatedRuleCount} relationship rule(s)`}>Link:{relatedRuleCount}</span>}
          </div>
        </div>

        <button
          className={`lock-btn ${locked ? "locked" : ""}`}
          onClick={toggleLock}
          title={locked ? "Unlock student (allow auto-placement)" : "Lock student (preserve placement)"}
          aria-label={locked ? "Unlock" : "Lock"}
        >
          {locked ? "\uD83D\uDD12" : "\uD83D\uDD13"}
        </button>
      </div>

      {tooltip &&
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
              {coTeachCategories.length > 0 && (
                <div className="tt-row">
                  <span className="tt-label">Co-teach</span>
                  <span>{coTeachCategories.map((category) => `${CO_TEACH_LABELS[category]} (${student.coTeachMinutes[category]}m)`).join(", ")}</span>
                </div>
              )}
              <div className="tt-row">
                <span className="tt-label">Acad. Tier</span>
                <span className={intervention.academicTier === 3 ? "tt-flag" : ""}>{intervention.academicTier}</span>
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

              {((isKindergarten && student.briganceReadiness !== undefined) ||
                (!isKindergarten && (student.mapReading !== undefined || student.mapMath !== undefined || student.ireadyReading || student.ireadyMath))) && (
                <>
                  <hr className="tt-sep" />
                  {isKindergarten && student.briganceReadiness !== undefined && (
                    <div className="tt-row">
                      <span className="tt-label">Brigance</span>
                      <span>{student.briganceReadiness}</span>
                    </div>
                  )}
                  {!isKindergarten && student.mapReading !== undefined && (
                    <div className="tt-row">
                      <span className="tt-label">MAP Reading</span>
                      <span>{student.mapReading}</span>
                    </div>
                  )}
                  {!isKindergarten && student.mapMath !== undefined && (
                    <div className="tt-row">
                      <span className="tt-label">MAP Math</span>
                      <span>{student.mapMath}</span>
                    </div>
                  )}
                  {!isKindergarten && student.ireadyReading && (
                    <div className="tt-row">
                      <span className="tt-label">iReady Read</span>
                      <span>{student.ireadyReading}</span>
                    </div>
                  )}
                  {!isKindergarten && student.ireadyMath && (
                    <div className="tt-row">
                      <span className="tt-label">iReady Math</span>
                      <span>{student.ireadyMath}</span>
                    </div>
                  )}
                </>
              )}

              {(tagContributions.length > 0 || roomTagBreakdown) && (
                <>
                  <hr className="tt-sep" />
                  <div className="tt-row">
                    <span className="tt-label">Tag Load</span>
                    <span className={tagSupportLoad >= 4 ? "tt-flag" : ""}>{tagSupportLoad}</span>
                  </div>
                  {tagContributions.length > 0 && (
                    <div className="tt-row">
                      <span className="tt-label">Load Tags</span>
                      <span className="tt-no-contact">
                        {tagContributions
                          .map((contribution) => `${contribution.tag} (${formatContribution(contribution.weight)})`)
                          .join(", ")}
                      </span>
                    </div>
                  )}
                  {roomTagBreakdown && (
                    <>
                      <div className="tt-row">
                        <span className="tt-label">Room Tag Load</span>
                        <span className={roomTagBreakdown.total - gradeTagSummary.averageTotal >= 3 ? "tt-poor-fit" : ""}>
                          {roomTagBreakdown.total.toFixed(1)} total
                        </span>
                      </div>
                      <div className="tt-row">
                        <span className="tt-label">Grade Avg</span>
                        <span>{gradeTagSummary.averageTotal.toFixed(1)}</span>
                      </div>
                      <div className="tt-row">
                        <span className="tt-label">Room Impact</span>
                        <span>{formatContribution(tagSupportLoad)} from this student</span>
                      </div>
                    </>
                  )}
                </>
              )}

              {(student.tags?.length ?? 0) > 0 && (
                <>
                  <hr className="tt-sep" />
                  <div className="tt-row">
                    <span className="tt-label">Student Tags</span>
                    <span className="tt-no-contact">{student.tags?.join(", ")}</span>
                  </div>
                </>
              )}

              {teacherFit && currentClassroom && (student.tags?.length ?? 0) > 0 && (
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
                    <span>Locked</span>
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
