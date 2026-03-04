import { useState } from "react"
import { useApp } from "../store/AppContext"

export function SnapshotManager() {
  const { state, dispatch } = useApp()
  const { snapshots, activeGrade, classrooms } = state
  const [name, setName] = useState("")
  const [note, setNote] = useState("")

  const currentGradeRooms = classrooms.filter((c) => c.grade === activeGrade)
  const gradeSnapshots = snapshots.filter((s) => s.grade === activeGrade)

  const diffSummary = (snapshotId: string) => {
    const snap = snapshots.find((s) => s.id === snapshotId)
    if (!snap) return ""
    const current = new Map(currentGradeRooms.flatMap((r) => r.students.map((st) => [st.id, r.id])))
    const prev = new Map(snap.payload.classrooms.flatMap((r) => r.students.map((st) => [st.id, r.id])))
    const ids = new Set([...current.keys(), ...prev.keys()])
    let moved = 0
    for (const id of ids) if (current.get(id) !== prev.get(id)) moved += 1
    const currentSize = currentGradeRooms.map((r) => r.students.length)
    const snapSize = snap.payload.classrooms.map((r) => r.students.length)
    return `${moved} moved • room count ${snap.payload.classrooms.length}→${currentGradeRooms.length} • avg size ${(snapSize.reduce((a, b) => a + b, 0) / Math.max(1, snapSize.length)).toFixed(1)}→${(currentSize.reduce((a, b) => a + b, 0) / Math.max(1, currentSize.length)).toFixed(1)}`
  }

  const save = () => {
    const label = name.trim() || `Snapshot ${new Date().toLocaleTimeString()}`
    dispatch({ type: "SAVE_SNAPSHOT", payload: { name: label, note: note.trim() || undefined } })
    setName("")
    setNote("")
  }

  return (
    <div className="snapshot-manager">
      <div className="snapshot-header">
        <h3 className="snapshot-title">Snapshots (Grade {activeGrade})</h3>
        <div className="snapshot-save-row">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Snapshot name" className="snapshot-input" />
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" className="snapshot-input" />
          <button className="btn btn-primary btn-sm" onClick={save}>Save Snapshot</button>
        </div>
      </div>

      {gradeSnapshots.length === 0 ? (
        <div className="empty-placeholder">No snapshots saved yet for this grade.</div>
      ) : (
        <div className="snapshot-list">
          {[...gradeSnapshots].reverse().map((snap) => (
            <div key={snap.id} className="snapshot-item" title={diffSummary(snap.id)}>
              <div className="snap-info">
                <span className="snap-name">{snap.name}</span>
                <span className="snap-time">{new Date(snap.createdAt).toLocaleString()} • {snap.note || "No note"}</span>
                <span className="snap-time">Diff: {diffSummary(snap.id)}</span>
              </div>
              <div className="snap-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: "RESTORE_SNAPSHOT", payload: snap.id })}>Restore</button>
                <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: "DUPLICATE_SNAPSHOT", payload: snap.id })}>Duplicate</button>
                <button className="btn btn-ghost btn-sm" onClick={() => {
                  const next = window.prompt("Rename snapshot", snap.name)
                  if (next) dispatch({ type: "RENAME_SNAPSHOT", payload: { id: snap.id, name: next } })
                }}>Rename</button>
                <button className="btn btn-ghost btn-sm" onClick={() => {
                  const next = window.prompt("Edit snapshot note", snap.note ?? "")
                  if (next !== null) dispatch({ type: "EDIT_SNAPSHOT_NOTE", payload: { id: snap.id, note: next } })
                }}>Edit Note</button>
                <button className="btn btn-danger btn-sm" onClick={() => dispatch({ type: "DELETE_SNAPSHOT", payload: snap.id })}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
