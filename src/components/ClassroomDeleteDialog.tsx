import { createPortal } from "react-dom"
import { Classroom } from "../types"

interface ClassroomDeleteDialogProps {
  classrooms: Classroom[]
  activeGrade: string
  selectedId: string
  onSelect: (classroomId: string) => void
  onCancel: () => void
  onConfirm: () => void
}

export function ClassroomDeleteDialog({
  classrooms,
  activeGrade,
  selectedId,
  onSelect,
  onCancel,
  onConfirm,
}: ClassroomDeleteDialogProps) {
  const selectedRoom = classrooms.find((classroom) => classroom.id === selectedId) ?? classrooms[0] ?? null

  return createPortal(
    <div className="student-modal-shell" role="dialog" aria-modal="true" aria-label="Delete classroom">
      <div className="student-modal-backdrop" onClick={onCancel} />
      <div className="student-modal delete-classroom-modal">
        <div className="student-modal-header">
          <div>
            <h2>Delete Grade {activeGrade} Classroom</h2>
            <p>Select the classroom you want to remove. If it has students, they will move back to Unassigned.</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>Close</button>
        </div>

        <div className="student-modal-body">
          <div className="delete-classroom-list">
            {classrooms.map((classroom) => (
              <label key={classroom.id} className={`delete-classroom-card ${selectedId === classroom.id ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="delete-classroom"
                  checked={selectedId === classroom.id}
                  onChange={() => onSelect(classroom.id)}
                />
                <div>
                  <strong>{classroom.grade}-{classroom.label}</strong>
                  <div>{classroom.teacherName.trim() || "Unnamed teacher"}</div>
                  <div>{classroom.students.length}/{classroom.maxSize} students</div>
                </div>
              </label>
            ))}
          </div>

          {selectedRoom && (
            <div className="settings-panel-note">
              Deleting <strong>{selectedRoom.grade}-{selectedRoom.label}</strong> will move {selectedRoom.students.length} student{selectedRoom.students.length === 1 ? "" : "s"} back to <strong>Unassigned</strong>.
            </div>
          )}
        </div>

        <div className="student-modal-footer">
          <div className="student-modal-footer-left" />
          <div className="student-modal-footer-right">
            <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
            <button className="btn btn-danger" onClick={onConfirm} disabled={!selectedRoom}>Delete Classroom</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

