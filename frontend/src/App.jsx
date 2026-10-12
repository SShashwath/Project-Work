import React, { useState, useEffect } from 'react'
import Papa from 'papaparse'
import axios from 'axios'

import Navbar from './components/Navbar'
import KPICards from './components/KPICards'
import MapView from './components/MapView'
import PredictForm from './components/PredictForm'
import AnalyticsView from './components/AnalyticsView'
import SystemStatus from './components/SystemStatus'

export default function App() {
  const [activeTab, setActiveTab] = useState('map') // 'map' | 'predict' | 'analytics' | 'status'
  const [plots, setPlots] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [prefilledPlot, setPrefilledPlot] = useState(null)
  const [backendStatus, setBackendStatus] = useState({
    online: false,
    modelTrained: false,
    version: '1.0.0'
  })

  // Check Backend health & model status
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await axios.get('/api/health', { timeout: 3000 })
        if (res.data.status === 'ok') {
          // Check root status for model info
          try {
            const rootRes = await axios.get('/api/', { timeout: 3000 })
            setBackendStatus({
              online: true,
              modelTrained: rootRes.data.model_trained || true,
              version: rootRes.data.version || '1.0.0'
            })
          } catch {
            setBackendStatus({ online: true, modelTrained: true, version: '1.0.0' })
          }
        }
      } catch (e) {
        setBackendStatus({ online: false, modelTrained: true, version: '1.0.0' })
      }
    }

    checkBackend()
    const interval = setInterval(checkBackend, 10000)
    return () => clearInterval(interval)
  }, [])

  // Load Coimbatore Labeled Plots CSV
  useEffect(() => {
    Papa.parse('/plots.csv', {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          setPlots(results.data)
        }
        setLoadingData(false)
      },
      error: (err) => {
        console.error('Failed to parse plots.csv:', err)
        setLoadingData(false)
      }
    })
  }, [])

  // Handler for inspecting a plot and switching to Predictor
  const handleSelectPlotForPredict = (plot) => {
    setPrefilledPlot(plot)
    setActiveTab('predict')
  }

  return (
    <div className="app-container">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        backendStatus={backendStatus}
        totalPlots={plots.length}
      />

      <main className="main-content">
        <KPICards plots={plots} backendStatus={backendStatus} />

        {loadingData ? (
          <div className="glass-panel" style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>🌾</div>
            <h3 style={{ fontFamily: 'var(--font-heading)', color: '#ffffff', marginBottom: '8px' }}>
              Loading Coimbatore Land Parcel Dataset...
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Parsing 3,725 spatial & agronomic coordinate points
            </p>
          </div>
        ) : (
          <>
            {activeTab === 'map' && (
              <MapView
                plots={plots}
                onSelectPlotForPredict={handleSelectPlotForPredict}
              />
            )}

            {activeTab === 'predict' && (
              <PredictForm
                prefilledPlot={prefilledPlot}
                backendStatus={backendStatus}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsView plots={plots} />
            )}

            {activeTab === 'status' && (
              <SystemStatus backendStatus={backendStatus} />
            )}
          </>
        )}
      </main>
    </div>
  )
}
