import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {Backdrop} from '../components/Backdrop';
import {PlayCard} from '../components/panels';
import {FadeIn, SectionTitle, cubic} from '../components/primitives';
import {C, F} from '../theme';

/**
 * 0:40-0:53. What was actually submitted.
 *
 * Every value on these cards is real registry data, taken from
 * `rote play search "gitlab" --source registry` - the raw output is in
 * public/runs/registry-search.txt.
 */
export const S04WhatIBuilt: React.FC = () => {
  const frame = useCurrentFrame();

  const proof = interpolate(frame, [286, 314], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: cubic,
  });

  return (
    <AbsoluteFill>
      <Backdrop intensity={0.75} glow={{x: 50, y: 24}} />

      <AbsoluteFill
        style={{
          padding: '80px 120px 190px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <SectionTitle label="The entry" delay={6} />

        <FadeIn delay={16} dur={20}>
          <div
            style={{
              marginTop: 22,
              fontFamily: F.display,
              fontSize: 52,
              fontWeight: 500,
              letterSpacing: '-0.025em',
              color: C.text,
            }}
          >
            Two published Plays. One question each.
          </div>
        </FadeIn>

        <div style={{display: 'flex', gap: 44, marginTop: 58}}>
          <PlayCard
            delay={44}
            width={680}
            name="gitlab-mr-gate"
            version="v1.3.2"
            owner="princepanchani"
            downloads={4}
            rank="#2 for “gitlab”"
            summary="Can this merge request merge? If not, what blocks it — and whose move is it?"
            tags={['platform-gitlab', 'job-merge-readiness', 'effect-read-only', '9 steps · 4 layers']}
          />
          <PlayCard
            delay={70}
            width={680}
            accent={C.ok}
            name="gitlab-mr-queue"
            version="v1.3.1"
            owner="princepanchani"
            downloads={2}
            rank="#1 for “gitlab”"
            summary="Across every open merge request, whose move is it — and how long has it been waiting?"
            tags={['platform-gitlab', 'job-triage', 'effect-read-only', 'for_each fan-out']}
          />
        </div>

        <div
          style={{
            marginTop: 64,
            opacity: proof,
            transform: `translateY(${(1 - proof) * 10}px)`,
            display: 'flex',
            alignItems: 'center',
            gap: 18,
          }}
        >
          <div style={{width: 34, height: 1, background: C.lineStrong}} />
          <div style={{fontFamily: F.display, fontSize: 26, color: C.dim}}>
            Every other merge-readiness Play in the registry targets GitHub.{' '}
            <span style={{color: C.text}}>These two own “gitlab”.</span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
