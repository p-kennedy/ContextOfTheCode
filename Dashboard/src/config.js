export const REPORTING_API = 'http://200.69.13.70:5009'
export const AGGREGATOR_API = 'http://200.69.13.70:5008'

export const SUPABASE_COLLECTOR_DEVICE_ID = 'supabase-collector'
export const FORTNITE_COLLECTOR_DEVICE_ID = 'fortnite-island'

export const QUICK_RANGES = [
  { key: 'hour', label: 'Last Hour', ms: 60 * 60 * 1000 },
  { key: 'day',  label: 'Last Day',  ms: 24 * 60 * 60 * 1000 },
  { key: 'week', label: 'Last Week', ms: 7 * 24 * 60 * 60 * 1000 },
  { key: 'all',  label: 'All Time',  ms: null },
]

export const DEVICE_POLL_INTERVAL_MS = 60_000
export const STATUS_DISMISS_MS = 5000

/** Collect interval presets for Android and PC Historic collectors */
export const INTERVAL_PRESETS = [10, 30, 60, 300]

/** Collect interval presets for the Fortnite collector */
export const FN_INTERVAL_PRESETS = [300, 600, 1800, 3600]
