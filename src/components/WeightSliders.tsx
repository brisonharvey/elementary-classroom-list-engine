import { useApp } from "../store/AppContext"

interface SliderProps {
  label: string
  description: string
  value: number
  onChange: (v: number) => void
  color: string
}

function Slider({ label, description, value, onChange, color }: SliderProps) {
  const tooltipId = `${label.toLowerCase().replace(/\s+/g, "-")}-desc`

  return (
    <div className="slider-group">
      <div className="slider-header">
        <span className="slider-label" style={{ color }}>
          {label}
        </span>
        <div className="slider-meta">
          <button
            type="button"
            className="slider-info"
            aria-label={`${label} description`}
            aria-describedby={tooltipId}
          >
            ?
          </button>
          <span className="slider-value">{value}</span>
        </div>
      </div>
      <div className="slider-input-wrap">
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="slider-input"
          style={{ accentColor: color }}
          aria-label={`${label} weight: ${value}`}
          aria-describedby={tooltipId}
        />
        <div id={tooltipId} className="slider-tooltip" role="tooltip">
          {description}
        </div>
      </div>
    </div>
  )
}

export function WeightSliders() {
  const { state, dispatch } = useApp()
  const { weights } = state

  const update = (key: keyof typeof weights) => (v: number) => {
    dispatch({ type: "SET_WEIGHTS", payload: { [key]: v } })
  }

  return (
    <div className="weight-sliders">
      <Slider
        label="Support Balance"
        description="On the next Auto-Sort, a higher value puts more focus on spreading support needs (IEPs, referrals, and tier levels) evenly across classes."
        value={weights.support}
        onChange={update("support")}
        color="#8b5cf6"
      />
      <Slider
        label="Behavior Balance"
        description="On the next Auto-Sort, a higher value puts more focus on balancing behavior support needs and referral intensity between classes."
        value={weights.behavior}
        onChange={update("behavior")}
        color="#f97316"
      />
      <Slider
        label="Reading Balance"
        description="On the next Auto-Sort, a higher value puts more focus on keeping reading levels (MAP and iReady) evenly mixed in each class."
        value={weights.reading}
        onChange={update("reading")}
        color="#3b82f6"
      />
      <Slider
        label="Math Balance"
        description="On the next Auto-Sort, a higher value puts more focus on keeping math levels (MAP and iReady) evenly mixed in each class."
        value={weights.math}
        onChange={update("math")}
        color="#10b981"
      />
    </div>
  )
}
