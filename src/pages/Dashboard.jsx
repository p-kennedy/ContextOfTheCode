import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  ISLANDS, INTERVALS, fetchIsland, fmtTick, fmtFull, fmtNum, metricLabel, metricColor,
} from '../lib/fortnite'

const CODE_RE = /^\d{4}-\d{4}-\d{4}$/

// Order charts appear in; anything else the API returns is appended after.
const CHART_ORDER = [
  'peakCCU', 'uniquePlayers', 'plays', 'averageMinutesPerPlayer',
  'minutesPlayed', 'favorites', 'recommendations',
]

function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-5 ${className}`}>
      {children}
    </div>
  )
}

function Stat({ label, value, hint }) {
  return (
    <Card>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </Card>
  )
}

function MetricChart({ metric, series, interval }) {
  const color = metricColor(metric)
  const points = series.filter(r => r[metric] != null)
  if (!points.length) return null
  return (
    <Card>
      <h3 className="text-sm font-semibold text-slate-700 mb-4">{metricLabel(metric)}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={v => fmtTick(v, interval)}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            minTickGap={40}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            width={56}
            tickFormatter={v => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : v)}
          />
          <Tooltip
            labelFormatter={fmtFull}
            formatter={v => [fmtNum(v), metricLabel(metric)]}
            contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', fontSize: 13 }}
          />
          <Line
            type="monotone"
            dataKey={metric}
            stroke={color}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  )
}

function summarise(series) {
  const vals = key => series.map(r => r[key]).filter(v => v != null)
  const ccu = vals('peakCCU')
  const sum = key => {
    const v = vals(key)
    return v.length ? v.reduce((a, b) => a + b, 0) : null
  }
  return {
    latestCcu: ccu.length ? ccu[ccu.length - 1] : null,
    maxCcu: ccu.length ? Math.max(...ccu) : null,
    plays: sum('plays'),
    minutes: sum('minutesPlayed'),
  }
}

export default function Dashboard() {
  const [params, setParams] = useSearchParams()
  const code = CODE_RE.test(params.get('island') ?? '') ? params.get('island') : ISLANDS[0].code
  const interval = INTERVALS.some(i => i.key === params.get('interval'))
    ? params.get('interval')
    : 'hour'

  const [customCode, setCustomCode] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchIsland(code, interval)
      .then(d => { if (!cancelled) setData(d) })
      .catch(e => { if (!cancelled) { setError(e.message); setData(null) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [code, interval, reloadKey])

  function update(next) {
    setParams({ island: code, interval, ...next })
  }

  function submitCustom(e) {
    e.preventDefault()
    const c = customCode.trim()
    if (!CODE_RE.test(c)) {
      setError('Island code should look like 1234-5678-9012')
      return
    }
    update({ island: c })
    setCustomCode('')
  }

  const series = data?.series ?? []
  const stats = useMemo(() => summarise(series), [series])
  const charts = data
    ? [...CHART_ORDER.filter(m => data.metrics.includes(m)),
       ...data.metrics.filter(m => !CHART_ORDER.includes(m))]
    : []
  const presetName = ISLANDS.find(i => i.code === code)?.name
  const title = data?.island?.title ?? presetName ?? code

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Fortnite island metrics</h1>
        <p className="text-sm text-slate-500 mt-1">
          Live player data from Epic's public Fortnite Ecosystem API (last 7 days).
        </p>
      </div>

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Island</label>
            <select
              value={ISLANDS.some(i => i.code === code) ? code : ''}
              onChange={e => update({ island: e.target.value })}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {!ISLANDS.some(i => i.code === code) && <option value="">{code}</option>}
              {ISLANDS.map(i => <option key={i.code} value={i.code}>{i.name}</option>)}
            </select>
          </div>

          <form onSubmit={submitCustom} className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Or any island code</label>
            <div className="flex gap-2">
              <input
                value={customCode}
                onChange={e => setCustomCode(e.target.value)}
                placeholder="1234-5678-9012"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button className="px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
                Go
              </button>
            </div>
          </form>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Granularity</label>
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              {INTERVALS.map(i => (
                <button
                  key={i.key}
                  onClick={() => update({ interval: i.key })}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    interval === i.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {i.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setReloadKey(k => k + 1)}
            disabled={loading}
            className="ml-auto px-4 py-2 text-sm font-medium border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 rounded-lg transition-colors"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </Card>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
            <p className="text-xs text-slate-400">
              {code}
              {data.island.creator && <> · by {data.island.creator}</>}
              {' · '}updated {fmtFull(data.fetchedAt)}
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Stat label="Latest peak CCU" value={fmtNum(stats.latestCcu)} />
            <Stat label="Highest peak CCU" value={fmtNum(stats.maxCcu)} hint="in this window" />
            <Stat label="Total plays" value={fmtNum(stats.plays)} hint="in this window" />
            <Stat label="Minutes played" value={fmtNum(stats.minutes)} hint="in this window" />
          </div>

          {charts.length ? (
            <div className="grid gap-6 lg:grid-cols-2">
              {charts.map(m => (
                <MetricChart key={m} metric={m} series={series} interval={interval} />
              ))}
            </div>
          ) : (
            <Card>
              <p className="text-sm text-slate-500">
                No data points for this island at this granularity. Try another interval or island.
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
