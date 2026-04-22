// Bridges Clerk's React hook (useAuth) with the axios interceptor,
// which runs outside React's component tree.

type TokenGetter = () => Promise<string | null>;
let _getter: TokenGetter | null = null;

export function setTokenGetter(fn: TokenGetter): void {
  _getter = fn;
}

export async function getAuthToken(): Promise<string | null> {
  return _getter ? _getter() : null;
}
