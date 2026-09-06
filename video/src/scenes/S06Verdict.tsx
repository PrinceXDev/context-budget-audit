import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {Backdrop} from '../components/Backdrop';
import {Terminal} from '../components/Terminal';
import {FadeIn, SectionTitle, cubic} from '../components/primitives';
import {C, F} from '../theme';

/**
 * 1:16-1:32. The report.
 *
 * public/runs/gate-demo.txt is stdout from a real `rote play run
 * princepanchani/gitlab-mr-gate` against gitlab-org/gitlab MR !143468, copied
 * in unedited. The only thing this scene adds is which lines are lit when.
 */

type Callout = {at: number; kicker: string; body: React.ReactNode};

const CALLOUTS: Callout[] = [
  {
    at: 172,
    kicker: 'the verdict',
    body: (
      <>
        One word, one reason, and{' '}
        <span style={{color: C.text}}>one name who has to act next.</span>
      </>
    ),
  },
  {
    at: 352,
    kicker: 'the evidence',
    body: (
      <>
        Every blocker names the API field that proves it —{' '}
        <span style={{fontFamily: F.mono, fontSize: '0.9em', color: C.warn}}>
          blocking_discussions_resolved=false
        </span>
        . Nothing here is inferred.
      </>
    ),
  },
];

export const S06Verdict: React.FC = () => {
  const frame = useCurrentFrame();

  const active = [...CALLOUTS].reverse().find((c) => frame >= c.at) ?? null;

  // Focus follows the callout: verdict block, then the blocker block.
  const focus: [number, number] | null =
    frame >= 352 ? [19, 24] : frame >= 172 ? [11, 18] : null;
  const focusAt = frame >= 352 ? 352 : 172;

  return (
    <AbsoluteFill>
      <Backdrop intensity={0.6} glow={{x: 30, y: 40, color: 'rgba(242,180,65,0.13)'}} />

      <AbsoluteFill style={{padding: '58px 110px', display: 'flex', flexDirection: 'column'}}>
        <SectionTitle label="Real verdict · real merge request" delay={4} />

        <div style={{display: 'flex', gap: 56, marginTop: 34, alignItems: 'flex-start'}}>
          <Terminal
            file="gate-demo.txt"
            title="rote play run princepanchani/gitlab-mr-gate"
            startAt={16}
            lps={15}
            range={[0, 30]}
            rows={30}
            focus={focus}
            focusAt={focusAt}
            fontSize={16}
            width={1000}
          />

          <div style={{flex: 1, paddingTop: 40, minWidth: 380}}>
            {active ? (
              <Callout key={active.at} c={active} />
            ) : (
              <FadeIn delay={20} dur={18}>
                <div style={{fontFamily: F.display, fontSize: 27, color: C.dim, lineHeight: 1.5}}>
                  A real public merge request in{' '}
                  <span style={{fontFamily: F.mono, fontSize: '0.88em', color: C.text}}>
                    gitlab-org/gitlab
                  </span>
                  , gated live.
                </div>
              </FadeIn>
            )}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Callout: React.FC<{c: Callout}> = ({c}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame - c.at, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: cubic,
  });
  return (
    <div style={{opacity: p, transform: `translateX(${(1 - p) * 16}px)`}}>
      <div
        style={{
          fontFamily: F.mono,
          fontSize: 13,
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          color: C.accent,
        }}
      >
        {c.kicker}
      </div>
      <div
        style={{
          fontFamily: F.display,
          fontSize: 31,
          lineHeight: 1.44,
          color: C.dim,
          marginTop: 16,
          fontWeight: 450,
        }}
      >
        {c.body}
      </div>
    </div>
  );
};
