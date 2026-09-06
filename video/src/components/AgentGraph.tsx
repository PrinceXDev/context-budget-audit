import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {C, F} from '../theme';
import {cubic} from './primitives';

/**
 * The real DAG of gitlab-mr-gate: nine steps in four layers, exactly as
 * `depends_on` declares them in src/main.ts. The five fetches sit in one layer
 * because they genuinely run in parallel - each depends only on validate_input.
 *
 * This is explanatory motion graphics ABOUT the product, deliberately drawn in
 * a different visual language from the terminal window so a viewer is never
 * confused about which is which.
 */

type Node = {id: string; label: string; col: number; row: number; kind: 'guard' | 'read' | 'judge'};

export const NODES: Node[] = [
  {id: 'self_check', label: 'self_check', col: 0, row: 0, kind: 'guard'},
  {id: 'validate_input', label: 'validate_input', col: 0, row: 3, kind: 'guard'},

  {id: 'fetch_mr', label: 'fetch_mr', col: 1, row: 1, kind: 'read'},
  {id: 'fetch_approvals', label: 'fetch_approvals', col: 1, row: 2, kind: 'read'},
  {id: 'fetch_approval_state', label: 'fetch_approval_state', col: 1, row: 3, kind: 'read'},
  {id: 'fetch_pipelines', label: 'fetch_pipelines', col: 1, row: 4, kind: 'read'},
  {id: 'fetch_discussions', label: 'fetch_discussions', col: 1, row: 5, kind: 'read'},

  {id: 'compute_verdict', label: 'compute_verdict', col: 2, row: 2.5, kind: 'judge'},
  {id: 'verify', label: 'verify', col: 3, row: 2.5, kind: 'judge'},
];

const EDGES: [string, string][] = [
  ['validate_input', 'fetch_mr'],
  ['validate_input', 'fetch_approvals'],
  ['validate_input', 'fetch_approval_state'],
  ['validate_input', 'fetch_pipelines'],
  ['validate_input', 'fetch_discussions'],
  ['self_check', 'compute_verdict'],
  ['fetch_mr', 'compute_verdict'],
  ['fetch_approvals', 'compute_verdict'],
  ['fetch_approval_state', 'compute_verdict'],
  ['fetch_pipelines', 'compute_verdict'],
  ['fetch_discussions', 'compute_verdict'],
  ['compute_verdict', 'verify'],
];

/** When each layer lights up, as an offset in frames from the graph's start. */
const LAYER_AT = [0, 26, 58, 84];

const COL_X = [110, 400, 760, 1060];
const ROW_Y = (r: number) => 60 + r * 74;
const W = 200;
const H = 46;

const kindColor = (k: Node['kind']) =>
  k === 'guard' ? C.warn : k === 'read' ? C.accent : C.ok;

export const AgentGraph: React.FC<{startAt?: number; scale?: number}> = ({
  startAt = 0,
  scale = 1,
}) => {
  const frame = useCurrentFrame();
  const f = frame - startAt;

  const nodeAt = (n: Node) => LAYER_AT[n.col];

  return (
    <svg
      width={1260 * scale}
      height={520 * scale}
      viewBox="0 0 1260 520"
      style={{overflow: 'visible'}}
    >
      {EDGES.map(([a, b], i) => {
        const na = NODES.find((n) => n.id === a)!;
        const nb = NODES.find((n) => n.id === b)!;
        const x1 = COL_X[na.col] + W;
        const y1 = ROW_Y(na.row) + H / 2;
        const x2 = COL_X[nb.col];
        const y2 = ROW_Y(nb.row) + H / 2;
        const mx = (x1 + x2) / 2;

        const at = LAYER_AT[nb.col] - 16;
        const p = interpolate(f - at, [0, 20], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: cubic,
        });
        const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;

        return (
          <path
            key={i}
            d={d}
            stroke={C.lineStrong}
            strokeWidth={1.6}
            fill="none"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - p}
            opacity={0.85}
          />
        );
      })}

      {NODES.map((n) => {
        const at = nodeAt(n);
        const p = interpolate(f - at, [0, 18], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: cubic,
        });
        const done = f > at + 34;
        const col = kindColor(n.kind);
        const x = COL_X[n.col];
        const y = ROW_Y(n.row);

        return (
          <g key={n.id} opacity={p} transform={`translate(${x}, ${y + (1 - p) * 8})`}>
            <rect
              width={W}
              height={H}
              rx={9}
              fill={C.panel}
              stroke={done ? col : C.lineStrong}
              strokeWidth={done ? 1.5 : 1}
            />
            <circle cx={19} cy={H / 2} r={4.5} fill={done ? col : C.ghost} />
            <text
              x={36}
              y={H / 2 + 5.5}
              fill={done ? C.text : C.dim}
              fontFamily={F.mono}
              fontSize={15.5}
            >
              {n.label}
            </text>
          </g>
        );
      })}

      {[
        {x: COL_X[0], label: 'guard'},
        {x: COL_X[1], label: 'read · parallel'},
        {x: COL_X[2], label: 'judge'},
        {x: COL_X[3], label: 'verify'},
      ].map((l, i) => {
        const p = interpolate(f - LAYER_AT[i], [0, 16], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: cubic,
        });
        return (
          <text
            key={i}
            x={l.x}
            y={26}
            fill={C.faint}
            fontFamily={F.mono}
            fontSize={13}
            letterSpacing="0.24em"
            opacity={p}
          >
            {l.label.toUpperCase()}
          </text>
        );
      })}
    </svg>
  );
};
