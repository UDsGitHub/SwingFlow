import { useState } from 'react';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  width?: string;
}

export function Tooltip({ content, children, width = 'w-56' }: TooltipProps) {
  const [show, setShow] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
          <span className={`block ${width} bg-surface-700 border border-surface-600 rounded-xl px-3 py-2.5 text-xs text-gray-300 shadow-xl leading-relaxed whitespace-normal`}>
            {content}
          </span>
          <span className="block absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-surface-600" />
        </span>
      )}
    </span>
  );
}
