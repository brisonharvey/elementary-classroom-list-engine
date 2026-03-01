import { useApp } from "../store/AppContext"

interface SliderProps {
  label: string
  description: string
  value: number
  onChange: (v: number) => void
  color: string
}

function Slider({ label, description, value, onChange, color }: SliderProps) {
  return (
    <div className="slider-group">
      <div className="slider-header">
        <span className="slider-label" style={{ color }}>
          {label}
        </span>
        <span className="slider-value">{value}</span>
      </div>
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
      />
      <div className="slider-desc">{description}</div>
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
        description="Distributes IEP, referral, academic & behavior tiers"
        value={weights.support}
        onChange={update("support")}
        color="#8b5cf6"
      />
      <Slider
        label="Reading Balance"
        description="Distributes MAP Reading & iReady Reading levels"
        value={weights.reading}
        onChange={update("reading")}
        color="#3b82f6"
      />
      <Slider
        label="Math Balance"
        description="Distributes MAP Math & iReady Math levels"
        value={weights.math}
        onChange={update("math")}
        color="#10b981"
      />
    </div>
  )
}
