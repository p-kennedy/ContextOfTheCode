# MetricsFlow Dashboard

A React + Vite dashboard for visualising MetricsFlow metrics. Built with Recharts and Tailwind CSS.

## Prerequisites

- Node.js 18 or later
- npm 9 or later
- The Reporting API running at `http://200.69.13.70:5009`

## Installation

```bash
cd Dashboard
npm install
```

## Running (development)

```bash
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

## Building for production

```bash
npm run build     # outputs to Dashboard/dist/
npm run preview   # preview the production build locally
```

## Pages

### Live View (`/live`)
Displays the most recent value for `cpu_percent`, `ram_usage_percent`, `process_count`, and `thread_count` for every connected PC device. Values are colour-coded by threshold (green / amber / red for percentage metrics). Auto-refreshes every 5 seconds.

### Historic Charts (`/historic`)
Line chart of `ram_usage_percent` and `cpu_percent` over time, fetched from the history endpoint. Use the start/end date pickers to narrow the range and click **Load** to fetch.

### Fortnite (`/fortnite`)
Line chart of `peak_ccu` and `unique_players` for the Fortnite island. Includes summary stat cards (current values + in-range peak). Supports the same date range filter.

## Configuration

The Reporting API base URL is set in [`src/lib/api.js`](src/lib/api.js):

```js
export const API_BASE = 'http://200.69.13.70:5009'
```

Update this value if the server address changes.
