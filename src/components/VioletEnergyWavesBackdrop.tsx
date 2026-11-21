import React from 'react';
import { AppThemeAccent, THEME_PALETTES } from '../utils/appSettings';

interface VioletEnergyWavesBackdropProps {
  theme?: AppThemeAccent;
}

export const VioletEnergyWavesBackdrop: React.FC<VioletEnergyWavesBackdropProps> = ({
  theme = 'violet',
}) => {
  const palette = THEME_PALETTES[theme] || THEME_PALETTES.violet;

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-0 bg-[#05060A]">
      {/* Deep top ambient glow */}
      <div
        className="absolute -top-28 inset-x-0 h-72 opacity-60 blur-[90px]"
        style={{
          background: `radial-gradient(ellipse 85% 70% at 50% 10%, ${palette.primary}66 0%, ${palette.secondary}40 40%, ${palette.tertiary}28 65%, transparent 85%)`,
        }}
      />

      {/* Top silk energy waves */}
      <svg
        className="absolute top-0 left-0 w-full h-56 sm:h-64 opacity-85"
        viewBox="0 0 800 260"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="waveTopGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={palette.secondary} stopOpacity="0.48" />
            <stop offset="48%" stopColor={palette.primary} stopOpacity="0.62" />
            <stop offset="100%" stopColor={palette.tertiary} stopOpacity="0.32" />
          </linearGradient>
          <linearGradient id="waveTopGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={palette.tertiary} stopOpacity="0.52" />
            <stop offset="50%" stopColor={palette.bright} stopOpacity="0.38" />
            <stop offset="100%" stopColor={palette.secondary} stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="waveRimTop" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={palette.secondary} stopOpacity="0.15" />
            <stop offset="32%" stopColor={palette.light} stopOpacity="0.85" />
            <stop offset="65%" stopColor={palette.primary} stopOpacity="0.75" />
            <stop offset="100%" stopColor={palette.tertiary} stopOpacity="0.5" />
          </linearGradient>
        </defs>

        {/* Flowing silk ribbon fills */}
        <path
          d="M-40,0 L840,0 L840,120 C680,190 520,65 360,135 C210,200 80,125 -40,175 Z"
          fill="url(#waveTopGrad1)"
        />
        <path
          d="M-40,0 L840,0 L840,75 C700,150 560,22 390,95 C235,162 110,70 -40,130 Z"
          fill="url(#waveTopGrad2)"
        />

        {/* Crisp glowing silk filaments */}
        <path
          d="M-30,132 C120,68 245,168 415,96 C585,24 705,148 840,72"
          fill="none"
          stroke="url(#waveRimTop)"
          strokeWidth="1.6"
        />
        <path
          d="M-30,175 C110,120 230,205 390,135 C550,65 695,180 840,115"
          fill="none"
          stroke="url(#waveRimTop)"
          strokeWidth="1.1"
          strokeOpacity="0.65"
        />
        <path
          d="M-30,90 C150,155 310,38 510,118 C660,175 760,95 840,132"
          fill="none"
          stroke={palette.tertiary}
          strokeWidth="0.95"
          strokeOpacity="0.48"
        />
      </svg>

      {/* Subtle top starlight sparkles */}
      <div
        className="absolute top-12 left-[31%] w-1.5 h-1.5 rounded-full blur-[0.5px] opacity-80"
        style={{ backgroundColor: palette.light, boxShadow: `0 0 12px ${palette.primary}` }}
      />
      <div
        className="absolute top-24 left-[64%] w-1 h-1 rounded-full opacity-75"
        style={{ backgroundColor: palette.tertiary, boxShadow: `0 0 10px ${palette.tertiary}` }}
      />
      <div
        className="absolute top-8 right-[24%] w-1 h-1 rounded-full opacity-70"
        style={{ backgroundColor: palette.light, boxShadow: `0 0 10px ${palette.secondary}` }}
      />

      {/* Deep bottom ambient glow */}
      <div
        className="absolute -bottom-24 inset-x-0 h-64 opacity-55 blur-[90px]"
        style={{
          background: `radial-gradient(ellipse 90% 70% at 50% 95%, ${palette.primary}66 0%, ${palette.secondary}40 42%, ${palette.tertiary}26 68%, transparent 85%)`,
        }}
      />

      {/* Bottom silk energy waves */}
      <svg
        className="absolute bottom-0 left-0 w-full h-48 sm:h-56 opacity-80"
        viewBox="0 0 800 220"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="waveBotGrad1" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={palette.primary} stopOpacity="0.55" />
            <stop offset="50%" stopColor={palette.secondary} stopOpacity="0.42" />
            <stop offset="100%" stopColor={palette.tertiary} stopOpacity="0.52" />
          </linearGradient>
          <linearGradient id="waveRimBot" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={palette.primary} stopOpacity="0.25" />
            <stop offset="32%" stopColor={palette.light} stopOpacity="0.82" />
            <stop offset="68%" stopColor={palette.secondary} stopOpacity="0.75" />
            <stop offset="100%" stopColor={palette.tertiary} stopOpacity="0.45" />
          </linearGradient>
        </defs>

        <path
          d="M-40,220 L840,220 L840,95 C680,170 520,55 370,130 C215,205 90,90 -40,150 Z"
          fill="url(#waveBotGrad1)"
        />
        <path
          d="M-30,150 C95,90 220,198 380,126 C535,54 685,165 840,95"
          fill="none"
          stroke="url(#waveRimBot)"
          strokeWidth="1.5"
        />
        <path
          d="M-30,185 C135,125 275,205 445,142 C615,80 730,175 840,128"
          fill="none"
          stroke={palette.tertiary}
          strokeWidth="1"
          strokeOpacity="0.52"
        />
      </svg>
    </div>
  );
};
