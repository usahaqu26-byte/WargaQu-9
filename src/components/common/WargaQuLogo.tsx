import React from 'react';

interface WargaQuLogoIconProps {
  uid?: string;
  className?: string;
  withBorder?: boolean;
}

/**
 * Ikon resmi aplikasi WargaQu ("Origami 7-Facet W"):
 * Huruf "W" tebal bergaya lipatan geometris 7 bidang warna
 * yang merepresentasikan 7 modul terpadu WargaQu.
 */
export const WargaQuLogoIcon: React.FC<WargaQuLogoIconProps> = ({
  uid = 'main',
  className = 'w-9 h-9',
  withBorder = true,
}) => {
  const safeUid = uid.replace(/[^a-zA-Z0-9_-]/g, '_');

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      className={`${className} shrink-0`}
      aria-label="Logo WargaQu"
    >
      <defs>
        <linearGradient id={`wqBg_${safeUid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="65%" stopColor="#f0fdf4" />
          <stop offset="100%" stopColor="#dcfce7" />
        </linearGradient>
        <linearGradient id={`wqGoldL_${safeUid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id={`wqGoldR_${safeUid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>

      <rect
        x="20"
        y="20"
        width="472"
        height="472"
        rx="108"
        fill={`url(#wqBg_${safeUid})`}
        stroke={withBorder ? '#065f46' : 'none'}
        strokeWidth={withBorder ? 12 : 0}
      />

      {/* 1. Left Top Arm */}
      <polygon points="88,140 162,140 180,204 118,246" fill="#047857" />
      <polygon points="162,140 180,204 146,184" fill="#065f46" fillOpacity="0.45" />

      {/* 2. Left Mid Wing */}
      <polygon points="118,246 180,204 195,256 136,310" fill="#0d9488" />

      {/* 3. Left Foot */}
      <polygon points="136,310 195,256 222,374 154,374" fill="#2dd4bf" />
      <polygon points="136,310 176,320 154,374" fill="#14b8a6" fillOpacity="0.5" />

      {/* 4. Center Crown & Inner Slants */}
      <polygon points="224,140 256,140 256,214 195,256" fill="#059669" />
      <polygon points="256,140 288,140 317,256 256,214" fill="#0284c7" />

      {/* 5. Center Golden Keystone */}
      <polygon points="195,256 256,214 256,268 222,374" fill={`url(#wqGoldL_${safeUid})`} />
      <polygon points="256,214 317,256 290,374 256,268" fill={`url(#wqGoldR_${safeUid})`} />

      {/* 6. Right Top & Mid Wing */}
      <polygon points="350,140 424,140 394,246 332,204" fill="#047857" />
      <polygon points="332,204 394,246 376,310 317,256" fill="#0d9488" />

      {/* 7. Right Foot */}
      <polygon points="317,256 376,310 358,374 290,374" fill="#2dd4bf" />
      <polygon points="376,310 336,320 358,374" fill="#14b8a6" fillOpacity="0.5" />

      {/* Subtle Origami Edge Highlight */}
      <polyline
        points="195,256 256,214 317,256"
        fill="none"
        stroke="#fef3c7"
        strokeWidth="3"
        strokeOpacity="0.7"
      />
    </svg>
  );
};
