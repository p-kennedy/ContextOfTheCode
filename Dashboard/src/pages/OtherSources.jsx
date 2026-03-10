import { useEffect, useRef, useState } from 'react'
import {
  LineChart, Line,
  BarChart, Bar,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { API_BASE, fmtDateTime } from '../lib/api'

const KNOWN_SOURCES = new Set(['pc', 'android', 'fortnite'])

const QUICK_RANGES = [
  { key: 'hour', label: 'Last Hour', ms: 60 * 60 * 1000 },
  { key: 'day',  label: 'Last Day',  ms: 24 * 60 * 60 * 1000 },
  { key: 'week', label: 'Last Week', ms: 7 * 24 * 60 * 60 * 1000 },
  { key: 'all',  label: 'All Time',  ms: null },
]

const CHART_TYPES = ['Line', 'Bar', 'Area']
const CHART_COLOR = '#6366f1'

function ChartTooltip({ active, payload, label, metricName }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="text-slate-500 mb-1.5 text-xs">{fmtDateTime(label)}</p>
      <p style={{ color: CHART_COLOR }} className="font-medium">
        {metricName}: {payload[0]?.value?.toLocaleString()}
      </p>
    </div>
  )
}

export default function OtherSources() {
  // Source + metric selection
  const [sources, setSources] = useState([])      // filtered list (no known sources)
  const [selectedSource, setSelectedSource] = useState(null)
  const [metricNames, setMetricNames] = useState([])
  const [selectedMetric, setSelectedMetric] = useState(null)

  // Chart data
  const [chartData, setChartData] = useState([])  // [{recorded_at, value}]
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [loadedCount, setLoadedCount] = useState(null)
  const [nextCursor, setNextCursor] = useState(null)

  // Chart type
  const [chartType, setChartType] = useState('Line')

  // Time range
  const [activeQuick, setActiveQuick] = useState(null)
  const [since, setSince] = useState('')
  const [until, setUntil] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  const sourcePollRef = useRef(null)

  // ── Fetch helpers ──────────────────────────────────────────

  async function fetchSources() {
    try {
      const res = await fetch(`${API_BASE}/metrics/sources`)
      if (!res.ok) return
      const all = await res.json()
      const filtered = all.filter(s => !KNOWN_SOURCES.has(s))
      setSources(filtered)
      return filtered
    } catch {
      return []
    }
  }

  async function fetchMetricNames(source) {
    if (!source) { setMetricNames([]); return [] }
    try {
      const url = new URL(`${API_BASE}/metrics/metric-names`)
      url.searchParams.set('source', source)
      const res = await fetch(url)
      if (!res.ok) return []
      const names = await res.json()
      setMetricNames(names)
      return names
    } catch {
      setMetricNames([])
      return []
    }
  }

  function buildParams(source, metric, overrides = {}) {
    const params = { source, metric_name: metric }
    if (activeQuick && !overrides.since) {
      const range = QUICK_RANGES.find(r => r.key === activeQuick)
      params.since = new Date(Date.now() - range.ms).toISOString()
      params.until = new Date().toISOString()
    } else {
      if (since) params.since = since
      if (until) params.until = until + 'T23:59:59'
    }
    return { ...params, ...overrides }
  }

  async function fetchHistory(params) {
    const url = new URL(`${API_BASE}/metrics/history`)
    Object.entries(params).forEach(([k, v]) => { if (v) url.searchParams.set(k, v) })
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }

  // Pivot raw rows to [{recorded_at, value}]
  function pivotRows(rows, metric) {
    const map = {}
    rows.forEach(r => {
      if (r.metric_name !== metric) return
      if (!map[r.recorded_at]) map[r.recorded_at] = { recorded_at: r.recorded_at, value: r.value }
    })
    return Object.values(map).sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at))
  }

  async function load(source, metric, overrideParams) {
    if (!source || !metric) return
    setLoading(true)
    setError(null)
    setNextCursor(null)
    try {
      const params = overrideParams ?? buildParams(source, metric)
      const { data: rows, next_cursor } = await fetchHistory(params)
      setChartData(pivotRows(rows, metric))
      setLoadedCount(rows.length)
      setNextCursor(next_cursor)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadMore() {
    if (!selectedSource || !selectedMetric || !nextCursor) return
    setLoadingMore(true)
    try {
      const params = { ...buildParams(selectedSource, selectedMetric), cursor: nextCursor }
      const { data: rows, next_cursor } = await fetchHistory(params)
      const newPivoted = pivotRows(rows, selectedMetric)
      setChartData(prev =>
        [...prev, ...newPivoted].sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at))
      )
      setLoadedCount(prev => prev + rows.length)
      setNextCursor(next_cursor)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingMore(false)
    }
  }

  // ── Initialisation ─────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const filtered = await fetchSources()
      if (!filtered?.length) return
      const src = filtered[0]
      setSelectedSource(src)
      const names = await fetchMetricNames(src)
      if (names?.length) {
        setSelectedMetric(names[0])
        load(src, names[0], { source: src, metric_name: names[0] })
      }
    }
    init()
    sourcePollRef.current = setInterval(fetchSources, 60_000)
    return () => clearInterval(sourcePollRef.current)
  }, [])

  // ── Source change ──────────────────────────────────────────

  async function handleSourceChange(src) {
    setSelectedSource(src)
    setSelectedMetric(null)
    setChartData([])
    setLoadedCount(null)
    setNextCursor(null)
    setError(null)
    const names = await fetchMetricNames(src)
    if (names?.length) {
      setSelectedMetric(names[0])
    }
  }

  // ── Metric change ──────────────────────────────────────────

  function handleMetricChange(metric) {
    setSelectedMetric(metric)
  }

  // ── Quick range ────────────────────────────────────────────

  function handleQuickClick(key) {
    setActiveQuick(key)
    setShowCustom(false)
    const range = QUICK_RANGES.find(r => r.key === key)
    const overrides = { source: selectedSource, metric_name: selectedMetric }
    if (range.ms !== null) {
      overrides.since = new Date(Date.now() - range.ms).toISOString()
      overrides.until = new Date().toISOString()
    }
    load(selectedSource, selectedMetric, overrides)
  }

  function handleCustomLoad() {
    setActiveQuick(null)
    load(selectedSource, selectedMetric)
  }

  // ── Chart rendering ────────────────────────────────────────

  const tickFormatter = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const commonAxisProps = {
    xAxis: (
      <XAxis
        dataKey="recorded_at"
        tickFormatter={tickFormatter}
        tick={{ fontSize: 11, fill: '#94a3b8' }}
        tickLine={false}
        axisLine={{ stroke: '#e2e8f0' }}
        interval="preserveStartEnd"
      />
    ),
    yAxis: (
      <YAxis
        tickFormatter={v => v.toLocaleString()}
        tick={{ fontSize: 11, fill: '#94a3b8' }}
        tickLine={false}
        axisLine={false}
        width={60}
      />
    ),
    grid: <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />,
    tooltip: <Tooltip content={<ChartTooltip metricName={selectedMetric} />} />,
  }

  function renderChart() {
    const margin = { top: 5, right: 20, left: 10, bottom: 5 }
    if (chartType === 'Bar') {
      return (
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={chartData} margin={margin}>
            {commonAxisProps.grid}
            {commonAxisProps.xAxis}
            {commonAxisProps.yAxis}
            {commonAxisProps.tooltip}
            <Bar dataKey="value" fill={CHART_COLOR} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )
    }
    if (chartType === 'Area') {
      return (
        <ResponsiveContainer width="100%" height={360}>
          <AreaChart data={chartData} margin={margin}>
            {commonAxisProps.grid}
            {commonAxisProps.xAxis}
            {commonAxisProps.yAxis}
            {commonAxisProps.tooltip}
            <Area
              type="monotone"
              dataKey="value"
              stroke={CHART_COLOR}
              fill={CHART_COLOR}
              fillOpacity={0.15}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      )
    }
    // Line (default)
    return (
      <ResponsiveContainer width="100%" height={360}>
        <LineChart data={chartData} margin={margin}>
          {commonAxisProps.grid}
          {commonAxisProps.xAxis}
          {commonAxisProps.yAxis}
          {commonAxisProps.tooltip}
          <Line
            type="monotone"
            dataKey="value"
            stroke={CHART_COLOR}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  // ── Empty state ────────────────────────────────────────────

  if (!loading && sources.length === 0) {
    return (
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Other Sources</h1>
          <p className="text-sm text-slate-500 mt-0.5">Any connected source not in PC, Android, or Fortnite</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center h-64 gap-3">
          <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-slate-500 text-sm font-medium">No other sources connected yet</p>
          <p className="text-slate-400 text-xs max-w-xs text-center">
            When a collector sends data with a source other than "pc", "android", or "fortnite", it will appear here automatically.
          </p>
        </div>
      </div>
    )
  }

  // ── Main render ────────────────────────────────────────────

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Other Sources</h1>
        <p className="text-sm text-slate-500 mt-0.5">Any connected source not in PC, Android, or Fortnite</p>
      </div>

      {/* Source + Metric + Chart type selectors */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Source</label>
            <select
              value={selectedSource ?? ''}
              onChange={e => handleSourceChange(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {sources.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Metric</label>
            <select
              value={selectedMetric ?? ''}
              onChange={e => handleMetricChange(e.target.value)}
              disabled={!metricNames.length}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {metricNames.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Chart Type</label>
            <div className="flex gap-1">
              {CHART_TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => setChartType(t)}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    chartType === t
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-indigo-600 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-end">
            <button
              onClick={() => load(selectedSource, selectedMetric)}
              disabled={loading || !selectedMetric}
              className="px-3 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
        <div className="flex flex-wrap items-end gap-4 mb-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Time Range</label>
            <div className="flex gap-2">
              {QUICK_RANGES.map(r => (
                <button
                  key={r.key}
                  onClick={() => handleQuickClick(r.key)}
                  disabled={loading || !selectedMetric}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                    activeQuick === r.key
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-indigo-600 hover:text-white'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

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

        {showCustom && (
          <div className="flex flex-wrap items-end gap-4 mt-3 pt-3 border-t border-slate-100">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Start Date</label>
              <input
                type="date"
                value={since}
                onChange={e => { setSince(e.target.value); setActiveQuick(null) }}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">End Date</label>
              <input
                type="date"
                value={until}
                onChange={e => { setUntil(e.target.value); setActiveQuick(null) }}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={handleCustomLoad}
              disabled={loading || !selectedMetric}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? 'Loading…' : 'Load'}
            </button>
          </div>
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
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-slate-800">
            {selectedSource && selectedMetric ? `${selectedSource} / ${selectedMetric}` : 'Select a source and metric'}
          </h2>
          {loadedCount != null && (
            <span className="text-xs text-slate-400">{loadedCount.toLocaleString()} rows</span>
          )}
        </div>

        {chartData.length === 0 && !loading ? (
          <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
            {selectedMetric ? 'No data for the selected range' : 'Select a source and metric above'}
          </div>
        ) : (
          renderChart()
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
