import React, { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  ScatterChart, Scatter, CartesianGrid
} from 'recharts'
import { CROP_COLORS, SUITABILITY_COLORS } from './MapView'

export default function AnalyticsView({ plots }) {
  const [elevationZone, setElevationZone] = useState('ALL') // 'ALL' | 'plains' | 'midlands' | 'ghats'

  // Filter plots by active elevation zone
  const filteredPlots = useMemo(() => {
    if (elevationZone === 'plains') {
      return plots.filter(p => (parseFloat(p.elevation) || 0) < 350)
    } else if (elevationZone === 'midlands') {
      return plots.filter(p => {
        const e = parseFloat(p.elevation) || 0
        return e >= 350 && e <= 600
      })
    } else if (elevationZone === 'ghats') {
      return plots.filter(p => (parseFloat(p.elevation) || 0) > 600)
    }
    return plots
  }, [plots, elevationZone])

  // Crop distribution data for Recharts
  const cropData = useMemo(() => {
    const counts = {}
    filteredPlots.forEach(p => {
      const c = p.recommended_crop || 'Unknown'
      counts[c] = (counts[c] || 0) + 1
    })

    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        fill: CROP_COLORS[name] || '#818cf8'
      }))
      .sort((a, b) => b.count - a.count)
  }, [filteredPlots])

  // Suitability Class distribution data for Recharts
  const suitabilityData = useMemo(() => {
    const counts = { High: 0, Moderate: 0, Low: 0 }
    filteredPlots.forEach(p => {
      const s = p.suitability_class
      if (counts[s] !== undefined) counts[s]++
    })

    return [
      { name: 'High', value: counts.High, color: SUITABILITY_COLORS.High },
      { name: 'Moderate', value: counts.Moderate, color: SUITABILITY_COLORS.Moderate },
      { name: 'Low', value: counts.Low, color: SUITABILITY_COLORS.Low }
    ]
  }, [filteredPlots])

  // Elevation distribution bins
  const elevationData = useMemo(() => {
    const bins = { '<300m': 0, '300-500m': 0, '500-800m': 0, '800-1200m': 0, '>1200m': 0 }
    filteredPlots.forEach(p => {
      const elev = parseFloat(p.elevation) || 0
      if (elev < 300) bins['<300m']++
      else if (elev < 500) bins['300-500m']++
      else if (elev < 800) bins['500-800m']++
      else if (elev < 1200) bins['800-1200m']++
      else bins['>1200m']++
    })

    return Object.entries(bins).map(([range, count]) => ({ range, count }))
  }, [filteredPlots])

  // Yield analysis per crop
  const yieldData = useMemo(() => {
    const stats = {}
    filteredPlots.forEach(p => {
      const c = p.recommended_crop
      if (!c || c === 'Not recommended' || p.pred_yield_index == null || p.pred_yield_index === '') return
      if (!stats[c]) stats[c] = { crop: c, totalIdx: 0, totalKg: 0, count: 0 }
      stats[c].totalIdx += parseFloat(p.pred_yield_index)
      stats[c].totalKg += parseFloat(p.pred_yield_kg_ha || 0)
      stats[c].count++
    })

    const baselines = {
      Banana: 41200, Coconut: 12400, Cotton: 1950, Groundnut: 2500, Maize: 6300,
      Pulses: 800, Rice: 4000, Sorghum: 1580, Sugarcane: 110000, Turmeric: 5350
    }

    return Object.values(stats)
      .map(s => ({
        crop: s.crop,
        avgYieldIdx: +(s.totalIdx / s.count).toFixed(3),
        avgKgHa: Math.round(s.totalKg / s.count),
        baseline: baselines[s.crop] || 4000,
        count: s.count,
        fill: CROP_COLORS[s.crop] || '#38bdf8'
      }))
      .sort((a, b) => b.avgYieldIdx - a.avgYieldIdx)
  }, [filteredPlots])

  // Sampled scatter data: NDVI vs. Predicted Yield Index
  const scatterData = useMemo(() => {
    const valid = filteredPlots.filter(p => {
      const ndvi = parseFloat(p.NDVI || p.ndvi)
      const yIdx = parseFloat(p.pred_yield_index)
      return !isNaN(ndvi) && !isNaN(yIdx) && p.recommended_crop && p.recommended_crop !== 'Not recommended'
    })

    // Take balanced sample of up to 150 points for chart clarity
    const step = Math.max(1, Math.floor(valid.length / 150))
    return valid.filter((_, idx) => idx % step === 0).map(p => ({
      ndvi: +(parseFloat(p.NDVI || p.ndvi)).toFixed(3),
      yieldIndex: +(parseFloat(p.pred_yield_index)).toFixed(3),
      crop: p.recommended_crop,
      elevation: Math.round(parseFloat(p.elevation) || 0)
    }))
  }, [filteredPlots])

  // Export filtered dataset to CSV
  const exportCsv = () => {
    if (!filteredPlots || filteredPlots.length === 0) return

    const headers = ['lat', 'lon', 'elevation', 'slope', 'ndvi', 'phh2o', 'soc', 'clay', 'sand', 'recommended_crop', 'suitability_class', 'pred_yield_index', 'pred_yield_kg_ha']
    const rows = filteredPlots.map(p => headers.map(h => {
      const val = p[h] !== undefined ? p[h] : (h === 'ndvi' ? p.NDVI : '')
      return `"${val}"`
    }).join(','))

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `agrisense_coimbatore_${elevationZone.toLowerCase()}_parcels.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const steepSlopeCount = filteredPlots.filter(p => parseFloat(p.slope) > 15).length
  const steepSlopePct = filteredPlots.length > 0 ? ((steepSlopeCount / filteredPlots.length) * 100).toFixed(1) : '0'
  const cultivablePlots = filteredPlots.filter(p => p.recommended_crop !== 'Not recommended').length

  return (
    <div className="analytics-view-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Filter Bar with Elevation Zones and CSV Export */}
      <div className="glass-panel" style={{ padding: '14px 20px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>
            🏔️ Altitude Zone Filter:
          </span>
          <button
            className={`btn ${elevationZone === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '4px 12px', fontSize: '0.75rem' }}
            onClick={() => setElevationZone('ALL')}
          >
            All Zones ({plots.length})
          </button>
          <button
            className={`btn ${elevationZone === 'plains' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '4px 12px', fontSize: '0.75rem' }}
            onClick={() => setElevationZone('plains')}
          >
            🌾 Plains (&lt;350m)
          </button>
          <button
            className={`btn ${elevationZone === 'midlands' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '4px 12px', fontSize: '0.75rem' }}
            onClick={() => setElevationZone('midlands')}
          >
            🌱 Midlands & Foothills (350–600m)
          </button>
          <button
            className={`btn ${elevationZone === 'ghats' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '4px 12px', fontSize: '0.75rem' }}
            onClick={() => setElevationZone('ghats')}
          >
            ⛰️ Western Ghats (&gt;600m)
          </button>
        </div>

        <button
          className="btn btn-secondary"
          style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={exportCsv}
        >
          📥 Export Filtered CSV ({filteredPlots.length})
        </button>
      </div>

      {/* Top Insights Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>
            🌾 Cultivable Parcels
          </div>
          <div style={{ fontSize: '1.8rem', fontFamily: 'var(--font-heading)', fontWeight: '700', color: '#10b981', margin: '4px 0' }}>
            {cultivablePlots.toLocaleString()} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>({((cultivablePlots / (filteredPlots.length || 1)) * 100).toFixed(1)}%)</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            Satisfy FAO soil & slope agronomic bounds
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>
            ⚠️ Steep Slope Exclusion
          </div>
          <div style={{ fontSize: '1.8rem', fontFamily: 'var(--font-heading)', fontWeight: '700', color: '#f43f5e', margin: '4px 0' }}>
            {steepSlopeCount.toLocaleString()} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>({steepSlopePct}%)</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            Parcels with slope &gt; 15° flagged non-cultivable
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>
            🏆 Leading Recommended Crop
          </div>
          <div style={{ fontSize: '1.8rem', fontFamily: 'var(--font-heading)', fontWeight: '700', color: '#38bdf8', margin: '4px 0' }}>
            {cropData.find(c => c.name !== 'Not recommended')?.name || 'Turmeric'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            Highest quota match in active zone
          </div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px' }}>
        {/* Crop Recommendations Bar Chart */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', color: '#ffffff' }}>
              📊 Crop Recommendation Distribution ({filteredPlots.length.toLocaleString()} Plots)
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Number of land parcels allocated to each crop category in active filter
            </p>
          </div>

          <div style={{ width: '100%', height: '340px' }}>
            <ResponsiveContainer>
              <BarChart data={cropData} margin={{ top: 10, right: 10, left: -10, bottom: 30 }}>
                <XAxis
                  dataKey="name"
                  stroke="#64748b"
                  fontSize={11}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.85rem'
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {cropData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Suitability Class Donut Chart */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', color: '#ffffff' }}>
              🥧 Suitability Classification
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              FAO-based weighted composite scores
            </p>
          </div>

          <div style={{ width: '100%', height: '340px' }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={suitabilityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={105}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {suitabilityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#ffffff'
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Module 4 Correlation: Scatter Plot (Canopy NDVI vs Yield Index) */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', color: '#38bdf8' }}>
              🔬 Agronomic Correlation: Sentinel-2 Canopy NDVI vs. LSTM Yield Index
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Parcel-level distribution demonstrating how vegetation vigor correlates with forecasted crop yield performance
            </p>
          </div>
          <span style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px', background: 'rgba(56,189,248,0.15)', color: '#38bdf8', fontWeight: '600' }}>
            Sampled Parcels
          </span>
        </div>

        <div style={{ width: '100%', height: '300px' }}>
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                type="number"
                dataKey="ndvi"
                name="Canopy NDVI"
                domain={[0.2, 0.9]}
                stroke="#64748b"
                fontSize={12}
                unit=""
                label={{ value: 'Sentinel-2 Canopy NDVI', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 12 }}
              />
              <YAxis
                type="number"
                dataKey="yieldIndex"
                name="Yield Index"
                domain={[0.8, 1.25]}
                stroke="#64748b"
                fontSize={12}
                unit="x"
                label={{ value: 'Yield Index (x Baseline)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload
                    return (
                      <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', padding: '10px', borderRadius: '8px', fontSize: '0.8rem' }}>
                        <div style={{ fontWeight: '700', color: CROP_COLORS[data.crop] || '#38bdf8', marginBottom: '4px' }}>
                          {data.crop}
                        </div>
                        <div>NDVI: <strong>{data.ndvi}</strong></div>
                        <div>Yield Index: <strong>{data.yieldIndex}x</strong></div>
                        <div>Elevation: <strong>{data.elevation}m</strong></div>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Scatter name="Parcels" data={scatterData} fill="#38bdf8" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Elevation Profile Row */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', color: '#ffffff' }}>
            🏔️ Terrain Elevation Profile (SRTM Elevation)
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Altitude bands across the Coimbatore district basin and Western Ghats boundary
          </p>
        </div>

        <div style={{ width: '100%', height: '240px' }}>
          <ResponsiveContainer>
            <BarChart data={elevationData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <XAxis dataKey="range" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: '#0f172a',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#ffffff'
                }}
              />
              <Bar dataKey="count" fill="#38bdf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Module 4: Crop Yield Performance & Regional Benchmarks */}
      {yieldData.length > 0 && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', color: '#38bdf8' }}>
                📈 Module 4: Crop Yield Performance & Regional Benchmarks (LSTM)
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Average predicted yield index and expected production across active parcels (relative to 1.00 baseline)
              </p>
            </div>
            <span style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px', background: 'rgba(56,189,248,0.15)', color: '#38bdf8', fontWeight: '600' }}>
              Multi-Input PyTorch LSTM
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
            {/* Yield Index Bar Chart */}
            <div style={{ width: '100%', height: '280px' }}>
              <ResponsiveContainer>
                <BarChart data={yieldData} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
                  <XAxis dataKey="crop" stroke="#64748b" fontSize={11} angle={-25} textAnchor="end" interval={0} />
                  <YAxis stroke="#64748b" fontSize={12} domain={[0.8, 1.2]} />
                  <Tooltip
                    contentStyle={{
                      background: '#0f172a',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.85rem'
                    }}
                    formatter={(val) => [`${val}x Regional Baseline`, 'Yield Index']}
                  />
                  <Bar dataKey="avgYieldIdx" radius={[4, 4, 0, 0]}>
                    {yieldData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Yield Summary Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 4px' }}>Crop</th>
                    <th style={{ padding: '8px 4px' }}>Plots</th>
                    <th style={{ padding: '8px 4px' }}>Pred Mean</th>
                    <th style={{ padding: '8px 4px' }}>Benchmark</th>
                    <th style={{ padding: '8px 4px' }}>Index</th>
                  </tr>
                </thead>
                <tbody>
                  {yieldData.map((row) => (
                    <tr key={row.crop} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '8px 4px', fontWeight: '600', color: row.fill }}>{row.crop}</td>
                      <td style={{ padding: '8px 4px', color: 'var(--text-muted)' }}>{row.count}</td>
                      <td style={{ padding: '8px 4px', color: '#ffffff', fontWeight: '600' }}>
                        {row.avgKgHa.toLocaleString()} {row.crop === 'Coconut' ? 'nuts' : 'kg'}
                      </td>
                      <td style={{ padding: '8px 4px', color: 'var(--text-dim)' }}>
                        {row.baseline.toLocaleString()}
                      </td>
                      <td style={{ padding: '8px 4px', color: row.avgYieldIdx >= 1.0 ? '#34d399' : '#fb923c', fontWeight: '600' }}>
                        {row.avgYieldIdx}x
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
