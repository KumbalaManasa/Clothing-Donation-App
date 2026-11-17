import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Local development uses HTTP by default so the browser can call the local
// API without trusting a self-signed certificate. Set DEV_HTTPS=1 to opt in
// to the per-machine development certificate for secure-context testing.
const certPath = resolve(import.meta.dirname, '../certs/dev-cert.pem')
const keyPath = resolve(import.meta.dirname, '../certs/dev-key.pem')
const httpsConfig =
  process.env.NODE_ENV !== 'production' && process.env.DEV_HTTPS === '1' && existsSync(certPath) && existsSync(keyPath)
    ? { cert: readFileSync(certPath), key: readFileSync(keyPath) }
    : undefined

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // host: true binds the dev server to all network interfaces (0.0.0.0), not
  // just localhost, so other devices on the same LAN can reach it at this
  // machine's IP — the first step toward sharing the app before a real cloud
  // deploy. Same server, same code, just reachable from more than one machine.
  server: {
    host: true,
    allowedHosts: ['.trycloudflare.com'],

    https: httpsConfig,
  },
  test: {
    // vitest's default include glob matches *.spec.js too, which collides
    // with the Playwright E2E specs under e2e/ (tasks 12.5-12.7) — those use
    // @playwright/test's own test() global, run separately via
    // `npm run test:e2e`, not vitest's `npm test`. Excluding e2e/ here keeps
    // the two runners from fighting over the same files. Vitest's own
    // defaults are repeated explicitly since setting `exclude` replaces them
    // rather than extending them.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
      'e2e/**',
    ],
  },
})
