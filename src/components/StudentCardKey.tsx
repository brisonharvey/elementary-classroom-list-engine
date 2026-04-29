export function StudentCardKey() {
  return (
    <details className="student-card-key">
      <summary className="student-card-key-summary">Student Card Key</summary>
      <div className="student-card-key-items" aria-label="Student card key">
        <span className="student-card-key-item"><span className="badge badge-gender badge-f">F</span> Gender</span>
        <span className="student-card-key-item"><span className="badge badge-sped badge-iep">IEP</span> Special education status</span>
        <span className="student-card-key-item"><span className="badge badge-tier tier-2">ACA 2</span> Academic tier</span>
        <span className="student-card-key-item"><span className="badge badge-tier tier-2">SEB 2</span> Social-emotional / behavior tier</span>
        <span className="student-card-key-item"><span className="badge badge-map">MAP R:45</span> MAP Reading</span>
        <span className="student-card-key-item"><span className="badge badge-map">MAP M:48</span> MAP Math</span>
        <span className="student-card-key-item"><span className="badge badge-iready">IR:Mid 2</span> iReady Reading level</span>
        <span className="student-card-key-item"><span className="badge badge-iready">IM:Late 1</span> iReady Math level</span>
        <span className="student-card-key-item"><span className="badge badge-coteach-total">CT:60</span> Total co-teach minutes</span>
        <span className="student-card-key-item"><span className="badge badge-coteach badge-coteach-reading">R:30</span> Co-teach area and minutes</span>
        <span className="student-card-key-item"><span className="badge badge-tags">Chars:3</span> Student characteristics count</span>
        <span className="student-card-key-item"><span className="badge badge-parent-request">PR:Yes</span> Parent request upheld</span>
        <span className="student-card-key-item"><span className="badge badge-parent-request">PR:No</span> Parent request not upheld</span>
        <span className="student-card-key-item"><span className="badge badge-poor-fit">Poor Fit</span> Teacher fit warning</span>
      </div>
    </details>
  )
}
