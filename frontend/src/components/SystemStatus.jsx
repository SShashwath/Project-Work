import React from 'react'

export default function SystemStatus({ backendStatus }) {
  const steps = [
    { num: '01', name: 'District Boundary & Plot Grid', file: 'coimbatore_plot_grid.geojson', done: true, desc: '3,902 candidate points clipped to Coimbatore boundary' },
    { num: '02', name: 'SRTM Terrain Ingestion', file: 'coimbatore_terrain.csv', done: true, desc: 'Elevation, slope degrees, and aspect via Google Earth Engine' },
    { num: '03', name: 'Sentinel-2 NDVI Canopy Index', file: 'coimbatore_ndvi.csv', done: true, desc: 'Annual median NDVI derived from cloud-free Sentinel-2 imagery' },
    { num: '04', name: 'SoilGrids Chemical & Physical Data', file: 'coimbatore_soil.csv', done: true, desc: 'pH (H₂O), SOC (dg/kg), Clay %, and Sand % from ISRIC' },
    { num: '05', name: 'Spatial Feature Merge', file: 'coimbatore_master_dataset.csv', done: true, desc: 'Coordinate-aligned inner join across all spatial layers' },
    { num: '06', name: 'Suitability & Agronomic Ground Truth', file: 'coimbatore_labeled_suitability.csv', done: true, desc: 'FAO multi-criteria scoring + 10-crop fuzzy logic matching' }
  ]

  return (
    <div className="system-status-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Backend & ML Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* API Server Card */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', color: '#ffffff' }}>
              🔌 FastAPI Backend Engine
            </h3>
            <span className={`status-pill ${backendStatus.online ? '' : 'offline'}`}>
              <span className="status-dot"></span>
              {backendStatus.online ? 'Connected (:8001)' : 'Offline'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Service:</span>
              <strong style={{ color: '#ffffff' }}>AgriSense FastAPI</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>API Version:</span>
              <strong style={{ color: '#ffffff' }}>1.0.0</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Swagger UI:</span>
              <a href="http://localhost:8001/docs" target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>
                http://localhost:8001/docs ↗
              </a>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>ReDoc Specification:</span>
              <a href="http://localhost:8001/redoc" target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>
                http://localhost:8001/redoc ↗
              </a>
            </div>
          </div>
        </div>

        {/* Machine Learning Model Card */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', color: '#ffffff' }}>
              🤖 ML Model Artifact
            </h3>
            <span className="badge badge-high">
              {backendStatus.modelTrained ? 'Trained Model' : 'Fuzzy Fallback'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Model Architecture:</span>
              <strong style={{ color: '#10b981' }}>RandomForest / XGBoost Classifier</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Number of Crop Classes:</span>
              <strong style={{ color: '#ffffff' }}>10 Target Crops</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Feature Dimension:</span>
              <strong style={{ color: '#ffffff' }}>9 Spatial & Soil Features</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Model Path:</span>
              <code style={{ color: '#a855f7', fontSize: '0.75rem' }}>saved_models/crop_recommender.joblib</code>
            </div>
          </div>
        </div>
      </div>

      {/* 6-Step Data Pipeline Status */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', color: '#ffffff' }}>
            🌾 Coimbatore Data Engineering Pipeline
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Status of reproducible data extraction, remote sensing, and labeling modules
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {steps.map(step => (
            <div
              key={step.num}
              style={{
                padding: '16px',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent-emerald)', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                  STEP {step.num}
                </span>
                <span style={{ fontSize: '0.8rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  ✓ Completed
                </span>
              </div>
              <div style={{ fontWeight: '600', fontSize: '0.95rem', color: '#ffffff' }}>
                {step.name}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {step.desc}
              </div>
              <code style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: 'auto' }}>
                data/{step.file}
              </code>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
