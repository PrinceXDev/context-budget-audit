import React from 'react';
import {AbsoluteFill, interpolate, Sequence, useCurrentFrame} from 'remotion';
import {AgentGraph} from '../components/AgentGraph';
import {Backdrop} from '../components/Backdrop';
import {Metric} from '../components/panels';
import {Counter, FadeIn, SectionTitle, Typewriter, cubic} from '../components/primitives';
import {C, F} from '../theme';

/**
 * 0:53-1:16. The first run.
 *
 * The command bar is the real invocation, character for character. The graph is
 * the real `depends_on` structure from src/main.ts. The self-check figure is the
 * real one printed by the run captured in public/runs/gate-demo.txt.
 */

const CMD = 'rote play run princepanchani/gitlab-mr-gate';

export const S05FirstRun: React.FC = () => {
  const frame = useCurrentFrame();

  // The clock runs only while the graph is executing, then holds.
  const t = interpolate(frame, [188, 296], [0, 6.1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const clockOn = interpolate(frame, [180, 200], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: cubic,
  });

  const guardP = interpolate(frame, [368, 396], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: cubic,
  });

  return (
    <AbsoluteFill>
      <Backdrop intensity={0.7} glow={{x: 50, y: 34}} />

      <AbsoluteFill style={{padding: '78px 110px', display: 'flex', flexDirection: 'column'}}>
        <SectionTitle label="Live run · real output" delay={4} />

        {/* The command. Nothing is abbreviated - this is the whole invocation. */}
        <FadeIn delay={10} dur={16} style={{marginTop: 26}}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              background: 'rgba(10,12,17,0.9)',
              border: `1px solid ${C.line}`,
              borderRadius: 12,
              padding: '20px 26px',
              width: 'fit-content',
              boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
            }}
          >
            <span style={{fontFamily: F.mono, fontSize: 26, color: C.ok}}>$</span>
            <span style={{fontFamily: F.mono, fontSize: 26, color: C.text, letterSpacing: '-0.01em'}}>
              <Typewriter text={CMD} delay={18} cps={30} />
            </span>
          </div>
        </FadeIn>

        <FadeIn delay={92} dur={16}>
          <div
            style={{
              marginTop: 14,
              fontFamily: F.mono,
              fontSize: 17,
              color: C.faint,
              letterSpacing: '0.02em',
            }}
          >
            no arguments · no token · no setup
          </div>
        </FadeIn>

        {/* The real DAG. */}
        <div style={{marginTop: 26, display: 'flex', alignItems: 'flex-start', gap: 40}}>
          <Sequence from={0} layout="none">
            <AgentGraph startAt={186} scale={0.86} />
          </Sequence>

          <div
            style={{
              opacity: clockOn,
              marginTop: 40,
              display: 'flex',
              flexDirection: 'column',
              gap: 30,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: F.display,
                  fontSize: 58,
                  fontWeight: 600,
                  color: C.text,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.03em',
                }}
              >
                {t.toFixed(1)}s
              </div>
              <div
                style={{
                  fontFamily: F.mono,
                  fontSize: 13,
                  letterSpacing: '0.22em',
                  color: C.faint,
                  textTransform: 'uppercase',
                  marginTop: 4,
                }}
              >
                wall clock
              </div>
            </div>
            <div>
              <div
                style={{
                  fontFamily: F.display,
                  fontSize: 58,
                  fontWeight: 600,
                  color: C.accent,
                  letterSpacing: '-0.03em',
                }}
              >
                <Counter to={9} delay={190} dur={80} />
              </div>
              <div
                style={{
                  fontFamily: F.mono,
                  fontSize: 13,
                  letterSpacing: '0.22em',
                  color: C.faint,
                  textTransform: 'uppercase',
                  marginTop: 4,
                }}
              >
                steps · 4 layers
              </div>
            </div>
          </div>
        </div>

        {/* The guard. This is the differentiating behaviour, so it gets its own
            beat rather than being a line in the report. */}
        <div
          style={{
            marginTop: 'auto',
            opacity: guardP,
            transform: `translateY(${(1 - guardP) * 14}px)`,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 64,
          }}
        >
          <div style={{maxWidth: 720}}>
            <div
              style={{
                fontFamily: F.mono,
                fontSize: 13,
                letterSpacing: '0.26em',
                textTransform: 'uppercase',
                color: C.warn,
              }}
            >
              before any live data is judged
            </div>
            <div
              style={{
                fontFamily: F.display,
                fontSize: 34,
                fontWeight: 450,
                color: C.text,
                marginTop: 12,
                lineHeight: 1.34,
              }}
            >
              The gate tests its own verdict logic first. If one case fails, the verdict is
              withheld entirely.
            </div>
          </div>

          <Metric
            delay={548}
            color={C.ok}
            value={
              <>
                <Counter to={39} delay={552} dur={26} />
                /39
              </>
            }
            label="self-check cases passed"
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
