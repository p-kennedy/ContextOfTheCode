import { useEffect, useState } from 'react'
import { fetchLive, fmtDateTime } from '../lib/api'

const AGGREGATOR_BASE = 'http://200.69.13.70:5008'
const METRICS = ['cpu_percent', 'ram_usage_percent', 'process_count', 'thread_count']
const REFRESH_MS = 5000
const PC_INTERVAL_PRESETS = [15, 30, 60, 600]
const FN_INTERVAL_PRESETS = [300, 600, 1800, 3600]
const MAX_LOG_ENTRIES = 10

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

function fmtPreset(s) {
  if (s >= 3600) return `${s / 3600}h`
  if (s >= 60) return `${s / 60}m`
  return `${s}s`
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

function IntervalRow({ label, presets, hoverColor, onSend }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {presets.map(s => (
          <button
            key={s}
            onClick={() => onSend(s)}
            className={`px-3 py-1.5 text-xs font-medium bg-slate-100 ${hoverColor} text-slate-700 rounded-lg transition-colors`}
          >
            {fmtPreset(s)}
          </button>
        ))}
      </div>
    </div>
  )
}

function DeviceCard({ deviceId, metricMap, onCommand }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-5">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
        <h2 className="font-semibold text-slate-800 text-base">{deviceId}</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-5">
        {METRICS.map(m => (
          <MetricCard key={m} metricName={m} entry={metricMap[m]} />
        ))}
      </div>

      <div className="border-t border-slate-100 pt-4 flex flex-col gap-3">
        <IntervalRow
          label="PC Collector"
          presets={PC_INTERVAL_PRESETS}
          hoverColor="hover:bg-blue-600 hover:text-white"
          onSend={s => onCommand(deviceId, 'set_interval', String(s))}
        />
        <div>
          <button
            onClick={() => onCommand(deviceId, 'ping')}
            className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition-colors"
          >
            Ping
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LiveView() {
  const [deviceMap, setDeviceMap] = useState({})
  const [lastUpdated, setLastUpdated] = useState(null)
  const [error, setError] = useState(null)
  const [commandLog, setCommandLog] = useState([])

  async function load() {
    try {
      const rows = await fetchLive({ source: 'pc', limit: 500 })
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

  async function sendCommand(deviceId, command, value = '') {
    const entry = {
      id: Date.now(),
      ts: new Date().toLocaleTimeString(),
      deviceId,
      command,
      value,
      status: 'sending',
    }
    setCommandLog(prev => [entry, ...prev].slice(0, MAX_LOG_ENTRIES))

    try {
      const res = await fetch(`${AGGREGATOR_BASE}/commands/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, command, value }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      setCommandLog(prev =>
        prev.map(e => e.id === entry.id ? { ...e, status: 'ok', receivers: data.receivers } : e)
      )
    } catch (e) {
      setCommandLog(prev =>
        prev.map(e => e.id === entry.id ? { ...e, status: 'error' } : e)
      )
    }
  }

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

      {/* Fetch error */}
      {error && (
        <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          Failed to fetch metrics: {error}
        </div>
      )}

      {/* Empty state */}
      {!error && devices.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <svg className="w-10 h-10 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
          </svg>
          <p className="text-sm">No live metrics in the last 5 minutes</p>
        </div>
      )}

      {/* Device cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        {devices.map(deviceId => (
          <DeviceCard
            key={deviceId}
            deviceId={deviceId}
            metricMap={deviceMap[deviceId]}
            onCommand={sendCommand}
          />
        ))}
      </div>

      {/* Device Control panel */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
        <h2 className="text-base font-semibold text-slate-800 mb-5">Device Control</h2>

        <div className="flex flex-col gap-5">
          {/* Broadcast PC */}
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Broadcast PC Collector
            </p>
            <div className="flex flex-wrap gap-2">
              {PC_INTERVAL_PRESETS.map(s => (
                <button
                  key={s}
                  onClick={() => sendCommand('all', 'set_interval', String(s))}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 rounded-lg transition-colors"
                >
                  {fmtPreset(s)}
                </button>
              ))}
              <button
                onClick={() => sendCommand('all', 'ping')}
                className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition-colors"
              >
                Ping All
              </button>
            </div>
          </div>

          {/* Broadcast Fortnite */}
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Broadcast Fortnite Poller
            </p>
            <div className="flex flex-wrap gap-2">
              {FN_INTERVAL_PRESETS.map(s => (
                <button
                  key={s}
                  onClick={() => sendCommand('fortnite-island', 'set_interval', String(s))}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-purple-600 hover:text-white text-slate-700 rounded-lg transition-colors"
                >
                  {fmtPreset(s)}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Command Log */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-4">
          Command Log
          <span className="ml-2 text-xs font-normal text-slate-400">last {MAX_LOG_ENTRIES}</span>
        </h2>
        {commandLog.length === 0 ? (
          <p className="text-sm text-slate-400">No commands sent yet.</p>
        ) : (
          <div className="space-y-2">
            {commandLog.map(entry => (
              <div
                key={entry.id}
                className="flex items-center gap-3 text-sm px-3 py-2 rounded-lg bg-slate-50"
              >
                <span className="text-slate-400 text-xs w-16 shrink-0">{entry.ts}</span>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  entry.status === 'ok' ? 'bg-emerald-400' :
                  entry.status === 'error' ? 'bg-red-400' : 'bg-amber-400 animate-pulse'
                }`} />
                <span className="font-medium text-slate-700 shrink-0">{entry.deviceId}</span>
                <span className="text-slate-500">{entry.command}</span>
                {entry.value && (
                  <span className="font-mono text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                    {entry.value}
                  </span>
                )}
                {entry.status === 'ok' && entry.receivers != null && (
                  <span className="ml-auto text-xs text-slate-400">
                    {entry.receivers} receiver{entry.receivers !== 1 ? 's' : ''}
                  </span>
                )}
                {entry.status === 'error' && (
                  <span className="ml-auto text-xs text-red-400">failed</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
