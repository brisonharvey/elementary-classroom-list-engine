import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { GRADES, STUDENT_TAGS, Student, StudentTag, Grade, CoTeachCategory } from "../types"
import { useApp } from "../store/AppContext"
import { CO_TEACH_CATEGORIES, CO_TEACH_LABELS, MAX_COTEACH_MINUTES } from "../utils/coTeach"

interface StudentEditorModalProps {
  student?: Student
  defaultGrade: Grade
  onClose: () => void
}

interface StudentFormState {
  id: string
  grade: Grade
  firstName: string
  lastName: string
  gender: "M" | "F"
  specialEdStatus: Student["specialEd"]["status"]
  academicTier: string
  behaviorTier: string
  academicTierNotes: string
  behaviorTierNotes: string
  referrals: string
  briganceReadiness: string
  mapReading: string
  mapMath: string
  ireadyReading: string
  ireadyMath: string
  ell: boolean
  section504: boolean
  raceEthnicity: string
  teacherNotes: string
  preassignedTeacher: string
  avoidTeachers: string
  noContactWith: string
  preferredWith: string
  tags: StudentTag[]
  coTeachMinutes: Record<CoTeachCategory, string>
}

function createEmptyCoTeachMinutes(): Record<CoTeachCategory, string> {
  return CO_TEACH_CATEGORIES.reduce((acc, category) => {
    acc[category] = ""
    return acc
  }, {} as Record<CoTeachCategory, string>)
}

function buildInitialFormState(student: Student | undefined, defaultGrade: Grade, nextId: number): StudentFormState {
  const coTeachMinutes = createEmptyCoTeachMinutes()
  if (student) {
    for (const category of CO_TEACH_CATEGORIES) {
      const value = student.coTeachMinutes[category]
      coTeachMinutes[category] = value ? String(value) : ""
    }
  }

  return {
    id: student ? String(student.id) : String(nextId),
    grade: student?.grade ?? defaultGrade,
    firstName: student?.firstName ?? "",
    lastName: student?.lastName ?? "",
    gender: student?.gender ?? "M",
    specialEdStatus: student?.specialEd.status ?? "None",
    academicTier: String(student?.intervention.academicTier ?? 1),
    behaviorTier: String(student?.behaviorTier ?? 1),
    academicTierNotes: student?.academicTierNotes ?? "",
    behaviorTierNotes: student?.behaviorTierNotes ?? "",
    referrals: student?.referrals ? String(student.referrals) : "",
    briganceReadiness: student?.briganceReadiness !== undefined ? String(student.briganceReadiness) : "",
    mapReading: student?.mapReading !== undefined ? String(student.mapReading) : "",
    mapMath: student?.mapMath !== undefined ? String(student.mapMath) : "",
    ireadyReading: student?.ireadyReading ?? "",
    ireadyMath: student?.ireadyMath ?? "",
    ell: Boolean(student?.ell),
    section504: Boolean(student?.section504),
    raceEthnicity: student?.raceEthnicity ?? "",
    teacherNotes: student?.teacherNotes ?? "",
    preassignedTeacher: student?.preassignedTeacher ?? "",
    avoidTeachers: (student?.avoidTeachers ?? []).join("; "),
    noContactWith: (student?.noContactWith ?? []).join(";"),
    preferredWith: (student?.preferredWith ?? []).join(";"),
    tags: student?.tags ? [...student.tags] : [],
    coTeachMinutes,
  }
}

function parseInteger(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (!/^\d+$/.test(trimmed)) return undefined
  const parsed = Number(trimmed)
  if (!Number.isSafeInteger(parsed)) return undefined
  return parsed
}

function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseIdInput(value: string): { ids: number[]; invalidTokens: string[] } {
  if (!value.trim()) return { ids: [], invalidTokens: [] }

  const ids: number[] = []
  const invalidTokens: string[] = []
  for (const token of value.split(/[;,|\s]+/)) {
    const trimmed = token.trim()
    if (!trimmed) continue
    const parsed = parseInteger(trimmed)
    if (parsed === undefined || parsed <= 0) {
      invalidTokens.push(trimmed)
      continue
    }
    ids.push(parsed)
  }

  return { ids: Array.from(new Set(ids)), invalidTokens }
}

function parseTeacherListInput(value: string): string[] {
  const unique: string[] = []
  const seen = new Set<string>()

  for (const token of value.split(/[;,|\n]+/)) {
    const trimmed = token.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(trimmed)
  }

  return unique
}

