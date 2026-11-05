import { Page, Section, List, Code } from '../components/Prose'

const TIMELINE = [
  ['21 Jan', 'Repo created, module kicks off.'],
  ['15 Feb', 'First collector and upload queue skeleton.'],
  ['18 Feb', 'Backend scaffold: Aggregator, Reporting API, Postgres, Docker Compose. PC collector posting real data.'],
  ['19 to 25 Feb', 'Fortnite poller with de-duplication, Redis upload queue, retry rules for failed uploads.'],
  ['28 Feb', 'First dashboard, plus the command channel from dashboard to collectors (the stretch goal).'],
  ['2 Mar', 'Fixed timestamps so we stored when data was measured, not when it was uploaded.'],
  ['5 Mar', 'Dashboard deployed on the VM behind nginx.'],
  ['7 Mar', 'Cursor pagination, database indexes and Redis caching on the history endpoint.'],
  ['9 to 10 Mar', 'Android and other-sources pages, filters, final fixes. Submitted with not much time to spare.'],
]

function Timeline() {
  return (
    <ol className="relative border-l border-slate-200 ml-2 space-y-4">
      {TIMELINE.map(([date, text]) => (
        <li key={date} className="ml-5">
          <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-purple-500" />
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{date}</p>
          <p className="text-[15px] text-slate-600">{text}</p>
        </li>
      ))}
    </ol>
  )
}

export default function Retro() {
  return (
    <Page title="How it went" subtitle="A look back at building MetricsFlow">
      <Section title="Timeline">
        <p>
          Most of the system was built in about three weeks, from the backend scaffold on 18
          February to the final commit on 10 March.
        </p>
        <Timeline />
      </Section>

      <Section title="What went well">
        <List
          items={[
            'Agreeing on a single metric contract early. Once it existed, adding the Fortnite, weather and Android sources was mostly writing a new collector, with no backend changes.',
            'The upload queue. Collectors kept working when the VM or network dropped, and the 4xx vs 5xx split meant one bad record could not jam everything behind it.',
            'Hitting the stretch goal. Seeing a button on the dashboard change a collector\'s polling interval in real time over Redis pub/sub was the most satisfying part of the project.',
            'Treating the history endpoint as a real API: pagination, indexes and caching rather than returning every row.',
          ]}
        />
      </Section>

      <Section title="What was hard">
        <List
          items={[
            'CORS. The dashboard and APIs ran on different ports, and it took several rounds of fixes (and commit messages ending in "hopefully") before it stayed fixed.',
            <>
              Time. Our first version stamped data when it reached the server, so anything that sat
              in the queue showed up at the wrong time. Making collectors set{' '}
              <Code>recorded_at</Code> at measurement time fixed it.
            </>,
            'De-duplicating Fortnite data. The API returns overlapping windows each poll, so the collector had to ask the Reporting API for the last stored timestamp and only queue newer intervals.',
            'Deploying to a shared VM with fixed ports, where every service needed its own port and nginx had to play nicely with client-side routing.',
          ]}
        />
      </Section>

      <Section title="What I'd do differently">
        <List
          items={[
            'Keep secrets out of the code from day one. A key ended up hardcoded in a config file, and environment variables should have been the only option.',
            'Commit small and often. A whole weekend of work landed in one commit, which makes it much harder to review or roll back.',
            'Integrate end to end earlier. Most of the painful bugs (CORS, timestamps) only showed up once every piece was running together.',
            'Write a few tests for the contract and the uploader\'s retry rules, the two things everything else depended on.',
          ]}
        />
      </Section>

      <Section title="Bringing it back">
        <p>
          When the VM was shut down, the live project went with it. Rather than rebuild the whole
          stack, I kept the part worth showing and made it cheap to run: one data source, one
          serverless function, no database. It is a good reminder that the right architecture
          depends on the constraints, and those had changed.
        </p>
      </Section>
    </Page>
  )
}
