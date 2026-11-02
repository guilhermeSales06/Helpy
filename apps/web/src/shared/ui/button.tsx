import type { ComponentProps } from 'react';

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary';
};

const base =
  'inline-flex h-12 items-center justify-center rounded-full px-6 text-[15.5px] font-semibold transition-colors outline-none focus-visible:ring-4 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-70';

const variants = {
  primary: 'bg-brand text-white hover:bg-brand-hover',
  secondary:
    'border border-line-strong bg-white text-ink hover:border-[#cfc9c3] hover:bg-surface',
} as const;

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
