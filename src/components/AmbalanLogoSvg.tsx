import React from 'react';

export const KhobinwalShieldLogo: React.FC<{ className?: string; isWatermark?: boolean }> = ({
  className = 'w-20 h-24',
  isWatermark = false,
}) => {
  return (
    <svg
      viewBox="0 0 200 240"
      className={className}
      style={{ opacity: isWatermark ? 0.16 : 1 }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer Red Shield */}
      <path
        d="M16 18 L100 8 L184 18 L184 125 C184 182 100 226 100 232 C100 226 16 182 16 125 Z"
        fill="#111111"
        stroke="#991B1B"
        strokeWidth="10"
        strokeLinejoin="round"
      />
      {/* Top Banner Box */}
      <rect
        x="10"
        y="30"
        width="180"
        height="34"
        rx="3"
        fill="#111111"
        stroke="#991B1B"
        strokeWidth="6"
      />
      <text
        x="100"
        y="53"
        fill="#FFFFFF"
        fontFamily="Arial, sans-serif"
        fontWeight="900"
        fontSize="18"
        textAnchor="middle"
        letterSpacing="0.5"
      >
        MAN 11 JAKARTA
      </text>

      {/* Gold Laurel Wreath Circle */}
      <circle
        cx="100"
        cy="122"
        r="38"
        fill="none"
        stroke="#D4AF37"
        strokeWidth="4"
        strokeDasharray="6 3"
      />
      {/* Star at top of emblem */}
      <polygon
        points="100,74 103,81 110,81 104,85 106,92 100,88 94,92 96,85 90,81 97,81"
        fill="#D4AF37"
      />
      {/* Crossed Swords / Spears in center */}
      <line
        x1="76"
        y1="146"
        x2="124"
        y2="98"
        stroke="#FFFFFF"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <line
        x1="124"
        y1="146"
        x2="76"
        y2="98"
        stroke="#FFFFFF"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* Tunas / Fleur-de-lis accent */}
      <circle cx="100" cy="122" r="8" fill="#D4AF37" />

      {/* Bottom White Ribbon: Khobinwal - Umkul */}
      <path
        d="M34 176 Q100 192 166 176 L160 196 Q100 212 40 196 Z"
        fill="#FFFFFF"
        stroke="#111111"
        strokeWidth="2"
      />
      <text
        x="100"
        y="192"
        fill="#111111"
        fontFamily="Arial, sans-serif"
        fontWeight="700"
        fontSize="11"
        textAnchor="middle"
      >
        Khobinwal - Umkul
      </text>
    </svg>
  );
};

export const TunasKelapaSilhouette: React.FC<{ className?: string }> = ({
  className = 'w-16 h-24',
}) => {
  return (
    <svg viewBox="0 0 120 180" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Coconut base */}
      <ellipse cx="48" cy="142" rx="26" ry="18" transform="rotate(-12 48 142)" fill="#1F1614" />
      {/* Main shoot curving up */}
      <path
        d="M62 140 C82 115 88 70 84 16 C92 48 98 86 84 128 C96 105 104 82 102 56 C110 88 100 125 74 148 Z"
        fill="#1F1614"
      />
      {/* Left leaf */}
      <path
        d="M66 112 C48 96 42 78 46 58 C50 76 58 92 72 102 Z"
        fill="#1F1614"
      />
      {/* Roots at bottom */}
      <path
        d="M42 156 Q68 168 102 152 Q72 162 42 156 Z"
        fill="#1F1614"
      />
    </svg>
  );
};
