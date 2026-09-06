import React from 'react';
import {AbsoluteFill, interpolate, Sequence, useCurrentFrame} from 'remotion';
import {Backdrop} from '../components/Backdrop';
import {LogoReveal} from '../components/Logo';
import {cubic} from '../components/primitives';
import {C, F} from '../theme';

/**
 * 0:28-0:40. The turn.
 *
 * The noisy chains are gone and one question sits alone on the frame. This is
 * the only scene in the piece with nothing else on screen, which is what buys
 * the pause its weight.
 */
export const S03Insight: React.FC = () => {
  const frame = useCurrentFrame();

  const qIn = interpolate(frame, [10, 34], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: cubic,
  });
  const qOut = interpolate(frame, [150, 176], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: cubic,
  });
  const q = Math.min(qIn, qOut);

  const glow = interpolate(frame, [176, 230], [0.3, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: cubic,
  });

  return (
    <AbsoluteFill>
      <Backdrop intensity={glow} glow={{x: 50, y: 46, color: C.accentGlow}} />

      {q > 0 ? (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <div
            style={{
              opacity: q,
              transform: `translateY(${(1 - qIn) * 18}px)`,
              fontFamily: F.display,
              fontSize: 66,
              fontWeight: 500,
              letterSpacing: '-0.03em',
              color: C.text,
              textAlign: 'center',
              maxWidth: 1280,
              lineHeight: 1.22,
            }}
          >
            What if the run that <span style={{color: C.accent}}>worked</span> became memory?
          </div>
        </AbsoluteFill>
      ) : null}

      <Sequence from={186}>
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
          <LogoReveal size={112} tagline="The memory layer for AI agents" taglineDelay={30} />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
