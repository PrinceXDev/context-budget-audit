import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {Backdrop} from '../components/Backdrop';
import {Terminal} from '../components/Terminal';
import {SectionTitle, cubic} from '../components/primitives';
import {C, F} from '../theme';

/**
 * 2:18-2:34. Why the memory is worth reusing.
 *
 * Memory an agent cannot check is a liability, not an asset. Each pillar here
 * is quoted from the same real run shown earlier - lines 51-61 of
 * public/runs/gate-demo.txt, on screen beside the claims they back.
 */

const PILLARS: {at: number; kicker: string; title: string; body: string; color: string}[] = [
  {
    at: 14,
    kicker: 'verify',
    title: 'Checked against a witness it never used',
    body: "A fresh second read, plus GitLab's own server-side verdict. If they disagree, the report says CONTRADICTED and tells you to trust GitLab.",
    color: C.ok,
  },
  {
    at: 178,
    kicker: 'unknowns',
    title: 'Unknown is never clean',
    body: 'A dimension it could not read is reported as unknown and downgrades the verdict. It is never quietly counted as passing.',
    color: C.warn,
  },
  {
    at: 348,
    kicker: 'blast radius',
    title: 'Read-only, by construction',
    body: 'Nothing is approved, merged, rebased, commented or labelled. No credentials at all on public projects.',
    color: C.accent,
  },
];

export const S09Trust: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <Backdrop intensity={0.62} glow={{x: 22, y: 46, color: 'rgba(56,225,176,0.13)'}} />

      <AbsoluteFill
        style={{
          padding: '70px 110px 190px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <SectionTitle label="Memory you can audit" delay={4} />

        <div style={{display: 'flex', gap: 62, marginTop: 38, alignItems: 'flex-start'}}>
          <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 26, maxWidth: 720}}>
            {PILLARS.map((p) => {
              const t = interpolate(frame - p.at, [0, 20], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing: cubic,
              });
              // Once the next pillar lands, the previous one recedes rather
              // than disappearing - the argument is cumulative.
              const isLatest =
                p === [...PILLARS].reverse().find((q) => frame >= q.at);
              const settle = isLatest ? 1 : 0.42;

              return (
                <div
                  key={p.kicker}
                  style={{
                    opacity: t * settle,
                    transform: `translateX(${(1 - t) * 20}px)`,
                    borderLeft: `2px solid ${p.color}`,
                    paddingLeft: 26,
                  }}
                >
                  <div
                    style={{
                      fontFamily: F.mono,
                      fontSize: 12.5,
                      letterSpacing: '0.3em',
                      textTransform: 'uppercase',
                      color: p.color,
                    }}
                  >
                    {p.kicker}
                  </div>
                  <div
                    style={{
                      fontFamily: F.display,
                      fontSize: 33,
                      fontWeight: 500,
                      color: C.text,
                      marginTop: 10,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {p.title}
                  </div>
                  <div
                    style={{
                      fontFamily: F.display,
                      fontSize: 22,
                      lineHeight: 1.5,
                      color: C.dim,
                      marginTop: 10,
                    }}
                  >
                    {p.body}
                  </div>
                </div>
              );
            })}
          </div>

          <Terminal
            file="gate-demo.txt"
            title="from the same run · lines 51-61"
            startAt={30}
            lps={9}
            range={[51, 62]}
            rows={11}
            fontSize={17}
            width={940}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
