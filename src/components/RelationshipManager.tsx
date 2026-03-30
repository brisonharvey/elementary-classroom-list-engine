import { useMemo, useState } from "react"
import { useApp } from "../store/AppContext"
import { RelationshipRule, Student } from "../types"

interface RelationshipManagerProps {
  onClose: () => void
}

type PairEntry = {
  key: string
  id?: string
  type: RelationshipRule["type"]
  studentIds: [number, number]
  note?: string
  source: "imported" | "managed"
  createdAt: number
  scope: "grade" | "multiYear"
}

type TeacherRestrictionEntry = {
  key: string
  studentId: number
  teacherName: string
}

function compareNames(a: Student, b: Student) {
  const byLast = a.lastName.localeCompare(b.lastName, undefined, { sensitivity: "base" })
  if (byLast !== 0) return byLast
  const byFirst = a.firstName.localeCompare(b.firstName, undefined, { sensitivity: "base" })
  if (byFirst !== 0) return byFirst
  return a.id - b.id
}

function normalizePair(studentIds: [number, number]): [number, number] {
  return studentIds[0] < studentIds[1]
    ? [studentIds[0], studentIds[1]]
    : [studentIds[1], studentIds[0]]
}

function pairKey(studentIds: [number, number]) {
  const [leftId, rightId] = normalizePair(studentIds)
  return `${leftId}:${rightId}`
}

function normalizeTeacherName(name: string): string {
  return name.trim().toLowerCase()
}

function appliesToActiveGrade(rule: RelationshipRule, activeGrade: Student["grade"], studentsById: Map<number, Student>): boolean {
  if (rule.type === "NO_CONTACT" && rule.scope === "multiYear") {
    const left = studentsById.get(rule.studentIds[0])
    const right = studentsById.get(rule.studentIds[1])
    return left?.grade === activeGrade && right?.grade === activeGrade
  }

  return rule.grade === activeGrade
}

