import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  leftIcon?: React.ReactNode;
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '',
  leftIcon,
  isLoading,
  ...props 
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-[Loew,Arial,sans-serif] rounded-full border-none shadow-none';
  
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-base',
    lg: 'px-7 py-3 text-lg'
  };

  const variantStyles = {
    primary: 'bg-[var(--color-primary)] text-[var(--color-text-primary)] hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-hover)]',
    ghost: 'bg-transparent text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:bg-opacity-10 active:bg-opacity-20',
    danger: 'bg-[var(--color-error)] text-[var(--color-text-primary)] hover:bg-red-700 active:bg-red-800'
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {leftIcon && !isLoading && <span className="mr-2">{leftIcon}</span>}
      {children}
    </button>
  );
};