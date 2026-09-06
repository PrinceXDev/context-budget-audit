import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, EASE, F} from '../theme';

/** Local frame, clamped at zero. Every primitive below is driven by this so a
 *  component can be dropped anywhere in a Sequence and still animate from its
 *  own start rather than the composition's. */
const useLocal = (delay: number) => Math.max(0, useCurrentFrame() - delay);

export const FadeIn: React.FC<{
  delay?: number;
  dur?: number;
  y?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({delay = 0, dur = 20, y = 14, children, style}) => {
  const f = useLocal(delay);
  const p = interpolate(f, [0, dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => cubic(t),
  });
  return (
    <div style={{opacity: p, transform: `translateY(${(1 - p) * y}px)`, ...style}}>{children}</div>
  );
};

export const SlideIn: React.FC<{
  delay?: number;
  from?: 'left' | 'right' | 'up' | 'down';
  distance?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({delay = 0, from = 'left', distance = 48, children, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - delay, fps, config: {damping: 200, mass: 0.7}});
  const axis = from === 'left' || from === 'right' ? 'X' : 'Y';
  const sign = from === 'left' || from === 'up' ? -1 : 1;
  return (
    <div
      style={{
        opacity: s,
        transform: `translate${axis}(${(1 - s) * distance * sign}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const ScaleReveal: React.FC<{
  delay?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({delay = 0, children, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - delay, fps, config: {damping: 14, mass: 0.5, stiffness: 110}});
  return (
    <div style={{opacity: Math.min(1, s * 1.6), transform: `scale(${0.86 + s * 0.14})`, ...style}}>
      {children}
    </div>
  );
};

/** Reveals text one character at a time. `cps` is characters per second, so the
 *  same component reads at a believable speed whatever the string length. */
export const Typewriter: React.FC<{
  text: string;
  delay?: number;
  cps?: number;
  caret?: boolean;
  style?: React.CSSProperties;
}> = ({text, delay = 0, cps = 34, caret = true, style}) => {
  const f = useLocal(delay);
  const {fps} = useVideoConfig();
  const shown = Math.min(text.length, Math.floor((f / fps) * cps));
  const done = shown >= text.length;
  const blink = Math.floor(f / 15) % 2 === 0;
  return (
    <span style={style}>
      {text.slice(0, shown)}
      {caret && (!done || blink) ? (
        <span style={{color: C.accent, opacity: done && !blink ? 0 : 1}}>▌</span>
      ) : null}
    </span>
  );
};

/** Counts to `to`, easing out so the last digits settle rather than snap. */
export const Counter: React.FC<{
  to: number;
  delay?: number;
  dur?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  style?: React.CSSProperties;
}> = ({to, delay = 0, dur = 40, prefix = '', suffix = '', decimals = 0, style}) => {
  const f = useLocal(delay);
  const v = interpolate(f, [0, dur], [0, to], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => cubic(t),
  });
  return (
    <span style={{fontVariantNumeric: 'tabular-nums', ...style}}>
      {prefix}
      {v.toFixed(decimals)}
      {suffix}
    </span>
  );
};

/** A phrase the eye should land on. The sweep is a wipe behind the text, not a
 *  fade of the text itself, so the words stay legible the whole time. */
export const Highlight: React.FC<{
  delay?: number;
  color?: string;
  children: React.ReactNode;
}> = ({delay = 0, color = C.accentSoft, children}) => {
  const f = useLocal(delay);
  const w = interpolate(f, [0, 18], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => cubic(t),
  });
  return (
    <span style={{position: 'relative', display: 'inline-block', padding: '0 .18em'}}>
      <span
        style={{
          position: 'absolute',
          inset: 0,
          width: `${w}%`,
          background: color,
          borderRadius: 4,
        }}
      />
      <span style={{position: 'relative'}}>{children}</span>
    </span>
  );
};

/** The small all-caps label that names a section without stealing the frame. */
export const SectionTitle: React.FC<{label: string; delay?: number; color?: string}> = ({
  label,
  delay = 0,
  color = C.faint,
}) => (
  <FadeIn delay={delay} dur={16} y={8}>
    <div
      style={{
        fontFamily: F.mono,
        fontSize: 20,
        letterSpacing: '0.34em',
        textTransform: 'uppercase',
        color,
      }}
    >
      {label}
    </div>
  </FadeIn>
);

/** A hairline that draws itself left to right. Used to separate without weight. */
export const Rule: React.FC<{delay?: number; width?: number | string; color?: string}> = ({
  delay = 0,
  width = '100%',
  color = C.line,
}) => {
  const f = useLocal(delay);
  const p = interpolate(f, [0, 26], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => cubic(t),
  });
  return (
    <div style={{width, height: 1, background: color, transform: `scaleX(${p})`, transformOrigin: 'left'}} />
  );
};

export const cubic = (t: number) => {
  const [, , , ] = EASE;
  // cubic-bezier(0.22, 1, 0.36, 1) approximated - an expo-out feel.
  return 1 - Math.pow(1 - t, 3);
};
