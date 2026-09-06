import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {C, F} from '../theme';
import {cubic} from './primitives';

/**
 * A code panel with a travelling highlight band.
 *
 * Used to walk the real frontmatter of src/main.ts. The lines passed in are
 * copied from that file, so what is on screen is the actual declaration the
 * published Play carries.
 */

export type Band = {from: number; to: number; at: number; note: string};

const tint = (l: string): React.ReactNode => {
  // YAML-ish: key before a colon, then the value. Comments dimmed. Enough to
  // read as code without pulling in a highlighter.
  const comment = l.match(/^(\s*)(#.*)$/);
  if (comment)
    return (
      <>
        {comment[1]}
        <span style={{color: C.ghost}}>{comment[2]}</span>
      </>
    );

  const kv = l.match(/^(\s*-?\s*)([A-Za-z_][\w.]*)(:)(.*)$/);
  if (kv)
    return (
      <>
        {kv[1]}
        <span style={{color: C.accent}}>{kv[2]}</span>
        <span style={{color: C.faint}}>{kv[3]}</span>
        <span style={{color: C.text}}>{kv[4]}</span>
      </>
    );

  return <span style={{color: C.dim}}>{l}</span>;
};

/** The band in force at a given local frame, or null before the first one. */
export const activeBand = (bands: Band[], localFrame: number): Band | null =>
  [...bands].reverse().find((b) => localFrame >= b.at) ?? null;

export const CodeWindow: React.FC<{
  title: string;
  lines: string[];
  bands?: Band[];
  startAt?: number;
  fontSize?: number;
  width?: number;
  /** Render the band's note under the window. Off when the scene places its
   *  own annotation alongside instead - a tall listing has no room below. */
  hideAnnotation?: boolean;
}> = ({title, lines, bands = [], startAt = 0, fontSize = 19, width = 900, hideAnnotation = false}) => {
  const frame = useCurrentFrame();
  const f = frame - startAt;
  const lineH = fontSize * 1.62;

  const open = interpolate(f, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: cubic,
  });

  const active = activeBand(bands, f);

  return (
    <div style={{position: 'relative', width, opacity: open, transform: `translateY(${(1 - open) * 18}px)`}}>
      <div
        style={{
          borderRadius: 14,
          background: 'rgba(10,12,17,0.94)',
          boxShadow: `0 0 0 1px ${C.line}, 0 34px 80px rgba(0,0,0,0.55)`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: 40,
            display: 'flex',
            alignItems: 'center',
            padding: '0 18px',
            gap: 9,
            background: C.panelTop,
            borderBottom: `1px solid ${C.line}`,
            fontFamily: F.mono,
            fontSize: 14,
            color: C.faint,
          }}
        >
          {title}
        </div>

        <div style={{position: 'relative', padding: '16px 0'}}>
          {active ? (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 16 + active.from * lineH,
                height: (active.to - active.from) * lineH,
                background: C.accentSoft,
                borderLeft: `2px solid ${C.accent}`,
                transition: 'none',
              }}
            />
          ) : null}

          <div style={{position: 'relative', fontFamily: F.mono, fontSize, lineHeight: 1.62}}>
            {lines.map((l, i) => {
              const shown = interpolate(f - 8 - i * 1.6, [0, 10], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              const inBand = active && i >= active.from && i < active.to;
              return (
                <div
                  key={i}
                  style={{
                    padding: '0 26px',
                    whiteSpace: 'pre',
                    opacity: shown * (active ? (inBand ? 1 : 0.34) : 1),
                  }}
                >
                  {tint(l)}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {active && !hideAnnotation ? (
        <Annotation key={active.note} note={active.note} at={active.at} startAt={startAt} />
      ) : null}
    </div>
  );
};

const Annotation: React.FC<{note: string; at: number; startAt: number}> = ({note, at, startAt}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame - startAt - at, [0, 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: cubic,
  });
  return (
    <div
      style={{
        marginTop: 26,
        opacity: p,
        transform: `translateY(${(1 - p) * 8}px)`,
        fontFamily: F.display,
        fontSize: 27,
        lineHeight: 1.42,
        color: C.text,
        fontWeight: 450,
      }}
    >
      {note}
    </div>
  );
};
