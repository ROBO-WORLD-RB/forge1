import React, { useId } from 'react';
import { Loader2 } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  helperText?: string;
  inputId?: string;
  loading?: boolean;
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  icon,
  className = '',
  helperText,
  inputId,
  loading = false,
  disabled,
  ...props
}) => {
  const generatedId = useId();
  const id = inputId || generatedId;
  const isDisabled = disabled || loading;

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className={`block text-sm font-medium mb-1.5 ${isDisabled ? 'text-gray-400' : 'text-gray-700'}`}
        >
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div
            className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${
              isDisabled ? 'text-gray-300' : 'text-gray-400'
            }`}
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
        <input
          id={id}
          disabled={isDisabled}
          className={`
            w-full rounded-xl border-2 transition-all duration-200
            ${
              error
                ? 'border-red-100 focus:border-red-500 bg-red-50/30'
                : 'border-gray-100 focus:border-forge-orange bg-white hover:border-gray-200'
            }
            ${icon ? 'pl-10' : 'pl-4'} ${loading ? 'pr-10' : 'pr-4'} py-3.5
            focus:outline-none focus:ring-4 focus:ring-forge-orange/5
            disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-100
            disabled:cursor-not-allowed disabled:hover:border-gray-100
            placeholder:text-gray-400 font-medium
            ${loading ? 'cursor-wait' : ''}
          `}
          aria-invalid={!!error}
          aria-busy={loading || undefined}
          aria-describedby={error ? `${id}-error` : helperText ? `${id}-helper` : undefined}
          {...props}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true">
            <Loader2 className="w-4 h-4 text-forge-orange animate-spin" />
          </div>
        )}
      </div>
      {error && (
        <p
          id={`${id}-error`}
          className="mt-1 text-sm text-red-500 animate-in slide-in-from-top-1 fade-in duration-200"
          role="alert"
        >
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={`${id}-helper`} className={`mt-1 text-xs ${isDisabled ? 'text-gray-400' : 'text-gray-500'}`}>
          {helperText}
        </p>
      )}
    </div>
  );
};

export default Input;
