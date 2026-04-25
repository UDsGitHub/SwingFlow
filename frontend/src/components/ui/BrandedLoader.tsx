import { Activity } from 'lucide-react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

interface BrandedLoaderProps {
  message?: string;
  subtext?: string;
  mode?: 'fullscreen' | 'inline';
  className?: string;
}

export function BrandedLoader({
  message = 'Loading SwingFlow…',
  subtext,
  mode = 'inline',
  className = '',
}: BrandedLoaderProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const pulseClass = prefersReducedMotion ? '' : 'animate-pulse';

  const containerClass =
    mode === 'fullscreen'
      ? 'min-h-screen bg-surface-950 flex items-center justify-center p-4'
      : 'w-full rounded-2xl border border-surface-700 bg-surface-800/70 p-6 flex items-center justify-center';

  return (
    <div className={`${containerClass} ${className}`.trim()} role="status" aria-live="polite">
      <div className="text-center">
        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-500/20 border border-brand-500/30 ${pulseClass}`}>
          <Activity size={22} className="text-brand-400" />
        </div>
        <p className="mt-3 text-sf-body text-gray-200">{message}</p>
        {subtext && (
          <p className="mt-1 text-sf-field text-gray-500">{subtext}</p>
        )}
      </div>
    </div>
  );
}
