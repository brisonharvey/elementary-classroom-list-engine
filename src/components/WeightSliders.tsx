import { useRef, useState } from "react"
import { createPortal } from "react-dom"
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
  const groupRef = useRef<HTMLDivElement>(null)
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number; placement: "above" | "below" } | null>(null)

  const showTooltip = () => {
    const rect = groupRef.current?.getBoundingClientRect()
    if (!rect) return

    const estimatedWidth = Math.min(320, window.innerWidth - 16)
    const left = Math.min(
      Math.max(8, rect.left + rect.width / 2 - estimatedWidth / 2),
      window.innerWidth - estimatedWidth - 8
    )
    const placement = rect.top < 140 ? "below" : "above"
    const top = placement === "below" ? rect.bottom + 12 : rect.top - 12

    setTooltipPosition({ top, left, placement })
    setTooltipVisible(true)
  }

  const hideTooltip = () => {
    setTooltipVisible(false)
  }

  return (
    <div
      ref={groupRef}
      className="slider-group"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocusCapture={showTooltip}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          hideTooltip()
        }
      }}
    >
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
      </div>
      {tooltipVisible && tooltipPosition
        ? createPortal(
            <div
              id={tooltipId}
              className="slider-tooltip"
              role="tooltip"
              style={{
                position: "fixed",
                top: tooltipPosition.top,
                left: tooltipPosition.left,
                transform: tooltipPosition.placement === "below" ? "none" : "translateY(-100%)",
              }}
            >
              {description}
            </div>,
            document.body
          )
        : null}
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
        label="Class Size + Demographics"
        description="Higher values prioritize keeping class sizes close while also balancing student demographic groups like gender, ELL, 504, and special education status across classes."
        value={weights.demographic}
        onChange={update("demographic")}
        color="#8b5cf6"
      />
      <Slider
        label="Characteristic Support Load"
        description="Higher values prioritize balancing the derived characteristic-based classroom support-load index and its behavioral, emotional, instructional, and energy subtotals."
        value={weights.tagSupportLoad}
        onChange={update("tagSupportLoad")}
        color="#0f766e"
      />
    </div>
  )
}