export function RelationshipManager({ onClose }: RelationshipManagerProps) {
  const { state, dispatch } = useApp()
  const [type, setType] = useState<RelationshipRule["type"]>("NO_CONTACT")
  const [studentA, setStudentA] = useState<number | "">("")
  const [studentB, setStudentB] = useState<number | "">("")
  const [note, setNote] = useState("")
  const [persistentNoContact, setPersistentNoContact] = useState(false)
  const [restrictedStudentId, setRestrictedStudentId] = useState<number | "">("")
  const [restrictedTeacherName, setRestrictedTeacherName] = useState("")
  const [search, setSearch] = useState("")

  const allStudentsById = useMemo(
    () => new Map(state.allStudents.map((student) => [student.id, student])),
    [state.allStudents]
  )

  const gradeStudents = useMemo(
    () => [...state.allStudents.filter((student) => student.grade === state.activeGrade)].sort(compareNames),
    [state.allStudents, state.activeGrade]
  )

  const studentsById = useMemo(
    () => new Map(gradeStudents.map((student) => [student.id, student])),
    [gradeStudents]
  )

  const availableTeacherNames = useMemo(
    () =>
      Array.from(
        new Set(
          state.classrooms
            .filter((classroom) => classroom.grade === state.activeGrade)
            .map((classroom) => classroom.teacherName.trim())
            .filter((teacherName) => teacherName.length > 0)
        )
      ).sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" })),
    [state.classrooms, state.activeGrade]
  )

  const pairEntries = useMemo(() => {
    const activeRules = state.relationshipRules.filter((rule) => appliesToActiveGrade(rule, state.activeGrade, allStudentsById))
    const noContactRules = activeRules.filter((rule) => rule.type === "NO_CONTACT")
    const doNotSeparateRules = activeRules.filter((rule) => rule.type === "DO_NOT_SEPARATE")
    const noContactEntries = new Map<string, PairEntry>()

    for (const student of gradeStudents) {
      for (const peerId of student.noContactWith ?? []) {
        if (!studentsById.has(peerId)) continue
        const studentIds = normalizePair([student.id, peerId])
        const key = pairKey(studentIds)
        const matchingRule = noContactRules.find((rule) => pairKey(rule.studentIds) === key)
        if (noContactEntries.has(key)) continue

        noContactEntries.set(key, {
          key,
          id: matchingRule?.id,
          type: "NO_CONTACT",
          studentIds,
          note: matchingRule?.note,
          source: matchingRule ? "managed" : "imported",
          createdAt: matchingRule?.createdAt ?? 0,
          scope: matchingRule?.scope === "multiYear" ? "multiYear" : "grade",
        })
      }
    }

    for (const rule of noContactRules) {
      const left = allStudentsById.get(rule.studentIds[0])
      const right = allStudentsById.get(rule.studentIds[1])
      if (left?.grade !== state.activeGrade || right?.grade !== state.activeGrade) continue

      const key = pairKey(rule.studentIds)
      if (noContactEntries.has(key)) continue
      noContactEntries.set(key, {
        key,
        id: rule.id,
        type: "NO_CONTACT",
        studentIds: normalizePair(rule.studentIds),
        note: rule.note,
        source: "managed",
        createdAt: rule.createdAt,
        scope: rule.scope === "multiYear" ? "multiYear" : "grade",
      })
    }

    return [
      ...Array.from(noContactEntries.values()),
      ...doNotSeparateRules
        .filter((rule) => {
          const left = allStudentsById.get(rule.studentIds[0])
          const right = allStudentsById.get(rule.studentIds[1])
          return left?.grade === state.activeGrade && right?.grade === state.activeGrade
        })
        .map((rule) => ({
          key: rule.id,
          id: rule.id,
          type: rule.type,
          studentIds: normalizePair(rule.studentIds),
          note: rule.note,
          source: "managed" as const,
          createdAt: rule.createdAt,
          scope: "grade" as const,
        })),
    ].sort((left, right) => {
      if (left.type !== right.type) return left.type === "NO_CONTACT" ? -1 : 1
      const leftA = studentsById.get(left.studentIds[0])
      const rightA = studentsById.get(right.studentIds[0])
      if (leftA && rightA) {
        const byName = compareNames(leftA, rightA)
        if (byName !== 0) return byName
      }
      return left.studentIds[0] - right.studentIds[0]
    })
  }, [allStudentsById, gradeStudents, state.activeGrade, state.relationshipRules, studentsById])

  const teacherRestrictionEntries = useMemo(
    () =>
      gradeStudents
        .flatMap((student) =>
          (student.avoidTeachers ?? []).map((teacherName) => ({
            key: `${student.id}:${normalizeTeacherName(teacherName)}`,
            studentId: student.id,
            teacherName,
          }))
        )
        .sort((left, right) => {
          const leftStudent = studentsById.get(left.studentId)
          const rightStudent = studentsById.get(right.studentId)
          if (leftStudent && rightStudent) {
            const byName = compareNames(leftStudent, rightStudent)
            if (byName !== 0) return byName
          }
          return left.teacherName.localeCompare(right.teacherName, undefined, { sensitivity: "base" })
        }),
    [gradeStudents, studentsById]
  )

  const filteredPairEntries = useMemo(() => {
    if (!search.trim()) return pairEntries
    const term = search.trim().toLowerCase()

    return pairEntries.filter((entry) => {
      const names = entry.studentIds
        .map((id) => {
          const student = studentsById.get(id)
          return student ? `${student.firstName} ${student.lastName} ${student.lastName}, ${student.firstName}` : `${id}`
        })
        .join(" ")
        .toLowerCase()
      const typeLabel = entry.type === "NO_CONTACT" ? "no contact hard" : "do not separate soft"
      const sourceLabel = entry.source === "imported" ? "imported from student import" : "managed rule"
      const scopeLabel = entry.scope === "multiYear" ? "multi year" : "grade only"
      return names.includes(term) || (entry.note ?? "").toLowerCase().includes(term) || typeLabel.includes(term) || sourceLabel.includes(term) || scopeLabel.includes(term)
    })
  }, [pairEntries, search, studentsById])

  const filteredTeacherRestrictions = useMemo(() => {
    if (!search.trim()) return teacherRestrictionEntries
    const term = search.trim().toLowerCase()

    return teacherRestrictionEntries.filter((entry) => {
      const student = studentsById.get(entry.studentId)
      const studentName = student ? `${student.firstName} ${student.lastName} ${student.lastName}, ${student.firstName}`.toLowerCase() : `${entry.studentId}`
      return studentName.includes(term) || entry.teacherName.toLowerCase().includes(term) || "teacher restriction blocked classroom".includes(term)
    })
  }, [search, studentsById, teacherRestrictionEntries])

  const nameFor = (id: number) => {
    const student = studentsById.get(id)
    return student ? `${student.firstName} ${student.lastName}` : `#${id}`
  }

  const savePairRule = () => {
    if (!studentA || !studentB || studentA === studentB) return
    const pair = normalizePair([Number(studentA), Number(studentB)])

    if (type === "NO_CONTACT") {
      dispatch({
        type: "UPSERT_NO_CONTACT_PAIR",
        payload: {
          grade: state.activeGrade,
          studentIds: pair,
          note,
          scope: persistentNoContact ? "multiYear" : "grade",
        },
      })
    } else {
      const existing = state.relationshipRules.find((rule) => {
        if (rule.grade !== state.activeGrade || rule.type !== type) return false
        const existingPair = normalizePair(rule.studentIds)
        return existingPair[0] === pair[0] && existingPair[1] === pair[1]
      })

      dispatch({
        type: "UPSERT_RELATIONSHIP_RULE",
        payload: {
          id: existing?.id ?? `rule-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
          type,
          studentIds: pair,
          note: note.trim() || undefined,
          createdAt: existing?.createdAt ?? Date.now(),
          grade: state.activeGrade,
          scope: "grade",
        },
      })
    }

    setStudentA("")
    setStudentB("")
    setNote("")
    setPersistentNoContact(false)
  }

  const saveTeacherRestriction = () => {
    if (!restrictedStudentId || !restrictedTeacherName.trim()) return
    const student = state.allStudents.find((entry) => entry.id === Number(restrictedStudentId))
    if (!student) return

    const teacherName = restrictedTeacherName.trim()
    dispatch({
      type: "UPSERT_STUDENT",
      payload: {
        previousId: student.id,
        student: {
          ...student,
          avoidTeachers: Array.from(new Set([...(student.avoidTeachers ?? []), teacherName])),
        },
      },
    })

    setRestrictedTeacherName("")
  }

  const deletePairEntry = (entry: PairEntry) => {
    if (entry.type === "NO_CONTACT") {
      dispatch({
        type: "DELETE_NO_CONTACT_PAIR",
        payload: {
          grade: state.activeGrade,
          studentIds: entry.studentIds,
        },
      })
      return
    }

    if (entry.id) {
      dispatch({ type: "DELETE_RELATIONSHIP_RULE", payload: entry.id })
    }
  }

  const deleteTeacherRestriction = (entry: TeacherRestrictionEntry) => {
    const student = state.allStudents.find((candidate) => candidate.id === entry.studentId)
    if (!student) return

    dispatch({
      type: "UPSERT_STUDENT",
      payload: {
        previousId: student.id,
        student: {
          ...student,
          avoidTeachers: (student.avoidTeachers ?? []).filter((teacherName) => normalizeTeacherName(teacherName) !== normalizeTeacherName(entry.teacherName)),
        },
      },
    })
  }

  return (
    <div className="slide-panel-content relationship-manager">
      <div className="slide-panel-header">
        <h3 className="summary-title">Rules Manager</h3>
        <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close rules manager">✕</button>
      </div>

      <p className="relationship-manager-intro">
        Manage hard no-contact pairs, soft keep-together pairs, blocked teacher classrooms, and multi-year no-contact rules that should follow students into future grades within this placement file.
      </p>
      {(state.schoolName.trim() || state.schoolYear.trim()) && (
        <div className="relationship-manager-context">
          <strong>Current placement file:</strong> {state.schoolName.trim() || "Unnamed school"}{state.schoolYear.trim() ? ` (${state.schoolYear.trim()})` : ""}
          <span>Multi-year no-contact rules stay with the same students as they move to later grades inside this school-year workspace.</span>
        </div>
      )}

      <section className="relationship-manager-form" aria-label="Add student pair rule">
        <div className="relationship-manager-grid">
          <label className="relationship-manager-field">
            <span>Rule type</span>
            <select value={type} onChange={(e) => setType(e.target.value as RelationshipRule["type"])} className="setting-card-input">
              <option value="NO_CONTACT">No Contact (HARD)</option>
              <option value="DO_NOT_SEPARATE">Do Not Separate (SOFT)</option>
            </select>
          </label>
          <label className="relationship-manager-field">
            <span>Search</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search students, teachers, notes, or rule type" className="setting-card-input" />
          </label>
          <label className="relationship-manager-field">
            <span>Student A</span>
            <select value={studentA} onChange={(e) => setStudentA(Number(e.target.value) || "")} className="setting-card-input">
              <option value="">Select student</option>
              {gradeStudents.map((student) => <option key={student.id} value={student.id}>{student.lastName}, {student.firstName}</option>)}
            </select>
          </label>
          <label className="relationship-manager-field">
            <span>Student B</span>
            <select value={studentB} onChange={(e) => setStudentB(Number(e.target.value) || "")} className="setting-card-input">
              <option value="">Select student</option>
              {gradeStudents.map((student) => <option key={student.id} value={student.id}>{student.lastName}, {student.firstName}</option>)}
            </select>
          </label>
          <label className="relationship-manager-field relationship-manager-field-wide">
            <span>Note</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional staff context" className="setting-card-input" />
          </label>
          {type === "NO_CONTACT" && (
            <label className="relationship-manager-field relationship-manager-field-wide relationship-manager-check">
              <input type="checkbox" checked={persistentNoContact} onChange={(e) => setPersistentNoContact(e.target.checked)} />
              <span>Keep this no-contact rule across future grade changes for these same students.</span>
            </label>
          )}
        </div>

        <div className="relationship-manager-actions">
          <button className="btn btn-primary" onClick={savePairRule} disabled={!studentA || !studentB || studentA === studentB}>
            Add Student Rule
          </button>
        </div>
      </section>

      <section className="relationship-manager-form" aria-label="Add teacher restriction">
        <div className="relationship-manager-grid">
          <label className="relationship-manager-field">
            <span>Student</span>
            <select value={restrictedStudentId} onChange={(e) => setRestrictedStudentId(Number(e.target.value) || "")} className="setting-card-input">
              <option value="">Select student</option>
              {gradeStudents.map((student) => <option key={student.id} value={student.id}>{student.lastName}, {student.firstName}</option>)}
            </select>
          </label>
          <label className="relationship-manager-field relationship-manager-field-wide">
            <span>Blocked teacher classroom</span>
            <input
              list="relationship-manager-teachers"
              value={restrictedTeacherName}
              onChange={(e) => setRestrictedTeacherName(e.target.value)}
              placeholder="Teacher name to avoid"
              className="setting-card-input"
            />
            <datalist id="relationship-manager-teachers">
              {availableTeacherNames.map((teacherName) => <option key={teacherName} value={teacherName} />)}
            </datalist>
          </label>
        </div>

        <div className="relationship-manager-actions">
          <button className="btn btn-primary" onClick={saveTeacherRestriction} disabled={!restrictedStudentId || !restrictedTeacherName.trim()}>
            Add Teacher Restriction
          </button>
        </div>
      </section>

      <div className="relationship-manager-list" aria-label="Current rules and teacher restrictions">
        {filteredPairEntries.length === 0 && filteredTeacherRestrictions.length === 0 ? (
          <div className="relationship-manager-empty">No matching rules or teacher restrictions for this grade yet.</div>
        ) : (
          <>
            {filteredPairEntries.map((entry) => (
              <div key={entry.key} className="relationship-item">
                <div className="relationship-item-main">
                  <div className="relationship-item-label-row">
                    <span className={`relationship-type-chip ${entry.type === "NO_CONTACT" ? "relationship-type-hard" : "relationship-type-soft"}`}>
                      {entry.type === "NO_CONTACT" ? "No Contact" : "Do Not Separate"}
                    </span>
                    <span className={`relationship-source relationship-source-${entry.source}`}>
                      {entry.source === "imported" ? "Imported" : "Managed"}
                    </span>
                    {entry.type === "NO_CONTACT" && entry.scope === "multiYear" && (
                      <span className="relationship-source relationship-source-managed">Multi-Year</span>
                    )}
                  </div>
                  <div className="relationship-item-title">{nameFor(entry.studentIds[0])} ↔ {nameFor(entry.studentIds[1])}</div>
                  <div className="relationship-item-meta">
                    {entry.note?.trim()
                      ? entry.note
                      : entry.source === "imported"
                        ? "Pulled from imported student no-contact data."
                        : entry.scope === "multiYear"
                          ? "Preserved across grade changes for these students."
                          : "No staff note added."}
                  </div>
                </div>
                <div className="relationship-item-actions">
                  <button className="btn btn-danger btn-sm" onClick={() => deletePairEntry(entry)}>Delete</button>
                </div>
              </div>
            ))}

            {filteredTeacherRestrictions.map((entry) => (
              <div key={entry.key} className="relationship-item">
                <div className="relationship-item-main">
                  <div className="relationship-item-label-row">
                    <span className="relationship-type-chip relationship-type-hard">Teacher Restriction</span>
                  </div>
                  <div className="relationship-item-title">{nameFor(entry.studentId)} → Avoid {entry.teacherName}</div>
                  <div className="relationship-item-meta">This student cannot be auto-placed into classrooms for this teacher and manual moves will warn about it.</div>
                </div>
                <div className="relationship-item-actions">
                  <button className="btn btn-danger btn-sm" onClick={() => deleteTeacherRestriction(entry)}>Delete</button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
