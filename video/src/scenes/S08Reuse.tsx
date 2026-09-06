import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Backdrop} from '../components/Backdrop';
import {RoteMark} from '../components/Logo';
import {Terminal} from '../components/Terminal';
import {FadeIn, SectionTitle, Typewriter, cubic} from '../components/primitives';
import {C, F} from '../theme';

/**
 * 1:52-2:18. The moment the piece exists for.
 *
 * Same published Play, an input it has never seen, and an execution that comes
 * out DIFFERENT - one blocker became three, in a different order, with two
 * honest unknowns. Both terminal files are real captured runs, so the contrast
 * on screen is a contrast the product actually produced.
 */

const CMD = 'rote play run princepanchani/gitlab-mr-gate project=gitlab-org/cli mr=2912';

const HANDOFF = 300;

export const S08Reuse: React.FC = () => {
  const frame = useCurrentFrame();

  const aOut = interpolate(frame, [HANDOFF - 26, HANDOFF], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: cubic,
  });
  const bIn = interpolate(frame, [HANDOFF - 6, HANDOFF + 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: cubic,
  });

  return (
    <AbsoluteFill>
      <Backdrop intensity={0.85} glow={{x: 50, y: 34, color: 'rgba(56,225,176,0.16)'}} />

      {aOut > 0 ? (
        <AbsoluteFill style={{opacity: aOut}}>
          <StageA />
        </AbsoluteFill>
      ) : null}

      {bIn > 0 ? (
        <AbsoluteFill style={{opacity: bIn}}>
          <StageB />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

/** The new task arrives, and the Play is retrieved rather than rebuilt. */
const StageA: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const chips = [
    'different project',
    'different merge request',
    'a problem this Play has never seen',
  ];

  const hit = spring({frame: frame - 226, fps, config: {damping: 15, mass: 0.6}});

  return (
    <AbsoluteFill
      style={{
        padding: '90px 120px 200px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <SectionTitle label="The same kind of task, again" delay={4} />

      <FadeIn delay={14} dur={18} style={{marginTop: 46}}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            background: 'rgba(10,12,17,0.9)',
            border: `1px solid ${C.line}`,
            borderRadius: 12,
            padding: '22px 28px',
            width: 'fit-content',
            maxWidth: 1500,
            boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
          }}
        >
          <span style={{fontFamily: F.mono, fontSize: 25, color: C.ok}}>$</span>
          <span style={{fontFamily: F.mono, fontSize: 25, color: C.text}}>
            <Typewriter text={CMD} delay={22} cps={38} />
          </span>
        </div>
      </FadeIn>

      <div style={{display: 'flex', gap: 16, marginTop: 40}}>
        {chips.map((c, i) => (
          <FadeIn key={c} delay={150 + i * 16} dur={16}>
            <div
              style={{
                fontFamily: F.mono,
                fontSize: 18,
                color: C.warn,
                background: C.warnSoft,
                border: `1px solid rgba(242,180,65,0.3)`,
                borderRadius: 24,
                padding: '10px 22px',
              }}
            >
              {c}
            </div>
          </FadeIn>
        ))}
      </div>

      {/* Retrieval. Not a search, not a rediscovery - an exact version resolved
          from the registry and reused. */}
      <div
        style={{
          marginTop: 80,
          opacity: hit,
          transform: `translateY(${(1 - hit) * 22}px) scale(${0.96 + hit * 0.04})`,
          display: 'flex',
          alignItems: 'center',
          gap: 26,
          background: C.okSoft,
          border: `1px solid rgba(56,225,176,0.34)`,
          borderRadius: 16,
          padding: '26px 34px',
          width: 'fit-content',
        }}
      >
        <RoteMark size={54} progress={Math.min(1, Math.max(0, (frame - 226) / 30))} />
        <div>
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 13,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              color: C.ok,
            }}
          >
            memory hit
          </div>
          <div style={{fontFamily: F.mono, fontSize: 27, color: C.text, marginTop: 8}}>
            princepanchani/gitlab-mr-gate@1.3.2
          </div>
          <div style={{fontFamily: F.display, fontSize: 20, color: C.dim, marginTop: 8}}>
            reused, not rediscovered
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** The adapted execution, beside the one it was learned from. */
const StageB: React.FC = () => {
  const frame = useCurrentFrame();
  const f = frame - HANDOFF;

  const focus: [number, number] | null = f >= 340 ? [30, 41] : f >= 170 ? [13, 29] : null;
  const focusAt = f >= 340 ? HANDOFF + 340 : HANDOFF + 170;

  return (
    <AbsoluteFill style={{padding: '56px 100px', display: 'flex', flexDirection: 'column'}}>
      <SectionTitle label="Adapted, not replayed" delay={HANDOFF + 6} />

      <div style={{display: 'flex', gap: 48, marginTop: 26, alignItems: 'flex-start'}}>
        <Terminal
          file="gate-cli-2912.txt"
          title="same Play · gitlab-org/cli !2912"
          startAt={HANDOFF + 10}
          lps={17}
          range={[0, 44]}
          rows={31}
          focus={focus}
          focusAt={focusAt}
          fontSize={16}
          width={980}
        />

        <div style={{flex: 1, minWidth: 420, paddingTop: 10}}>
          <Delta />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ROWS: {label: string; a: string; b: string; at: number; hot?: boolean}[] = [
  {label: 'merge request', a: 'gitlab/!143468', b: 'cli/!2912', at: 120},
  {label: 'blockers', a: '1', b: '3', at: 178, hot: true},
  {label: 'first move', a: 'resolve threads', b: 'fix conflicts', at: 236},
  {label: 'merge path', a: '1 step', b: '3 steps, ordered', at: 294, hot: true},
  {label: 'not measured', a: '0', b: '2, named', at: 352},
];

const Delta: React.FC = () => {
  const frame = useCurrentFrame();
  const f = frame - HANDOFF;

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '160px 1fr 1fr',
          gap: '0 18px',
          fontFamily: F.mono,
          fontSize: 13,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: C.faint,
          paddingBottom: 14,
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        <div />
        <div>learned from</div>
        <div style={{color: C.ok}}>this run</div>
      </div>

      {ROWS.map((r) => {
        const p = interpolate(f - r.at, [0, 16], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: cubic,
        });
        return (
          <div
            key={r.label}
            style={{
              opacity: p,
              transform: `translateX(${(1 - p) * 14}px)`,
              display: 'grid',
              gridTemplateColumns: '160px 1fr 1fr',
              gap: '0 18px',
              alignItems: 'baseline',
              padding: '17px 0',
              borderBottom: `1px solid ${C.line}`,
            }}
          >
            <div style={{fontFamily: F.mono, fontSize: 14, color: C.faint}}>{r.label}</div>
            <div style={{fontFamily: F.mono, fontSize: 20, color: C.ghost}}>{r.a}</div>
            <div
              style={{
                fontFamily: F.mono,
                fontSize: r.hot ? 24 : 20,
                color: r.hot ? C.ok : C.text,
                fontWeight: r.hot ? 600 : 400,
              }}
            >
              {r.b}
            </div>
          </div>
        );
      })}

      <FadeIn delay={HANDOFF + 400} dur={20}>
        <div
          style={{
            marginTop: 30,
            fontFamily: F.display,
            fontSize: 27,
            lineHeight: 1.46,
            color: C.text,
          }}
        >
          The Play did not repeat an answer.
          <br />
          <span style={{color: C.ok}}>It applied a method.</span>
        </div>
      </FadeIn>
    </div>
  );
};
