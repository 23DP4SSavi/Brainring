import { defineConfig } from '@playwright/test'
import { existsSync } from 'node:fs'

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 30000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5179',
    viewport: { width: 390, height: 844 },
    timezoneId: 'Europe/Riga',
    ...(existsSync(
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    )
      ? { channel: 'msedge' }
      : {}),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node ../backend/src/server.js',
      url: 'http://127.0.0.1:3019/api/health',
      env: { PORT: '3019', DATABASE_PATH: ':memory:' },
      reuseExistingServer: false,
    },
    {
      command: 'npm.cmd run dev -- --host 127.0.0.1 --port 5179 --strictPort',
      url: 'http://127.0.0.1:5179',
      env: { BRAINRING_API_TARGET: 'http://127.0.0.1:3019' },
      reuseExistingServer: false,
    },
  ],
})
