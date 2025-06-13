
import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', text, className }) => {
  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-4',
    lg: 'w-16 h-16 border-4',
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className || ''}`}>
      <div
        className={`animate-spin rounded-full ${sizeClasses[size]} border-gray-400 border-t-transparent`}
      ></div>
      {text && <p className="mt-2 text-sm text-gray-400">{text}</p>}
    </div>
  );
};