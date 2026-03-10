import { useEffect, useRef, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { API_BASE, fetchHistory, pivotByTime, fmtDateTime } from '../lib/api'

const AGGREGATOR_BASE = 'http://200.69.13.70:5008'

const ISLAND_OPTIONS = [
  { code: '3225-0366-8885', name: 'Steal The Brainrot' },
  { code: '5253-8468-3364', name: 'Murder Mystery' },
  { code: '2898-7886-8847', name: 'Crazy Red Vs Blue' },
  { code: '4590-4493-7113', name: 'The Pit - Free For All' },
  { code: '1832-0431-4852', name: '1v1 Build Fights! [4.6.4]' },
]

const QUICK_RANGES = [
  { key: 'hour', label: 'Last Hour', ms: 60 * 60 * 1000 },
  { key: 'day',  label: 'Last Day',  ms: 24 * 60 * 60 * 1000 },
  { key: 'week', label: 'Last Week', ms: 7 * 24 * 60 * 60 * 1000 },
  { key: 'all',  label: 'All Time',  ms: null },
]

const FN_INTERVAL_PRESETS = [300, 600, 1800, 3600]

const METRICS = ['peak_ccu', 'unique_players']
const COLORS = { peak_ccu: '#8b5cf6', unique_players: '#10b981' }
const LABELS = { peak_ccu: 'Peak CCU', unique_players: 'Unique Players' }

function fmtPreset(s) {
  if (s >= 3600) return `${s / 3600}h`
  if (s >= 60) return `${s / 60}m`
  return `${s}s`
}

function islandLabel(code) {
  return ISLAND_OPTIONS.find(o => o.code === code)?.name ?? code
}

function StatBadge({ label, value }) {
  return (
    <div className="bg-slate-50 rounded-xl p-4 flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-slate-800">
        {value != null ? value.toLocaleString() : '—'}
      </span>
    </div>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="text-slate-500 mb-1.5 text-xs">{fmtDateTime(label)}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-medium">
          {LABELS[p.dataKey]}: {p.value?.toLocaleString()}
        </p>
      ))}
    </div>
  )
}

