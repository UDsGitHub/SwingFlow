import { execSync } from 'child_process';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../..');
// Services the backend does not use; skipping them makes `supabase start` much faster.
const EXCLUDED = 'studio,imgproxy,inbucket,edge-runtime,logflare,vector,realtime,storage-api,supavisor';

function sh(cmd: string, inherit = false): string {
  return execSync(cmd, { cwd: REPO_ROOT, stdio: inherit ? 'inherit' : 'pipe', encoding: 'utf8' }) ?? '';
}

function readStatus(): Record<string, string> | null {
  try {
    const out = sh('supabase status -o env');
    const env = Object.fromEntries(
      out.split('\n')
        .map(l => l.match(/^([A-Z_]+)="?(.*?)"?$/))
        .filter((m): m is RegExpMatchArray => !!m)
        .map(m => [m[1], m[2]]),
    );
    return env.API_URL ? env : null;
  } catch {
    return null;
  }
}

/**
 * Start (or reuse) the repo's local Supabase and rebuild the schema from supabase/migrations,
 * so every run starts empty and proves the migrations apply cleanly. Requires Docker.
 */
export default function setup(): void {
  let status = readStatus();
  if (!status) {
    sh(`supabase start -x ${EXCLUDED}`, true);
    status = readStatus();
  }
  if (!status) throw new Error('Local Supabase did not start — is Docker running?');

  sh('supabase db reset --local', true);

  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
    throw new Error(`Refusing to run integration tests against non-local Supabase: ${status.API_URL}`);
  }
  process.env.SUPABASE_URL = status.API_URL;
  process.env.SUPABASE_ANON_KEY = status.ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY;
  process.env.DATA_PROVIDER = 'mock';
  process.env.VAPID_PUBLIC_KEY = '';
  process.env.VAPID_PRIVATE_KEY = '';
}
