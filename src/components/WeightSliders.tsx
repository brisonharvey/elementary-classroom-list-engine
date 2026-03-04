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
        label="Academic Needs"
        description="Higher values prioritize balancing academic need levels (academic tier and assessment profile) evenly across classes."
        value={weights.academic}
        onChange={update("academic")}
        color="#3b82f6"
      />
      <Slider
        label="Behavioral Needs"
        description="Higher values prioritize balancing behavioral support intensity (behavior tier and referrals) between classes."
        value={weights.behavioral}
        onChange={update("behavioral")}
        color="#f97316"
      />
      <Slider
        label="Demographic Needs"
        description="Higher values prioritize balancing student demographic groups (gender, ELL, 504, and special education status) across classes."
        value={weights.demographic}
        onChange={update("demographic")}
        color="#8b5cf6"
      />
    </div>
  )
}
