export const ISLANDS = [
  { code: '3225-0366-8885', name: 'Steal The Brainrot' },
  { code: '5253-8468-3364', name: 'Murder Mystery' },
  { code: '2898-7886-8847', name: 'Crazy Red Vs Blue' },
  { code: '4590-4493-7113', name: 'The Pit - Free For All' },
  { code: '1832-0431-4852', name: '1v1 Build Fights!' },
]

export const INTERVALS = [
  { key: 'minute', label: 'Minute' },
  { key: 'hour', label: 'Hour' },
  { key: 'day', label: 'Day' },
]

export const METRIC_INFO = {
  peakCCU: { label: 'Peak concurrent players', color: '#8b5cf6' },
  uniquePlayers: { label: 'Unique players', color: '#10b981' },
  plays: { label: 'Plays', color: '#3b82f6' },
  minutesPlayed: { label: 'Minutes played', color: '#f59e0b' },
  averageMinutesPerPlayer: { label: 'Avg minutes per player', color: '#ef4444' },
  favorites: { label: 'Favourites', color: '#ec4899' },
  recommendations: { label: 'Recommendations', color: '#14b8a6' },
}

export function metricLabel(key) {
  return METRIC_INFO[key]?.label ?? key
}

export function metricColor(key) {
  return METRIC_INFO[key]?.color ?? '#64748b'
}

export async function fetchIsland(code, interval) {
  const res = await fetch(
    `/api/fortnite?code=${encodeURIComponent(code)}&interval=${interval}`,
  )
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
  return body
}

export function fmtTick(iso, interval) {
  const d = new Date(iso)
  if (interval === 'day') return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  if (interval === 'hour') {
    return d.toLocaleDateString([], { weekday: 'short' }) + ' ' +
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function fmtFull(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function fmtNum(n) {
  if (n == null || Number.isNaN(n)) return '—'
  return Math.round(n).toLocaleString()
}
