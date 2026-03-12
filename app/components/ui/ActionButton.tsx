'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

type ButtonVariant = 'accent' | 'ghost' | 'danger' | 'yes' | 'no';
type ButtonSize = 'sm' | 'md' | 'lg';
type ButtonState = 'idle' | 'loading' | 'success' | 'error';

interface ActionButtonProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  onClick?: (e: React.MouseEvent) => void | Promise<void>;
  disabled?: boolean;
  className?: string;
  fullWidth?: boolean;
  /** External state control — if provided, internal state management is skipped */
  state?: ButtonState;
}

export function ActionButton({
  children,
  variant = 'accent',
  size = 'md',
  onClick,
  disabled = false,
  className = '',
  fullWidth = false,
  state: externalState,
}: ActionButtonProps) {
  const [internalState, setInternalState] = useState<ButtonState>('idle');
  const state = externalState ?? internalState;
  const useInternal = externalState === undefined;

  const handleClick = async (e: React.MouseEvent) => {
    if (disabled || state === 'loading') return;

    if (useInternal) {
      setInternalState('loading');
      try {
        await onClick?.(e);
        setInternalState('success');
        setTimeout(() => setInternalState('idle'), 1500);
      } catch {
        setInternalState('error');
        setTimeout(() => setInternalState('idle'), 2000);
      }
    } else {
      // External state management — just call the handler
      onClick?.(e);
    }
  };

  const variantClasses: Record<ButtonVariant, string> = {
    accent: 'btn-accent',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
    yes: 'bg-profit/15 text-profit border border-profit/20 hover:bg-profit/25 font-semibold rounded-[10px]',
    no: 'bg-loss/15 text-loss border border-loss/20 hover:bg-loss/25 font-semibold rounded-[10px]',
  };

  const sizeClasses: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-8 py-3.5 text-base',
  };

  const stateContent = () => {
    switch (state) {
      case 'loading':
        return (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {children}
          </span>
        );
      case 'success':
        return (
          <span className="flex items-center gap-1.5">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Done
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1.5">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Failed
          </span>
        );
      default:
        return children;
    }
  };

  return (
    <motion.button
      onClick={handleClick}
      disabled={disabled || state === 'loading'}
      className={`
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
        inline-flex items-center justify-center gap-2 transition-all font-medium
        ${className}
      `}
      whileHover={!disabled ? { scale: 1.02 } : undefined}
      whileTap={!disabled ? { scale: 0.98 } : undefined}
    >
      {stateContent()}
    </motion.button>
  );
}
