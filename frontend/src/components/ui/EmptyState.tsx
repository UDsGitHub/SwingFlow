import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  heading?: string;
  body: string;
  className?: string;
  iconBg?: string;
}

export function EmptyState({
  icon: Icon,
  heading,
  body,
  className = '',
  iconBg = 'bg-surface-700',
}: EmptyStateProps) {
  return (
    <div className={`text-center ${className}`}>
      <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center mx-auto mb-4`}>
        <Icon size={22} className="text-gray-400" />
      </div>
      {heading && (
        <p className="text-sm font-semibold text-gray-300 mb-1">{heading}</p>
      )}
      <p className="text-sm text-gray-400 max-w-xs mx-auto leading-relaxed">{body}</p>
    </div>
  );
}
