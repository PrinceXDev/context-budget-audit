import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {Backdrop} from '../components/Backdrop';
import {RoteMark} from '../components/Logo';
import {PresenterHero} from '../components/Presenter';
import {FadeIn, Rule, cubic} from '../components/primitives';
import {C, F} from '../theme';

/**
 * 3:21-3:32. The signature.
 *
 * The portrait sits right, the name sits left, and the links are set small and
 * quiet - a credit, not a call to action.
 */
export const S13Creator: React.FC = () => {
  const frame = useCurrentFrame();

  const out = interpolate(frame, [292, 326], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: cubic,
  });

  return (
    <AbsoluteFill style={{opacity: out}}>
      <Backdrop intensity={0.55} glow={{x: 68, y: 46}} />

      <AbsoluteFill
        style={{
          padding: '0 170px',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 100,
        }}
      >
        <div style={{maxWidth: 820}}>
          <FadeIn delay={10} dur={20}>
            <div
              style={{
                fontFamily: F.mono,
                fontSize: 14,
                letterSpacing: '0.32em',
                textTransform: 'uppercase',
                color: C.faint,
              }}
            >
              Built by
            </div>
          </FadeIn>

          <FadeIn delay={20} dur={22}>
            <div
              style={{
                fontFamily: F.display,
                fontSize: 78,
                fontWeight: 600,
                letterSpacing: '-0.035em',
                color: C.text,
                marginTop: 14,
                lineHeight: 1.05,
              }}
            >
              Prince Panchani
            </div>
          </FadeIn>

          <div style={{marginTop: 34, width: 520}}>
            <Rule delay={54} color={C.lineStrong} />
          </div>

          <div style={{display: 'flex', flexDirection: 'column', gap: 13, marginTop: 30}}>
            {[
              {k: 'github', v: 'github.com/PrinceXDev'},
              {k: 'linkedin', v: 'linkedin.com/in/prince-panchani-70757b202'},
              {k: 'registry', v: 'play.modiqo.ai/princepanchani'},
            ].map((l, i) => (
              <FadeIn key={l.k} delay={66 + i * 12} dur={18}>
                <div style={{display: 'flex', alignItems: 'baseline', gap: 20}}>
                  <span
                    style={{
                      fontFamily: F.mono,
                      fontSize: 13,
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      color: C.faint,
                      width: 96,
                    }}
                  >
                    {l.k}
                  </span>
                  <span style={{fontFamily: F.mono, fontSize: 22, color: C.dim}}>{l.v}</span>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={128} dur={22}>
            <div
              style={{
                marginTop: 46,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <RoteMark size={34} />
              <span
                style={{
                  fontFamily: F.mono,
                  fontSize: 16,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: C.faint,
                }}
              >
                Built for the Rote Playoffs
              </span>
            </div>
          </FadeIn>
        </div>

        <PresenterHero delay={28} size={330} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
