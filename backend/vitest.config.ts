import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          // Starts (or reuses) a local Supabase and resets it from supabase/migrations.
          globalSetup: ['tests/integration/globalSetup.ts'],
          // Tests share one database, so run all files in a single process, one at a time.
          pool: 'forks',
          poolOptions: { forks: { singleFork: true } },
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
