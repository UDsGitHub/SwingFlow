import { useEffect, useRef, useState } from 'react';

/**
 * Keeps a loading UI visible for at least `minDurationMs` once shown,
 * preventing flash/flicker when requests resolve very quickly.
 */
export function useMinimumLoading(isLoading: boolean, minDurationMs = 450) {
  const [showLoader, setShowLoader] = useState(isLoading);
  const startedAtRef = useRef<number | null>(isLoading ? Date.now() : null);

  useEffect(() => {

    if (isLoading) {
      startedAtRef.current = Date.now();
      setShowLoader(true);
      return;
    }

    if (!showLoader) return;

    const startedAt = startedAtRef.current ?? Date.now();
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(minDurationMs - elapsed, 0);

    const timeoutId = window.setTimeout(() => {
      setShowLoader(false);
      startedAtRef.current = null;
    }, remaining);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isLoading, minDurationMs, showLoader]);

  return showLoader;
}
