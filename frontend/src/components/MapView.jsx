import React, { useState, useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'

// Curated crop colors
export const CROP_COLORS = {
  'Rice': '#34d399',         // Emerald green
  'Coconut': '#38bdf8',      // Sky blue
  'Turmeric': '#facc15',     // Golden yellow
  'Sugarcane': '#a855f7',    // Purple
  'Maize': '#fb923c',        // Orange
  'Cotton': '#e2e8f0',       // Off-white / light slate
  'Groundnut': '#d97706',    // Warm amber
  'Banana': '#22c55e',       // Fresh green
  'Tomato': '#ef4444',       // Crimson red
  'Bhendi': '#14b8a6',       // Teal
  'Not recommended': '#64748b' // Slate gray
}

export const SUITABILITY_COLORS = {
  'High': '#10b981',
  'Moderate': '#f59e0b',
  'Low': '#f43f5e',
  'Not recommended': '#64748b'
}

export default function MapView({ plots, onSelectPlotForPredict }) {
  const [selectedCrop, setSelectedCrop] = useState('ALL')
  const [selectedSuitability, setSelectedSuitability] = useState('ALL')
  const [colorMode, setColorMode] = useState('crop') // 'crop' | 'suitability'
  const [activePlot, setActivePlot] = useState(null)
  const [searchCoords, setSearchCoords] = useState('')

  // Unique crops in dataset
  const cropList = useMemo(() => {
    const set = new Set()
    plots.forEach(p => {
      if (p.recommended_crop) set.add(p.recommended_crop)
    })
    return Array.from(set).sort()
  }, [plots])

  // Filtered plots
  const filteredPlots = useMemo(() => {
    return plots.filter(plot => {
      const matchCrop = selectedCrop === 'ALL' || plot.recommended_crop === selectedCrop
      const matchSuit = selectedSuitability === 'ALL' || plot.suitability_class === selectedSuitability
      return matchCrop && matchSuit
    })
  }, [plots, selectedCrop, selectedSuitability])

  const getMarkerColor = (plot) => {
    if (colorMode === 'crop') {
      return CROP_COLORS[plot.recommended_crop] || '#94a3b8'
    } else {
      return SUITABILITY_COLORS[plot.suitability_class] || '#64748b'
    }
  }

  return (
    <div className="glass-panel map-view-container" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Map Control Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          {/* Crop Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Crop:</span>
            <select
              id="map-filter-crop"
              className="form-select"
              style={{ width: '160px', padding: '6px 10px', fontSize: '0.85rem' }}
              value={selectedCrop}
              onChange={(e) => setSelectedCrop(e.target.value)}
            >
              <option value="ALL">All Crops ({plots.length})</option>
              {cropList.map(crop => (
                <option key={crop} value={crop}>{crop}</option>
              ))}
            </select>
          </div>

          {/* Suitability Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Suitability:</span>
            <select
              id="map-filter-suitability"
              className="form-select"
              style={{ width: '160px', padding: '6px 10px', fontSize: '0.85rem' }}
              value={selectedSuitability}
              onChange={(e) => setSelectedSuitability(e.target.value)}
            >
              <option value="ALL">All Classes</option>
              <option value="High">High</option>
              <option value="Moderate">Moderate</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {/* Color Mode Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(15,23,34,0.7)', padding: '4px', borderRadius: '8px' }}>
            <button
              id="btn-color-by-crop"
              className={`btn ${colorMode === 'crop' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '5px 12px', fontSize: '0.8rem' }}
              onClick={() => setColorMode('crop')}
            >
              By Crop
            </button>
            <button
              id="btn-color-by-suitability"
              className={`btn ${colorMode === 'suitability' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '5px 12px', fontSize: '0.8rem' }}
              onClick={() => setColorMode('suitability')}
            >
              By Suitability
            </button>
          </div>
        </div>

        {/* Status Count badge */}
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Showing <strong style={{ color: '#ffffff' }}>{filteredPlots.length.toLocaleString()}</strong> of {plots.length.toLocaleString()} parcels
        </div>
      </div>

      {/* Map & Plot Details Drawer Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: activePlot ? '1fr 340px' : '1fr', gap: '16px', minHeight: '600px', height: '68vh' }}>
        {/* Leaflet Map */}
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
          <MapContainer
            center={[10.99, 76.96]}
            zoom={10}
            scrollWheelZoom={true}
            style={{ width: '100%', height: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />

            {filteredPlots.map((plot, idx) => {
              const lat = parseFloat(plot.lat)
              const lon = parseFloat(plot.lon)
              if (isNaN(lat) || isNaN(lon)) return null

              const markerColor = getMarkerColor(plot)

              return (
                <CircleMarker
                  key={idx}
                  center={[lat, lon]}
                  radius={4}
                  pathOptions={{
                    fillColor: markerColor,
                    fillOpacity: 0.85,
                    color: markerColor,
                    weight: 1,
                  }}
                  eventHandlers={{
                    click: () => setActivePlot(plot)
                  }}
                >
                  <Popup>
                    <div style={{ fontSize: '0.85rem', minWidth: '180px' }}>
                      <div style={{ fontWeight: '700', fontSize: '1rem', color: markerColor, marginBottom: '4px' }}>
                        {plot.recommended_crop || 'Parcel'}
                      </div>
                      <div><strong>Suitability:</strong> {plot.suitability_class} ({plot.suitability_score})</div>
                      <div><strong>Soil pH:</strong> {plot.phh2o}</div>
                      <div><strong>Elevation:</strong> {plot.elevation}m (Slope: {parseFloat(plot.slope || 0).toFixed(1)}°)</div>
                      <button
                        className="btn btn-primary"
                        style={{ marginTop: '8px', padding: '4px 10px', fontSize: '0.75rem', width: '100%' }}
                        onClick={() => setActivePlot(plot)}
                      >
                        Inspect Details
                      </button>
                    </div>
                  </Popup>
                </CircleMarker>
              )
            })}
          </MapContainer>

          {/* Floating Legend */}
          <div style={{
            position: 'absolute',
            bottom: '16px',
            left: '16px',
            zIndex: 1000,
            background: 'rgba(9, 14, 21, 0.88)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '10px 14px',
            maxWidth: '260px',
            fontSize: '0.75rem'
          }}>
            <div style={{ fontWeight: '600', marginBottom: '6px', color: '#ffffff' }}>
              {colorMode === 'crop' ? 'Top Crops Legend' : 'Suitability Class'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
              {colorMode === 'crop'
                ? Object.entries(CROP_COLORS).slice(0, 8).map(([crop, color]) => (
                    <div key={crop} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }}></span>
                      <span style={{ color: 'var(--text-muted)' }}>{crop}</span>
                    </div>
                  ))
                : Object.entries(SUITABILITY_COLORS).map(([suit, color]) => (
                    <div key={suit} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }}></span>
                      <span style={{ color: 'var(--text-muted)' }}>{suit}</span>
                    </div>
                  ))
              }
            </div>
          </div>
        </div>

        {/* Selected Plot Inspector Drawer */}
        {activePlot && (
          <div className="glass-panel" style={{ padding: '18px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '600' }}>
                Parcel Inspector
              </div>
              <button
                className="btn btn-secondary"
                style={{ padding: '2px 8px', fontSize: '0.8rem', borderRadius: '4px' }}
                onClick={() => setActivePlot(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '12px', background: 'rgba(15,23,34,0.6)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: '700', color: getMarkerColor(activePlot) }}>
                {activePlot.recommended_crop}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                Coordinates: {parseFloat(activePlot.lat).toFixed(4)}°N, {parseFloat(activePlot.lon).toFixed(4)}°E
              </div>
              {activePlot.not_recommended_reason && (
                <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#fb7185', background: 'rgba(244,63,94,0.1)', padding: '4px 8px', borderRadius: '4px' }}>
                  ⚠️ {activePlot.not_recommended_reason}
                </div>
              )}
            </div>

            {/* Suitability Meter */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Suitability Index:</span>
                <span className={`badge badge-${(activePlot.suitability_class || 'low').toLowerCase()}`}>
                  {activePlot.suitability_class} ({(parseFloat(activePlot.suitability_score || 0) * 100).toFixed(0)}%)
                </span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  width: `${(parseFloat(activePlot.suitability_score || 0) * 100)}%`,
                  height: '100%',
                  background: SUITABILITY_COLORS[activePlot.suitability_class] || '#10b981'
                }}></div>
              </div>
            </div>

            {/* Soil Attributes */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>
                🌱 Soil Characteristics (SoilGrids)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem' }}>
                <div style={{ padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                  <div style={{ color: 'var(--text-muted)' }}>pH (H₂O)</div>
                  <div style={{ fontWeight: '600', color: '#ffffff' }}>{activePlot.phh2o}</div>
                </div>
                <div style={{ padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                  <div style={{ color: 'var(--text-muted)' }}>SOC (dg/kg)</div>
                  <div style={{ fontWeight: '600', color: '#ffffff' }}>{activePlot.soc}</div>
                </div>
                <div style={{ padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                  <div style={{ color: 'var(--text-muted)' }}>Clay %</div>
                  <div style={{ fontWeight: '600', color: '#ffffff' }}>{activePlot.clay}%</div>
                </div>
                <div style={{ padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                  <div style={{ color: 'var(--text-muted)' }}>Sand %</div>
                  <div style={{ fontWeight: '600', color: '#ffffff' }}>{activePlot.sand}%</div>
                </div>
              </div>
            </div>

            {/* Terrain Attributes */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>
                🏔️ Terrain & Vegetation (SRTM & Sentinel-2)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem' }}>
                <div style={{ padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                  <div style={{ color: 'var(--text-muted)' }}>Elevation</div>
                  <div style={{ fontWeight: '600', color: '#ffffff' }}>{activePlot.elevation} m</div>
                </div>
                <div style={{ padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                  <div style={{ color: 'var(--text-muted)' }}>Slope</div>
                  <div style={{ fontWeight: '600', color: '#ffffff' }}>{parseFloat(activePlot.slope || 0).toFixed(1)}°</div>
                </div>
                <div style={{ padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                  <div style={{ color: 'var(--text-muted)' }}>Aspect</div>
                  <div style={{ fontWeight: '600', color: '#ffffff' }}>{parseFloat(activePlot.aspect || 0).toFixed(0)}°</div>
                </div>
                <div style={{ padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                  <div style={{ color: 'var(--text-muted)' }}>NDVI</div>
                  <div style={{ fontWeight: '600', color: '#ffffff' }}>{parseFloat(activePlot.NDVI || activePlot.ndvi || 0).toFixed(3)}</div>
                </div>
              </div>
            </div>

            {/* Test in Predictor Button */}
            <button
              id="btn-inspect-load-predict"
              className="btn btn-primary"
              style={{ marginTop: 'auto', width: '100%' }}
              onClick={() => onSelectPlotForPredict(activePlot)}
            >
              🧪 Load into Live Recommender
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
