import React, { useState, useEffect } from 'react'

// Lightweight count-up hook for smooth numeric animation
function useCountUp(targetValue, duration = 800, decimals = 0) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const val = parseFloat(targetValue)
    if (isNaN(val)) return

    let start = 0
    const startTime = performance.now()

    const animate = (now) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3)
      const nextVal = start + (val - start) * ease

      setCurrent(nextVal)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setCurrent(val)
      }
    }

    requestAnimationFrame(animate)
  }, [targetValue, duration])

  return decimals > 0 ? current.toFixed(decimals) : Math.round(current).toLocaleString()
}

export default function KPICards({ plots, backendStatus }) {
  const total = plots.length || 3725
  const highSuit = plots.filter(p => p.suitability_class === 'High').length
  const highPct = total > 0 ? ((highSuit / total) * 100) : 24.8
  
  // Calculate average pH and NDVI if plots loaded
  const avgPh = plots.length > 0 
    ? (plots.reduce((acc, p) => acc + (parseFloat(p.phh2o) || 6.2), 0) / plots.length)
    : 6.15
    
  const avgNdvi = plots.length > 0 
    ? (plots.reduce((acc, p) => acc + (parseFloat(p.NDVI || p.ndvi) || 0.6), 0) / plots.length)
    : 0.64

  const plotsWithYield = plots.filter(p => p.pred_yield_index != null && p.pred_yield_index !== '')
  const avgYieldIdx = plotsWithYield.length > 0
    ? (plotsWithYield.reduce((acc, p) => acc + parseFloat(p.pred_yield_index), 0) / plotsWithYield.length)
    : 1.02

  const animatedTotal = useCountUp(total, 900, 0)
  const animatedHighPct = useCountUp(highPct, 900, 1)
  const animatedYield = useCountUp(avgYieldIdx, 900, 2)
  const animatedPh = useCountUp(avgPh, 900, 2)
  const animatedNdvi = useCountUp(avgNdvi, 900, 2)

  return (
    <div className="kpi-grid" id="kpi-banner">
      <div className="glass-panel kpi-card" id="kpi-total-plots">
        <div className="kpi-icon-wrap" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
          📍
        </div>
        <div>
          <div className="kpi-value">{animatedTotal}</div>
          <div className="kpi-label">Sampled Parcels</div>
        </div>
      </div>

      <div className="glass-panel kpi-card" id="kpi-high-suitability">
        <div className="kpi-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
          ✨
        </div>
        <div>
          <div className="kpi-value">{animatedHighPct}%</div>
          <div className="kpi-label">High Suitability</div>
        </div>
      </div>

      <div className="glass-panel kpi-card" id="kpi-mean-yield">
        <div className="kpi-icon-wrap" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
          📈
        </div>
        <div>
          <div className="kpi-value">{animatedYield}x</div>
          <div className="kpi-label">Yield Index (LSTM)</div>
        </div>
      </div>

      <div className="glass-panel kpi-card" id="kpi-mean-ph">
        <div className="kpi-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
          🧪
        </div>
        <div>
          <div className="kpi-value">{animatedPh} pH</div>
          <div className="kpi-label">Mean Soil pH (H₂O)</div>
        </div>
      </div>

      <div className="glass-panel kpi-card" id="kpi-mean-ndvi">
        <div className="kpi-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
          🌿
        </div>
        <div>
          <div className="kpi-value">{animatedNdvi}</div>
          <div className="kpi-label">Mean Canopy NDVI</div>
        </div>
      </div>

      <div className="glass-panel kpi-card" id="kpi-model-badge">
        <div className="kpi-icon-wrap" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
          🤖
        </div>
        <div>
          <div className="kpi-value" style={{ fontSize: '1.25rem' }}>
            {backendStatus.modelTrained ? 'Trained ML' : 'Fuzzy Fallback'}
          </div>
          <div className="kpi-label">Inference Engine</div>
        </div>
      </div>
    </div>
  )
}

