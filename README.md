# MetricsFlow

A live Fortnite island metrics dashboard. It started as a group project for the Context of the Code module (Immersive Software Engineering, UL, Spring 2026).

The original system ran on a university VM. It used four collectors, a Redis upload queue, two FastAPI services, Postgres and a React dashboard. That code is preserved at [this commit](https://github.com/matthewb62/ContextOfTheCode/tree/2c53c176667d0a966fca8b9247830b1868ec013d).

This version is cut down so it can run for free on Vercel:

- **`src/`**: React + Vite + Tailwind + Recharts dashboard, plus the "About" and "How it went" write-up pages
- **`api/fortnite.js`**: a Vercel serverless function that proxies Epic's public [Fortnite Ecosystem API](https://api.fortnite.com/ecosystem/v1), validates input and caches responses for 5 minutes

## Run locally

```bash
npm install
npm run dev
```

`npm run dev` also serves `/api/fortnite` through a small Vite middleware, so you don't need the Vercel CLI.

## Deploy

Import the repo into Vercel. It auto-detects Vite and needs no environment variables. `vercel.json` handles client-side routing.
