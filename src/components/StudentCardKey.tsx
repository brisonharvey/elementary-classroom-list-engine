export function StudentCardKey() {
  return (
    <details className="student-card-key">
      <summary className="student-card-key-summary">Student Card Key</summary>
      <div className="student-card-key-items" aria-label="Student card key">
        <span className="student-card-key-item"><span className="badge badge-gender badge-f">F</span> Gender</span>
        <span className="student-card-key-item"><span className="badge badge-sped badge-iep">IEP</span> Special education status</span>
        <span className="student-card-key-item">
          <span className="tier-pips tier-pips-1" style={{ display: "inline-flex" }}>
            <span className="tier-pip-label">ACA</span>
            <span className="tier-pip filled" /><span className="tier-pip" /><span className="tier-pip" />
          </span>
          {" "}Academic tier (1–3 dots; green=1, amber=2, red=3)
        </span>
        <span className="student-card-key-item">
          <span className="tier-pips tier-pips-2" style={{ display: "inline-flex" }}>
            <span className="tier-pip-label">SEB</span>
            <span className="tier-pip filled" /><span className="tier-pip filled" /><span className="tier-pip" />
          </span>
          {" "}Behavior tier (1–3 dots)
        </span>
        <span className="student-card-key-item"><span className="badge badge-ell">EL</span> English Language Learner</span>
        <span className="student-card-key-item"><span className="badge badge-504">504</span> Section 504 plan</span>
        <span className="student-card-key-item"><span className="badge badge-coteach-total">CT:60</span> Co-teach minutes required</span>
        <span className="student-card-key-item"><span className="badge badge-tags">Chars:3</span> Student characteristics count</span>
        <span className="student-card-key-item"><span className="badge badge-poor-fit">Poor Fit</span> Teacher fit warning</span>
      </div>
    </details>
  )
}
