import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

export const REPO_ROOT = path.resolve(__dirname, '../..');
export const BACKEND_PORT = 3101;
export const FRONTEND_PORT = 5174;
export const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;
/** Friday 2026-10-23 after the close: the mock market produces Reversal setups for AXP and CB. */
export const MOCK_MARKET_TIME = '2026-10-23T20:35:00Z';
export const TEST_USER_EMAIL = 'swingflow-e2e+clerk_test@example.com';

const EXCLUDED = 'studio,imgproxy,inbucket,edge-runtime,logflare,vector,realtime,storage-api,supavisor';

function readSupabaseStatus(): Record<string, string> | null {
  try {
    const out = execSync('supabase status -o env', { cwd: REPO_ROOT, encoding: 'utf8', stdio: 'pipe' });
    const env = Object.fromEntries(
      out.split('\n').map(l => l.match(/^([A-Z_]+)="?(.*?)"?$/)).filter((m): m is RegExpMatchArray => !!m).map(m => [m[1], m[2]]),
    );
    return env.API_URL ? env : null;
  } catch {
    return null;
  }
}

/** Start (or reuse) the repo's local Supabase and return its connection details. Requires Docker. */
export function localSupabase(): { url: string; anonKey: string; serviceRoleKey: string } {
  let status = readSupabaseStatus();
  if (!status) {
    execSync(`supabase start -x ${EXCLUDED}`, { cwd: REPO_ROOT, stdio: 'inherit' });
    status = readSupabaseStatus();
  }
  if (!status || !/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
    throw new Error('Local Supabase is not available — is Docker running?');
  }
  return { url: status.API_URL, anonKey: status.ANON_KEY, serviceRoleKey: status.SERVICE_ROLE_KEY };
}

/**
 * Clerk development-instance keys: CI provides them as environment variables; locally they
 * come from backend/.env. Only pk_test/sk_test keys are accepted.
 */
export function clerkKeys(): { publishableKey: string; secretKey: string } {
  const file = path.join(REPO_ROOT, 'backend/.env');
  const fromFile = fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {};
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY ?? fromFile.CLERK_PUBLISHABLE_KEY ?? '';
  const secretKey = process.env.CLERK_SECRET_KEY ?? fromFile.CLERK_SECRET_KEY ?? '';
  if (!publishableKey.startsWith('pk_test_') || !secretKey.startsWith('sk_test_')) {
    throw new Error('e2e needs Clerk development keys (pk_test_/sk_test_) in the environment or backend/.env');
  }
  return { publishableKey, secretKey };
}
