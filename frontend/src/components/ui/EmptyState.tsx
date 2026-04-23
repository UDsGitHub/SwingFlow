import { LucideIcon } from 'lucide-react';

export interface EmptyStateProps {
  icon?: LucideIcon;
  heading: string;
  /** Secondary explanation */
  subtext: string;
  className?: string;
  iconClassName?: string;
}

/**
 * Centered empty pattern — muted icon, medium heading, small subtext.
 */
export function EmptyState({
  icon: Icon,
  heading,
  subtext,
  className = '',
  iconClassName = 'text-gray-500',
}: EmptyStateProps) {
  return (
    <div className={`text-center max-w-md mx-auto ${className}`.trim()}>
      {Icon && (
        <div className="w-12 h-12 rounded-xl bg-surface-800 border border-surface-700 flex items-center justify-center mx-auto mb-4">
          <Icon size={22} className={iconClassName} />
        </div>
      )}
      <p className="text-sf-label font-medium text-gray-300 mb-1.5">{heading}</p>
      <p className="text-sf-body text-gray-500 leading-relaxed">{subtext}</p>
    </div>
  );
}
