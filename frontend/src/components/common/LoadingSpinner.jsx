const LoadingSpinner = ({ size = 'md', text = '', variant = 'spinner' }) => {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg'
  };

  if (variant === 'dots') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2.5 h-2.5 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2.5 h-2.5 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        {text && <p className={`text-gray-500 ${textSizes[size]}`}>{text}</p>}
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8">
        <div className={`relative ${sizes[size]}`}>
          <div className="absolute inset-0 bg-primary-600 rounded-full animate-ping opacity-30" />
          <div className={`relative ${sizes[size]} bg-primary-600 rounded-full animate-pulse`} />
        </div>
        {text && <p className={`text-gray-500 ${textSizes[size]}`}>{text}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <svg
        className={`animate-spin ${sizes[size]} text-primary-600`}
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-20"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
        />
        <path
          className="opacity-80"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {text && <p className={`text-gray-500 ${textSizes[size]}`}>{text}</p>}
    </div>
  );
};

export default LoadingSpinner;
