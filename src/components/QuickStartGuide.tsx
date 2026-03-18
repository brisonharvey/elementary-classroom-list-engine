import { Classroom } from "../types"

interface QuickStartGuideProps {
  hasStudents: boolean
  hasTeachers: boolean
  activeGrade: string
  gradeRooms: Classroom[]
  onOpenImport: () => void
  onOpenSettings: () => void
  onDismiss: () => void
}

export function QuickStartGuide({
  hasStudents,
  hasTeachers,
  activeGrade,
  gradeRooms,
  onOpenImport,
  onOpenSettings,
  onDismiss,
}: QuickStartGuideProps) {
  const checks = [
    { label: "Import students", done: hasStudents },
    { label: "Import teachers", done: hasTeachers },
    { label: `Review Grade ${activeGrade} classrooms`, done: gradeRooms.length > 0 },
  ]

  return (
    <section className="quick-start-guide" aria-label="Quick start guide">
      <div className="quick-start-copy">
        <span className="quick-start-eyebrow">Guided Setup</span>
        <h2>Start here for a low-stress roster build</h2>
        <p>
          Follow these steps in order: import students, import teachers, check classroom sizes and co-teach coverage, then run auto-place for the grade you are working on.
        </p>
        <div className="quick-start-actions">
          <button className="btn btn-primary" onClick={onOpenImport}>Open Import</button>
          <button className="btn btn-ghost" onClick={onOpenSettings}>Review Settings</button>
          <button className="btn btn-ghost" onClick={onDismiss}>Dismiss guide</button>
        </div>
      </div>
      <div className="quick-start-checklist">
        {checks.map((check) => (
          <div key={check.label} className={`quick-start-check ${check.done ? "done" : ""}`}>
            <span className="quick-start-check-mark">{check.done ? "Done" : "Next"}</span>
            <span>{check.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

