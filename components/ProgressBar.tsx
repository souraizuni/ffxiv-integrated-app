import React from 'react';

interface ProgressBarProps {
  value: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

export default function ProgressBar({ value, size = 'md', color = '#f59e0b' }: ProgressBarProps) {
  const heights = { sm: '6px', md: '10px', lg: '14px' };
  return (
    <div className="w-full">
      <div className="relative bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden" style={{ height: heights[size] }}>
        <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color, height: '100%', transition: 'width 300ms ease' }} />
      </div>
    </div>
  );
}
