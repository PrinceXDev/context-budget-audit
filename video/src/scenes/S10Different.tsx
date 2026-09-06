import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Backdrop} from '../components/Backdrop';
import {ComparisonRow} from '../components/panels';
import {FadeIn, SectionTitle} from '../components/primitives';
import {C, F} from '../theme';

/**
 * 2:34-2:50. What this is not.
 *
 * Fast, four beats and out. The rows are not knocking the alternatives - each
 * one does its own job well. The point is only that none of them is the one
 * Rote is doing.
 */

const ROWS = [
  {name: 'Chat history', claim: 'remembers the conversation', ok: false, at: 18},
  {name: 'Prompt library', claim: 'remembers the instructions', ok: false, at: 62},
  {name: 'Macro', claim: 'repeats fixed steps, exactly', ok: false, at: 106},
  {name: 'RAG', claim: 'retrieves information', ok: false, at: 150},
  {name: 'Rote', claim: 'remembers a successful way of doing work', ok: true, at: 214},
];

export const S10Different: React.FC = () => (
  <AbsoluteFill>
    <Backdrop intensity={0.62} glow={{x: 50, y: 62}} />

    <AbsoluteFill
      style={{padding: '96px 200px', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}
    >
      <SectionTitle label="What this is not" delay={4} />

      <div style={{display: 'flex', flexDirection: 'column', gap: 14, marginTop: 44}}>
        {ROWS.map((r) => (
          <ComparisonRow
            key={r.name}
            name={r.name}
            claim={r.claim}
            ok={r.ok}
            delay={r.at}
            highlight={r.ok}
          />
        ))}
      </div>

      <FadeIn delay={268} dur={22}>
        <div
          style={{
            marginTop: 46,
            fontFamily: F.display,
            fontSize: 32,
            color: C.dim,
            lineHeight: 1.45,
          }}
        >
          The difference is the verb.{' '}
          <span style={{color: C.text}}>Not what was said — what was done.</span>
        </div>
      </FadeIn>
    </AbsoluteFill>
  </AbsoluteFill>
);
