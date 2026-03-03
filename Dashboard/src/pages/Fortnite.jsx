import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { fetchHistory, pivotByTime, fmtDateTime } from '../lib/api'

const AGGREGATOR_BASE = 'http://200.69.13.70:5008'

const ISLAND_OPTIONS = [
  { code: '3225-0366-8885', name: 'MetricsFlow Test Island' },
  { code: '6562-8953-6567', name: 'Pandvil Box Fight' },
  { code: '6531-4403-0726', name: 'The Pit' },
  { code: '7980-5509-9541', name: 'Boxfight District' },
]

const METRICS = ['peak_ccu', 'unique_players']
const COLORS = { peak_ccu: '#8b5cf6', unique_players: '#10b981' }
const LABELS = { peak_ccu: 'Peak CCU', unique_players: 'Unique Players' }

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
  const [since, setSince] = useState('')
  const [until, setUntil] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [loadedCount, setLoadedCount] = useState(null)

  const [selectedIsland, setSelectedIsland] = useState(ISLAND_OPTIONS[0].code)
  // null | 'sending' | 'ok' | 'no-listeners' | 'error'
  const [islandStatus, setIslandStatus] = useState(null)
  const [islandReceivers, setIslandReceivers] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const params = { source: 'fortnite', limit: 1000 }
      if (since) params.since = since
      if (until) params.until = until + 'T23:59:59'
      const rows = await fetchHistory(params)
      setData(pivotByTime(rows, METRICS))
      setLoadedCount(rows.length)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

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

      {/* Island selector */}
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
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Start Date</label>
          <input
            type="date"
            value={since}
            onChange={e => setSince(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">End Date</label>
          <input
            type="date"
            value={until}
            onChange={e => setUntil(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {loading ? 'Loading…' : 'Load'}
        </button>
        {loadedCount != null && (
          <span className="text-xs text-slate-400 self-end pb-2">
            {loadedCount} rows loaded
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          Failed to load data: {error}
        </div>
      )}

      {/* Chart */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-6">Player Activity Over Time</h2>
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
      </div>
    </div>
  )
}