export default function Fortnite() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [loadedCount, setLoadedCount] = useState(null)
  const [nextCursor, setNextCursor] = useState(null)

  // Quick range
  const [activeQuick, setActiveQuick] = useState(null)

  // Manual date pickers
  const [since, setSince] = useState('')
  const [until, setUntil] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  // Island command (switch poller target)
  const [selectedIsland, setSelectedIsland] = useState(ISLAND_OPTIONS[0].code)
  const [islandStatus, setIslandStatus] = useState(null) // null | 'sending' | 'ok' | 'no-listeners' | 'error'
  const [islandReceivers, setIslandReceivers] = useState(null)

  // Interval command feedback
  const [intervalStatus, setIntervalStatus] = useState(null) // null | 'sending' | 'ok' | 'no-listeners' | 'error'
  const [intervalReceivers, setIntervalReceivers] = useState(null)

  // Island filter (chart data)
  const [islandDevices, setIslandDevices] = useState([])
  const [selectedIslandFilter, setSelectedIslandFilter] = useState('all')
  const devicePollRef = useRef(null)

  function buildParams() {
    const params = { source: 'fortnite' }
    if (selectedIslandFilter !== 'all') params.device_id = selectedIslandFilter
    if (activeQuick) {
      const range = QUICK_RANGES.find(r => r.key === activeQuick)
      if (range.ms !== null) {
        params.since = new Date(Date.now() - range.ms).toISOString()
        params.until = new Date().toISOString()
      }
    } else {
      if (since) params.since = since
      if (until) params.until = until + 'T23:59:59'
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

  useEffect(() => { load({ source: 'fortnite' }) }, [])

  function handleQuickClick(key) {
    setActiveQuick(key)
    setShowCustom(false)
    const range = QUICK_RANGES.find(r => r.key === key)
    const params = { source: 'fortnite' }
    if (selectedIslandFilter !== 'all') params.device_id = selectedIslandFilter
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

  function loadIslandDevices() {
    const url = new URL(`${API_BASE}/metrics/devices`)
    url.searchParams.set('source', 'fortnite')
    fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(ids => setIslandDevices(ids))
      .catch(() => {})
  }

  useEffect(() => {
    loadIslandDevices()
    devicePollRef.current = setInterval(loadIslandDevices, 60_000)
    return () => clearInterval(devicePollRef.current)
  }, [])

  async function sendIntervalCommand(seconds) {
    setIntervalStatus('sending')
    setIntervalReceivers(null)
    try {
      const res = await fetch(`${AGGREGATOR_BASE}/commands/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: 'fortnite-island', command: 'set_interval', value: String(seconds) }),
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

  async function switchIsland() {
    setIslandStatus('sending')
    setIslandReceivers(null)
    try {
      const res = await fetch(`${AGGREGATOR_BASE}/commands/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: 'fortnite-island', command: 'set_island', value: selectedIsland }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.receivers === 0) {
        setIslandStatus('no-listeners')
      } else {
        setIslandReceivers(data.receivers)
        setIslandStatus('ok')
      }
    } catch {
      setIslandStatus('error')
    } finally {
      setTimeout(() => setIslandStatus(null), 5000)
    }
  }

  const activeIslandName = ISLAND_OPTIONS.find(o => o.code === selectedIsland)?.name ?? selectedIsland

  // Compute summary stats from the latest data point
  const latest = data[data.length - 1] ?? {}
  const maxCcu = data.length ? Math.max(...data.map(d => d.peak_ccu ?? 0)) : null
  const maxPlayers = data.length ? Math.max(...data.map(d => d.unique_players ?? 0)) : null

  const tickFormatter = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Fortnite</h1>
        <p className="text-sm text-slate-500 mt-0.5">Island player metrics over time</p>
      </div>

      {/* Island command — switch poller target */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Island</p>
          <span className="text-xs text-slate-400">· active: {activeIslandName}</span>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <select
            value={selectedIsland}
            onChange={e => { setSelectedIsland(e.target.value); setIslandStatus(null) }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {ISLAND_OPTIONS.map(opt => (
              <option key={opt.code} value={opt.code}>
                {opt.name} — {opt.code}
              </option>
            ))}
          </select>
          <button
            onClick={switchIsland}
            disabled={islandStatus === 'sending'}
            className="px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {islandStatus === 'sending' ? 'Switching…' : 'Switch Island'}
          </button>
          {islandStatus === 'ok' && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Command received by {islandReceivers} collector{islandReceivers !== 1 ? 's' : ''}
            </span>
          )}
          {islandStatus === 'no-listeners' && (
            <span className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              Command sent but no collectors are listening — is the Fortnite poller running?
            </span>
          )}
          {islandStatus === 'error' && (
            <span className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
              Failed to send command
            </span>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatBadge label="Current CCU" value={latest.peak_ccu} />
        <StatBadge label="Current Players" value={latest.unique_players} />
        <StatBadge label="Peak CCU (range)" value={maxCcu} />
        <StatBadge label="Peak Players (range)" value={maxPlayers} />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">

        {/* Row 1: quick range + island filter */}
        <div className="flex flex-wrap items-end gap-4 mb-4">
          {/* Quick range */}
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
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-purple-600 hover:text-white'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Island filter */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Filter Island</label>
            <div className="flex gap-2 items-center">
              <select
                value={selectedIslandFilter}
                onChange={e => setSelectedIslandFilter(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Islands</option>
                {islandDevices.map(id => (
                  <option key={id} value={id}>{islandLabel(id)}</option>
                ))}
              </select>
              <button
                onClick={() => load()}
                disabled={loading}
                className="px-3 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                Apply
              </button>
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

        {/* Custom date pickers — collapsed by default */}
        {showCustom && (
          <div className="flex flex-wrap items-end gap-4 mt-3 pt-3 border-t border-slate-100">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Start Date</label>
              <input
                type="date"
                value={since}
                onChange={e => { setSince(e.target.value); setActiveQuick(null) }}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">End Date</label>
              <input
                type="date"
                value={until}
                onChange={e => { setUntil(e.target.value); setActiveQuick(null) }}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button
              onClick={handleCustomLoad}
              disabled={loading}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? 'Loading…' : 'Load'}
            </button>
          </div>
        )}
      </div>

      {/* Poller interval control */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
          Poll Interval — Fortnite Poller
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          {FN_INTERVAL_PRESETS.map(s => (
            <button
              key={s}
              onClick={() => sendIntervalCommand(s)}
              disabled={intervalStatus === 'sending'}
              className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-purple-600 hover:text-white text-slate-700 rounded-lg transition-colors disabled:opacity-50"
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
              Command sent but no collectors are listening — is the Fortnite poller running?
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

      {/* Error */}
      {error && (
        <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          Failed to load data: {error}
        </div>
      )}

      {/* Chart */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-slate-800">Player Activity Over Time</h2>
          {loadedCount != null && (
            <span className="text-xs text-slate-400">{loadedCount.toLocaleString()} rows</span>
          )}
        </div>
        {data.length === 0 && !loading ? (
          <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
            No Fortnite data for the selected range
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={380}>
            <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
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
                tickFormatter={v => v.toLocaleString()}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                width={60}
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
