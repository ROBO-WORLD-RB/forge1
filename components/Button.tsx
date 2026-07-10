import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  icon?: React.ReactNode;
  loading?: boolean;
  loadingText?: string;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  icon,
  loading = false,
  loadingText,
  className = '',
  disabled,
  type = 'button',
  ...props
}) => {
  const isDisabled = disabled || loading;

  const baseStyles =
    'inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-[0.98]';

  const variants = {
    primary:
      'bg-forge-orange hover:bg-orange-600 text-white focus:ring-forge-orange shadow-lg shadow-forge-orange/20 disabled:hover:bg-forge-orange',
    secondary:
      'bg-forge-navy hover:bg-slate-800 text-white focus:ring-forge-navy shadow-lg shadow-forge-navy/20 disabled:hover:bg-forge-navy',
    outline:
      'border-2 border-gray-200 text-forge-navy hover:border-forge-orange hover:text-forge-orange focus:ring-forge-orange bg-white disabled:hover:border-gray-200 disabled:hover:text-forge-navy',
    ghost:
      'text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:hover:bg-transparent disabled:hover:text-gray-600',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm min-h-[36px]',
    md: 'px-4 py-2 text-base min-h-[44px]',
    lg: 'px-6 py-3 text-lg min-h-[48px]',
  };

  const stateStyles = loading
    ? 'cursor-wait pointer-events-none opacity-80'
    : 'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100';

  const spinnerSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-5 h-5',
  };

  return (
    <button
      type={type}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${stateStyles} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-disabled={isDisabled || undefined}
      {...props}
    >
      {loading && (
        <Loader2 className={`${spinnerSizes[size]} animate-spin shrink-0`} aria-hidden="true" />
      )}
      {!loading && icon && <span className="shrink-0">{icon}</span>}
      <span className={loading ? 'opacity-90' : undefined}>
        {loading && loadingText ? loadingText : children}
      </span>
    </button>
  );
};

export default Button;
