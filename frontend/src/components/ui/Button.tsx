import { ButtonHTMLAttributes, forwardRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const base =
  'inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-950 disabled:opacity-40 disabled:cursor-not-allowed';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 px-4 py-2',
  secondary:
    'border border-surface-600 bg-surface-800 text-gray-200 hover:bg-surface-700 hover:border-surface-500 px-4 py-2',
  ghost: 'text-gray-400 hover:text-gray-200 hover:bg-surface-800 px-3 py-2 font-medium',
  danger: 'bg-bear-500 text-white hover:bg-bear-600 px-4 py-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', className = '', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={`${base} ${variants[variant]} ${className}`.trim()}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
