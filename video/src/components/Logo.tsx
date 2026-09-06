import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, F} from '../theme';
import {cubic} from './primitives';

/**
 * A typographic Rote lockup.
 *
 * NOTE: this is a neutral stand-in mark, not Modiqo's official Rote brand
 * asset - drop the real SVG in here if you have one. The glyph is three nodes
 * and a return path: a run that finishes and feeds the next one.
 */

export const RoteMark: React.FC<{size?: number; progress?: number}> = ({size = 64, progress = 1}) => {
  const p = Math.max(0, Math.min(1, progress));
  const LEN = 150;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path
        d="M14 44 C14 22, 50 22, 50 44"
        stroke={C.accent}
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeDasharray={LEN}
        strokeDashoffset={LEN * (1 - p)}
      />
      <path
        d="M50 44 C50 54, 38 56, 32 50"
        stroke={C.ok}
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeDasharray={LEN}
        strokeDashoffset={LEN * (1 - Math.max(0, (p - 0.55) / 0.45))}
        opacity={p > 0.55 ? 1 : 0}
      />
      {[
        {cx: 14, cy: 44, c: C.accent, at: 0.1},
        {cx: 32, cy: 27, c: C.accent, at: 0.45},
        {cx: 50, cy: 44, c: C.ok, at: 0.8},
      ].map((n, i) => (
        <circle
          key={i}
          cx={n.cx}
          cy={n.cy}
          r={5}
          fill={C.bg}
          stroke={n.c}
          strokeWidth={3}
          opacity={p > n.at ? 1 : 0}
        />
      ))}
    </svg>
  );
};

export const LogoReveal: React.FC<{
  delay?: number;
  size?: number;
  tagline?: string | null;
  taglineDelay?: number;
}> = ({delay = 0, size = 96, tagline = null, taglineDelay = 24}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const f = frame - delay;

  const draw = interpolate(f, [0, 34], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: cubic,
  });
  const word = spring({frame: f - 14, fps, config: {damping: 20, mass: 0.7}});
  const tag = interpolate(f - taglineDelay, [0, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: cubic,
  });

  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22}}>
      <div style={{display: 'flex', alignItems: 'center', gap: size * 0.28}}>
        <RoteMark size={size} progress={draw} />
        <div
          style={{
            fontFamily: F.display,
            fontSize: size * 0.82,
            fontWeight: 600,
            letterSpacing: '-0.035em',
            color: C.text,
            opacity: word,
            transform: `translateX(${(1 - word) * -16}px)`,
          }}
        >
          Rote
        </div>
      </div>
      {tagline ? (
        <div
          style={{
            fontFamily: F.display,
            fontSize: size * 0.24,
            fontWeight: 400,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: C.dim,
            opacity: tag,
            transform: `translateY(${(1 - tag) * 8}px)`,
          }}
        >
          {tagline}
        </div>
      ) : null}
    </div>
  );
};
