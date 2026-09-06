import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {Backdrop} from '../components/Backdrop';
import {CodeWindow, activeBand, type Band} from '../components/CodeWindow';
import {SectionTitle, cubic} from '../components/primitives';
import {C, F} from '../theme';

/**
 * 1:32-1:52. The anatomy of a Play.
 *
 * Excerpted verbatim from the frontmatter of src/main.ts - the same declaration
 * the published package carries. Trimmed for the frame, never reworded, and no
 * field appears here that the real Play does not have.
 */

const LINES = [
  'name: gitlab-mr-gate',
  'version: 1.3.2',
  'source_url: https://play.modiqo.ai/princepanchani/gitlab-mr-gate',
  '',
  'parameters:',
  '- name: project',
  "  default: gitlab-org/gitlab",
  '- name: mr',
  "  default: '143468'",
  '',
  'steps:',
  '  self_check:',
  '    argv: [python3, selfcheck.py, verdict.py]',
  '  validate_input:',
  '    argv: [python3, validate.py, $project, $mr]',
  '  fetch_mr:',
  '    depends_on: [validate_input]',
  '  compute_verdict:',
  '    depends_on: [self_check, fetch_mr, fetch_approvals,',
  '                 fetch_approval_state, fetch_pipelines,',
  '                 fetch_discussions]',
  '  verify:',
  '    depends_on: [compute_verdict]',
  '',
  'output:',
  '  schema:',
  '    verdict, headline, whose_move, merge_path,',
  '    blockers, unknowns, stages, facts,',
  '    self_check, verify',
];

const BANDS: Band[] = [
  {
    from: 0,
    to: 3,
    at: 26,
    note: 'Identity and an exact version. Registry versions are immutable — the Play an agent reused last month is byte-for-byte the one it reuses today.',
  },
  {
    from: 4,
    to: 9,
    at: 160,
    note: 'The inputs it adapts to. The memory is fixed; the merge request is not.',
  },
  {
    from: 10,
    to: 23,
    at: 300,
    note: 'depends_on is memory of order — what had to happen before what. Worked out once, written down, never re-derived.',
  },
  {
    from: 24,
    to: 29,
    at: 452,
    note: 'A fixed output shape. Every run returns the same keys, so the next agent can read the result without guessing at it.',
  },
];

export const S07WhatIsAPlay: React.FC = () => {
  const frame = useCurrentFrame();
  const band = activeBand(BANDS, frame);

  const headP = interpolate(frame, [8, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: cubic,
  });

  return (
    <AbsoluteFill>
      <Backdrop intensity={0.7} glow={{x: 72, y: 40}} />

      <AbsoluteFill style={{padding: '70px 110px', display: 'flex', flexDirection: 'column'}}>
        <SectionTitle label="What a Play actually is" delay={4} />

        <div style={{display: 'flex', gap: 70, marginTop: 30, alignItems: 'flex-start'}}>
          <CodeWindow
            title="gitlab-mr-gate · frontmatter (excerpt)"
            lines={LINES}
            bands={BANDS}
            startAt={14}
            fontSize={17}
            width={880}
            hideAnnotation
          />

          <div style={{flex: 1, paddingTop: 20, minWidth: 480}}>
            <div
              style={{
                opacity: headP,
                transform: `translateY(${(1 - headP) * 12}px)`,
                fontFamily: F.display,
                fontSize: 42,
                fontWeight: 500,
                letterSpacing: '-0.025em',
                color: C.text,
                lineHeight: 1.2,
              }}
            >
              Not a prompt.
              <br />
              Not a script.
            </div>

            <div
              style={{
                opacity: headP,
                marginTop: 22,
                fontFamily: F.display,
                fontSize: 26,
                color: C.dim,
                lineHeight: 1.5,
                maxWidth: 560,
              }}
            >
              An inspectable record of how the work was done — readable before you trust it.
            </div>

            <div style={{marginTop: 46, minHeight: 200}}>
              {band ? <Note key={band.at} at={band.at} text={band.note} /> : null}
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Note: React.FC<{at: number; text: string}> = ({at, text}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame - at, [0, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: cubic,
  });
  return (
    <div
      style={{
        opacity: p,
        transform: `translateY(${(1 - p) * 10}px)`,
        borderLeft: `2px solid ${C.accent}`,
        paddingLeft: 24,
        fontFamily: F.display,
        fontSize: 27,
        lineHeight: 1.5,
        color: C.text,
        fontWeight: 400,
        maxWidth: 560,
      }}
    >
      {text}
    </div>
  );
};
