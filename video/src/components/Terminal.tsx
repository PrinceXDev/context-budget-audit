import React, {useEffect, useState} from 'react';
import {
  cancelRender,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import {C, F} from '../theme';
import {cubic} from './primitives';

/**
 * Replays a real captured run.
 *
 * The text is loaded from public/runs/*.txt - those files are stdout from
 * actual `rote play run` invocations, copied in verbatim. Nothing here
 * generates or embellishes output; the only thing this component decides is
 * WHEN each line appears and which tokens get colour. That distinction matters
 * for a demo: everything inside this frame is product behaviour, and the motion
 * graphics that explain it live outside the window.
 */

export const useRunText = (file: string): string[] => {
  const [lines, setLines] = useState<string[]>([]);
  const [handle] = useState(() => delayRender(`load ${file}`));

  useEffect(() => {
    fetch(staticFile(`runs/${file}`))
      .then((r) => r.text())
      .then((t) => {
        setLines(t.replace(/\r\n/g, '\n').split('\n'));
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [file, handle]);

  return lines;
};

/** Colour rules, applied to a whole line first, then to tokens within it. */
const lineColor = (l: string): string | null => {
  const t = l.trim();
  if (/^VERDICT: (BLOCKED|NOT OPEN|UNAVAILABLE)/.test(t)) return C.warn;
  if (/^VERDICT: PASS/.test(t)) return C.ok;
  if (/^(GITLAB MR GATE|GITLAB MR QUEUE|ROTE PLAY)$/.test(t)) return C.text;
  if (/^(BLOCKERS|MERGE PATH|NOT MEASURED|STAGE LEDGER|GITLAB SAYS|SELF-CHECK|VERIFY|ROT LEDGER|REVIEW LOAD|WAITING ON|LISTED BUT NOT GATED)/.test(t))
    return C.accent;
  if (t.startsWith('DEMO RUN')) return C.faint;
  if (t.startsWith('?')) return C.faint;
  return null;
};

const TOKENS: {re: RegExp; color: string; bold?: boolean}[] = [
  {re: /\bCONFIRMED\b/g, color: C.ok, bold: true},
  {re: /\bCONTRADICTED\b/g, color: C.danger, bold: true},
  {re: /\b39\/39\b/g, color: C.ok, bold: true},
  {re: /<< STALE/g, color: C.warn},
  {re: /\b(success)\b/g, color: C.ok},
  {re: /\b(failed|conflict|has_conflicts=true)\b/g, color: C.danger},
  {re: /\bnot read\b/g, color: C.warn},
  {re: /https?:\/\/\S+/g, color: C.accent},
  {re: /\[[a-z_]+\]/g, color: C.accent},
  {re: /![0-9]+/g, color: C.text},
];

const Line: React.FC<{text: string; dim?: boolean}> = ({text, dim}) => {
  const base = lineColor(text) ?? C.dim;

  // Build non-overlapping coloured spans. Earlier rules win, which is why the
  // specific ones (CONFIRMED, 39/39) are listed before the generic ones.
  type Mark = {start: number; end: number; color: string; bold?: boolean};
  const marks: Mark[] = [];
  for (const {re, color, bold} of TOKENS) {
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (marks.some((k) => start < k.end && end > k.start)) continue;
      marks.push({start, end, color, bold});
    }
  }
  marks.sort((a, b) => a.start - b.start);

  const out: React.ReactNode[] = [];
  let cur = 0;
  marks.forEach((k, i) => {
    if (k.start > cur) out.push(<span key={`p${i}`}>{text.slice(cur, k.start)}</span>);
    out.push(
      <span key={`m${i}`} style={{color: k.color, fontWeight: k.bold ? 700 : 400}}>
        {text.slice(k.start, k.end)}
      </span>,
    );
    cur = k.end;
  });
  if (cur < text.length) out.push(<span key="tail">{text.slice(cur)}</span>);

  return (
    <div
      style={{
        color: base,
        opacity: dim ? 0.28 : 1,
        whiteSpace: 'pre',
        minHeight: '1.52em',
        transition: 'none',
      }}
    >
      {out.length ? out : ' '}
    </div>
  );
};

export type TerminalProps = {
  file: string;
  /** Frame at which the first line prints. */
  startAt?: number;
  /** Lines printed per second. */
  lps?: number;
  /** Print only this slice of the file. */
  range?: [number, number];
  /** Dim everything except this slice, once printing has passed it. */
  focus?: [number, number] | null;
  /** Frame at which the focus dimming fades in. */
  focusAt?: number;
  /** Rows visible before the view starts following the newest line. */
  rows?: number;
  title?: string;
  fontSize?: number;
  width?: number | string;
  height?: number | string;
  style?: React.CSSProperties;
};

export const Terminal: React.FC<TerminalProps> = ({
  file,
  startAt = 0,
  lps = 34,
  range,
  focus = null,
  focusAt = 0,
  rows = 26,
  title,
  fontSize = 21,
  width = 1240,
  height,
  style,
}) => {
  const frame = useCurrentFrame();
  const all = useRunText(file);
  const lines = range ? all.slice(range[0], range[1]) : all;

  const elapsed = Math.max(0, frame - startAt);
  const printed = Math.min(lines.length, Math.floor((elapsed / 30) * lps));

  const lineH = fontSize * 1.52;

  // Follow the newest line once the buffer is taller than the window, so the
  // last thing printed is always the thing on screen.
  const overflow = Math.max(0, printed - rows);
  const scroll = interpolate(overflow, [0, Math.max(1, lines.length)], [0, lineH * Math.max(1, lines.length)], {
    extrapolateRight: 'clamp',
  });

  const dimP = focus
    ? interpolate(frame, [focusAt, focusAt + 16], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: cubic,
      })
    : 0;

  return (
    <div
      style={{
        width,
        height: height ?? rows * lineH + 62,
        borderRadius: 14,
        background: 'rgba(10,12,17,0.92)',
        boxShadow: `0 0 0 1px ${C.line}, 0 40px 90px rgba(0,0,0,0.55)`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        backdropFilter: 'blur(6px)',
        ...style,
      }}
    >
      <div
        style={{
          height: 42,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '0 18px',
          background: C.panelTop,
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        {[C.ghost, C.ghost, C.ghost].map((c, i) => (
          <div key={i} style={{width: 11, height: 11, borderRadius: '50%', background: c}} />
        ))}
        <div
          style={{
            marginLeft: 14,
            fontFamily: F.mono,
            fontSize: 15,
            color: C.faint,
            letterSpacing: '0.02em',
          }}
        >
          {title ?? file}
        </div>
      </div>

      <div style={{flex: 1, overflow: 'hidden', padding: '12px 22px'}}>
        <div
          style={{
            fontFamily: F.mono,
            fontSize,
            lineHeight: 1.52,
            transform: `translateY(${-scroll}px)`,
          }}
        >
          {lines.slice(0, printed).map((l, i) => {
            const inFocus = !focus || (i >= focus[0] && i < focus[1]);
            return <Line key={i} text={l} dim={!inFocus && dimP > 0.5} />;
          })}
        </div>
      </div>
    </div>
  );
};
