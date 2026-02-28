import { useEffect, useState } from 'react'
import { fetchLive, fmtDateTime } from '../lib/api'

const METRICS = ['cpu_percent', 'ram_usage_percent', 'process_count', 'thread_count']
const REFRESH_MS = 5000

const METRIC_LABELS = {
  cpu_percent: 'CPU',
  ram_usage_percent: 'RAM',
  process_count: 'Processes',
  thread_count: 'Threads',
}

const METRIC_UNITS = {
  cpu_percent: '%',
  ram_usage_percent: '%',
  process_count: '',
  thread_count: '',
}

function valueColor(metricName, value) {
  if (!['cpu_percent', 'ram_usage_percent'].includes(metricName)) return 'text-slate-800'
  if (value < 50) return 'text-emerald-600'
  if (value < 80) return 'text-amber-500'
  return 'text-red-500'
}

function MetricCard({ metricName, entry }) {
  const val = entry?.value
  const formatted = val != null ? (Number.isInteger(val) ? val : val.toFixed(1)) : '—'
  const unit = METRIC_UNITS[metricName]
  const color = val != null ? valueColor(metricName, val) : 'text-slate-400'

  return (
    <div className="bg-slate-50 rounded-xl p-4 flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        {METRIC_LABELS[metricName]}
      </span>
      <span className={`text-3xl font-bold ${color}`}>
        {formatted}
        {unit && <span className="text-lg font-medium ml-0.5">{unit}</span>}
      </span>
      {entry && (
        <span className="text-xs text-slate-400">{fmtDateTime(entry.recorded_at)}</span>
      )}
    </div>
  )
}

function DeviceCard({ deviceId, metricMap }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-5">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
        <h2 className="font-semibold text-slate-800 text-base">{deviceId}</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {METRICS.map(m => (
          <MetricCard key={m} metricName={m} entry={metricMap[m]} />
        ))}
      </div>
    </div>
  )
}

export default function LiveView() {
  const [deviceMap, setDeviceMap] = useState({})
  const [lastUpdated, setLastUpdated] = useState(null)
  const [error, setError] = useState(null)

  async function load() {
    try {
      const rows = await fetchLive({ source: 'pc', limit: 500 })

      // For each device+metric pair, keep the most recent row
      const map = {}
      rows.forEach(r => {
        if (!map[r.device_id]) map[r.device_id] = {}
        const existing = map[r.device_id][r.metric_name]
        if (!existing || r.recorded_at > existing.recorded_at) {
          map[r.device_id][r.metric_name] = r
        }
      })

      setDeviceMap(map)
      setLastUpdated(new Date())
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => clearInterval(id)
  }, [])

  const devices = Object.keys(deviceMap)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Live View</h1>
          <p className="text-sm text-slate-500 mt-0.5">Refreshes every {REFRESH_MS / 1000} seconds</p>
        </div>
        {lastUpdated && (
          <span className="text-xs text-slate-400">
            Last updated {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          Failed to fetch metrics: {error}
        </div>
      )}

      {/* Empty */}
      {!error && devices.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <svg className="w-10 h-10 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
          </svg>
          <p className="text-sm">No live metrics in the last 5 minutes</p>
        </div>
      )}

      {/* Device cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {devices.map(deviceId => (
          <DeviceCard key={deviceId} deviceId={deviceId} metricMap={deviceMap[deviceId]} />
        ))}
      </div>
    </div>
  )
}
