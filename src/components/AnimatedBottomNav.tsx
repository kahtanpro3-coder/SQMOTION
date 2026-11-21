import React, { useState, useRef, MouseEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Home,
} from 'lucide-react';
import { Language } from '../types';
import { useAppTheme } from '../utils/appSettings';

interface Ripple {
  id: number;
  x: number;
  y: number;
}

interface AnimatedBottomNavProps {
  activeTab: 'home' | 'tutorials' | 'projects' | 'templates';
  onSelectTab: (tab: 'home' | 'tutorials' | 'projects' | 'templates') => void;
  onOpenNewProjectModal: () => void;
  lang: Language;
}

export const AnimatedBottomNav: React.FC<AnimatedBottomNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenNewProjectModal,
  lang,
}) => {
  const [ripples, setRipples] = useState<{ [key: string]: Ripple[] }>({});
  const [activeBurstTab, setActiveBurstTab] = useState<string | null>(null);
  const [sqShockwaves, setSqShockwaves] = useState<{ id: number; timestamp: number }[]>([]);
  const [sqPressed, setSqPressed] = useState<boolean>(false);
  const [isSqFocusActive, setIsSqFocusActive] = useState<boolean>(false);
  const { palette } = useAppTheme();

  // Parallax 3D Tilt State
  const dockRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState<{ x: number; y: number; glareX: number; glareY: number }>({
    x: 0,
    y: 0,
    glareX: 50,
    glareY: 50,
  });
  const [isHovered, setIsHovered] = useState<boolean>(false);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!dockRef.current) return;
    const rect = dockRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Calculate subtle 3D tilt angles (-6deg to 6deg)
    const rotateY = ((x - centerX) / centerX) * 5.5;
    const rotateX = -((y - centerY) / centerY) * 5.5;

    // Glare position percentage
    const glareX = (x / rect.width) * 100;
    const glareY = (y / rect.height) * 100;

    setTilt({ x: rotateX, y: rotateY, glareX, glareY });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ x: 0, y: 0, glareX: 50, glareY: 50 });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  // Trigger ripple effect on click
  const triggerRipple = (tabKey: string, e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rippleId = Date.now() + Math.random();

    setRipples((prev) => ({
      ...prev,
      [tabKey]: [...(prev[tabKey] || []), { id: rippleId, x, y }],
    }));

    // Trigger active burst
    setActiveBurstTab(tabKey);
    setTimeout(() => {
      setActiveBurstTab(null);
    }, 450);

    // Remove ripple after animation completes
    setTimeout(() => {
      setRipples((prev) => ({
        ...prev,
        [tabKey]: (prev[tabKey] || []).filter((r) => r.id !== rippleId),
      }));
    }, 700);
  };

  // Handle SQ Button press with energy shockwave pulse & focus lift
  const handleSqPress = (e: React.MouseEvent<HTMLButtonElement>) => {
    const shockId = Date.now();
    setSqShockwaves((prev) => [...prev, { id: shockId, timestamp: Date.now() }]);
    setSqPressed(true);
    setIsSqFocusActive(true);

    triggerRipple('sq', e);

    setTimeout(() => {
      setSqPressed(false);
    }, 300);

    // Trigger modal opening
    onOpenNewProjectModal();

    setTimeout(() => {
      setSqShockwaves((prev) => prev.filter((s) => s.id !== shockId));
      setIsSqFocusActive(false);
    }, 1800);
  };

  // Staggered initial entrance easing for nav items
  const itemVariants = {
    hidden: { opacity: 0, y: 26, scale: 0.82 },
    visible: (custom: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        delay: 0.22 + custom * 0.08,
        duration: 0.65,
        ease: [0.16, 1, 0.3, 1], // easeOutExpo
      },
    }),
  };

  return (
    <>
      {/* Background Cinematic Blur & Dark Focus Vignette when SQ is tapped */}
      <AnimatePresence>
        {isSqFocusActive && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(8px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-30 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse at 50% 100%, rgba(var(--app-accent-rgb), 0.25) 0%, rgba(10, 14, 24, 0.6) 45%, rgba(0, 0, 0, 0.75) 100%)',
            }}
          />
        )}
      </AnimatePresence>

      {/* ================= 3D SPRING POPUP ENTRANCE CONTAINER ================= */}
      <motion.footer
        initial={{ y: 95, opacity: 0, scale: 0.92, rotateX: 14 }}
        animate={{
          y: isSqFocusActive ? -10 : 0,
          opacity: 1,
          scale: isSqFocusActive ? 1.025 : 1,
          rotateX: 0,
        }}
        transition={{
          type: 'spring',
          stiffness: 210,
          damping: 20,
          mass: 0.9,
        }}
        style={{
          perspective: '1000px',
          transformStyle: 'preserve-3d',
        }}
        className="fixed bottom-2 sm:bottom-4 inset-x-0 mx-auto z-40 w-[250px] sm:w-[270px] pointer-events-none select-none"
      >
        <div
          ref={dockRef}
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{
            transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(${isHovered || isSqFocusActive ? 12 : 0}px)`,
            transition: isHovered
              ? 'transform 0.1s cubic-bezier(0.2, 0, 0, 1)'
              : 'transform 0.65s cubic-bezier(0.16, 1, 0.3, 1)',
            transformStyle: 'preserve-3d',
          }}
          className={`relative w-full h-[84px] flex items-center justify-center pointer-events-auto transition-shadow duration-500 ${
            isSqFocusActive
              ? 'drop-shadow-[0_20px_60px_rgba(var(--app-accent-rgb),0.6)]'
              : 'drop-shadow-[0_14px_45px_rgba(0,0,0,0.75)]'
          }`}
        >
          {/* ================= SVG ARCHED GLASS CANVAS & NEON ENERGY BEAM ================= */}
          <div className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
            <svg
              className="w-full h-full overflow-visible"
              viewBox="0 0 600 90"
              preserveAspectRatio="none"
            >
              <defs>
                {/* Glass Frosted Tint Gradient */}
                <linearGradient id="glassDarkBg" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#101528" stopOpacity="0.9" />
                  <stop offset="50%" stopColor="#0B0F1B" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#05070E" stopOpacity="0.98" />
                </linearGradient>

                {/* Specular Top Arch Rim Light */}
                <linearGradient id="specularRim" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={palette.bright} stopOpacity="0.4" />
                  <stop offset="20%" stopColor="#ffffff" stopOpacity="0.8" />
                  <stop offset="50%" stopColor={palette.light} stopOpacity="0.95" />
                  <stop offset="80%" stopColor="#ffffff" stopOpacity="0.8" />
                  <stop offset="100%" stopColor={palette.bright} stopOpacity="0.4" />
                </linearGradient>

                {/* Base Ambient Glowing Ribbon Border */}
                <linearGradient id="purpleRibbonGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={palette.secondary} stopOpacity="0.65" />
                  <stop offset="25%" stopColor={palette.primary} stopOpacity="0.85" />
                  <stop offset="50%" stopColor={palette.bright} stopOpacity="0.95" />
                  <stop offset="75%" stopColor={palette.primary} stopOpacity="0.85" />
                  <stop offset="100%" stopColor={palette.secondary} stopOpacity="0.65" />
                </linearGradient>

                {/* Traveling Neon Energy Line Gradient */}
                <linearGradient id="energyBeamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={palette.secondary} stopOpacity="0" />
                  <stop offset="20%" stopColor={palette.primary} stopOpacity="0.4" />
                  <stop offset="55%" stopColor={palette.bright} stopOpacity="0.95" />
                  <stop offset="85%" stopColor={palette.light} stopOpacity="1" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
                </linearGradient>

                {/* Core Intense Laser Beam */}
                <linearGradient id="laserCoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={palette.bright} stopOpacity="0" />
                  <stop offset="50%" stopColor={palette.light} stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
                </linearGradient>

                {/* Neon Bloom Filters */}
                <filter id="neonBeamGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="3.5" result="blur1" />
                  <feGaussianBlur stdDeviation="8" result="blur2" />
                  <feMerge>
                    <feMergeNode in="blur2" />
                    <feMergeNode in="blur1" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                <filter id="ambientDockGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="6" stdDeviation="14" floodColor={palette.primary} floodOpacity="0.4" />
                  <feDropShadow dx="0" dy="1" stdDeviation="4" floodColor={palette.secondary} floodOpacity="0.22" />
                </filter>

                {/* Clip path for the glass body */}
                <clipPath id="dockArchedClip">
                  <path d="M 32,40 Q 300,-2 568,40 A 24,24 0 0,1 568,84 Q 300,42 32,84 A 24,24 0 0,1 32,40 Z" />
                </clipPath>
              </defs>

              {/* 1. Main Frosted Glass Body with Multi-Depth Drop Shadows */}
              <path
                d="M 32,40 Q 300,-2 568,40 A 24,24 0 0,1 568,84 Q 300,42 32,84 A 24,24 0 0,1 32,40 Z"
                fill="url(#glassDarkBg)"
                filter="url(#ambientDockGlow)"
                className="backdrop-blur-2xl"
              />

              {/* 2. Base Border Line */}
              <path
                d="M 32,40 Q 300,-2 568,40 A 24,24 0 0,1 568,84 Q 300,42 32,84 A 24,24 0 0,1 32,40 Z"
                fill="none"
                stroke="url(#purpleRibbonGlow)"
                strokeWidth="1.8"
                strokeOpacity="0.65"
              />

              {/* 3. Top Specular Arch Accent (Thin Elegant Rim Light) */}
              <path
                d="M 36,39 Q 300,-1 564,39"
                fill="none"
                stroke="url(#specularRim)"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeOpacity="0.8"
              />

              {/* 4. Glowing Purple Neon Energy Line (Traveling Trail - 60fps Hardware Loop) */}
              <path
                d="M 32,40 Q 300,-2 568,40 A 24,24 0 0,1 568,84 Q 300,42 32,84 A 24,24 0 0,1 32,40 Z"
                pathLength="1000"
                fill="none"
                stroke="url(#energyBeamGrad)"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeDasharray="180 820"
                filter="url(#neonBeamGlow)"
                className="animate-energy-trace"
              />

              {/* 5. Hyper-Bright Leading Core Laser Spark */}
              <path
                d="M 32,40 Q 300,-2 568,40 A 24,24 0 0,1 568,84 Q 300,42 32,84 A 24,24 0 0,1 32,40 Z"
                pathLength="1000"
                fill="none"
                stroke="url(#laserCoreGrad)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeDasharray="50 950"
                className="animate-energy-trace"
              />

              {/* 6. Counter-flow soft harmonic pulse for richer depth */}
              <path
                d="M 32,40 Q 300,-2 568,40 A 24,24 0 0,1 568,84 Q 300,42 32,84 A 24,24 0 0,1 32,40 Z"
                pathLength="1000"
                fill="none"
                stroke={palette.primary}
                strokeWidth="1.6"
                strokeOpacity="0.4"
                strokeLinecap="round"
                strokeDasharray="90 910"
                className="animate-energy-trace-reverse"
              />
            </svg>

            {/* ================= GLASS SURFACE SPECULAR SHEEN & REFLECTION ================= */}
            <div
              className="absolute inset-0 overflow-hidden pointer-events-none rounded-[36px]"
              style={{
                clipPath: 'polygon(5% 42%, 50% 0%, 95% 42%, 95% 95%, 5% 95%)',
              }}
            >
              {/* Ambient Moving Glass Sheen Wave */}
              <div className="absolute -inset-full w-[300%] h-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-glass-sheen pointer-events-none" />

              {/* Dynamic Mouse Glare Spotlight */}
              <div
                className="absolute inset-0 transition-opacity duration-300 pointer-events-none"
                style={{
                  background: `radial-gradient(ellipse 260px 70px at ${tilt.glareX}% ${tilt.glareY}%, rgba(var(--app-accent-bright-rgb), 0.22) 0%, rgba(255, 255, 255, 0.06) 40%, transparent 80%)`,
                  opacity: isHovered ? 1 : 0.45,
                }}
              />
            </div>
          </div>

          {/* ================= INTERACTIVE CURVED NAVIGATION ITEMS (Home, SQ Button) ================= */}
          <div className="relative z-10 w-full h-full flex items-center justify-around px-5 sm:px-7">
            {/* ================= ITEM 1: الصفحة الرئيسية (Home) ================= */}
            <motion.button
              type="button"
              custom={0}
              initial="hidden"
              animate="visible"
              variants={itemVariants}
              whileHover={{ y: -3, scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              onClick={(e) => {
                triggerRipple('home', e);
                onSelectTab('home');
              }}
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 mt-3.5 sm:mt-4 transition-colors cursor-pointer group outline-none overflow-visible ${
                activeTab === 'home'
                  ? 'text-white font-extrabold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {/* Ripples */}
              {ripples['home']?.map((r) => (
                <span
                  key={r.id}
                  style={{ left: r.x, top: r.y, backgroundColor: `rgba(${palette.brightRgb}, 0.4)` }}
                  className="absolute w-7 h-7 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none animate-nav-ripple"
                />
              ))}

              {/* Active Glow Aura */}
              {activeTab === 'home' && (
                <motion.div
                  layoutId="activeTabAura"
                  style={{
                    background: `linear-gradient(to top, rgba(${palette.primaryRgb}, 0.25), rgba(${palette.secondaryRgb}, 0.15), transparent)`,
                  }}
                  className="absolute -inset-2 rounded-2xl filter blur-sm -z-10"
                />
              )}

              <div
                className={`relative transition-transform duration-300 ${
                  activeBurstTab === 'home' ? 'animate-active-burst' : ''
                }`}
              >
                <Home
                  className={`w-5 h-5 stroke-[2.2] transition-all duration-300 ${
                    activeTab === 'home'
                      ? 'text-[var(--app-accent-bright)] drop-shadow-[0_0_12px_rgba(var(--app-accent-bright-rgb),0.95)] scale-110'
                      : 'group-hover:text-[var(--app-accent-bright)] group-hover:drop-shadow-[0_0_6px_rgba(var(--app-accent-bright-rgb),0.5)]'
                  }`}
                />
              </div>

              <span
                className={`text-[10px] sm:text-[11px] font-bold tracking-tight transition-all duration-300 ${
                  activeTab === 'home'
                    ? 'text-white drop-shadow-[0_0_8px_rgba(var(--app-accent-bright-rgb),0.8)]'
                    : 'text-slate-400 group-hover:text-slate-200'
                }`}
              >
                {lang === 'ar' ? 'الصفحة الرئيسية' : 'Home'}
              </span>

              {/* Active Indicator Micro-Pill */}
              {activeTab === 'home' && (
                <motion.div
                  layoutId="activeIndicator"
                  style={{
                    background: palette.cssGrad,
                    boxShadow: `0 0 10px ${palette.bright}`,
                  }}
                  className="w-2 h-1 rounded-full mt-0.5"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </motion.button>

            {/* ================= ITEM 2 (Center Peak): 3D FLOATING & BREATHING SQ BUTTON ================= */}
            <motion.div
              custom={1}
              initial="hidden"
              animate="visible"
              variants={itemVariants}
              className="flex-1 flex items-center justify-center -mt-3.5 sm:-mt-4 relative"
            >
              {/* Dynamic Realistic Drop Shadow underneath */}
              <div
                className="absolute top-12 sm:top-13 w-10 h-3 rounded-full filter blur-md animate-float-shadow pointer-events-none"
                style={{ backgroundColor: palette.deep, opacity: 0.8 }}
              />

              {/* Concentric Pulsing Neon Rings */}
              <div
                className="absolute w-14 h-14 rounded-full border animate-pulse-ring-1 pointer-events-none"
                style={{
                  backgroundColor: `rgba(${palette.primaryRgb}, 0.2)`,
                  borderColor: `rgba(${palette.brightRgb}, 0.35)`,
                }}
              />
              <div
                className="absolute w-14 h-14 rounded-full border animate-pulse-ring-2 pointer-events-none"
                style={{
                  backgroundColor: `rgba(${palette.secondaryRgb}, 0.2)`,
                  borderColor: `rgba(${palette.secondaryRgb}, 0.35)`,
                }}
              />

              {/* Expanding Shockwave Energy Pulses on Click */}
              {sqShockwaves.map((s) => (
                <React.Fragment key={s.id}>
                  <div className="absolute w-16 h-16 rounded-full border-2 border-[var(--app-accent-bright)] animate-shockwave-purple pointer-events-none -z-10" />
                  <div className="absolute w-16 h-16 rounded-full border border-[var(--app-accent-secondary)] animate-shockwave-magenta pointer-events-none -z-10" />
                  <div className="absolute w-16 h-16 rounded-full border border-[var(--app-accent-tertiary)] opacity-85 animate-shockwave-2 pointer-events-none -z-10" />
                </React.Fragment>
              ))}

              {/* 3D Floating Main Button Container */}
              <div className="animate-float-breathing">
                <button
                  type="button"
                  onClick={handleSqPress}
                  style={{
                    background: palette.cssGrad,
                    borderColor: `rgba(${palette.brightRgb}, 0.9)`,
                    boxShadow: sqPressed
                      ? `0 0 48px ${palette.bright}`
                      : `0 0 24px rgba(${palette.primaryRgb}, 0.8), 0 0 48px rgba(${palette.tertiaryRgb}, 0.45), inset 0 1px 2px rgba(255,255,255,0.7)`,
                  }}
                  className={`relative w-13 h-13 sm:w-14 sm:h-14 rounded-full border-2 p-0.5 flex items-center justify-center hover:scale-115 active:scale-90 transition-all duration-300 group cursor-pointer overflow-hidden outline-none ${
                    sqPressed ? 'scale-90 ring-4 ring-[rgba(var(--app-accent-bright-rgb),0.6)]' : ''
                  }`}
                  title={lang === 'ar' ? 'إنشاء مشروع جديد' : 'New Project'}
                >
                  {/* Ripples on SQ Button */}
                  {ripples['sq']?.map((r) => (
                    <span
                      key={r.id}
                      style={{ left: r.x, top: r.y }}
                      className="absolute w-12 h-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/50 pointer-events-none animate-nav-ripple"
                    />
                  ))}

                  {/* Glossy Top Glass Shimmer Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-b from-white/35 via-white/5 to-transparent rounded-full pointer-events-none" />

                  {/* Rotating Laser Sheen Reflection */}
                  <div className="absolute -inset-2 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-rotate-sheen pointer-events-none opacity-60" />

                  {/* Inner Beveled Button Face */}
                  <div
                    className="relative w-full h-full rounded-full flex items-center justify-center shadow-[inset_0_2px_4px_rgba(255,255,255,0.35),inset_0_-2px_4px_rgba(0,0,0,0.5)]"
                    style={{
                      background: `linear-gradient(to top right, ${palette.deep}, ${palette.solid}, ${palette.secondary})`,
                    }}
                  >
                    <span className="text-white font-black text-sm sm:text-base tracking-tighter drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] group-hover:scale-110 transition-transform duration-200">
                      SQ
                    </span>
                  </div>
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.footer>
    </>
  );
};
