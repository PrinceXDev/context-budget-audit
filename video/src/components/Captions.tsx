import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {C, F} from '../theme';
import {SCRIPT, type Line} from '../script';
import {SHOW_CAPTIONS} from '../config';
import {cubic} from './primitives';

/**
 * Subtitles for the narration.
 *
 * Deliberately not karaoke: the whole line lands at once and holds, because a
 * word-by-word highlight makes a viewer read at the renderer's pace instead of
 * their own. Emphasis comes from colour on the one phrase that carries the
 * sentence, set in `script.ts`.
 */

/** Split a line on its emphasis phrases, keeping them as marked segments.
 *  Case-insensitive, first match wins, and a phrase that is not present is
 *  simply ignored rather than throwing - the script is edited by hand. */
const segment = (line: Line): {text: string; hot: boolean}[] => {
  const phrases = (line.emphasis ?? []).filter((p) => p.trim().length > 0);
  let parts: {text: string; hot: boolean}[] = [{text: line.text, hot: false}];

  for (const phrase of phrases) {
    const next: {text: string; hot: boolean}[] = [];
    for (const part of parts) {
      if (part.hot) {
        next.push(part);
        continue;
      }
      const i = part.text.toLowerCase().indexOf(phrase.toLowerCase());
      if (i === -1) {
        next.push(part);
        continue;
      }
      if (i > 0) next.push({text: part.text.slice(0, i), hot: false});
      next.push({text: part.text.slice(i, i + phrase.length), hot: true});
      const rest = part.text.slice(i + phrase.length);
      if (rest) next.push({text: rest, hot: false});
    }
    parts = next;
  }
  return parts;
};

export const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  if (!SHOW_CAPTIONS) return null;

  const line = SCRIPT.find((l) => frame >= l.from - 4 && frame < l.from + l.dur + 8);
  if (!line) return null;

  const local = frame - line.from;
  const inP = interpolate(local, [-4, 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: cubic,
  });
  const outP = interpolate(local, [line.dur - 6, line.dur + 8], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: cubic,
  });
  const o = Math.min(inP, outP);

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 46,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          // Keeps the text clear of the presenter portrait in the corner.
          marginRight: 210,
          padding: '0 40px',
          textAlign: 'center',
          opacity: o,
          transform: `translateY(${(1 - o) * 10}px)`,
        }}
      >
        <span
          style={{
            fontFamily: F.display,
            fontSize: 35,
            lineHeight: 1.32,
            fontWeight: 450,
            letterSpacing: '-0.008em',
            color: C.text,
            textShadow: '0 2px 22px rgba(0,0,0,0.9), 0 0 60px rgba(0,0,0,0.6)',
          }}
        >
          {segment(line).map((s, i) =>
            s.hot ? (
              <strong key={i} style={{color: C.accent, fontWeight: 650}}>
                {s.text}
              </strong>
            ) : (
              <span key={i}>{s.text}</span>
            ),
          )}
        </span>
      </div>
    </div>
  );
};
