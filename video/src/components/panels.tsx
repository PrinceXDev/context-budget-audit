import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, F} from '../theme';
import {cubic} from './primitives';

/** A published Play, drawn as an artifact card. All values are real registry
 *  data from `rote play search "gitlab" --source registry`. */
export const PlayCard: React.FC<{
  name: string;
  version: string;
  owner: string;
  summary: string;
  tags: string[];
  downloads?: number;
  delay?: number;
  rank?: string;
  accent?: string;
  width?: number;
}> = ({name, version, owner, summary, tags, downloads, delay = 0, rank, accent = C.accent, width = 560}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - delay, fps, config: {damping: 18, mass: 0.7}});

  return (
    <div
      style={{
        width,
        opacity: s,
        transform: `translateY(${(1 - s) * 26}px)`,
        background: `linear-gradient(180deg, ${C.panelTop}, ${C.panel})`,
        borderRadius: 16,
        boxShadow: `0 0 0 1px ${C.line}, 0 30px 70px rgba(0,0,0,0.5)`,
        padding: '26px 30px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, ${accent}, transparent 72%)`,
        }}
      />
      <div style={{display: 'flex', alignItems: 'baseline', gap: 12}}>
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 32,
            color: C.text,
            fontWeight: 500,
            letterSpacing: '-0.01em',
          }}
        >
          {name}
        </div>
        <div style={{fontFamily: F.mono, fontSize: 19, color: accent}}>{version}</div>
        {rank ? (
          <div
            style={{
              marginLeft: 'auto',
              fontFamily: F.mono,
              fontSize: 13,
              letterSpacing: '0.16em',
              color: C.faint,
              border: `1px solid ${C.line}`,
              borderRadius: 6,
              padding: '3px 9px',
            }}
          >
            {rank}
          </div>
        ) : null}
      </div>

      <div style={{fontFamily: F.mono, fontSize: 16, color: C.faint, marginTop: 8}}>
        {owner} · public
        {downloads !== undefined ? ` · ${downloads} downloads` : ''}
      </div>

      <div
        style={{
          fontFamily: F.display,
          fontSize: 23,
          lineHeight: 1.46,
          color: C.dim,
          marginTop: 20,
          minHeight: 100,
        }}
      >
        {summary}
      </div>

      <div style={{display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18}}>
        {tags.map((t, i) => {
          const p = interpolate(frame - delay - 14 - i * 3, [0, 12], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: cubic,
          });
          return (
            <div
              key={t}
              style={{
                opacity: p,
                fontFamily: F.mono,
                fontSize: 13,
                color: C.dim,
                background: 'rgba(255,255,255,0.035)',
                border: `1px solid ${C.line}`,
                borderRadius: 20,
                padding: '5px 12px',
              }}
            >
              {t}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** A single number that should land hard. */
export const Metric: React.FC<{
  value: React.ReactNode;
  label: string;
  sub?: string;
  delay?: number;
  color?: string;
}> = ({value, label, sub, delay = 0, color = C.text}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - delay, fps, config: {damping: 17, mass: 0.6}});
  return (
    <div
      style={{
        opacity: s,
        transform: `translateY(${(1 - s) * 16}px)`,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div
        style={{
          fontFamily: F.display,
          fontSize: 62,
          fontWeight: 600,
          letterSpacing: '-0.03em',
          color,
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: F.mono,
          fontSize: 14,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: C.faint,
        }}
      >
        {label}
      </div>
      {sub ? (
        <div style={{fontFamily: F.display, fontSize: 17, color: C.dim, maxWidth: 300}}>{sub}</div>
      ) : null}
    </div>
  );
};

/** One line of the differentiation table. */
export const ComparisonRow: React.FC<{
  name: string;
  claim: string;
  ok: boolean;
  delay?: number;
  highlight?: boolean;
}> = ({name, claim, ok, delay = 0, highlight = false}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - delay, fps, config: {damping: 20, mass: 0.6}});

  return (
    <div
      style={{
        opacity: s,
        transform: `translateX(${(1 - s) * -22}px)`,
        display: 'grid',
        gridTemplateColumns: '330px 44px 1fr',
        alignItems: 'center',
        gap: 26,
        padding: '20px 30px',
        borderRadius: 12,
        background: highlight ? C.okSoft : 'transparent',
        boxShadow: highlight ? `0 0 0 1px rgba(56,225,176,0.32)` : `0 0 0 1px ${C.line}`,
      }}
    >
      <div
        style={{
          fontFamily: F.mono,
          fontSize: 22,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: highlight ? C.ok : C.dim,
          fontWeight: highlight ? 600 : 400,
        }}
      >
        {name}
      </div>
      <div
        style={{
          fontFamily: F.display,
          fontSize: 26,
          color: ok ? C.ok : C.faint,
          textAlign: 'center',
        }}
      >
        {ok ? '✓' : '✕'}
      </div>
      <div
        style={{
          fontFamily: F.display,
          fontSize: 25,
          color: highlight ? C.text : C.dim,
          fontWeight: highlight ? 500 : 400,
        }}
      >
        {claim}
      </div>
    </div>
  );
};
