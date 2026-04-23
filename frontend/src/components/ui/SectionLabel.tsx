import { ReactNode } from 'react';

/** Page section / card header — title case in source; 13px semibold muted */
export function SectionLabel({
  children,
  className = '',
  as: Tag = 'h2',
  noMargin,
}: {
  children: ReactNode;
  className?: string;
  as?: 'h2' | 'h3' | 'p' | 'div';
  /** When set, omit default bottom margin (e.g. inline in a toolbar row) */
  noMargin?: boolean;
}) {
  return (
    <Tag className={`text-sf-section text-gray-400 ${noMargin ? '' : 'mb-4'} ${className}`.trim()}>
      {children}
    </Tag>
  );
}
