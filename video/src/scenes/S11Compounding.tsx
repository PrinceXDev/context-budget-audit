import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Backdrop} from '../components/Backdrop';
import {Terminal} from '../components/Terminal';
import {Counter, FadeIn, SectionTitle, cubic} from '../components/primitives';
import {C, F} from '../theme';

/**
 * 2:50-3:08. From one Play to a compounding library.
 *
 * The queue numbers are read off the real run in public/runs/queue-demo.txt -
 * 67 open merge requests in gitlab-org/cli, oldest 197 days, median 113.
 */

const LOOP = ['USE', 'LEARN', 'REUSE', 'IMPROVE'];

export const S11Compounding: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const loopIn = interpolate(frame, [352, 384], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: cubic,
  });

  return (
    <AbsoluteFill>
      <Backdrop intensity={0.8} glow={{x: 50, y: 30}} />

      <AbsoluteFill style={{padding: '58px 110px', display: 'flex', flexDirection: 'column'}}>
        <SectionTitle label="One Play is memory. Many is capability." delay={4} />

        <div style={{display: 'flex', gap: 60, marginTop: 34, alignItems: 'flex-start'}}>
          <Terminal
            file="queue-demo.txt"
            title="rote play run princepanchani/gitlab-mr-queue"
            startAt={40}
            lps={11}
            range={[141, 160]}
            rows={19}
            fontSize={17}
            width={940}
          />

          <div style={{flex: 1, minWidth: 460, display: 'flex', flexDirection: 'column', gap: 34}}>
            <FadeIn delay={168} dur={18}>
              <div
                style={{
                  fontFamily: F.display,
                  fontSize: 31,
                  color: C.dim,
                  lineHeight: 1.44,
                }}
              >
                The second Play answers the same question across{' '}
                <span style={{color: C.text}}>an entire backlog</span> — and says how long each one
                has been waiting.
              </div>
            </FadeIn>

            <div style={{display: 'flex', gap: 54}}>
              {[
                {to: 67, label: 'open merge requests', color: C.text},
                {to: 197, label: 'days, oldest', color: C.warn, suffix: 'd'},
                {to: 113, label: 'days, median', color: C.warn, suffix: 'd'},
              ].map((m, i) => (
                <div key={m.label} style={{display: 'flex', flexDirection: 'column', gap: 6}}>
                  <div
                    style={{
                      fontFamily: F.display,
                      fontSize: 54,
                      fontWeight: 600,
                      color: m.color,
                      letterSpacing: '-0.03em',
                    }}
                  >
                    <Counter to={m.to} delay={196 + i * 12} dur={40} suffix={m.suffix ?? ''} />
                  </div>
                  <div
                    style={{
                      fontFamily: F.mono,
                      fontSize: 12.5,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: C.faint,
                    }}
                  >
                    {m.label}
                  </div>
                </div>
              ))}
            </div>

            {/* The loop. Each pass through it is cheaper than the last, which is
                the whole argument of the piece in four words. */}
            <div style={{opacity: loopIn, marginTop: 12}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap'}}>
                {LOOP.map((w, i) => {
                  const s = spring({
                    frame: frame - 366 - i * 13,
                    fps,
                    config: {damping: 17, mass: 0.5},
                  });
                  return (
                    <React.Fragment key={w}>
                      {i > 0 ? (
                        <span style={{color: C.faint, fontSize: 22, opacity: s}}>→</span>
                      ) : null}
                      <span
                        style={{
                          opacity: s,
                          transform: `scale(${0.9 + s * 0.1})`,
                          display: 'inline-block',
                          fontFamily: F.mono,
                          fontSize: 22,
                          letterSpacing: '0.14em',
                          color: i === LOOP.length - 1 ? C.ok : C.text,
                          border: `1px solid ${i === LOOP.length - 1 ? C.ok : C.lineStrong}`,
                          background: i === LOOP.length - 1 ? C.okSoft : 'transparent',
                          borderRadius: 8,
                          padding: '9px 18px',
                        }}
                      >
                        {w}
                      </span>
                    </React.Fragment>
                  );
                })}
                <span
                  style={{
                    opacity: interpolate(frame, [432, 456], [0, 1], {
                      extrapolateLeft: 'clamp',
                      extrapolateRight: 'clamp',
                    }),
                    fontFamily: F.mono,
                    fontSize: 22,
                    color: C.ok,
                  }}
                >
                  ↺
                </span>
              </div>

              <FadeIn delay={452} dur={20}>
                <div
                  style={{
                    marginTop: 26,
                    fontFamily: F.display,
                    fontSize: 29,
                    color: C.text,
                    lineHeight: 1.42,
                  }}
                >
                  Every run that works can become the next agent&rsquo;s{' '}
                  <span style={{color: C.ok}}>starting point</span>.
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
