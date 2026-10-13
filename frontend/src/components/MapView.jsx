import React, { useState, useMemo, useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet'

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

export const YIELD_INDEX_COLORS = {
  'High (>1.05x)': '#10b981',
  'Optimal (0.98-1.05x)': '#06b6d4',
  'Moderate (0.90-0.98x)': '#f59e0b',
  'Below Avg (<0.90x)': '#f43f5e',
}

const TALUK_PRESETS = [
  { name: 'All District', center: [10.99, 76.96], zoom: 10, tag: 'District Overview' },
  { name: 'Pollachi', center: [10.6586, 77.0084], zoom: 12, tag: 'Coconut / Spices Heartland' },
  { name: 'Mettupalayam', center: [11.3000, 76.9400], zoom: 12, tag: 'Bhavani River & Banana' },
  { name: 'Sulur', center: [11.0300, 77.1250], zoom: 12, tag: 'Maize & Rainfed Plains' },
  { name: 'Anamalai', center: [10.5800, 76.9300], zoom: 12, tag: 'Foothills / Turmeric' },
  { name: 'Valparai', center: [10.3200, 76.9500], zoom: 11, tag: 'Western Ghats (High Elevation)' },
  { name: 'Annur', center: [11.2330, 77.1330], zoom: 12, tag: 'Northern Agro-belt' }
]

const BASE_MAPS = {
  dark: {
    name: 'Dark Canvas',
    url: 'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
  },
  satellite: {
    name: 'Satellite View',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics'
  },
  topo: {
    name: 'World Topo',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, HERE, Garmin, USGS, EPA'
  }
}

// Controller component for map camera moves and click sampling
function MapEventsController({ targetView, onMapClick }) {
  const map = useMap()

  useEffect(() => {
    if (targetView) {
      map.flyTo(targetView.center, targetView.zoom, { duration: 1.2 })
    }
  }, [targetView, map])

  useMapEvents({
    click(e) {
      if (e.originalEvent && (e.originalEvent.target?.closest('.leaflet-popup') || e.originalEvent.target?.closest('.leaflet-marker-icon'))) {
        return
      }
      if (onMapClick) {
        onMapClick(e.latlng)
      }
    }
  })

  return null
}

export default function MapView({ plots, onSelectPlotForPredict }) {
  const [selectedCrop, setSelectedCrop] = useState('ALL')
  const [selectedSuitability, setSelectedSuitability] = useState('ALL')
  const [colorMode, setColorMode] = useState('crop') // 'crop' | 'suitability' | 'yield'
  const [baseMapKey, setBaseMapKey] = useState('dark')
  const [markerRadius, setMarkerRadius] = useState(4)
  const [activePlot, setActivePlot] = useState(null)
  const [targetView, setTargetView] = useState(null)
  const [activeTaluk, setActiveTaluk] = useState('All District')
  const [sampledPoint, setSampledPoint] = useState(null)

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
    } else if (colorMode === 'suitability') {
      return SUITABILITY_COLORS[plot.suitability_class] || '#64748b'
    } else {
      const idx = parseFloat(plot.pred_yield_index)
      if (!idx) return '#64748b'
      if (idx >= 1.05) return '#10b981'
      if (idx >= 0.98) return '#06b6d4'
      if (idx >= 0.90) return '#f59e0b'
      return '#f43f5e'
    }
  }

  // Handle clicking anywhere on map: drop sampled point and find closest plot
  const handleMapClick = (latlng) => {
    if (!plots || plots.length === 0) return

    let nearest = null
    let minDistanceSq = Infinity

    for (const plot of plots) {
      const lat = parseFloat(plot.lat)
      const lon = parseFloat(plot.lon)
      if (isNaN(lat) || isNaN(lon)) continue
      const d = Math.pow(lat - latlng.lat, 2) + Math.pow(lon - latlng.lng, 2)
      if (d < minDistanceSq) {
        minDistanceSq = d
        nearest = plot
      }
    }

    if (nearest) {
      const sampled = {
        ...nearest,
        lat: parseFloat(latlng.lat.toFixed(5)),
        lon: parseFloat(latlng.lng.toFixed(5)),
        isSampled: true,
        nearestDistanceKm: +(Math.sqrt(minDistanceSq) * 111).toFixed(2)
      }
      setSampledPoint(sampled)
      setActivePlot(sampled)
    }
  }

  const handleTalukSelect = (taluk) => {
    setActiveTaluk(taluk.name)
    setTargetView({ center: taluk.center, zoom: taluk.zoom })
  }

  return (
    <div className="glass-panel map-view-container" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Region & Taluk Quick Jumps */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', paddingBottom: '4px' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          📍 Focus Taluk:
        </span>
        {TALUK_PRESETS.map((taluk) => (
          <button
            key={taluk.name}
            className={`btn ${activeTaluk === taluk.name ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px' }}
            onClick={() => handleTalukSelect(taluk)}
            title={taluk.tag}
          >
            {taluk.name}
          </button>
        ))}
      </div>

      {/* Map Control Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          {/* Base Layer Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(15,23,34,0.7)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', paddingLeft: '4px', paddingRight: '4px' }}>Layer:</span>
            <button
              className={`btn ${baseMapKey === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              onClick={() => setBaseMapKey('dark')}
            >
              🌙 Dark
            </button>
            <button
              className={`btn ${baseMapKey === 'satellite' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              onClick={() => setBaseMapKey('satellite')}
            >
              🛰️ Satellite
            </button>
            <button
              className={`btn ${baseMapKey === 'topo' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              onClick={() => setBaseMapKey('topo')}
            >
              🏔️ Topo
            </button>
          </div>

          {/* Crop Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Crop:</span>
            <select
              id="map-filter-crop"
              className="form-select"
              style={{ width: '150px', padding: '6px 10px', fontSize: '0.85rem' }}
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
              style={{ width: '130px', padding: '6px 10px', fontSize: '0.85rem' }}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(15,23,34,0.7)', padding: '4px', borderRadius: '8px' }}>
            <button
              id="btn-color-by-crop"
              className={`btn ${colorMode === 'crop' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
              onClick={() => setColorMode('crop')}
            >
              By Crop
            </button>
            <button
              id="btn-color-by-suitability"
              className={`btn ${colorMode === 'suitability' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
              onClick={() => setColorMode('suitability')}
            >
              By Suitability
            </button>
            <button
              id="btn-color-by-yield"
              className={`btn ${colorMode === 'yield' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
              onClick={() => setColorMode('yield')}
            >
              By Yield
            </button>
          </div>

          {/* Dot Size */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>Dot:</span>
            {[3, 4, 6].map(r => (
              <button
                key={r}
                className={`btn ${markerRadius === r ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '2px 7px', fontSize: '0.7rem', borderRadius: '4px' }}
                onClick={() => setMarkerRadius(r)}
              >
                {r === 3 ? 'S' : r === 4 ? 'M' : 'L'}
              </button>
            ))}
          </div>
        </div>

        {/* Status Count badge */}
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Showing <strong style={{ color: '#ffffff' }}>{filteredPlots.length.toLocaleString()}</strong> of {plots.length.toLocaleString()} parcels
        </div>
      </div>

      {/* Map & Plot Details Drawer Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: activePlot ? '1fr 360px' : '1fr', gap: '16px', minHeight: '620px', height: '70vh', transition: 'all 0.3s ease' }}>
        {/* Leaflet Map */}
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
          <MapContainer
            center={[10.99, 76.96]}
            zoom={10}
            scrollWheelZoom={true}
            style={{ width: '100%', height: '100%' }}
          >
            <TileLayer
              attribution={BASE_MAPS[baseMapKey].attribution}
              url={BASE_MAPS[baseMapKey].url}
            />

            <MapEventsController targetView={targetView} onMapClick={handleMapClick} />

            {/* Regular Plot Markers */}
            {filteredPlots.map((plot, idx) => {
              const lat = parseFloat(plot.lat)
              const lon = parseFloat(plot.lon)
              if (isNaN(lat) || isNaN(lon)) return null

              const markerColor = getMarkerColor(plot)
              const isSelected = activePlot && activePlot.lat === plot.lat && activePlot.lon === plot.lon

              return (
                <CircleMarker
                  key={idx}
                  center={[lat, lon]}
                  radius={isSelected ? markerRadius + 3 : markerRadius}
                  pathOptions={{
                    fillColor: markerColor,
                    fillOpacity: isSelected ? 1.0 : 0.85,
                    color: isSelected ? '#ffffff' : markerColor,
                    weight: isSelected ? 2 : 1,
                  }}
                  eventHandlers={{
                    click: () => {
                      setSampledPoint(null)
                      setActivePlot(plot)
                    }
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
                        style={{ marginTop: '8px', padding: '6px 10px', fontSize: '0.8rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectPlotForPredict(plot)
                        }}
                      >
                        🧪 Open in Live Recommender ↗
                      </button>
                    </div>
                  </Popup>
                </CircleMarker>
              )
            })}

            {/* Custom Sampled Point from Click Anywhere */}
            {sampledPoint && (
              <CircleMarker
                center={[sampledPoint.lat, sampledPoint.lon]}
                radius={9}
                pathOptions={{
                  fillColor: '#38bdf8',
                  fillOpacity: 0.9,
                  color: '#ffffff',
                  weight: 3
                }}
              >
                <Popup autoPan={false}>
                  <div style={{ fontSize: '0.85rem' }}>
                    <div style={{ fontWeight: '700', color: '#38bdf8' }}>📍 Custom Sampled Location</div>
                    <div>{sampledPoint.lat}°N, {sampledPoint.lon}°E</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Nearest parcel: {sampledPoint.nearestDistanceKm} km away</div>
                    <button
                      className="btn btn-primary"
                      style={{ marginTop: '8px', padding: '6px 10px', fontSize: '0.8rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectPlotForPredict(sampledPoint)
                      }}
                    >
                      🧪 Open in Live Recommender ↗
                    </button>
                  </div>
                </Popup>
              </CircleMarker>
            )}
          </MapContainer>

          {/* Floating Instructions Banner */}
          <div style={{
            position: 'absolute',
            top: '14px',
            left: '14px',
            zIndex: 1000,
            background: 'rgba(9, 14, 21, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>💡 Tip:</span>
            <span>Click any parcel or <em>click anywhere on the map</em> to sample coordinates!</span>
          </div>

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
            maxWidth: '280px',
            fontSize: '0.75rem'
          }}>
            <div style={{ fontWeight: '600', marginBottom: '6px', color: '#ffffff' }}>
              {colorMode === 'crop'
                ? 'Top Crops Legend'
                : colorMode === 'suitability'
                ? 'Suitability Class'
                : 'Yield Index Legend (LSTM)'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
              {colorMode === 'crop'
                ? Object.entries(CROP_COLORS).slice(0, 8).map(([crop, color]) => (
                    <div key={crop} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }}></span>
                      <span style={{ color: 'var(--text-muted)' }}>{crop}</span>
                    </div>
                  ))
                : colorMode === 'suitability'
                ? Object.entries(SUITABILITY_COLORS).map(([suit, color]) => (
                    <div key={suit} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }}></span>
                      <span style={{ color: 'var(--text-muted)' }}>{suit}</span>
                    </div>
                  ))
                : Object.entries(YIELD_INDEX_COLORS).map(([label, color]) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }}></span>
                      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                    </div>
                  ))
              }
            </div>
          </div>
        </div>

        {/* Selected Plot Inspector Drawer */}
        {activePlot && (
          <div className="glass-panel drawer-slide" style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', borderLeft: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.05em' }}>
                  {activePlot.isSampled ? '📍 Sampled Location' : 'Parcel Inspector'}
                </span>
                {activePlot.isSampled && (
                  <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', borderRadius: '4px' }}>
                    Map Pin
                  </span>
                )}
              </div>
              <button
                className="btn btn-secondary"
                style={{ padding: '3px 8px', fontSize: '0.8rem', borderRadius: '4px' }}
                onClick={() => {
                  setActivePlot(null)
                  setSampledPoint(null)
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '12px', background: 'rgba(15,23,34,0.6)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', color: getMarkerColor(activePlot) }}>
                {activePlot.recommended_crop}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                Coordinates: {parseFloat(activePlot.lat).toFixed(4)}°N, {parseFloat(activePlot.lon).toFixed(4)}°E
              </div>
              {activePlot.isSampled && activePlot.nearestDistanceKm && (
                <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: '4px' }}>
                  Derived from nearest grid cell ({activePlot.nearestDistanceKm} km away)
                </div>
              )}
              {activePlot.not_recommended_reason && (
                <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#fb7185', background: 'rgba(244,63,94,0.1)', padding: '6px 8px', borderRadius: '4px', border: '1px solid rgba(244,63,94,0.2)' }}>
                  ⚠️ {activePlot.not_recommended_reason}
                </div>
              )}
            </div>

            {/* Module 4: Crop Yield Forecast */}
            {activePlot.pred_yield_kg_ha != null && activePlot.pred_yield_kg_ha !== '' && (
              <div style={{ padding: '12px', background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.1) 0%, rgba(14, 165, 233, 0.18) 100%)', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: '#38bdf8' }}>
                    📈 Yield Forecast (LSTM)
                  </span>
                  <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.25)', color: '#38bdf8', fontWeight: '600' }}>
                    {activePlot.pred_yield_index ? `${activePlot.pred_yield_index}x index` : 'Forecasted'}
                  </span>
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: '700', color: '#ffffff', marginTop: '4px' }}>
                  {Number(activePlot.pred_yield_kg_ha).toLocaleString()} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{activePlot.recommended_crop === 'Coconut' ? 'nuts/ha' : 'kg/ha'}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                  Fused 12-month Sentinel-2 NDVI/EVI temporal series
                </div>
              </div>
            )}

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
              style={{ marginTop: 'auto', width: '100%', padding: '10px' }}
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
