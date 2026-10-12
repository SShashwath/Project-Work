import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { CROP_COLORS } from './MapView'

const PRESETS = [
  {
    name: 'Pollachi Coconut Farm (Flat, High NDVI)',
    data: {
      elevation: 280,
      slope: 1.5,
      aspect: 140,
      ndvi: 0.68,
      phh2o: 6.4,
      soc: 380,
      clay: 26,
      sand: 48,
      lat: 10.65,
      lon: 77.01
    }
  },
  {
    name: 'Sirumugai River Basin (Low Elev, Clayey)',
    data: {
      elevation: 310,
      slope: 1.2,
      aspect: 90,
      ndvi: 0.58,
      phh2o: 6.8,
      soc: 340,
      clay: 38,
      sand: 32,
      lat: 11.31,
      lon: 77.01
    }
  },
  {
    name: 'Anamalai Foothills (Turmeric / Maize)',
    data: {
      elevation: 540,
      slope: 5.8,
      aspect: 180,
      ndvi: 0.62,
      phh2o: 5.8,
      soc: 420,
      clay: 30,
      sand: 40,
      lat: 10.45,
      lon: 76.92
    }
  },
  {
    name: 'Steep Ghat Slope (Slope > 20° - Rejected)',
    data: {
      elevation: 920,
      slope: 24.5,
      aspect: 210,
      ndvi: 0.75,
      phh2o: 5.2,
      soc: 490,
      clay: 32,
      sand: 35,
      lat: 10.35,
      lon: 76.85
    }
  },
  {
    name: 'High Alkaline / Saline Soil (pH 8.8)',
    data: {
      elevation: 360,
      slope: 2.0,
      aspect: 120,
      ndvi: 0.35,
      phh2o: 8.8,
      soc: 120,
      clay: 45,
      sand: 25,
      lat: 11.02,
      lon: 77.15
    }
  }
]

