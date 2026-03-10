import { REPORTING_API } from '../config'
export const API_BASE = REPORTING_API

export async function fetchLive(params = {}) {
  const url = new URL(`${API_BASE}/metrics/live`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function fetchHistory(params = {}) {
  const url = new URL(`${API_BASE}/metrics/history`)
  Object.entries(params).forEach(([k, v]) => v && url.searchParams.set(k, v))
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** Pivot flat rows into [{recorded_at, metricA: val, metricB: val}] for Recharts */
export function pivotByTime(rows, metricNames) {
  const map = {}
  rows.forEach(r => {
    if (!metricNames.includes(r.metric_name)) return
    if (!map[r.recorded_at]) map[r.recorded_at] = { recorded_at: r.recorded_at }
    map[r.recorded_at][r.metric_name] = r.value
  })
  return Object.values(map).sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at))
}

export function fmtDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function fmtTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
