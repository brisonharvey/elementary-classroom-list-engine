import { useState } from "react"
import { useApp } from "../store/AppContext"

export function SnapshotManager() {
  const { state, dispatch } = useApp()
  const { snapshots } = state
  const [name, setName] = useState("")
  const [restored, setRestored] = useState<string | null>(null)

  const save = () => {
    const label = name.trim() || `Snapshot ${new Date().toLocaleTimeString()}`
    dispatch({ type: "SAVE_SNAPSHOT", payload: label })
    setName("")
  }

  const restore = (id: string, snapName: string) => {
    const ok = window.confirm(`Restore snapshot "${snapName}"?\nThis will replace your current placement.`)
    if (ok) {
      dispatch({ type: "RESTORE_SNAPSHOT", payload: id })
      setRestored(id)
      setTimeout(() => setRestored(null), 2000)
    }
  }

  const del = (id: string, snapName: string) => {
    if (window.confirm(`Delete snapshot "${snapName}"?`)) {
      dispatch({ type: "DELETE_SNAPSHOT", payload: id })
    }
  }

  return (
    <div className="snapshot-manager">
      <div className="snapshot-header">
        <h3 className="snapshot-title">Snapshots</h3>
        <div className="snapshot-save-row">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="Snapshot name (optional)"
            className="snapshot-input"
          />
          <button className="btn btn-primary btn-sm" onClick={save}>
            Save Snapshot
          </button>
        </div>
      </div>

      {snapshots.length === 0 ? (
        <div className="empty-placeholder">No snapshots saved yet.</div>
      ) : (
        <div className="snapshot-list">
          {[...snapshots].reverse().map((snap) => (
            <div key={snap.id} className={`snapshot-item ${restored === snap.id ? "restored" : ""}`}>
              <div className="snap-info">
                <span className="snap-name">{snap.name}</span>
                <span className="snap-time">{new Date(snap.timestamp).toLocaleString()}</span>
              </div>
              <div className="snap-actions">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => restore(snap.id, snap.name)}
                  title="Restore this snapshot"
                >
                  {restored === snap.id ? "Restored!" : "Restore"}
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => del(snap.id, snap.name)}
                  title="Delete this snapshot"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
