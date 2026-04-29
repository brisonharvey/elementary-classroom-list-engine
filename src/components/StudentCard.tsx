import { memo, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { CoTeachCategory, Student } from "../types"
import { CO_TEACH_LABELS, getStudentCoTeachTotal, getStudentRequiredCoTeachCategories } from "../utils/coTeach"
import { useApp } from "../store/AppContext"
import { useDrag } from "../store/DragContext"
import { getStudentTeacherFitForClassroom } from "../utils/teacherFit"
import { StudentEditorModal } from "./StudentEditorModal"

interface StudentCardProps {
  student: Student
  classroomId: string | null
}

function tierClass(tier: number): string {
  if (tier >= 3) return "tier-3"
  if (tier >= 2) return "tier-2"
  return "tier-1"
}

const CO_TEACH_ABBREVIATIONS: Record<CoTeachCategory, string> = {
  reading: "R",
  writing: "W",
  scienceSocialStudies: "SS",
  math: "M",
  behavior: "B",
  social: "Soc",
  vocational: "Voc",
}

type ParentRequestStatus = "none" | "upheld" | "not-upheld"

export const StudentCard = memo(function StudentCard({ student, classroomId }: StudentCardProps) {
  const { state, dispatch } = useApp()
  const { startDrag, clearDrag } = useDrag()
  const showTeacherDetails = state.showTeacherNames

  const { specialEd, intervention, behaviorTier, locked } = student
  const cardRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null)
  const [editingStudent, setEditingStudent] = useState(false)

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
  const isKindergarten = student.grade === "K"
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
      if (!editingStudent) setTooltip({ x, y })
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
  const coTeachBadges = coTeachCategories.map((category) => ({
    category,
    abbreviation: CO_TEACH_ABBREVIATIONS[category],
    minutes: student.coTeachMinutes[category] ?? 0,
    label: CO_TEACH_LABELS[category],
  }))
  const noContactNames = (student.noContactWith ?? []).map((id) => {
    const noContact = state.allStudents.find((entry) => entry.id === id)
    return noContact ? `${noContact.firstName} ${noContact.lastName}` : `#${id}`
  })
  const assignedRoomByStudentId = useMemo(() => {
    const entries = new Map<number, string>()
    for (const classroom of state.classrooms) {
      for (const roomStudent of classroom.students) {
        entries.set(roomStudent.id, classroom.id)
      }
    }
    return entries
  }, [state.classrooms])
  const parentPreferredNames = (student.parentPreferredWith ?? []).map((id) => {
    const peer = state.allStudents.find((entry) => entry.id === id)
    return peer ? `${peer.firstName} ${peer.lastName}` : `#${id}`
  })
  const parentAvoidNames = (student.parentAvoidWith ?? []).map((id) => {
    const peer = state.allStudents.find((entry) => entry.id === id)
    return peer ? `${peer.firstName} ${peer.lastName}` : `#${id}`
  })
  const parentRequestStatus: ParentRequestStatus = useMemo(() => {
    const preferredIds = student.parentPreferredWith ?? []
    const avoidIds = student.parentAvoidWith ?? []
    if (preferredIds.length === 0 && avoidIds.length === 0) return "none"
    if (!classroomId) return "not-upheld"

    const preferredUpheld = preferredIds.every((peerId) => assignedRoomByStudentId.get(peerId) === classroomId)
    const avoidUpheld = avoidIds.every((peerId) => assignedRoomByStudentId.get(peerId) !== classroomId)
    return preferredUpheld && avoidUpheld ? "upheld" : "not-upheld"
  }, [assignedRoomByStudentId, classroomId, student.parentAvoidWith, student.parentPreferredWith])
  const parentRequestTitle =
    parentRequestStatus === "none"
      ? ""
      : [
          `Parent request ${parentRequestStatus === "upheld" ? "upheld" : "not upheld"}`,
          parentPreferredNames.length > 0 ? `With: ${parentPreferredNames.join(", ")}` : "",
          parentAvoidNames.length > 0 ? `Apart: ${parentAvoidNames.join(", ")}` : "",
        ].filter(Boolean).join(" | ")

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

              <span className={`badge badge-tier ${tierClass(intervention.academicTier)}`} title={`Academic Tier ${intervention.academicTier}`}>
                ACA {intervention.academicTier}
              </span>

              <span className={`badge badge-tier ${tierClass(behaviorTier)}`} title={`Behavior Tier ${behaviorTier}`}>
                SEB {behaviorTier}
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
                  MAP R:{student.mapReading}
                </span>
              )}
              {!isKindergarten && student.mapMath !== undefined && (
                <span className="badge badge-map" title={`MAP Math: ${student.mapMath}`}>
                  MAP M:{student.mapMath}
                </span>
              )}
              {!isKindergarten && student.ireadyReading && (
                <span className="badge badge-iready" title={`iReady Reading: ${student.ireadyReading}`}>
                  IR:{student.ireadyReading}
                </span>
              )}
              {!isKindergarten && student.ireadyMath && (
                <span className="badge badge-iready" title={`iReady Math: ${student.ireadyMath}`}>
                  IM:{student.ireadyMath}
                </span>
              )}
              {(student.tags?.length ?? 0) > 0 && (
                <span className="badge badge-tags" title={(student.tags ?? []).join(", ")}>
                  Chars:{student.tags!.length}
                </span>
              )}

              {student.ell && student.elLevel && (
                <span className="badge badge-el" title={`EL support: ${student.elLevel}`}>
                  EL:{student.elLevel}
                </span>
              )}
              {student.elNeedsCoTeach && (
                <span className="badge badge-el-coteach" title="EL: co-teach room suggested">EL-CT</span>
              )}

              {student.interventionLevel && (
                <span className="badge badge-intervention" title={`Intervention support: ${student.interventionLevel}`}>
                  INT:{student.interventionLevel}
                </span>
              )}
              {student.interventionNeedsCoTeach && (
                <span className="badge badge-intervention-coteach" title="Intervention: co-teach room suggested">INT-CT</span>
              )}

              {parentRequestStatus !== "none" && (
                <span className="badge badge-parent-request" title={parentRequestTitle}>
                  {parentRequestStatus === "upheld" ? "PR:Yes" : "PR:No"}
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
          </div>
        </div>

        {coTeachBadges.length > 0 && (
          <div className="student-card-coteach-row">
            <span className="badge badge-coteach-total" title={`Co-teach required: ${totalCoTeachMinutes} minutes total`}>
              CT:{totalCoTeachMinutes}
            </span>
            {coTeachBadges.map((entry) => (
              <span
                key={entry.category}
                className={`badge badge-coteach badge-coteach-${entry.category}`}
                title={`${entry.label}: ${entry.minutes} minute${entry.minutes === 1 ? "" : "s"}`}
              >
                {entry.abbreviation}:{entry.minutes}
              </span>
            ))}
          </div>
        )}
      </div>

      {editingStudent && <StudentEditorModal student={student} defaultGrade={student.grade} onClose={() => setEditingStudent(false)} />}

      {tooltip && !editingStudent &&
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

              {parentRequestStatus !== "none" && (
                <>
                  <hr className="tt-sep" />
                  <div className="tt-row">
                    <span className="tt-label">Parent Request</span>
                    <span className={parentRequestStatus === "upheld" ? "" : "tt-flag"}>
                      {parentRequestStatus === "upheld" ? "Upheld" : "Not upheld"}
                    </span>
                  </div>
                  {parentPreferredNames.length > 0 && (
                    <div className="tt-row">
                      <span className="tt-label">Requested With</span>
                      <span className="tt-no-contact">{parentPreferredNames.join(", ")}</span>
                    </div>
                  )}
                  {parentAvoidNames.length > 0 && (
                    <div className="tt-row">
                      <span className="tt-label">Requested Apart</span>
                      <span className="tt-no-contact">{parentAvoidNames.join(", ")}</span>
                    </div>
                  )}
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