export default function PredictForm({ prefilledPlot, backendStatus }) {
  const [formData, setFormData] = useState({
    elevation: 380,
    slope: 3.2,
    aspect: 180,
    ndvi: 0.62,
    phh2o: 6.4,
    soc: 320,
    clay: 28,
    sand: 44,
    lat: 10.99,
    lon: 76.96
  })

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)

  // Pre-fill from Map drawer if requested
  useEffect(() => {
    if (prefilledPlot) {
      setFormData({
        elevation: parseFloat(prefilledPlot.elevation) || 380,
        slope: parseFloat(prefilledPlot.slope) || 3.0,
        aspect: parseFloat(prefilledPlot.aspect) || 180,
        ndvi: parseFloat(prefilledPlot.NDVI || prefilledPlot.ndvi) || 0.6,
        phh2o: parseFloat(prefilledPlot.phh2o) || 6.4,
        soc: parseFloat(prefilledPlot.soc) || 300,
        clay: parseFloat(prefilledPlot.clay) || 28,
        sand: parseFloat(prefilledPlot.sand) || 44,
        lat: parseFloat(prefilledPlot.lat) || 10.99,
        lon: parseFloat(prefilledPlot.lon) || 76.96
      })
    }
  }, [prefilledPlot])

  const handleInputChange = (field, val) => {
    setFormData(prev => ({ ...prev, [field]: parseFloat(val) || 0 }))
  }

  const handlePresetSelect = (preset) => {
    setFormData({ ...preset.data })
  }

  const runPrediction = async (e) => {
    if (e) e.preventDefault()
    setLoading(true)
    setErrorMsg(null)

    try {
      // Call backend API /api/recommend/plot (proxied to port 8001)
      const res = await axios.post('/api/recommend/plot', formData, { timeout: 5000 })
      setResult(res.data)
    } catch (err) {
      console.warn('Backend call failed, computing local agronomic prediction:', err)
      // Client-side fallback if backend server isn't running
      const isSteep = formData.slope > 15
      const suitScore = Math.max(0.1, Math.min(0.95, (
        (1 - Math.min(1, formData.slope / 25)) * 0.3 +
        Math.max(0, formData.ndvi) * 0.3 +
        (1 - Math.abs(formData.phh2o - 6.5) / 3) * 0.2 +
        Math.min(1, formData.soc / 500) * 0.2
      )))
      
      const suitClass = suitScore >= 0.7 ? 'High' : suitScore >= 0.5 ? 'Moderate' : 'Low'
      const isRejected = isSteep || suitScore < 0.5

      let crop = 'Coconut'
      if (formData.clay > 35 && formData.slope < 3) crop = 'Rice'
      else if (formData.elevation > 500 && formData.slope < 10) crop = 'Turmeric'
      else if (formData.sand > 50) crop = 'Groundnut'
      else if (formData.phh2o > 7.2) crop = 'Sugarcane'

      const cropMeans = {
        Banana: 41200, Coconut: 12400, Cotton: 1950, Groundnut: 2500, Maize: 6300,
        Pulses: 800, Rice: 4000, Sorghum: 1580, Sugarcane: 110000, Turmeric: 5350
      }
      const baseYield = cropMeans[crop] || 4000
      const vegFactor = Math.max(0.6, Math.min(1.4, 1.0 + (formData.ndvi - 0.5) * 0.3 + (suitScore - 0.6) * 0.2))
      const yieldIdx = +(vegFactor).toFixed(3)
      const yieldKg = Math.round(yieldIdx * baseYield)

      const monthlyWeights = [0.85, 0.78, 0.72, 0.70, 0.74, 0.95, 1.02, 1.08, 1.12, 1.20, 1.25, 1.10]
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      const phenology = monthlyWeights.map((w, idx) => ({
        month: idx + 1,
        month_name: monthNames[idx],
        ndvi: +(Math.max(0.1, Math.min(0.95, formData.ndvi * w))).toFixed(3),
        evi: +(Math.max(0.08, Math.min(0.85, formData.ndvi * 0.75 * w))).toFixed(3)
      }))

      setResult({
        recommended: !isRejected,
        recommended_crop: isRejected ? 'Not recommended' : crop,
        not_recommended_reason: isSteep ? 'steep slope (>15 deg) - not cultivable for modelled crops' : (isRejected ? 'low suitability score' : ''),
        suitability_score: parseFloat(suitScore.toFixed(3)),
        suitability_class: suitClass,
        agro_fit_top: isRejected ? 0 : 0.84,
        top_recommendations: isRejected ? [] : [
          { rank: 1, crop: crop, probability: 0.78, agronomic_fit: 0.85 },
          { rank: 2, crop: 'Maize', probability: 0.12, agronomic_fit: 0.72 },
          { rank: 3, crop: 'Cotton', probability: 0.08, agronomic_fit: 0.65 }
        ],
        yield_prediction: isRejected ? null : {
          crop,
          pred_yield_index: yieldIdx,
          pred_yield_kg_ha: yieldKg,
          baseline_mean_kg_ha: baseYield,
          variance_pct: +((yieldIdx - 1.0) * 100).toFixed(1),
          yield_category: yieldIdx >= 1.08 ? 'High Yield Potential' : yieldIdx >= 0.95 ? 'Optimal / Benchmark Yield' : 'Moderate Yield',
          monthly_phenology: phenology
        },
        is_client_fallback: true
      })
    } finally {
      setLoading(false)
    }

  }

  // Run on mount once
  useEffect(() => {
    runPrediction()
  }, [])

  return (
    <div className="predict-view-container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
      {/* Parameter Input Form */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', color: '#ffffff' }}>
              🧪 Parcel Feature Inputs
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Enter soil and terrain characteristics or choose a local parcel preset
            </p>
          </div>
        </div>

        {/* Preset Selector */}
        <div className="form-group">
          <label className="form-label">
            <span>⚡ Load Realistic Preset:</span>
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {PRESETS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '6px 10px', borderRadius: '6px' }}
                onClick={() => handlePresetSelect(preset)}
              >
                {preset.name.split(' (')[0]}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={runPrediction}>
          {/* Section: Soil Characteristics */}
          <div style={{ margin: '20px 0 10px', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--accent-emerald)', letterSpacing: '0.05em' }}>
            🌱 SoilGrids Parameters
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">
                <span>Soil pH (H₂O)</span>
                <span className="val">{formData.phh2o.toFixed(1)}</span>
              </label>
              <input
                id="input-ph"
                type="range"
                min="4.0"
                max="9.5"
                step="0.1"
                className="slider-input"
                value={formData.phh2o}
                onChange={(e) => handleInputChange('phh2o', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span>SOC (dg/kg)</span>
                <span className="val">{formData.soc}</span>
              </label>
              <input
                id="input-soc"
                type="range"
                min="50"
                max="800"
                step="10"
                className="slider-input"
                value={formData.soc}
                onChange={(e) => handleInputChange('soc', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span>Clay Content (%)</span>
                <span className="val">{formData.clay}%</span>
              </label>
              <input
                id="input-clay"
                type="range"
                min="5"
                max="75"
                step="1"
                className="slider-input"
                value={formData.clay}
                onChange={(e) => handleInputChange('clay', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span>Sand Content (%)</span>
                <span className="val">{formData.sand}%</span>
              </label>
              <input
                id="input-sand"
                type="range"
                min="5"
                max="85"
                step="1"
                className="slider-input"
                value={formData.sand}
                onChange={(e) => handleInputChange('sand', e.target.value)}
              />
            </div>
          </div>

          {/* Section: Terrain & Canopy */}
          <div style={{ margin: '20px 0 10px', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--accent-blue)', letterSpacing: '0.05em' }}>
            🏔️ Terrain & Vegetation Parameters
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">
                <span>Elevation (m)</span>
                <span className="val">{formData.elevation} m</span>
              </label>
              <input
                id="input-elevation"
                type="range"
                min="150"
                max="1800"
                step="10"
                className="slider-input"
                value={formData.elevation}
                onChange={(e) => handleInputChange('elevation', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span>Slope (degrees)</span>
                <span className="val">{formData.slope.toFixed(1)}°</span>
              </label>
              <input
                id="input-slope"
                type="range"
                min="0"
                max="35"
                step="0.5"
                className="slider-input"
                value={formData.slope}
                onChange={(e) => handleInputChange('slope', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span>Canopy NDVI</span>
                <span className="val">{formData.ndvi.toFixed(2)}</span>
              </label>
              <input
                id="input-ndvi"
                type="range"
                min="0.1"
                max="0.95"
                step="0.02"
                className="slider-input"
                value={formData.ndvi}
                onChange={(e) => handleInputChange('ndvi', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span>Aspect (degrees)</span>
                <span className="val">{formData.aspect.toFixed(0)}°</span>
              </label>
              <input
                id="input-aspect"
                type="range"
                min="0"
                max="360"
                step="5"
                className="slider-input"
                value={formData.aspect}
                onChange={(e) => handleInputChange('aspect', e.target.value)}
              />
            </div>
          </div>

          <button
            id="btn-run-prediction"
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '16px', padding: '12px' }}
            disabled={loading}
          >
            {loading ? 'Evaluating Land Parcel...' : '✨ Predict Crop & Land Suitability'}
          </button>
        </form>
      </div>

      {/* Results Card */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', color: '#ffffff' }}>
            🎯 AI Recommendation Outcome
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Module 2 Composite Suitability + Module 3 ML Inference
          </p>
        </div>

        {result ? (
          <>
            {/* Primary Result Banner */}
            <div style={{
              padding: '20px',
              borderRadius: '12px',
              background: result.recommended
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.25) 100%)'
                : 'linear-gradient(135deg, rgba(244, 63, 94, 0.15) 0%, rgba(225, 29, 72, 0.25) 100%)',
              border: `1px solid ${result.recommended ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: result.recommended ? '#34d399' : '#fb7185' }}>
                  {result.recommended ? '✅ Cultivation Recommended' : '🚫 Parcel Not Recommended'}
                </span>
                <span className={`badge badge-${(result.suitability_class || 'low').toLowerCase()}`}>
                  {result.suitability_class} Suitability
                </span>
              </div>

              <div style={{
                fontSize: '2rem',
                fontFamily: 'var(--font-heading)',
                fontWeight: '700',
                color: '#ffffff',
                margin: '10px 0 4px'
              }}>
                {result.recommended_crop}
              </div>

              {result.not_recommended_reason && (
                <div style={{ fontSize: '0.85rem', color: '#fda4af', marginTop: '6px' }}>
                  Reason: {result.not_recommended_reason}
                </div>
              )}

              {result.is_client_fallback && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '8px' }}>
                  ℹ️ Computed via local agronomic rules (Backend server was unreached)
                </div>
              )}
            </div>

            {/* Suitability Score Bar */}
            <div style={{ padding: '16px', background: 'rgba(15,23,34,0.6)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Normalized Composite Suitability:</span>
                <strong style={{ color: '#ffffff' }}>{(result.suitability_score * 100).toFixed(1)}%</strong>
              </div>
              <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{
                  width: `${result.suitability_score * 100}%`,
                  height: '100%',
                  background: result.suitability_score >= 0.7 ? '#10b981' : result.suitability_score >= 0.5 ? '#f59e0b' : '#f43f5e',
                  transition: 'width 0.4s ease'
                }}></div>
              </div>
            </div>

            {/* Module 4: Crop Yield Prediction (LSTM) */}
            {result.yield_prediction && (
              <div style={{
                padding: '18px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.08) 0%, rgba(14, 165, 233, 0.15) 100%)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.1rem' }}>📈</span>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Module 4 — Temporal LSTM Yield Forecast
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        Fused 12-Month Sentinel-2 [NDVI, EVI] Dynamics + Soil/Terrain
                      </div>
                    </div>
                  </div>
                  <span style={{
                    fontSize: '0.75rem',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    background: 'rgba(56, 189, 248, 0.2)',
                    color: '#38bdf8',
                    fontWeight: '600'
                  }}>
                    {result.yield_prediction.yield_category}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ padding: '12px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Estimated Plot Yield</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: '700', color: '#ffffff', margin: '2px 0' }}>
                      {Number(result.yield_prediction.pred_yield_kg_ha).toLocaleString()}
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '4px' }}>
                        {result.yield_prediction.crop === 'Coconut' ? 'nuts/ha' : 'kg/ha'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      Regional baseline: {Number(result.yield_prediction.baseline_mean_kg_ha).toLocaleString()}
                    </div>
                  </div>

                  <div style={{ padding: '12px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Yield Index Performance</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: '700', color: result.yield_prediction.pred_yield_index >= 1.0 ? '#34d399' : '#fb923c', margin: '2px 0' }}>
                      {result.yield_prediction.pred_yield_index}x
                      <span style={{ fontSize: '0.8rem', marginLeft: '6px', color: result.yield_prediction.variance_pct >= 0 ? '#34d399' : '#fb923c' }}>
                        ({result.yield_prediction.variance_pct >= 0 ? '+' : ''}{result.yield_prediction.variance_pct}%)
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      Relative to Coimbatore crop mean
                    </div>
                  </div>
                </div>

                {/* 12-Month Phenology Curve */}
                {result.yield_prediction.monthly_phenology && (
                  <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#e2e8f0' }}>
                        🌾 12-Month Vegetation Phenology Cycle (Sentinel-2 Input)
                      </span>
                      <div style={{ display: 'flex', gap: '10px', fontSize: '0.7rem' }}>
                        <span style={{ color: '#34d399' }}>● NDVI</span>
                        <span style={{ color: '#38bdf8' }}>● EVI</span>
                      </div>
                    </div>

                    <div style={{ width: '100%', height: '70px', position: 'relative' }}>
                      <svg viewBox="0 0 360 60" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                        <defs>
                          <linearGradient id="ndviGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#34d399" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#34d399" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        {/* Background monsoon grid indicator (SW Monsoon months Jun-Sep, NE Monsoon Oct-Dec) */}
                        <rect x="150" y="0" width="120" height="50" fill="rgba(56, 189, 248, 0.05)" rx="4" />
                        <text x="210" y="8" fill="rgba(56,189,248,0.5)" fontSize="6" textAnchor="middle">Monsoon Peak Window</text>

                        {/* NDVI Polyline & Area */}
                        {(() => {
                          const pts = result.yield_prediction.monthly_phenology.map((m, i) => {
                            const x = (i / 11) * 340 + 10
                            const y = 50 - (Math.max(0, Math.min(1, m.ndvi)) * 42)
                            return `${x},${y}`
                          }).join(' ')
                          const areaPts = `10,50 ${pts} 350,50`
                          return (
                            <>
                              <polygon points={areaPts} fill="url(#ndviGrad)" />
                              <polyline points={pts} fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" />
                            </>
                          )
                        })()}

                        {/* EVI Polyline */}
                        {(() => {
                          const pts = result.yield_prediction.monthly_phenology.map((m, i) => {
                            const x = (i / 11) * 340 + 10
                            const y = 50 - (Math.max(0, Math.min(1, m.evi)) * 42)
                            return `${x},${y}`
                          }).join(' ')
                          return <polyline points={pts} fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3,2" />
                        })()}

                        {/* Month labels */}
                        {result.yield_prediction.monthly_phenology.map((m, i) => {
                          const x = (i / 11) * 340 + 10
                          return (
                            <text key={m.month_name} x={x} y="58" fill="#64748b" fontSize="6" textAnchor="middle">
                              {m.month_name[0]}
                            </text>
                          )
                        })}
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Top Ranked Recommendations */}
            {result.top_recommendations && result.top_recommendations.length > 0 && (
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#ffffff', marginBottom: '10px' }}>
                  📊 Ranked Alternative Recommendations
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {result.top_recommendations.map((rec) => (
                    <div
                      key={rec.crop}
                      style={{
                        padding: '10px 14px',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        border: '1px solid var(--border-subtle)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: 'rgba(255,255,255,0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: '700'
                        }}>
                          #{rec.rank}
                        </span>
                        <span style={{ fontWeight: '600', color: CROP_COLORS[rec.crop] || '#ffffff' }}>
                          {rec.crop}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.8rem' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Confidence: </span>
                          <strong style={{ color: '#ffffff' }}>{(rec.probability * 100).toFixed(1)}%</strong>
                        </div>
                        {rec.agronomic_fit != null && (
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Agro Fit: </span>
                            <strong style={{ color: '#38bdf8' }}>{(rec.agronomic_fit * 100).toFixed(0)}%</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading prediction...
          </div>
        )}
      </div>
    </div>
  )
}
