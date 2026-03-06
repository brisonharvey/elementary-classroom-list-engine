import { useMemo, useState } from "react"
import { useApp } from "../store/AppContext"
import { RelationshipRule } from "../types"

interface RelationshipManagerProps {
  onClose: () => void
}

export function RelationshipManager({ onClose }: RelationshipManagerProps) {
  const { state, dispatch } = useApp()
  const [type, setType] = useState<RelationshipRule["type"]>("NO_CONTACT")
  const [studentA, setStudentA] = useState<number | "">("")
  const [studentB, setStudentB] = useState<number | "">("")
  const [note, setNote] = useState("")
  const [search, setSearch] = useState("")

  const gradeStudents = state.allStudents.filter((s) => s.grade === state.activeGrade)
  const filteredRules = useMemo(() => {
    const rules = state.relationshipRules.filter((r) => r.grade === state.activeGrade)
    if (!search.trim()) return rules
    const term = search.toLowerCase()
    return rules.filter((r) => r.note?.toLowerCase().includes(term) || r.studentIds.join(" ").includes(term))
  }, [state.relationshipRules, state.activeGrade, search])

  const nameFor = (id: number) => {
    const student = gradeStudents.find((s) => s.id === id)
    return student ? `${student.firstName} ${student.lastName}` : `#${id}`
  }

  const save = () => {
    if (!studentA || !studentB || studentA === studentB) return
    const pair: [number, number] =
      Number(studentA) < Number(studentB)
        ? [Number(studentA), Number(studentB)]
        : [Number(studentB), Number(studentA)]
    const existing = state.relationshipRules.find((r) => {
      if (r.grade !== state.activeGrade || r.type !== type) return false
      const existingPair: [number, number] =
        r.studentIds[0] < r.studentIds[1]
          ? [r.studentIds[0], r.studentIds[1]]
          : [r.studentIds[1], r.studentIds[0]]
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
    setStudentA("")
    setStudentB("")
    setNote("")
  }

  return (
    <div className="slide-panel-content">
      <div className="slide-panel-header">
        <h3 className="summary-title">No-contact Manager</h3>
        <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close no-contact manager">✕</button>
      </div>
      <div className="snapshot-save-row">
        <select value={type} onChange={(e) => setType(e.target.value as RelationshipRule["type"])} className="snapshot-input">
          <option value="NO_CONTACT">No Contact (HARD)</option>
          <option value="DO_NOT_SEPARATE">Do Not Separate (SOFT)</option>
        </select>
        <select value={studentA} onChange={(e) => setStudentA(Number(e.target.value) || "")} className="snapshot-input">
          <option value="">Student A</option>
          {gradeStudents.map((s) => <option key={s.id} value={s.id}>{s.lastName}, {s.firstName}</option>)}
        </select>
        <select value={studentB} onChange={(e) => setStudentB(Number(e.target.value) || "")} className="snapshot-input">
          <option value="">Student B</option>
          {gradeStudents.map((s) => <option key={s.id} value={s.id}>{s.lastName}, {s.firstName}</option>)}
        </select>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" className="snapshot-input" />
        <button className="btn btn-primary btn-sm" onClick={save}>Add Rule</button>
      </div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search rules" className="snapshot-input" />
      <div className="snapshot-list">
        {filteredRules.map((r) => (
          <div key={r.id} className="snapshot-item">
            <div className="snap-info">
              <span className="snap-name">{r.type === "NO_CONTACT" ? "⛔" : "🤝"} {nameFor(r.studentIds[0])} ↔ {nameFor(r.studentIds[1])}</span>
              <span className="snap-time">{r.note || "No note"}</span>
            </div>
            <div className="snap-actions">
              <button className="btn btn-danger btn-sm" onClick={() => dispatch({ type: "DELETE_RELATIONSHIP_RULE", payload: r.id })}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
