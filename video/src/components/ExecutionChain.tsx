import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, F} from '../theme';
import {cubic} from './primitives';

/**
 * The rediscovery chain from the problem scene: an agent groping toward an
 * answer it has already found once before.
 *
 * Illustrative by design - this is the "before" story, not a recording of any
 * product. It is drawn as abstract pills precisely so it cannot be mistaken for
 * real tool output.
 */

export type Step = {label: string; kind: 'work' | 'fail' | 'win'};

export const ExecutionChain: React.FC<{
  steps: Step[];
  startAt?: number;
  every?: number;
  size?: number;
}> = ({steps, startAt = 0, every = 15, size = 1}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 14 * size, flexWrap: 'nowrap'}}>
      {steps.map((st, i) => {
        const at = startAt + i * every;
        const s = spring({frame: frame - at, fps, config: {damping: 19, mass: 0.5}});
        if (s <= 0.001) return <div key={i} style={{width: 0}} />;

        const color =
          st.kind === 'fail' ? C.danger : st.kind === 'win' ? C.ok : C.dim;
        const bg =
          st.kind === 'fail' ? C.dangerSoft : st.kind === 'win' ? C.okSoft : 'rgba(255,255,255,0.03)';

        // A failed attempt gives a small shake as it lands - the only place in
        // the piece that uses a nervous motion, and it is the point of it.
        const shake =
          st.kind === 'fail'
            ? Math.sin((frame - at) * 1.5) * Math.max(0, 1 - (frame - at) / 12) * 4
            : 0;

        return (
          <React.Fragment key={i}>
            {i > 0 ? (
              <div
                style={{
                  width: 26 * size,
                  height: 1,
                  background: C.lineStrong,
                  opacity: s,
                  flexShrink: 0,
                }}
              />
            ) : null}
            <div
              style={{
                opacity: s,
                transform: `translateY(${(1 - s) * 12}px) translateX(${shake}px) scale(${
                  0.94 + s * 0.06
                })`,
                fontFamily: F.mono,
                fontSize: 19 * size,
                letterSpacing: '0.1em',
                color,
                background: bg,
                border: `1px solid ${st.kind === 'work' ? C.line : color}`,
                borderRadius: 8,
                padding: `${10 * size}px ${18 * size}px`,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {st.label}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

/** The cost ticker that runs alongside the chain. */
export const CostBar: React.FC<{
  startAt?: number;
  dur?: number;
  tokens: number;
  calls: number;
  seconds: number;
  label?: string;
}> = ({startAt = 0, dur = 120, tokens, calls, seconds, label = 'cost of rediscovery'}) => {
  const frame = useCurrentFrame();
  const f = frame - startAt;
  const p = interpolate(f, [0, dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: cubic,
  });
  const o = interpolate(f, [0, 14], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  const items = [
    {v: Math.round(tokens * p).toLocaleString('en-US'), l: 'tokens'},
    {v: Math.round(calls * p).toString(), l: 'tool calls'},
    {v: `${(seconds * p).toFixed(0)}s`, l: 'elapsed'},
  ];

  return (
    <div style={{opacity: o, display: 'flex', flexDirection: 'column', gap: 14}}>
      <div
        style={{
          fontFamily: F.mono,
          fontSize: 13,
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          color: C.faint,
        }}
      >
        {label}
      </div>
      <div style={{display: 'flex', gap: 54}}>
        {items.map((it) => (
          <div key={it.l} style={{display: 'flex', flexDirection: 'column', gap: 4}}>
            <div
              style={{
                fontFamily: F.display,
                fontSize: 46,
                fontWeight: 600,
                color: C.warn,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.02em',
              }}
            >
              {it.v}
            </div>
            <div style={{fontFamily: F.mono, fontSize: 14, color: C.faint}}>{it.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
