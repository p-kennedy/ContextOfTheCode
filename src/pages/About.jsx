import { Page, Section, List, Code, A, ORIGINAL_CODE_URL } from '../components/Prose'

function Box({ title, sub, tone = 'slate' }) {
  const tones = {
    slate: 'border-slate-200 bg-white',
    purple: 'border-purple-200 bg-purple-50',
    red: 'border-red-200 bg-red-50',
    green: 'border-emerald-200 bg-emerald-50',
  }
  return (
    <div className={`rounded-xl border px-3 py-2 text-center ${tones[tone]}`}>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function Arrow({ label }) {
  return (
    <div className="flex flex-col items-center py-1 text-slate-400">
      {label && <span className="text-[11px]">{label}</span>}
      <span className="text-lg leading-none">↓</span>
    </div>
  )
}

function Architecture() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:p-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Box title="PC collector" sub="psutil" />
        <Box title="Android app" sub="via Supabase" />
        <Box title="Fortnite API" sub="island players" tone="purple" />
        <Box title="Open-Meteo" sub="Limerick weather" />
      </div>
      <Arrow label="flat JSON metric events" />
      <Box title="Local Redis upload queue" sub="retry on 5xx / network errors, drop on 4xx" tone="red" />
      <Arrow label="POST /metrics" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
        <Box title="Aggregator API" sub="FastAPI, write side" />
        <Box title="PostgreSQL" sub="metric_events, indexed" tone="green" />
        <Box title="Reporting API" sub="FastAPI, live + history, Redis cache" />
      </div>
      <Arrow label="GET /metrics/live, /metrics/history" />
      <Box title="React dashboard" sub="Vite + Recharts, served by nginx" tone="purple" />
      <p className="mt-4 text-xs text-slate-500 text-center">
        Commands flowed the other way: dashboard → Aggregator <Code>/commands</Code> → Redis pub/sub →
        the matching collector (change polling interval, switch Fortnite island).
      </p>
    </div>
  )
}

export default function About() {
  return (
    <Page
      title="About the project"
      subtitle="MetricsFlow · Context of the Code · Immersive Software Engineering, UL · Spring 2026"
    >
      <Section title="What it was">
        <p>
          MetricsFlow was a group project for the Context of the Code module. The brief was to
          collect metrics from several different sources, ship them to a backend running on a
          university VM, store them, and visualise them on a web dashboard. The stretch goal was
          two-way control: the dashboard should be able to send commands back to the collectors.
        </p>
        <p>
          We pulled from four sources: system stats from a PC, data from our Android app (stored
          in Supabase), player counts for Fortnite Creative islands, and Limerick weather.
        </p>
      </Section>

      <Section title="Original architecture">
        <Architecture />
        <List
          items={[
            <>
              <strong className="text-slate-800">One metric contract.</strong> Every collector
              emitted the same flat shape (<Code>device_id</Code>, <Code>source</Code>,{' '}
              <Code>metric_name</Code>, <Code>value</Code>, <Code>unit</Code>,{' '}
              <Code>recorded_at</Code>), so adding a source never touched the backend.
            </>,
            <>
              <strong className="text-slate-800">Separate read and write services.</strong> The
              Aggregator only accepted data; the Reporting API only served it. Both were FastAPI
              with async SQLAlchemy on a shared Postgres, all run with Docker Compose.
            </>,
            <>
              <strong className="text-slate-800">Resilient uploads.</strong> Collectors never
              posted directly. Metrics went into a local Redis queue and an uploader drained it,
              re-queuing on server or network errors and discarding on 4xx so bad data could not
              block the queue.
            </>,
            <>
              <strong className="text-slate-800">Querying at scale.</strong> The history endpoint
              used cursor-based pagination on <Code>recorded_at</Code>, indexes on the columns we
              filtered by, and a short-lived Redis cache.
            </>,
            <>
              <strong className="text-slate-800">Remote control.</strong> Each collector subscribed
              to its own Redis pub/sub channel. The dashboard could change polling intervals or
              switch which Fortnite island was tracked, and showed how many collectors received the
              command.
            </>,
          ]}
        />
      </Section>

      <Section title="What's running here now">
        <p>
          The university VM is gone, so this is a cut-down version kept alive as a portfolio piece.
          It keeps the Fortnite part, which was the most interesting data, and drops everything
          that needed a server running 24/7.
        </p>
        <List
          items={[
            'The dashboard is the same React + Recharts app, now hosted on Vercel.',
            <>
              A single serverless function (<Code>/api/fortnite</Code>) proxies Epic's public
              Fortnite Ecosystem API, validates input and caches responses for 5 minutes.
            </>,
            'No database or collectors: the Fortnite API already keeps 7 days of history, so storing it ourselves would only add cost and moving parts.',
            'You can look up any public island by code, not just the preset ones.',
          ]}
        />
        <p>
          The full original codebase (collectors, both APIs, Docker setup) is preserved at the{' '}
          <A href={ORIGINAL_CODE_URL}>last commit before the rework</A> on GitHub.
        </p>
      </Section>
    </Page>
  )
}
