import { execSync } from 'child_process';
import { clerkSetup } from '@clerk/testing/playwright';
import { createClerkClient } from '@clerk/backend';
import { REPO_ROOT, TEST_USER_EMAIL } from './support/env';

/** Fresh local database, a Clerk testing token, and a dedicated test user in the Clerk dev instance. */
export default async function globalSetup(): Promise<void> {
  execSync('supabase db reset --local', { cwd: REPO_ROOT, stdio: 'inherit' });

  await clerkSetup();

  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const existing = await clerk.users.getUserList({ emailAddress: [TEST_USER_EMAIL] });
  if (existing.data.length === 0) {
    await clerk.users.createUser({ emailAddress: [TEST_USER_EMAIL], skipPasswordRequirement: true });
  }
}
