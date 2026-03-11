import { useMemo, useState } from "react"
import { useApp } from "../store/AppContext"
import { RelationshipRule, Student } from "../types"

interface RelationshipManagerProps {
  onClose: () => void
}

type ManagerEntry = {
  key: string
  id?: string
  type: RelationshipRule["type"]
  studentIds: [number, number]
  note?: string
  source: "imported" | "managed"
  createdAt: number
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

export function RelationshipManager({ onClose }: RelationshipManagerProps) {
  const { state, dispatch } = useApp()
  const [type, setType] = useState<RelationshipRule["type"]>("NO_CONTACT")
  const [studentA, setStudentA] = useState<number | "">("")
  const [studentB, setStudentB] = useState<number | "">("")
  const [note, setNote] = useState("")
  const [search, setSearch] = useState("")

  const gradeStudents = useMemo(
    () => [...state.allStudents.filter((student) => student.grade === state.activeGrade)].sort(compareNames),
    [state.allStudents, state.activeGrade]
  )

  const studentsById = useMemo(
    () => new Map(gradeStudents.map((student) => [student.id, student])),
    [gradeStudents]
  )

  const entries = useMemo(() => {
    const gradeRules = state.relationshipRules.filter((rule) => rule.grade === state.activeGrade)
    const noContactRules = gradeRules.filter((rule) => rule.type === "NO_CONTACT")
    const doNotSeparateRules = gradeRules.filter((rule) => rule.type === "DO_NOT_SEPARATE")
    const noContactEntries = new Map<string, ManagerEntry>()

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
        })
      }
    }

    for (const rule of noContactRules) {
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
      })
    }

    const combined = [
      ...Array.from(noContactEntries.values()),
      ...doNotSeparateRules.map((rule) => ({
        key: rule.id,
        id: rule.id,
        type: rule.type,
        studentIds: normalizePair(rule.studentIds),
        note: rule.note,
        source: "managed" as const,
        createdAt: rule.createdAt,
      })),
    ]

    if (!search.trim()) {
      return combined.sort((left, right) => {
        if (left.type !== right.type) return left.type === "NO_CONTACT" ? -1 : 1
        const leftA = studentsById.get(left.studentIds[0])
        const rightA = studentsById.get(right.studentIds[0])
        if (leftA && rightA) {
          const byName = compareNames(leftA, rightA)
          if (byName !== 0) return byName
        }
        return left.studentIds[0] - right.studentIds[0]
      })
    }

    const term = search.trim().toLowerCase()
    return combined.filter((entry) => {
      const names = entry.studentIds
        .map((id) => {
          const student = studentsById.get(id)
          return student ? `${student.firstName} ${student.lastName} ${student.lastName}, ${student.firstName}` : `${id}`
        })
        .join(" ")
        .toLowerCase()

      const typeLabel = entry.type === "NO_CONTACT" ? "no contact hard" : "do not separate soft"
      const sourceLabel = entry.source === "imported" ? "imported from student import" : "managed rule"
      return names.includes(term) || (entry.note ?? "").toLowerCase().includes(term) || typeLabel.includes(term) || sourceLabel.includes(term)
    })
  }, [gradeStudents, search, state.relationshipRules, state.activeGrade, studentsById])

  const nameFor = (id: number) => {
    const student = studentsById.get(id)
    return student ? `${student.firstName} ${student.lastName}` : `#${id}`
  }

  const save = () => {
    if (!studentA || !studentB || studentA === studentB) return
    const pair = normalizePair([Number(studentA), Number(studentB)])

    if (type === "NO_CONTACT") {
      dispatch({
        type: "UPSERT_NO_CONTACT_PAIR",
        payload: {
          grade: state.activeGrade,
          studentIds: pair,
          note,
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
        },
      })
    }

    setStudentA("")
    setStudentB("")
    setNote("")
  }

  const deleteEntry = (entry: ManagerEntry) => {
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

  return (
    <div className="slide-panel-content relationship-manager">
      <div className="slide-panel-header">
        <h3 className="summary-title">No-contact Manager</h3>
        <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close no-contact manager">✕</button>
      </div>

      <p className="relationship-manager-intro">
        Imported no-contact pairs appear here automatically. You can add more hard no-contact pairs or soft keep-together rules, and remove any pair from the manager.
      </p>

      <section className="relationship-manager-form" aria-label="Add no-contact or keep-together rule">
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
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search students, notes, or rule type" className="setting-card-input" />
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
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note for staff context" className="setting-card-input" />
          </label>
        </div>

        <div className="relationship-manager-actions">
          <button className="btn btn-primary" onClick={save} disabled={!studentA || !studentB || studentA === studentB}>
            Add Rule
          </button>
        </div>
      </section>

      <div className="relationship-manager-list" aria-label="Current no-contact and keep-together rules">
        {entries.length === 0 ? (
          <div className="relationship-manager-empty">No matching rules for this grade yet.</div>
        ) : (
          entries.map((entry) => (
            <div key={entry.key} className="relationship-item">
              <div className="relationship-item-main">
                <div className="relationship-item-label-row">
                  <span className={`relationship-type-chip ${entry.type === "NO_CONTACT" ? "relationship-type-hard" : "relationship-type-soft"}`}>
                    {entry.type === "NO_CONTACT" ? "No Contact" : "Do Not Separate"}
                  </span>
                  <span className={`relationship-source relationship-source-${entry.source}`}>
                    {entry.source === "imported" ? "Imported" : "Managed"}
                  </span>
                </div>
                <div className="relationship-item-title">{nameFor(entry.studentIds[0])} ↔ {nameFor(entry.studentIds[1])}</div>
                <div className="relationship-item-meta">
                  {entry.note?.trim() ? entry.note : entry.source === "imported" ? "Pulled from imported student no-contact data." : "No staff note added."}
                </div>
              </div>
              <div className="relationship-item-actions">
                <button className="btn btn-danger btn-sm" onClick={() => deleteEntry(entry)}>Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
