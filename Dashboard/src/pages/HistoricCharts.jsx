import { useEffect, useRef, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { API_BASE, fetchHistory, pivotByTime, fmtDateTime } from '../lib/api'

const AGGREGATOR_BASE = 'http://200.69.13.70:5008'
const PC_INTERVAL_PRESETS = [10, 30, 60, 300]

const METRICS = ['ram_usage_percent', 'cpu_percent']
const COLORS = { ram_usage_percent: '#3b82f6', cpu_percent: '#f59e0b' }
const LABELS = { ram_usage_percent: 'RAM %', cpu_percent: 'CPU %' }

const QUICK_RANGES = [
  { key: 'hour', label: 'Last Hour', ms: 60 * 60 * 1000 },
  { key: 'day',  label: 'Last Day',  ms: 24 * 60 * 60 * 1000 },
  { key: 'week', label: 'Last Week', ms: 7 * 24 * 60 * 60 * 1000 },
  { key: 'all',  label: 'All Time',  ms: null },
]

function fmtPreset(s) {
  if (s >= 3600) return `${s / 3600}h`
  if (s >= 60) return `${s / 60}m`
  return `${s}s`
}

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

async function fetchDeviceIds() {
  const url = new URL(`${API_BASE}/metrics/devices`)
  url.searchParams.set('source', 'pc')
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export default function HistoricCharts() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [loadedCount, setLoadedCount] = useState(null)
  const [nextCursor, setNextCursor] = useState(null)

  // Quick range selection
  const [activeQuick, setActiveQuick] = useState(null)

  // Custom range inputs (date strings)
  const [showCustom, setShowCustom] = useState(false)
  const [customSince, setCustomSince] = useState('')
  const [customUntil, setCustomUntil] = useState('')

  // Interval command feedback
  const [intervalStatus, setIntervalStatus] = useState(null) // null | 'sending' | 'ok' | 'no-listeners' | 'error'
  const [intervalReceivers, setIntervalReceivers] = useState(null)

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
    const params = { source: 'pc' }
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
    setNextCursor(null)
    try {
      const { data: rows, next_cursor } = await fetchHistory(overrideParams ?? buildParams())
      setData(pivotByTime(rows, METRICS))
      setLoadedCount(rows.length)
      setNextCursor(next_cursor)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadMore() {
    setLoadingMore(true)
    try {
      const { data: rows, next_cursor } = await fetchHistory({ ...buildParams(), cursor: nextCursor })
      const newPivoted = pivotByTime(rows, METRICS)
      setData(prev => [...prev, ...newPivoted].sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at)))
      setLoadedCount(prev => prev + rows.length)
      setNextCursor(next_cursor)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingMore(false)
    }
  }

  // Initial load (no quick range — use all available data)
  useEffect(() => { load({ source: 'pc' }) }, [])

  function handleQuickClick(key) {
    setActiveQuick(key)
    setShowCustom(false)
    const range = QUICK_RANGES.find(r => r.key === key)
    const params = { source: 'pc' }
    if (selectedDevice !== 'all') params.device_id = selectedDevice
    if (range.ms !== null) {
      params.since = new Date(Date.now() - range.ms).toISOString()
      params.until = new Date().toISOString()
    }
    load(params)
  }

  function handleCustomLoad() {
    setActiveQuick(null)
    load()
  }

  function handleDeviceChange(id) {
    setSelectedDevice(id)
  }

  async function sendIntervalCommand(seconds) {
    setIntervalStatus('sending')
    setIntervalReceivers(null)
    const targetDevice = selectedDevice === 'all' ? 'all' : selectedDevice
    try {
      const res = await fetch(`${AGGREGATOR_BASE}/commands/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: targetDevice, command: 'set_interval', value: String(seconds) }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.receivers === 0) {
        setIntervalStatus('no-listeners')
      } else {
        setIntervalReceivers(data.receivers)
        setIntervalStatus('ok')
      }
    } catch {
      setIntervalStatus('error')
    } finally {
      setTimeout(() => setIntervalStatus(null), 5000)
    }
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
            <div className="flex gap-2 items-center">
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
              <button
                onClick={() => load()}
                disabled={loading}
                className="px-3 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                Apply
              </button>
            </div>
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

      {/* Collector interval control */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
          Collect Interval{selectedDevice !== 'all' ? ` — ${selectedDevice}` : ' — All Devices'}
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          {PC_INTERVAL_PRESETS.map(s => (
            <button
              key={s}
              onClick={() => sendIntervalCommand(s)}
              disabled={intervalStatus === 'sending'}
              className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {fmtPreset(s)}
            </button>
          ))}
          {intervalStatus === 'ok' && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Command received by {intervalReceivers} collector{intervalReceivers !== 1 ? 's' : ''}
            </span>
          )}
          {intervalStatus === 'no-listeners' && (
            <span className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              Command sent but no collectors are listening — is the PC collector running?
            </span>
          )}
          {intervalStatus === 'error' && (
            <span className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
              Failed to send command
            </span>
          )}
        </div>
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

        {nextCursor && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="px-5 py-2 text-sm font-medium bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-lg transition-colors"
            >
              {loadingMore ? 'Loading…' : 'Load More'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
