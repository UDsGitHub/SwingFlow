import { ReactNode } from 'react';

/**
 * Global content width — matches Dashboard (max-w-7xl) with consistent horizontal padding.
 * Sidebar is sibling flex; this wrapper only spans the main column.
 */
interface Props {
  children: ReactNode;
  className?: string;
}

export function PageContainer({ children, className = '' }: Props) {
  return (
    <div className={`w-full max-w-7xl mx-auto px-4 sm:px-5 md:px-6 ${className}`.trim()}>
      {children}
    </div>
  );
}