export function StudentEditorModal({ student, defaultGrade, onClose }: StudentEditorModalProps) {
  const { state, dispatch } = useApp()
  const nextId = useMemo(() => state.allStudents.reduce((max, entry) => Math.max(max, entry.id), 0) + 1, [state.allStudents])
  const [form, setForm] = useState<StudentFormState>(() => buildInitialFormState(student, defaultGrade, nextId))
  const [error, setError] = useState("")

  useEffect(() => {
    setForm(buildInitialFormState(student, defaultGrade, nextId))
    setError("")
  }, [student, defaultGrade, nextId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  const assignedRoom = useMemo(
    () => (student ? state.classrooms.find((classroom) => classroom.students.some((entry) => entry.id === student.id)) ?? null : null),
    [state.classrooms, student]
  )

  const sameGradePeers = useMemo(
    () =>
      state.allStudents
        .filter((entry) => entry.grade === form.grade && entry.id !== student?.id)
        .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)),
    [form.grade, state.allStudents, student?.id]
  )

  const sameGradePeerSummary = sameGradePeers.slice(0, 10).map((peer) => `#${peer.id} ${peer.lastName}, ${peer.firstName}`).join(" | ")

  const setField = <K extends keyof StudentFormState>(key: K, value: StudentFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const setCoTeachMinute = (category: CoTeachCategory, value: string) => {
    setForm((current) => ({
      ...current,
      coTeachMinutes: {
        ...current.coTeachMinutes,
        [category]: value,
      },
    }))
  }

  const toggleTag = (tag: StudentTag) => {
    setForm((current) => ({
      ...current,
      tags: current.tags.includes(tag) ? current.tags.filter((entry) => entry !== tag) : [...current.tags, tag],
    }))
  }

  const save = () => {
    const id = parseInteger(form.id)
    if (id === undefined || id <= 0) {
      setError("Student ID must be a positive whole number.")
      return
    }

    if (state.allStudents.some((entry) => entry.id === id && entry.id !== student?.id)) {
      setError(`Student ID ${id} is already in use.`)
      return
    }

    const firstName = form.firstName.trim()
    const lastName = form.lastName.trim()
    if (!firstName || !lastName) {
      setError("First and last name are required.")
      return
    }

    const academicTier = parseInteger(form.academicTier)
    const behaviorTier = parseInteger(form.behaviorTier)
    if (academicTier === undefined || academicTier <= 0 || behaviorTier === undefined || behaviorTier <= 0) {
      setError("Academic and behavior tiers must be positive whole numbers.")
      return
    }

    const parsedNoContact = parseIdInput(form.noContactWith)
    const parsedPreferred = parseIdInput(form.preferredWith)
    const avoidTeachers = parseTeacherListInput(form.avoidTeachers)
    if (parsedNoContact.invalidTokens.length > 0 || parsedPreferred.invalidTokens.length > 0) {
      setError("No-contact and preferred-with fields accept only positive student IDs separated by commas, spaces, or semicolons.")
      return
    }

    const peerIds = new Set(state.allStudents.filter((entry) => entry.id !== student?.id).map((entry) => entry.id))
    const missingNoContact = parsedNoContact.ids.filter((peerId) => !peerIds.has(peerId))
    const missingPreferred = parsedPreferred.ids.filter((peerId) => !peerIds.has(peerId))
    if (missingNoContact.length > 0 || missingPreferred.length > 0) {
      setError("One or more referenced student IDs do not exist in the current roster.")
      return
    }

    const invalidPreferred = parsedPreferred.ids.filter((peerId) => {
      const peer = state.allStudents.find((entry) => entry.id === peerId)
      return peer != null && peer.grade !== form.grade
    })
    if (invalidPreferred.length > 0) {
      setError("Preferred-with students must be in the same grade as this student.")
      return
    }

    const coTeachMinutes = CO_TEACH_CATEGORIES.reduce((acc, category) => {
      const parsed = parseInteger(form.coTeachMinutes[category])
      if (parsed && parsed > 0) {
        acc[category] = Math.min(MAX_COTEACH_MINUTES, parsed)
      }
      return acc
    }, {} as Partial<Record<CoTeachCategory, number>>)

    const nextStudent: Student = {
      id,
      grade: form.grade,
      firstName,
      lastName,
      gender: form.gender,
      specialEd: { status: form.specialEdStatus },
      coTeachMinutes,
      intervention: { academicTier },
      behaviorTier,
      academicTierNotes: form.academicTierNotes.trim() || undefined,
      behaviorTierNotes: form.behaviorTierNotes.trim() || undefined,
      referrals: parseInteger(form.referrals) ?? 0,
      briganceReadiness: parseOptionalNumber(form.briganceReadiness),
      mapReading: parseOptionalNumber(form.mapReading),
      mapMath: parseOptionalNumber(form.mapMath),
      ireadyReading: form.ireadyReading.trim() || undefined,
      ireadyMath: form.ireadyMath.trim() || undefined,
      tags: form.tags,
      noContactWith: parsedNoContact.ids,
      preferredWith: parsedPreferred.ids,
      locked: form.preassignedTeacher.trim() ? true : (student?.preassignedTeacher ? false : (student?.locked ?? false)),
      ell: form.ell,
      section504: form.section504,
      raceEthnicity: form.raceEthnicity.trim() || undefined,
      teacherNotes: form.teacherNotes.trim() || undefined,
      preassignedTeacher: form.preassignedTeacher.trim() || undefined,
      avoidTeachers,
    }

    dispatch({
      type: "UPSERT_STUDENT",
      payload: {
        student: nextStudent,
        previousId: student?.id,
      },
    })
    onClose()
  }

  const remove = () => {
    if (!student) return
    const confirmed = window.confirm(`Remove ${student.firstName} ${student.lastName} from the roster? This also removes relationship rules and references.`)
    if (!confirmed) return
    dispatch({ type: "DELETE_STUDENT", payload: student.id })
    onClose()
  }

  return createPortal(
    <div className="student-modal-shell" role="dialog" aria-modal="true" aria-label={student ? "Edit student" : "Add student"}>
      <div className="student-modal-backdrop" onClick={onClose} />
      <div className="student-modal">
        <div className="student-modal-header">
          <div>
            <h2>{student ? `Edit ${student.firstName} ${student.lastName}` : `Add Grade ${defaultGrade} Student`}</h2>
            <p>
              {student
                ? assignedRoom
                  ? `Currently placed in ${assignedRoom.grade}-${assignedRoom.label}${assignedRoom.teacherName ? ` (${assignedRoom.teacherName})` : ""}.`
                  : "Currently unassigned."
                : "New students start unassigned until you drag or auto-place them."}
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>

        <div className="student-modal-body">
          <section className="student-form-section">
            <div className="student-form-section-title">Basics</div>
            <div className="student-form-grid">
              <label className="student-field">
                <span>Student ID</span>
                <input className="snapshot-input" value={form.id} onChange={(e) => setField("id", e.target.value)} />
              </label>
              <label className="student-field">
                <span>Grade</span>
                <select className="snapshot-input" value={form.grade} onChange={(e) => setField("grade", e.target.value as Grade)}>
                  {GRADES.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
                </select>
              </label>
              <label className="student-field">
                <span>First Name</span>
                <input className="snapshot-input" value={form.firstName} onChange={(e) => setField("firstName", e.target.value)} />
              </label>
              <label className="student-field">
                <span>Last Name</span>
                <input className="snapshot-input" value={form.lastName} onChange={(e) => setField("lastName", e.target.value)} />
              </label>
              <label className="student-field">
                <span>Gender</span>
                <select className="snapshot-input" value={form.gender} onChange={(e) => setField("gender", e.target.value as "M" | "F")}>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </label>
              <label className="student-field">
                <span>Assigned Teacher</span>
                <small className="student-field-hint">Attempts placement into a matching classroom and exports this teacher if still unassigned.</small>
                <input
                  className="snapshot-input"
                  value={form.preassignedTeacher}
                  onChange={(e) => setField("preassignedTeacher", e.target.value)}
                  placeholder="Optional teacher name"
                />
              </label>
            </div>
          </section>

          <section className="student-form-section">
            <div className="student-form-section-title">Support Profile</div>
            <div className="student-form-grid">
              <label className="student-field">
                <span>Special Ed Status</span>
                <select className="snapshot-input" value={form.specialEdStatus} onChange={(e) => setField("specialEdStatus", e.target.value as Student["specialEd"]["status"])}>
                  <option value="None">None</option>
                  <option value="IEP">IEP</option>
                  <option value="Referral">Referral</option>
                </select>
              </label>
              <label className="student-field">
                <span>Academic Tier</span>
                <small className="student-field-hint">Use the summed support score. Imports can create values above 3.</small>
                <input className="snapshot-input" value={form.academicTier} onChange={(e) => setField("academicTier", e.target.value)} placeholder="1" />
              </label>
              <label className="student-field">
                <span>Behavior Tier</span>
                <small className="student-field-hint">Use the summed support score. Imports can create values above 3.</small>
                <input className="snapshot-input" value={form.behaviorTier} onChange={(e) => setField("behaviorTier", e.target.value)} placeholder="1" />
              </label>
              <label className="student-field">
                <span>Referrals</span>
                <input className="snapshot-input" value={form.referrals} onChange={(e) => setField("referrals", e.target.value)} placeholder="0" />
              </label>
              <label className="student-field student-field-wide">
                <span>Academic Tier Notes</span>
                <textarea className="snapshot-input student-notes" value={form.academicTierNotes} onChange={(e) => setField("academicTierNotes", e.target.value)} />
              </label>
              <label className="student-field student-field-wide">
                <span>Behavior Tier Notes</span>
                <textarea className="snapshot-input student-notes" value={form.behaviorTierNotes} onChange={(e) => setField("behaviorTierNotes", e.target.value)} />
              </label>
              <label className="student-check student-check-inline">
                <input type="checkbox" checked={form.ell} onChange={(e) => setField("ell", e.target.checked)} />
                <span>English Learner</span>
              </label>
              <label className="student-check student-check-inline">
                <input type="checkbox" checked={form.section504} onChange={(e) => setField("section504", e.target.checked)} />
                <span>504 Plan</span>
              </label>
            </div>
          </section>

          <section className="student-form-section">
            <div className="student-form-section-title">Assessment Data</div>
            <div className="student-form-grid">
              <label className="student-field">
                <span>Brigance</span>
                <input className="snapshot-input" value={form.briganceReadiness} onChange={(e) => setField("briganceReadiness", e.target.value)} />
              </label>
              <label className="student-field">
                <span>MAP Reading</span>
                <input className="snapshot-input" value={form.mapReading} onChange={(e) => setField("mapReading", e.target.value)} />
              </label>
              <label className="student-field">
                <span>MAP Math</span>
                <input className="snapshot-input" value={form.mapMath} onChange={(e) => setField("mapMath", e.target.value)} />
              </label>
              <label className="student-field">
                <span>i-Ready Reading</span>
                <input className="snapshot-input" value={form.ireadyReading} onChange={(e) => setField("ireadyReading", e.target.value)} />
              </label>
              <label className="student-field">
                <span>i-Ready Math</span>
                <input className="snapshot-input" value={form.ireadyMath} onChange={(e) => setField("ireadyMath", e.target.value)} />
              </label>
              <label className="student-field">
                <span>Race / Ethnicity</span>
                <input className="snapshot-input" value={form.raceEthnicity} onChange={(e) => setField("raceEthnicity", e.target.value)} />
              </label>
            </div>
          </section>

          <section className="student-form-section">
            <div className="student-form-section-title">Co-Teach Minutes</div>
            <div className="student-form-grid student-form-grid-compact">
              {CO_TEACH_CATEGORIES.map((category) => (
                <label key={category} className="student-field">
                  <span>{CO_TEACH_LABELS[category]}</span>
                  <input
                    className="snapshot-input"
                    value={form.coTeachMinutes[category]}
                    onChange={(e) => setCoTeachMinute(category, e.target.value)}
                    placeholder="0"
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="student-form-section">
            <div className="student-form-section-title">Relationships And Notes</div>
            <div className="student-form-grid">
              <label className="student-field student-field-wide">
                <span>Blocked Teacher Classrooms</span>
                <input
                  className="snapshot-input"
                  value={form.avoidTeachers}
                  onChange={(e) => setField("avoidTeachers", e.target.value)}
                  placeholder="Teacher names separated by semicolons"
                />
              </label>
              <label className="student-field student-field-wide">
                <span>No-Contact IDs</span>
                <input
                  className="snapshot-input"
                  value={form.noContactWith}
                  onChange={(e) => setField("noContactWith", e.target.value)}
                  placeholder="Example: 101; 145"
                />
              </label>
              <label className="student-field student-field-wide">
                <span>Preferred-With IDs</span>
                <input
                  className="snapshot-input"
                  value={form.preferredWith}
                  onChange={(e) => setField("preferredWith", e.target.value)}
                  placeholder="Same-grade IDs only"
                />
              </label>
              <div className="student-form-help student-field-wide">
                Same-grade peers: {sameGradePeerSummary || `No other Grade ${form.grade} students yet.`}
              </div>
              <label className="student-field student-field-wide">
                <span>Teacher Notes</span>
                <textarea className="snapshot-input student-notes" value={form.teacherNotes} onChange={(e) => setField("teacherNotes", e.target.value)} />
              </label>
            </div>
          </section>

          <section className="student-form-section">
            <div className="student-form-section-title">Student Characteristics</div>
            <div className="student-tags-grid">
              {STUDENT_TAGS.map((tag) => (
                <label key={tag} className="student-check">
                  <input type="checkbox" checked={form.tags.includes(tag)} onChange={() => toggleTag(tag)} />
                  <span>{tag}</span>
                </label>
              ))}
            </div>
          </section>
        </div>

        <div className="student-modal-footer">
          <div className="student-modal-footer-left">
            {student && <button className="btn btn-danger" onClick={remove}>Remove Student</button>}
          </div>
          <div className="student-modal-footer-right">
            {error && <div className="student-form-error">{error}</div>}
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={save}>{student ? "Save Changes" : "Add Student"}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}


