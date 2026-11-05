import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Lets `npm run dev` serve /api/fortnite without the Vercel CLI.
function devApi() {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use('/api/fortnite', async (req, res) => {
        const { default: handler } = await server.ssrLoadModule('/api/fortnite.js')
        req.query = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams)
        res.status = code => { res.statusCode = code; return res }
        res.json = body => {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(body))
        }
        await handler(req, res)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), devApi()],
})
