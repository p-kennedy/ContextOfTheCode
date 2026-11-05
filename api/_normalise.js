// Turns the Fortnite Ecosystem API metrics response
// ({ peakCCU: [{ value, timestamp }], plays: [...], ... })
// into one row per timestamp: [{ timestamp, peakCCU, plays, ... }].
// Metrics whose items have no numeric `value` (e.g. retention) are skipped.
export function normalise(raw) {
  const rows = new Map()
  const metrics = []

  for (const [key, items] of Object.entries(raw ?? {})) {
    if (!Array.isArray(items)) continue
    let used = false
    for (const item of items) {
      if (!item || typeof item !== 'object' || !item.timestamp) continue
      if (!('value' in item)) continue
      const row = rows.get(item.timestamp) ?? { timestamp: item.timestamp }
      row[key] = typeof item.value === 'number' ? item.value : null
      rows.set(item.timestamp, row)
      used = true
    }
    if (used) metrics.push(key)
  }

  const series = [...rows.values()].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
  )
  return { metrics, series }
}
