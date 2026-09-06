/**
 * Design tokens for the Rote Playoffs demo.
 *
 * One dark ground, one accent, two signal colours. Everything else is a tint of
 * the ground. Restraint is the point: the terminal output is the loudest thing
 * on screen and nothing should compete with it.
 */
export const C = {
  bg: '#06070A',
  bgElev: '#0B0D12',
  panel: '#0E1117',
  panelTop: '#141821',
  line: 'rgba(255,255,255,0.075)',
  lineStrong: 'rgba(255,255,255,0.16)',

  text: '#EDF0F5',
  dim: '#8B94A5',
  faint: '#565F71',
  ghost: '#2B3140',

  accent: '#6E8BFF',
  accentSoft: 'rgba(110,139,255,0.14)',
  accentGlow: 'rgba(110,139,255,0.34)',

  ok: '#38E1B0',
  okSoft: 'rgba(56,225,176,0.13)',
  warn: '#F2B441',
  warnSoft: 'rgba(242,180,65,0.13)',
  danger: '#FF6B6B',
  dangerSoft: 'rgba(255,107,107,0.13)',
} as const;

export const F = {
  display: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace',
} as const;

/** Shared easing. A single curve keeps unrelated motion feeling related. */
export const EASE = [0.22, 1, 0.36, 1] as const;
export const EASE_IN = [0.6, 0, 0.4, 1] as const;
