import React from 'react';
import {AbsoluteFill, interpolate, Sequence, useCurrentFrame} from 'remotion';
import {Backdrop} from '../components/Backdrop';
import {LogoReveal} from '../components/Logo';
import {cubic} from '../components/primitives';
import {C, F} from '../theme';

/**
 * 3:08-3:21. Two sentences and the mark.
 *
 * Back to the black of the cold open on purpose: the piece ends where it began,
 * with the same claim answered instead of asked.
 */

const Line: React.FC<{text: string; hot?: string; from: number; dur: number}> = ({
  text,
  hot,
  from,
  dur,
}) => {
  const frame = useCurrentFrame();
  const f = frame - from;
  const inP = interpolate(f, [0, 24], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: cubic,
  });
  const outP = interpolate(f, [dur - 20, dur], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: cubic,
  });
  const o = Math.min(inP, outP);
  if (o <= 0) return null;

  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <div
        style={{
          opacity: o,
          transform: `translateY(${(1 - inP) * 14}px)`,
          fontFamily: F.display,
          fontSize: 70,
          fontWeight: 500,
          letterSpacing: '-0.032em',
          color: C.dim,
          textAlign: 'center',
        }}
      >
        {text} <span style={{color: hot ? C.text : C.dim}}>{hot}</span>
      </div>
    </AbsoluteFill>
  );
};

export const S12Finale: React.FC = () => {
  const frame = useCurrentFrame();
  const dark = interpolate(frame, [0, 30], [0.7, 0.25], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const lift = interpolate(frame, [300, 340], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: cubic,
  });

  return (
    <AbsoluteFill style={{background: C.bg}}>
      <Backdrop intensity={Math.max(dark, lift)} />

      <Line text="Agents remember" hot="what was said." from={14} dur={140} />
      <Line text="Rote remembers" hot="what worked." from={168} dur={140} />

      <Sequence from={318}>
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <LogoReveal size={116} tagline="The memory layer for AI agents" taglineDelay={28} />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
