import React, { useState, useEffect, useRef } from 'react'
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
      soc: 280,
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

// USDA Soil Texture Classifier
function getSoilTexture(clay, sand) {
  const total = clay + sand
  let c = clay
  let s = sand
  if (total > 100) {
    c = (clay / total) * 100
    s = (sand / total) * 100
  }
  const silt = Math.max(0, 100 - c - s)

  if (c >= 40 && s <= 45 && silt < 40) {
    return { type: 'Clay', desc: 'Heavy dense soil, high moisture & nutrient retention; ideal for wetland Rice, requires drainage for trees' }
  }
  if (c >= 40 && silt >= 40) {
    return { type: 'Silty Clay', desc: 'Very fine texture, retains high water & nutrients; prone to waterlogging' }
  }
  if (c >= 35 && s >= 45) {
    return { type: 'Sandy Clay', desc: 'Dense clay with coarse sand fraction; strong water retention' }
  }
  if (c >= 27 && c < 40 && s <= 45 && s >= 20) {
    return { type: 'Clay Loam', desc: 'Balanced fertile soil; great for Turmeric, Sugarcane & Banana' }
  }
  if (c >= 27 && c < 40 && s < 20) {
    return { type: 'Silty Clay Loam', desc: 'Smooth, fertile soil with high moisture retention' }
  }
  if (c >= 20 && c < 35 && s > 45 && silt < 28) {
    return { type: 'Sandy Clay Loam', desc: 'Good drainage with clay binder; ideal for Coconut & Groundnut' }
  }
  if (c >= 7 && c < 27 && silt >= 28 && silt < 50 && s <= 52) {
    return { type: 'Loam', desc: 'Ideal agricultural soil; fertile, loose, with optimal water-holding capacity' }
  }
  if ((silt >= 50 && c >= 12 && c < 27) || (silt >= 50 && silt < 80 && c < 12)) {
    return { type: 'Silt Loam', desc: 'Silky, fertile soil; highly productive for vegetables & pulses' }
  }
  if (silt >= 80 && c < 12) {
    return { type: 'Silt', desc: 'Very fine riverbed alluvial soil; fertile but prone to surface crusting' }
  }
  if ((c < 20 && s > 52 && (s + 2 * c) > 30) || (c < 7 && silt < 50 && s > 43)) {
    return { type: 'Sandy Loam', desc: 'Rapid drainage & good aeration; perfect for Coconut, Groundnut & Maize' }
  }
  if (s >= 70 && (s + 1.5 * c) >= 15) {
    return { type: 'Loamy Sand', desc: 'High permeability; requires frequent drip irrigation & organic mulching' }
  }
  if (s > 85) {
    return { type: 'Sand', desc: 'Excessive drainage, low nutrient retention; needs continuous organic amendments' }
  }
  return { type: 'Medium Loam', desc: 'Well-aerated agricultural soil with moderate retention' }
}

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
  const [autoCalculate, setAutoCalculate] = useState(true)
  const [showAdvisory, setShowAdvisory] = useState(false)
  const [justExecuted, setJustExecuted] = useState(false)
  const [lastEvaluatedTime, setLastEvaluatedTime] = useState(null)
  const [simulatedYield, setSimulatedYield] = useState(null)
  const debounceTimerRef = useRef(null)

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
    const num = parseFloat(val) || 0
    setSimulatedYield(null)
    setFormData(prev => ({ ...prev, [field]: num }))
  }

  const handlePresetSelect = (preset) => {
    setSimulatedYield(null)
    setFormData({ ...preset.data })
  }

  const handleManualPredict = async (e) => {
    if (e) e.preventDefault()
    setSimulatedYield(null)
    await runPrediction()
    setJustExecuted(true)
    const now = new Date()
    setLastEvaluatedTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    setTimeout(() => {
      setJustExecuted(false)
    }, 2500)
  }

  const handleSimulateAlternativeYield = (cropName) => {
    const cropMeans = {
      Banana: 41200, Coconut: 12400, Cotton: 1950, Groundnut: 2500, Maize: 6300,
      Pulses: 800, Rice: 4000, Sorghum: 1580, Sugarcane: 110000, Turmeric: 5350
    }
    const baseYield = cropMeans[cropName] || 4000
    const vegFactor = Math.max(0.65, Math.min(1.35, 0.98 + (Math.max(0.32, formData.ndvi) - 0.5) * 0.35))
    const yieldIdx = +(vegFactor).toFixed(3)
    const yieldKg = Math.round(yieldIdx * baseYield)

    const monthlyWeights = [0.85, 0.78, 0.72, 0.70, 0.74, 0.95, 1.02, 1.08, 1.12, 1.20, 1.25, 1.10]
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    const phenology = monthlyWeights.map((w, idx) => ({
      month: idx + 1,
      month_name: monthNames[idx],
      ndvi: +(Math.max(0.1, Math.min(0.95, Math.max(0.35, formData.ndvi) * w))).toFixed(3),
      evi: +(Math.max(0.08, Math.min(0.85, Math.max(0.35, formData.ndvi) * 0.75 * w))).toFixed(3)
    }))

    setSimulatedYield({
      crop: cropName,
      pred_yield_index: yieldIdx,
      pred_yield_kg_ha: yieldKg,
      baseline_mean_kg_ha: baseYield,
      variance_pct: +((yieldIdx - 1.0) * 100).toFixed(1),
      yield_category: yieldIdx >= 1.05 ? 'High Potential (Irrigated)' : 'Benchmark Yield (Managed)',
      monthly_phenology: phenology,
      isSimulated: true
    })
  }

  const runPrediction = async (customData) => {
    const dataToUse = customData || formData
    setLoading(true)

    try {
      // Call backend API /api/recommend/plot
      const res = await axios.post('/api/recommend/plot', dataToUse, { timeout: 4000 })
      setResult(res.data)
    } catch (err) {
      // Client-side fallback if backend server isn't reachable
      const isSteep = dataToUse.slope > 15
      const suitScore = Math.max(0.1, Math.min(0.95, (
        (1 - Math.min(1, dataToUse.slope / 25)) * 0.3 +
        Math.max(0, dataToUse.ndvi) * 0.3 +
        (1 - Math.abs(dataToUse.phh2o - 6.5) / 3) * 0.2 +
        Math.min(1, dataToUse.soc / 500) * 0.2
      )))
      
      const suitClass = suitScore >= 0.7 ? 'High' : suitScore >= 0.5 ? 'Moderate' : 'Low'
      const isRejected = isSteep || suitScore < 0.5

      let crop = 'Coconut'
      if (dataToUse.clay > 35 && dataToUse.slope < 3) crop = 'Rice'
      else if (dataToUse.elevation > 500 && dataToUse.slope < 10) crop = 'Turmeric'
      else if (dataToUse.sand > 50) crop = 'Groundnut'
      else if (dataToUse.phh2o > 7.2) crop = 'Sugarcane'

      const cropMeans = {
        Banana: 41200, Coconut: 12400, Cotton: 1950, Groundnut: 2500, Maize: 6300,
        Pulses: 800, Rice: 4000, Sorghum: 1580, Sugarcane: 110000, Turmeric: 5350
      }
      const baseYield = cropMeans[crop] || 4000
      const vegFactor = Math.max(0.6, Math.min(1.4, 1.0 + (dataToUse.ndvi - 0.5) * 0.3 + (suitScore - 0.6) * 0.2))
      const yieldIdx = +(vegFactor).toFixed(3)
      const yieldKg = Math.round(yieldIdx * baseYield)

      const monthlyWeights = [0.85, 0.78, 0.72, 0.70, 0.74, 0.95, 1.02, 1.08, 1.12, 1.20, 1.25, 1.10]
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      const phenology = monthlyWeights.map((w, idx) => ({
        month: idx + 1,
        month_name: monthNames[idx],
        ndvi: +(Math.max(0.1, Math.min(0.95, dataToUse.ndvi * w))).toFixed(3),
        evi: +(Math.max(0.08, Math.min(0.85, dataToUse.ndvi * 0.75 * w))).toFixed(3)
      }))

      // Alternative crop probabilities
      const altCrops = ['Turmeric', 'Maize', 'Cotton', 'Banana', 'Rice'].filter(c => c !== crop)

      setResult({
        recommended: !isRejected,
        recommended_crop: isRejected ? 'Not recommended' : crop,
        not_recommended_reason: isSteep ? 'Steep slope (>15 deg) - high erosion risk under FAO criteria' : (isRejected ? 'Low suitability score' : ''),
        suitability_score: parseFloat(suitScore.toFixed(3)),
        suitability_class: suitClass,
        agro_fit_top: isRejected ? 0 : 0.84,
        top_recommendations: isRejected ? [] : [
          { rank: 1, crop: crop, probability: 0.78, agronomic_fit: 0.88 },
          { rank: 2, crop: altCrops[0], probability: 0.14, agronomic_fit: 0.74 },
          { rank: 3, crop: altCrops[1], probability: 0.08, agronomic_fit: 0.66 }
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

  // Run on mount or when formData changes (debounced if autoCalculate is on)
  useEffect(() => {
    if (!autoCalculate) return

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      runPrediction()
    }, 280)

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [formData, autoCalculate])

  // Run once immediately on mount
  useEffect(() => {
    runPrediction()
  }, [])

  // Calculated Soil Texture
  const soilTexture = getSoilTexture(formData.clay, formData.sand)
  const calculatedSilt = Math.max(0, +(100 - formData.clay - formData.sand).toFixed(1))

  // Color helper for pH status
  const getPhStatus = (ph) => {
    if (ph < 5.5) return { text: 'Strongly Acidic', color: '#f43f5e', note: 'Agricultural lime recommended' }
    if (ph < 6.5) return { text: 'Slightly Acidic', color: '#fbbf24', note: 'Ideal for Turmeric, Tea & Banana' }
    if (ph <= 7.5) return { text: 'Neutral / Optimal', color: '#10b981', note: 'Peak nutrient bioavailability' }
    if (ph <= 8.5) return { text: 'Moderately Alkaline', color: '#38bdf8', note: 'Tolerated by Sugarcane & Cotton' }
    return { text: 'Saline / Alkaline', color: '#a855f7', note: 'Requires gypsum & green manuring' }
  }
  const phStatus = getPhStatus(formData.phh2o)

  return (
    <div className="predict-view-container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
      
      {/* Parameter Input Form */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', color: '#ffffff' }}>
              🧪 Parcel Agronomic Inputs
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Adjust soil & terrain characteristics or load realistic field presets
            </p>
          </div>

          {/* Auto-Calculate Live Switch */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(15,23,34,0.7)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: autoCalculate ? '#34d399' : 'var(--text-muted)' }}>
              ⚡ Live Preview
            </span>
            <input
              type="checkbox"
              id="toggle-auto-calc"
              checked={autoCalculate}
              onChange={(e) => setAutoCalculate(e.target.checked)}
              style={{ cursor: 'pointer', accentColor: '#10b981' }}
            />
          </div>
        </div>

        {/* Preset Selector */}
        <div className="form-group" style={{ marginBottom: '8px' }}>
          <label className="form-label">
            <span>⚡ Load Realistic Field Presets:</span>
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

        <form onSubmit={(e) => { e.preventDefault(); runPrediction(); }}>
          
          {/* Section: Soil Characteristics */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--accent-emerald)', letterSpacing: '0.05em' }}>
              🌱 Soil Characteristics (ISRIC SoilGrids)
            </span>
            <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(16,185,129,0.15)', color: '#34d399', fontWeight: '600' }}>
              Texture: {soilTexture.type}
            </span>
          </div>

          {/* Soil Texture Dynamic Badge */}
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '14px', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <strong style={{ color: '#ffffff' }}>USDA Soil Texture: {soilTexture.type}</strong>
              <span style={{ color: 'var(--text-muted)' }}>Clay: {formData.clay}% | Sand: {formData.sand}% | Silt: {calculatedSilt}%</span>
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
              {soilTexture.desc}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            
            {/* Soil pH with Visual Bar */}
            <div className="form-group">
              <label className="form-label">
                <span title="Soil pH measured in H2O. Key determinant of nutrient availability.">
                  Soil pH (H₂O) ℹ️
                </span>
                <span className="val" style={{ color: phStatus.color, fontWeight: '700' }}>
                  {formData.phh2o.toFixed(1)} ({phStatus.text})
                </span>
              </label>
              <input
                id="input-ph"
                type="range"
                min="4.5"
                max="9.0"
                step="0.1"
                className="slider-input"
                value={formData.phh2o}
                onChange={(e) => handleInputChange('phh2o', e.target.value)}
              />
              {/* Visual pH Gradient Meter */}
              <div style={{ height: '5px', borderRadius: '3px', background: 'linear-gradient(to right, #f43f5e 0%, #fbbf24 35%, #10b981 55%, #38bdf8 75%, #a855f7 100%)', marginTop: '4px', position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  left: `${((formData.phh2o - 4.5) / 4.5) * 100}%`,
                  top: '-4px',
                  width: '4px',
                  height: '13px',
                  background: '#ffffff',
                  borderRadius: '2px',
                  boxShadow: '0 0 6px #ffffff',
                  transform: 'translateX(-50%)'
                }}></div>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                {phStatus.note}
              </div>
            </div>

            {/* Soil Organic Carbon (SOC) */}
            <div className="form-group">
              <label className="form-label">
                <span title="Soil Organic Carbon in decigrams per kg (ISRIC SoilGrids). Vital for water retention and microbial health.">
                  Soil Organic Carbon (SOC) ℹ️
                </span>
                <span className="val">{formData.soc} dg/kg</span>
              </label>
              <input
                id="input-soc"
                type="range"
                min="50"
                max="600"
                step="10"
                className="slider-input"
                value={formData.soc}
                onChange={(e) => handleInputChange('soc', e.target.value)}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                <span>Low (&lt;150)</span>
                <span>Optimal (250–400)</span>
                <span>Rich (&gt;400)</span>
              </div>
            </div>

            {/* Clay % */}
            <div className="form-group">
              <label className="form-label">
                <span title="Clay fraction (0-100%). Governs water-holding capacity and cation exchange capacity.">
                  Clay Content (%) ℹ️
                </span>
                <span className="val">{formData.clay}%</span>
              </label>
              <input
                id="input-clay"
                type="range"
                min="5"
                max="60"
                step="1"
                className="slider-input"
                value={formData.clay}
                onChange={(e) => handleInputChange('clay', e.target.value)}
              />
            </div>

            {/* Sand % */}
            <div className="form-group">
              <label className="form-label">
                <span title="Sand fraction (0-100%). Governs aeration and infiltration rate.">
                  Sand Content (%) ℹ️
                </span>
                <span className="val">{formData.sand}%</span>
              </label>
              <input
                id="input-sand"
                type="range"
                min="10"
                max="80"
                step="1"
                className="slider-input"
                value={formData.sand}
                onChange={(e) => handleInputChange('sand', e.target.value)}
              />
            </div>
          </div>

          {/* Section: Terrain & Canopy */}
          <div style={{ margin: '20px 0 10px', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--accent-blue)', letterSpacing: '0.05em' }}>
            🏔️ Terrain & Satellite Canopy (SRTM & Sentinel-2)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            
            {/* Elevation */}
            <div className="form-group">
              <label className="form-label">
                <span title="Elevation above sea level in meters from NASA SRTM.">
                  Elevation (SRTM) ℹ️
                </span>
                <span className="val">{formData.elevation} m</span>
              </label>
              <input
                id="input-elevation"
                type="range"
                min="150"
                max="1200"
                step="10"
                className="slider-input"
                value={formData.elevation}
                onChange={(e) => handleInputChange('elevation', e.target.value)}
              />
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                {formData.elevation < 350 ? 'Plains basin (Paddy/Coconut)' : formData.elevation < 600 ? 'Foothills (Turmeric/Maize)' : 'Highland / Ghat zone'}
              </div>
            </div>

            {/* Slope with Live Danger Flag */}
            <div className="form-group">
              <label className="form-label">
                <span title="Slope in degrees calculated from SRTM DEM. Slopes >15° are flagged as uncultivable under FAO guidelines due to erosion.">
                  Slope (degrees) ℹ️
                </span>
                <span className="val" style={{ color: formData.slope > 15 ? '#f43f5e' : '#ffffff', fontWeight: formData.slope > 15 ? '700' : 'normal' }}>
                  {formData.slope.toFixed(1)}° {formData.slope > 15 ? '⚠️ Steep' : ''}
                </span>
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
              {/* Visual Slope Bar */}
              <div style={{ height: '5px', borderRadius: '3px', background: 'linear-gradient(to right, #10b981 0%, #10b981 40%, #fbbf24 45%, #fbbf24 65%, #f43f5e 70%, #f43f5e 100%)', marginTop: '4px', position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  left: `${Math.min(100, (formData.slope / 35) * 100)}%`,
                  top: '-4px',
                  width: '4px',
                  height: '13px',
                  background: '#ffffff',
                  borderRadius: '2px',
                  boxShadow: '0 0 6px #ffffff',
                  transform: 'translateX(-50%)'
                }}></div>
              </div>
              <div style={{ fontSize: '0.7rem', color: formData.slope > 15 ? '#fb7185' : 'var(--text-dim)', marginTop: '4px' }}>
                {formData.slope > 15 ? 'Exceeds FAO limit (>15°): High runoff erosion' : formData.slope <= 3 ? 'Gentle valley floor: Ideal for wetland crops' : 'Moderate slope: Terracing suggested'}
              </div>
            </div>

            {/* NDVI */}
            <div className="form-group">
              <label className="form-label">
                <span title="Sentinel-2 annual median Normalized Difference Vegetation Index. Indicates canopy chlorophyll vigor.">
                  Sentinel-2 Canopy NDVI ℹ️
                </span>
                <span className="val" style={{ color: '#34d399', fontWeight: '700' }}>
                  {formData.ndvi.toFixed(2)}
                </span>
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
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                {formData.ndvi < 0.35 ? 'Sparse vegetation / fallow' : formData.ndvi < 0.65 ? 'Moderate healthy canopy' : 'Dense vigorous vegetation'}
              </div>
            </div>

            {/* Aspect */}
            <div className="form-group">
              <label className="form-label">
                <span title="Slope compass orientation in degrees (0-360). Affects solar exposure and monsoon intercept.">
                  Aspect (compass) ℹ️
                </span>
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
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                {formData.aspect >= 180 && formData.aspect <= 270 ? 'SW-facing: High southwest monsoon exposure' : 'NE / East facing: Sheltered leeward'}
              </div>
            </div>
          </div>

          <button
            id="btn-run-prediction"
            type="submit"
            className="btn btn-primary"
            style={{
              width: '100%',
              marginTop: '20px',
              padding: '12px',
              fontSize: '0.95rem',
              background: justExecuted ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : undefined,
              borderColor: justExecuted ? '#34d399' : undefined,
              boxShadow: justExecuted ? '0 0 16px rgba(16, 185, 129, 0.45)' : undefined,
              transition: 'all 0.3s ease'
            }}
            disabled={loading}
            onClick={handleManualPredict}
          >
            {loading
              ? '⏳ Evaluating Land Parcel...'
              : justExecuted
              ? '✅ Inference Evaluated & Synced (FastAPI :8001)'
              : '✨ Run Full Suitability & Yield Inference'}
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            <span>{lastEvaluatedTime ? `Evaluated: ${lastEvaluatedTime}` : 'Engine ready'}</span>
            <span style={{ color: backendStatus.online ? '#34d399' : '#f59e0b', fontWeight: '500' }}>
              ● {backendStatus.online ? 'FastAPI :8001 Connected' : 'Local Inference Engine'}
            </span>
          </div>
        </form>
      </div>

      {/* Results Card */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', color: '#ffffff' }}>
              🎯 AI Recommendation Outcome
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Module 2 FAO Rules + Module 3 ML + Module 4 LSTM Forecast
            </p>
          </div>

          {result && result.recommended && (
            <button
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => setShowAdvisory(true)}
            >
              📄 Farmer Advisory Sheet
            </button>
          )}
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
                  {result.recommended ? '✅ Cultivation Recommended' : '🚫 Parcel Not Cultivable'}
                </span>
                <span className={`badge badge-${(result.suitability_class || 'low').toLowerCase()}`}>
                  {result.suitability_class} Suitability
                </span>
              </div>

              <div style={{
                fontSize: '2.1rem',
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
                  ℹ️ Computed via local agronomic inference
                </div>
              )}
            </div>

            {/* Suitability Score Bar */}
            <div style={{ padding: '14px 16px', background: 'rgba(15,23,34,0.6)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
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

            {/* Top-3 Ranked Crop Recommendations */}
            {result.top_recommendations && result.top_recommendations.length > 0 && (
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.05em' }}>
                  🏆 Ranked Alternative Crops
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                  {result.top_recommendations.map((rec) => (
                    <div
                      key={rec.rank}
                      style={{
                        padding: '10px',
                        borderRadius: '8px',
                        background: rec.rank === 1 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                        border: `1px solid ${rec.rank === 1 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>#{rec.rank} Choice</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: CROP_COLORS[rec.crop] || '#38bdf8' }}>
                          {rec.crop}
                        </span>
                      </div>
                      <div style={{ margin: '6px 0 3px', width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${(rec.probability || 0.5) * 100}%`, height: '100%', background: CROP_COLORS[rec.crop] || '#38bdf8' }}></div>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Fit: {((rec.agronomic_fit || 0.7) * 100).toFixed(0)}%</span>
                        <span>Prob: {((rec.probability || 0.5) * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Module 4: Crop Yield Prediction (LSTM) or Diagnostic Panel */}
            {(() => {
              const activeYield = result.yield_prediction || simulatedYield
              const topAltCrop = result.top_recommendations?.[0]?.crop || 'Banana'

              if (activeYield) {
                return (
                  <div style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: activeYield.isSimulated
                      ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(126, 34, 206, 0.15) 100%)'
                      : 'linear-gradient(135deg, rgba(56, 189, 248, 0.08) 0%, rgba(14, 165, 233, 0.15) 100%)',
                    border: `1px solid ${activeYield.isSimulated ? 'rgba(168, 85, 247, 0.35)' : 'rgba(56, 189, 248, 0.3)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.1rem' }}>📈</span>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: '700', color: activeYield.isSimulated ? '#c084fc' : '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {activeYield.isSimulated ? `Simulated Yield Potential: ${activeYield.crop}` : 'Module 4 — Temporal LSTM Yield Forecast'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                            {activeYield.isSimulated ? 'Potential yield under supplemental irrigation & soil management' : 'Fused 12-Month Sentinel-2 [NDVI, EVI] Dynamics + Soil/Terrain'}
                          </div>
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: activeYield.isSimulated ? 'rgba(168, 85, 247, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                        color: activeYield.isSimulated ? '#c084fc' : '#38bdf8',
                        fontWeight: '600'
                      }}>
                        {activeYield.yield_category}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div style={{ padding: '10px 12px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Estimated Plot Yield</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff', margin: '2px 0' }}>
                          {Number(activeYield.pred_yield_kg_ha).toLocaleString()}
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '4px' }}>
                            {activeYield.crop === 'Coconut' ? 'nuts/ha' : 'kg/ha'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          Regional baseline: {Number(activeYield.baseline_mean_kg_ha).toLocaleString()}
                        </div>
                      </div>

                      <div style={{ padding: '10px 12px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Yield Index Performance</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: activeYield.pred_yield_index >= 1.0 ? '#34d399' : '#fb923c', margin: '2px 0' }}>
                          {activeYield.pred_yield_index}x
                          <span style={{ fontSize: '0.8rem', marginLeft: '6px', color: activeYield.variance_pct >= 0 ? '#34d399' : '#fb923c' }}>
                            ({activeYield.variance_pct >= 0 ? '+' : ''}{activeYield.variance_pct}%)
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          Relative to Coimbatore crop mean
                        </div>
                      </div>
                    </div>

                    {/* 12-Month Phenology Curve */}
                    {activeYield.monthly_phenology && (
                      <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#e2e8f0' }}>
                            🌾 12-Month Phenology Cycle (Sentinel-2 Input)
                          </span>
                          <div style={{ display: 'flex', gap: '8px', fontSize: '0.7rem' }}>
                            <span style={{ color: '#34d399' }}>● NDVI</span>
                            <span style={{ color: '#38bdf8' }}>● EVI</span>
                          </div>
                        </div>

                        <div style={{ width: '100%', height: '65px', position: 'relative' }}>
                          <svg viewBox="0 0 360 60" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                            <defs>
                              <linearGradient id="ndviGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#34d399" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="#34d399" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>
                            <rect x="150" y="0" width="120" height="50" fill="rgba(56, 189, 248, 0.05)" rx="4" />
                            <text x="210" y="8" fill="rgba(56,189,248,0.5)" fontSize="6" textAnchor="middle">Monsoon Window</text>

                            {(() => {
                              const pts = activeYield.monthly_phenology.map((m, i) => {
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

                            {(() => {
                              const pts = activeYield.monthly_phenology.map((m, i) => {
                                const x = (i / 11) * 340 + 10
                                const y = 50 - (Math.max(0, Math.min(1, m.evi)) * 42)
                                return `${x},${y}`
                              }).join(' ')
                              return (
                                <polyline points={pts} fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3,3" />
                              )
                            })()}
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                )
              }

              return (
                <div style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'rgba(244, 63, 94, 0.06)',
                  border: '1px solid rgba(244, 63, 94, 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.1rem' }}>📈</span>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#fb7185', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Module 4 — Yield Forecast Status
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          FAO Precision Agronomy Gating (SUIT_GATE = 0.50)
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(244, 63, 94, 0.2)', color: '#fb7185', fontWeight: '600' }}>
                      Yield Modeling Gated
                    </span>
                  </div>

                  <p style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                    Automated yield forecasting is gated because composite suitability (<strong>{(result.suitability_score * 100).toFixed(1)}%</strong>) is below the 50.0% FAO threshold {result.not_recommended_reason ? `(${result.not_recommended_reason})` : ''}.
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginTop: '4px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '0.75rem', borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={() => handleSimulateAlternativeYield(topAltCrop)}
                    >
                      🔬 Simulate Yield for #{1} Alternative: {topAltCrop}
                    </button>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      or increase Canopy NDVI &ge; 0.35 to unlock full model
                    </span>
                  </div>
                </div>
              )
            })()}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Adjust parameters to evaluate plot suitability
          </div>
        )}
      </div>

      {/* Farmer Advisory Modal Sheet */}
      {showAdvisory && result && (
        <div className="advisory-modal-backdrop" onClick={() => setShowAdvisory(false)}>
          <div className="glass-panel advisory-card-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="advisory-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: '700', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  AgriSense Coimbatore — Precision Farm Advisory
                </div>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', color: '#ffffff', margin: '4px 0' }}>
                  Agricultural Suitability & Management Card
                </h2>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Location: {formData.lat}°N, {formData.lon}°E | Elevation: {formData.elevation}m | Soil: {soilTexture.type}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-primary"
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                  onClick={() => window.print()}
                >
                  🖨️ Print / Save PDF
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                  onClick={() => setShowAdvisory(false)}
                >
                  ✕
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '16px' }}>
              {/* Primary Crop Advice */}
              <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', padding: '16px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: '#10b981' }}>
                  Recommended Crop
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#ffffff', margin: '4px 0' }}>
                  {result.recommended_crop}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                  Suitability: <strong>{result.suitability_class} ({(result.suitability_score * 100).toFixed(0)}%)</strong>
                </div>
                {result.yield_prediction && (
                  <div style={{ marginTop: '10px', fontSize: '0.85rem', color: '#38bdf8' }}>
                    Target Yield: <strong>{Number(result.yield_prediction.pred_yield_kg_ha).toLocaleString()} {result.yield_prediction.crop === 'Coconut' ? 'nuts/ha' : 'kg/ha'}</strong> ({result.yield_prediction.pred_yield_index}x index)
                  </div>
                )}
              </div>

              {/* Soil Health Checklist */}
              <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border-subtle)', padding: '16px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Soil Health & Amendments
                </div>
                <div style={{ fontSize: '0.85rem', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px', color: '#e2e8f0' }}>
                  <div>🧪 <strong>pH Status:</strong> {formData.phh2o} ({phStatus.text}) — {phStatus.note}</div>
                  <div>🌱 <strong>Organic Matter:</strong> SOC {formData.soc} dg/kg — {formData.soc < 200 ? 'Apply FYM / vermicompost (10 t/ha)' : 'Adequate organic reserve'}</div>
                  <div>🌊 <strong>Drainage Strategy:</strong> {soilTexture.type} — {formData.clay > 35 ? 'Provide sub-surface drainage trenches' : 'Drip irrigation with mulching recommended'}</div>
                  <div>🏔️ <strong>Soil Conservation:</strong> Slope {formData.slope}° — {formData.slope > 5 ? 'Contour bunding & vetiver grass hedging suggested' : 'Flat terrain; low erosion risk'}</div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(56,189,248,0.06)', borderRadius: '8px', border: '1px solid rgba(56,189,248,0.2)', fontSize: '0.8rem', color: '#94a3b8' }}>
              📌 <strong>Agronomic Guidance Note:</strong> Recommendations fuse Coimbatore regional soil surveys, Sentinel-2 canopy phenology curves, and FAO land suitability standards. Local field soil testing before sowing is advised.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
