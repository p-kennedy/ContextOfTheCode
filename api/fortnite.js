// Vercel serverless function: thin, cached proxy in front of the public
// Fortnite Ecosystem API. Keeps the browser on one origin (no CORS issues)
// and lets Vercel's edge cache absorb repeat requests.
import { normalise } from './_normalise.js'

const BASE = 'https://api.fortnite.com/ecosystem/v1'
const CODE_RE = /^\d{4}-\d{4}-\d{4}$/
const INTERVALS = new Set(['minute', 'hour', 'day'])

export default async function handler(req, res) {
  const code = String(req.query.code ?? '')
  const interval = String(req.query.interval ?? 'hour')

  if (!CODE_RE.test(code)) {
    return res.status(400).json({ error: 'Island code should look like 1234-5678-9012' })
  }
  if (!INTERVALS.has(interval)) {
    return res.status(400).json({ error: 'interval must be minute, hour or day' })
  }

  try {
    const [metaRes, metricsRes] = await Promise.all([
      fetch(`${BASE}/islands/${code}`),
      fetch(`${BASE}/islands/${code}/metrics/${interval}`),
    ])

    if (metricsRes.status === 404) {
      return res.status(404).json({
        error: 'No data for that island. It may be private or have too few players.',
      })
    }
    if (metricsRes.status === 429) {
      return res.status(429).json({ error: 'Fortnite API rate limit hit, try again shortly.' })
    }
    if (!metricsRes.ok) {
      return res.status(502).json({ error: `Fortnite API returned ${metricsRes.status}` })
    }

    const meta = metaRes.ok ? await metaRes.json() : {}
    const { metrics, series } = normalise(await metricsRes.json())

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({
      island: {
        code,
        title: meta.title ?? meta.displayName ?? null,
        creator: meta.creatorCode ?? null,
      },
      interval,
      metrics,
      series,
      fetchedAt: new Date().toISOString(),
    })
  } catch {
    return res.status(502).json({ error: 'Could not reach the Fortnite API.' })
  }
}
