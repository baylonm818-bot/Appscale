import { motion, useReducedMotion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';

/**
 * Standard Durations (ms)
 * - Micro (buttons, badges, indicators): 150-200ms
 * - Medium (cards, sections, modals): 250-350ms
 * - Long (count-up, multi-stage entrance): 500-800ms
 */
export const transitions = {
  micro: { duration: 0.18, ease: [0.16, 1, 0.3, 1] },
  page: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
  springy: { type: 'spring', stiffness: 380, damping: 25 },
  gentleSpring: { type: 'spring', stiffness: 300, damping: 28 },
};

export const pageVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.995 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: transitions.page,
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.995,
    transition: { duration: 0.18, ease: 'easeIn' },
  },
};

export const staggerContainer = (staggerTime = 0.07, delay = 0.02) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: staggerTime,
      delayChildren: delay,
    },
  },
});

export const itemFadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  },
};

export const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 12 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 380, damping: 26 },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 8,
    transition: { duration: 0.18, ease: 'easeIn' },
  },
};

export const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.22 } },
  exit: { opacity: 0, transition: { duration: 0.18 } },
};

/**
 * Animated number count-up component
 * Runs once when the component enters viewport or renders with data
 */
export function CountUp({ value = 0, duration = 750, className = '' }) {
  const shouldReduceMotion = useReducedMotion();
  const target = typeof value === 'number' ? value : parseInt(String(value).replace(/[^0-9.-]/g, ''), 10) || 0;
  const [displayValue, setDisplayValue] = useState(() => (shouldReduceMotion ? target : 0));
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    if (shouldReduceMotion) {
      setDisplayValue(target);
      return;
    }

    if (hasAnimatedRef.current) {
      setDisplayValue(target);
      return;
    }

    hasAnimatedRef.current = true;
    let startTimestamp = null;
    let animationFrameId;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(eased * target));

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        setDisplayValue(target);
      }
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [target, duration, shouldReduceMotion]);

  return <span className={className}>{displayValue}</span>;
}

/**
 * Animated Shimmer Skeleton for zero-layout-shift loading
 */
export function ShimmerSkeleton({ className = '', style = {} }) {
  return (
    <div
      style={style}
      className={`relative overflow-hidden bg-gray-200/80 rounded-xl before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_infinite] before:bg-linear-to-r before:from-transparent before:via-white/50 before:to-transparent ${className}`}
    />
  );
}
