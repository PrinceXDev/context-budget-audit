import React from 'react';
import {AbsoluteFill, interpolate, Sequence, useCurrentFrame} from 'remotion';
import {Backdrop} from '../components/Backdrop';
import {LogoReveal} from '../components/Logo';
import {C, F} from '../theme';
import {cubic} from '../components/primitives';

/**
 * 0:00-0:10. No product, no UI, no logo for the first eight seconds.
 *
 * Two sentences on black. The first states a thing the viewer already believes;
 * the second takes it away. Everything after this scene is the answer to the
 * second sentence.
 */

const Statement: React.FC<{
  text: string;
  from: number;
  dur: number;
  color?: string;
  size?: number;
}> = ({text, from, dur, color = C.text, size = 62}) => {
  const frame = useCurrentFrame();
  const f = frame - from;
  const inP = interpolate(f, [0, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: cubic,
  });
  const outP = interpolate(f, [dur - 18, dur], [1, 0], {
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
          fontFamily: F.display,
          fontSize: size,
          fontWeight: 500,
          letterSpacing: '-0.028em',
          color,
          opacity: o,
          // A whisper of upward drift. Any more and it reads as a slide.
          transform: `translateY(${(1 - inP) * 16}px)`,
          textAlign: 'center',
          maxWidth: 1300,
          lineHeight: 1.24,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

export const S01ColdOpen: React.FC = () => {
  const frame = useCurrentFrame();

  // The ground stays almost black until the logo, then lifts.
  const bg = interpolate(frame, [225, 265], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: cubic,
  });

  return (
    <AbsoluteFill style={{background: C.bg}}>
      <Backdrop intensity={bg * 0.7} />

      <Statement text="Your AI agent solved this yesterday." from={12} dur={98} />
      <Statement
        text="Why is it solving it again from scratch today?"
        from={125}
        dur={100}
        color={C.text}
      />

      <Sequence from={238}>
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <LogoReveal size={104} />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
