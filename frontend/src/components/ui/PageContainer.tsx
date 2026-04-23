import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
}

export function PageContainer({ children, className = '' }: Props) {
  return (
    <div className={`max-w-7xl mx-auto w-full ${className}`}>
      {children}
    </div>
  );
}
