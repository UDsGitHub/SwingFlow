import { defineConfig, devices } from '@playwright/test';
import { BACKEND_PORT, FRONTEND_PORT, FRONTEND_URL, MOCK_MARKET_TIME, REPO_ROOT, clerkKeys, localSupabase } from './support/env';
import path from 'path';

const supabase = localSupabase();
const clerk = clerkKeys();
// Expose keys to @clerk/testing in global setup and the tests.
process.env.CLERK_PUBLISHABLE_KEY = clerk.publishableKey;
process.env.CLERK_SECRET_KEY = clerk.secretKey;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './global-setup.ts',
  timeout: 60_000,
  use: {
    baseURL: FRONTEND_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Isolated backend: local Supabase, deterministic mock market, no cron jobs.
      command: 'npm run dev',
      cwd: path.join(REPO_ROOT, 'backend'),
      url: `http://localhost:${BACKEND_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        PORT: String(BACKEND_PORT),
        SUPABASE_URL: supabase.url,
        SUPABASE_ANON_KEY: supabase.anonKey,
        SUPABASE_SERVICE_ROLE_KEY: supabase.serviceRoleKey,
        DATA_PROVIDER: 'mock',
        MOCK_MARKET_TIME,
        DISABLE_SCHEDULER: 'true',
        CORS_ORIGINS: FRONTEND_URL,
        CLERK_PUBLISHABLE_KEY: clerk.publishableKey,
        CLERK_SECRET_KEY: clerk.secretKey,
        VAPID_PUBLIC_KEY: '',
        VAPID_PRIVATE_KEY: '',
        NODE_ENV: 'test',
      },
    },
    {
      command: 'npm run dev',
      cwd: path.join(REPO_ROOT, 'frontend'),
      url: FRONTEND_URL,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        VITE_PORT: String(FRONTEND_PORT),
        VITE_API_PROXY_TARGET: `http://localhost:${BACKEND_PORT}`,
        VITE_CLERK_PUBLISHABLE_KEY: clerk.publishableKey,
        VITE_API_URL: '/api',
      },
    },
  ],
});
