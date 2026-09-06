import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {Backdrop} from '../components/Backdrop';
import {CostBar, ExecutionChain, type Step} from '../components/ExecutionChain';
import {FadeIn, Rule, SectionTitle, cubic} from '../components/primitives';
import {C, F} from '../theme';

/**
 * 0:10-0:28. The same task, twice, with nothing carried between them.
 *
 * The two chains are deliberately identical down to the counters. The point of
 * the scene is that the second run is not cheaper than the first, and the only
 * honest way to show that is to show the same numbers twice.
 */

const RUN: Step[] = [
  {label: 'TASK', kind: 'work'},
  {label: 'SEARCH', kind: 'work'},
  {label: 'TRY', kind: 'work'},
  {label: 'FAIL', kind: 'fail'},
  {label: 'SEARCH', kind: 'work'},
  {label: 'TRY', kind: 'work'},
  {label: 'SUCCESS', kind: 'win'},
];

const RunRow: React.FC<{when: string; startAt: number; costAt: number; fade?: number}> = ({
  when,
  startAt,
  costAt,
  fade = 1,
}) => (
  <div
    style={{
      opacity: fade,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 70,
    }}
  >
    <div style={{display: 'flex', flexDirection: 'column', gap: 24}}>
      <FadeIn delay={startAt - 8} dur={14}>
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 17,
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: C.faint,
          }}
        >
          {when}
        </div>
      </FadeIn>
      <ExecutionChain steps={RUN} startAt={startAt} every={15} size={1.16} />
    </div>

    <CostBar startAt={costAt} dur={64} tokens={41200} calls={17} seconds={94} label="" />
  </div>
);

export const S02Problem: React.FC = () => {
  const frame = useCurrentFrame();

  // The first run recedes once the second is running, so the eye compares
  // rather than re-reads.
  const dim1 = interpolate(frame, [268, 300], [1, 0.4], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: cubic,
  });

  const verdictP = interpolate(frame, [446, 478], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: cubic,
  });

  return (
    <AbsoluteFill>
      <Backdrop intensity={0.7} glow={{x: 26, y: 34, color: 'rgba(242,180,65,0.15)'}} />

      <AbsoluteFill
        style={{
          padding: '84px 130px 200px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <SectionTitle label="The problem" delay={8} />

        <div style={{marginTop: 62, display: 'flex', flexDirection: 'column', gap: 54}}>
          <RunRow when="First time the task appears" startAt={30} costAt={140} fade={dim1} />

          <Rule delay={252} color={C.line} />

          <RunRow when="Same task. Next week." startAt={278} costAt={390} />
        </div>

        <div
          style={{
            marginTop: 76,
            opacity: verdictP,
            transform: `translateY(${(1 - verdictP) * 14}px)`,
            fontFamily: F.display,
            fontSize: 46,
            fontWeight: 500,
            letterSpacing: '-0.025em',
            color: C.text,
          }}
        >
          Nothing from the first run survived into the second.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
