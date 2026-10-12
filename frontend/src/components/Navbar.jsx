import React from 'react'

export default function Navbar({ activeTab, setActiveTab, backendStatus, totalPlots }) {
  return (
    <header className="navbar" id="app-header">
      <div className="brand" id="brand-logo" onClick={() => setActiveTab('map')}>
        <div className="brand-icon">🌾</div>
        <div>
          <div className="brand-title">AgriSense</div>
          <div className="brand-subtitle">Coimbatore District Precision Agriculture</div>
        </div>
      </div>

      <nav className="nav-tabs" id="nav-tabs-bar">
        <button
          id="nav-tab-map"
          className={`nav-tab-btn ${activeTab === 'map' ? 'active' : ''}`}
          onClick={() => setActiveTab('map')}
        >
          <span>🗺️</span>
          <span>District Geo-Map</span>
        </button>

        <button
          id="nav-tab-predict"
          className={`nav-tab-btn ${activeTab === 'predict' ? 'active' : ''}`}
          onClick={() => setActiveTab('predict')}
        >
          <span>🧪</span>
          <span>Live Recommender</span>
        </button>

        <button
          id="nav-tab-analytics"
          className={`nav-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <span>📊</span>
          <span>Agri-Analytics</span>
        </button>

        <button
          id="nav-tab-status"
          className={`nav-tab-btn ${activeTab === 'status' ? 'active' : ''}`}
          onClick={() => setActiveTab('status')}
        >
          <span>⚙️</span>
          <span>Model & API</span>
        </button>
      </nav>

      <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          id="backend-status-pill"
          className={`status-pill ${backendStatus.online ? '' : 'offline'}`}
          title={backendStatus.online ? `FastAPI running on :8001 (${backendStatus.modelTrained ? 'ML Model Active' : 'Fuzzy Fallback'})` : 'FastAPI Offline - Click System Status'}
        >
          <div className="status-dot"></div>
          <span>{backendStatus.online ? 'API Online' : 'API Offline'}</span>
        </div>
      </div>
    </header>
  )
}
