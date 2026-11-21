import React from 'react';

// Strong, expressive 120Hz / 240Hz GPU-composited spring physics
export const MODAL_EASE = [0.22, 1, 0.36, 1] as const;

export const VIEW_SPRING = {
  type: 'spring' as const,
  stiffness: 360,
  damping: 22,
  mass: 0.78,
  restDelta: 0.0005,
  restSpeed: 0.0005,
};

export const PANEL_SPRING = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 23,
  mass: 0.72,
  restDelta: 0.0005,
  restSpeed: 0.0005,
};

export const PILL_SPRING = {
  type: 'spring' as const,
  stiffness: 520,
  damping: 24,
  mass: 0.55,
  restDelta: 0.0005,
  restSpeed: 0.0005,
};

export const ITEM_SPRING = {
  type: 'spring' as const,
  stiffness: 440,
  damping: 23,
  mass: 0.65,
  restDelta: 0.0005,
  restSpeed: 0.0005,
};

export const AMBIENT_BACKDROP_STYLE: React.CSSProperties = {
  background:
    'radial-gradient(ellipse at 50% 100%, rgba(var(--app-accent-rgb), 0.16) 0%, rgba(5, 8, 14, 0.92) 52%, rgba(0, 0, 0, 0.96) 100%)',
};

export const viewTransitionVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 36 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: VIEW_SPRING,
  },
  exit: {
    opacity: 0,
    scale: 1.04,
    y: -18,
    transition: { duration: 0.18, ease: MODAL_EASE },
  },
};

export const backdropVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.18, ease: MODAL_EASE },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15, ease: MODAL_EASE },
  },
};

export const bottomSheetVariants = {
  hidden: { y: '100%', opacity: 0, scale: 0.93 },
  visible: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: PANEL_SPRING,
  },
  exit: {
    y: '100%',
    opacity: 0,
    scale: 0.94,
    transition: { duration: 0.18, ease: MODAL_EASE },
  },
};

export const centerModalVariants = {
  hidden: { y: 44, opacity: 0, scale: 0.86 },
  visible: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: PANEL_SPRING,
  },
  exit: {
    y: 24,
    opacity: 0,
    scale: 0.9,
    transition: { duration: 0.16, ease: MODAL_EASE },
  },
};

export const fullScreenModalVariants = {
  hidden: { y: 64, opacity: 0, scale: 0.93 },
  visible: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: VIEW_SPRING,
  },
  exit: {
    y: 36,
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.16, ease: MODAL_EASE },
  },
};

export const sideDrawerLeftVariants = {
  hidden: { x: '-100%', opacity: 0, scale: 0.95 },
  visible: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: PANEL_SPRING,
  },
  exit: {
    x: '-100%',
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.18, ease: MODAL_EASE },
  },
};

export const dropdownVariants = {
  hidden: { opacity: 0, y: -12, scale: 0.88 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: PILL_SPRING,
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.92,
    transition: { duration: 0.12, ease: MODAL_EASE },
  },
};

export const dropdownUpVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.88 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: PILL_SPRING,
  },
  exit: {
    opacity: 0,
    y: 8,
    scale: 0.92,
    transition: { duration: 0.12, ease: MODAL_EASE },
  },
};

export const staggerContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.032,
      delayChildren: 0.04,
    },
  },
};

export const staggerFastContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.02,
      delayChildren: 0.02,
    },
  },
};

export const staggerItemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.92 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: ITEM_SPRING,
  },
};

export const AmbientModalGlow: React.FC = () => (
  <div
    className="absolute bottom-0 inset-x-0 h-80 sm:h-96 pointer-events-none filter blur-3xl"
    style={{
      background:
        'linear-gradient(to top, rgba(var(--app-accent-rgb), 0.14), rgba(var(--app-accent-secondary-rgb), 0.08), rgba(var(--app-accent-tertiary-rgb), 0.05), transparent)',
    }}
  />
);

export const PanelRimSheen: React.FC<{ roundedClass?: string }> = ({
  roundedClass = 'rounded-t-[36px]',
}) => (
  <>
    {/* Top Rim Light Sweep matching Active App Theme */}
    <div className="absolute top-0 inset-x-0 h-[2px] overflow-hidden pointer-events-none z-20">
      <div
        className="w-1/2 h-full animate-panel-light-sweep"
        style={{
          background:
            'linear-gradient(to right, transparent, var(--app-accent-bright), var(--app-accent-secondary), var(--app-accent-tertiary))',
        }}
      />
    </div>
    {/* Specular Inner Glare Sheen */}
    <div
      className={`absolute top-0 inset-x-6 h-20 bg-gradient-to-b from-white/8 via-white/2 to-transparent ${roundedClass} pointer-events-none z-10`}
    />
  </>
);
