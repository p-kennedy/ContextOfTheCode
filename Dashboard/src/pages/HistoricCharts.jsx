import { useEffect, useRef, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { API_BASE, fetchHistory, pivotByTime, fmtDateTime } from '../lib/api'

const METRICS = ['ram_usage_percent', 'cpu_percent']
const COLORS = { ram_usage_percent: '#3b82f6', cpu_percent: '#f59e0b' }
const LABELS = { ram_usage_percent: 'RAM %', cpu_percent: 'CPU %' }

const QUICK_RANGES = [
  { key: 'hour', label: 'Last Hour', ms: 60 * 60 * 1000 },
  { key: 'day',  label: 'Last Day',  ms: 24 * 60 * 60 * 1000 },
]

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="text-slate-500 mb-1.5 text-xs">{fmtDateTime(label)}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-medium">
          {LABELS[p.dataKey]}: {p.value?.toFixed(1)}%
        </p>
      ))}
    </div>
  )
}

/** Fetch distinct device IDs from the metrics list endpoint */
async function fetchDeviceIds() {
  const url = new URL(`${API_BASE}/metrics/`)
  url.searchParams.set('source', 'pc')
  url.searchParams.set('limit', '1000')
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const rows = await res.json()
  return [...new Set(rows.map(r => r.device_id))].sort()
}

export default function HistoricCharts() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [loadedCount, setLoadedCount] = useState(null)

  // Quick range selection
  const [activeQuick, setActiveQuick] = useState(null)

  // Custom range inputs (date strings)
  const [showCustom, setShowCustom] = useState(false)
  const [customSince, setCustomSince] = useState('')
  const [customUntil, setCustomUntil] = useState('')

  // Device filter
  const [devices, setDevices] = useState([])
  const [selectedDevice, setSelectedDevice] = useState('all')

  const devicePollRef = useRef(null)

  function loadDeviceIds() {
    fetchDeviceIds()
      .then(ids => setDevices(ids))
      .catch(() => {})
  }

  useEffect(() => {
    loadDeviceIds()
    devicePollRef.current = setInterval(loadDeviceIds, 60_000)
    return () => clearInterval(devicePollRef.current)
  }, [])

  /** Build since/until params for the history fetch */
  function buildParams() {
    const params = { source: 'pc', limit: 1000 }
    if (selectedDevice !== 'all') params.device_id = selectedDevice

    if (activeQuick) {
      const range = QUICK_RANGES.find(r => r.key === activeQuick)
      params.since = new Date(Date.now() - range.ms).toISOString()
      params.until = new Date().toISOString()
    } else {
      if (customSince) params.since = customSince
      if (customUntil) params.until = customUntil + 'T23:59:59'
    }
    return params
  }

  async function load(overrideParams) {
    setLoading(true)
    setError(null)
    try {
      const params = overrideParams ?? buildParams()
      const rows = await fetchHistory(params)
      setData(pivotByTime(rows, METRICS))
      setLoadedCount(rows.length)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Initial load (no quick range — use all available data)
  useEffect(() => { load({ source: 'pc', limit: 1000 }) }, [])

  function handleQuickClick(key) {
    setActiveQuick(key)
    setShowCustom(false)
    const range = QUICK_RANGES.find(r => r.key === key)
    const since = new Date(Date.now() - range.ms).toISOString()
    const until = new Date().toISOString()
    const params = { source: 'pc', limit: 1000, since, until }
    if (selectedDevice !== 'all') params.device_id = selectedDevice
    load(params)
  }

  function handleCustomLoad() {
    setActiveQuick(null)
    load()
  }

  function handleDeviceChange(id) {
    setSelectedDevice(id)
  }

  const tickFormatter = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Historic Charts</h1>
        <p className="text-sm text-slate-500 mt-0.5">PC metrics over time — RAM and CPU usage</p>
      </div>

      {/* Filters panel */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">

        {/* Row 1: device + quick range */}
        <div className="flex flex-wrap items-end gap-4 mb-4">
          {/* Device dropdown */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Device</label>
            <select
              value={selectedDevice}
              onChange={e => handleDeviceChange(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Devices</option>
              {devices.map(id => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>

          {/* Quick range buttons */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Time Range</label>
            <div className="flex gap-2">
              {QUICK_RANGES.map(r => (
                <button
                  key={r.key}
                  onClick={() => handleQuickClick(r.key)}
                  disabled={loading}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                    activeQuick === r.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-blue-600 hover:text-white'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Custom range toggle */}
        <button
          onClick={() => setShowCustom(v => !v)}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1"
        >
          <svg
            className={`w-3 h-3 transition-transform ${showCustom ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          Custom Range
        </button>

        {/* Custom range inputs — collapsed by default */}
        {showCustom && (
          <div className="flex flex-wrap items-end gap-4 mt-3 pt-3 border-t border-slate-100">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Start Date</label>
              <input
                type="date"
                value={customSince}
                onChange={e => { setCustomSince(e.target.value); setActiveQuick(null) }}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">End Date</label>
              <input
                type="date"
                value={customUntil}
                onChange={e => { setCustomUntil(e.target.value); setActiveQuick(null) }}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleCustomLoad}
              disabled={loading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? 'Loading…' : 'Load'}
            </button>
          </div>
        )}
      </div>

      {/* Mixed-data note */}
      {selectedDevice === 'all' && devices.length > 1 && (
        <div className="mb-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
          Showing data from all devices combined. Select a specific device for per-device trends.
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          Failed to load history: {error}
        </div>
      )}

      {/* Chart */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-slate-800">RAM & CPU Usage Over Time</h2>
          {loadedCount != null && (
            <span className="text-xs text-slate-400">{loadedCount.toLocaleString()} rows</span>
          )}
        </div>

        {data.length === 0 && !loading ? (
          <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
            No data for the selected range
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={380}>
            <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="recorded_at"
                tickFormatter={tickFormatter}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={v => `${v}%`}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                width={42}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend
                formatter={key => <span className="text-sm text-slate-600">{LABELS[key]}</span>}
              />
              {METRICS.map(m => (
                <Line
                  key={m}
                  type="monotone"
                  dataKey={m}
                  stroke={COLORS[m]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls={true}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}

        {/* Truncation warning */}
        {loadedCount === 1000 && (
          <div className="mt-4 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs">
            Data may be truncated — try a shorter time range.
          </div>
        )}
      </div>
    </div>
  )
}
