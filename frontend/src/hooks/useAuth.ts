import { useUser, useClerk } from '@clerk/clerk-react';

export function useAuth() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  const email = user?.primaryEmailAddress?.emailAddress ?? null;

  return {
    user: user ? { ...user, email } : null,
    loading: !isLoaded,
    signOut: () => signOut(),
  };
}
