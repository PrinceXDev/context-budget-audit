import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {C} from '../theme';

/**
 * The ground every scene sits on: near-black, a faint engineering grid, one
 * slow accent bloom, and a vignette to keep the eye centre-frame.
 *
 * `intensity` dials the whole thing down for scenes that need to be nearly
 * black (the cold open and the finale) without swapping components.
 */
export const Backdrop: React.FC<{
  intensity?: number;
  glow?: {x: number; y: number; color?: string};
}> = ({intensity = 1, glow}) => {
  const frame = useCurrentFrame();

  // A very slow drift keeps the grid from reading as a static texture. Two
  // pixels over ten seconds - felt rather than seen.
  const drift = interpolate(frame, [0, 300], [0, 2]);

  const g = glow ?? {x: 50, y: 42, color: C.accentGlow};

  return (
    <AbsoluteFill style={{background: C.bg}}>
      <AbsoluteFill
        style={{
          opacity: 0.55 * intensity,
          backgroundImage: `linear-gradient(${C.line} 1px, transparent 1px),
                            linear-gradient(90deg, ${C.line} 1px, transparent 1px)`,
          backgroundSize: '72px 72px',
          backgroundPosition: `${drift}px ${drift}px`,
          maskImage: 'radial-gradient(ellipse 78% 68% at 50% 45%, #000 40%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 78% 68% at 50% 45%, #000 40%, transparent 100%)',
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.9 * intensity,
          background: `radial-gradient(ellipse 60% 50% at ${g.x}% ${g.y}%, ${
            g.color ?? C.accentGlow
          } 0%, transparent 62%)`,
          filter: 'blur(80px)',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse 90% 80% at 50% 50%, transparent 45%, rgba(0,0,0,0.72) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};
