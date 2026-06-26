import React from 'react';

export function Logo({ className = "w-6 h-6", strokeWidth = 2, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Crossed utensils scaled and shifted to make room for E */}
      <g transform="translate(1, 0.5) scale(0.85)">
        {/* Horizontal mirror (flip X coordinates) */}
        <g transform="translate(24, 0) scale(-1, 1)">
          {/* Knife Blade */}
          <path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8" />
          {/* Fork Head & Handle */}
          <path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7" />
          {/* Knife Handle */}
          <path d="m2.1 21.8 6.4-6.3" />
          {/* Fork Tines connector */}
          <path d="m19 5-7 7" />
        </g>
      </g>
      
      {/* Small 'E' at the bottom right */}
      <path d="M17.5 16.5 L17.5 21.5" />
      <path d="M17.5 16.5 L21 16.5" />
      <path d="M17.5 19 L20 19" />
      <path d="M17.5 21.5 L21 21.5" />
    </svg>
  );
}

export default Logo;
