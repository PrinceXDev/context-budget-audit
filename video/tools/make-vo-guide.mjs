/**
 * Generates VO-SCRIPT.md from src/script.ts.
 *
 * The guide is derived rather than written by hand so the durations a narrator
 * reads against are the exact durations the captions use. Re-run it after any
 * edit to the script:
 *
 *     node --experimental-strip-types tools/make-vo-guide.mjs
 */
import {writeFileSync} from 'node:fs';
import {SCRIPT} from '../src/script.ts';
import {FPS, S} from '../src/config.ts';

const tc = (f) => {
  const t = f / FPS;
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
};

const SECTION_OF = Object.entries(S)
  .map(([k, v]) => ({name: k, from: v.from, to: v.from + v.dur}))
  .sort((a, b) => a.from - b.from);

const sectionAt = (f) => SECTION_OF.find((s) => f >= s.from && f < s.to)?.name ?? '-';

const rows = SCRIPT.map((l) => {
  const words = l.text.trim().split(/\s+/).length;
  const secs = l.dur / FPS;
  return {
    ...l,
    words,
    secs,
    wpm: Math.round((words / secs) * 60),
    section: sectionAt(l.from),
  };
});

const totalWords = rows.reduce((a, r) => a + r.words, 0);
const totalSpeak = rows.reduce((a, r) => a + r.secs, 0);

let md = `# Voiceover script — Rote Playoffs demo

Generated from \`src/script.ts\`. Do not edit by hand; edit the script and re-run
\`node --experimental-strip-types tools/make-vo-guide.mjs\`.

**${SCRIPT.length} lines · ${totalWords} words · ${totalSpeak.toFixed(
  0,
)}s of speech across a ${tc(
  SCRIPT[SCRIPT.length - 1].from + SCRIPT[SCRIPT.length - 1].dur,
)} timeline.**
The gaps between lines are deliberate pauses — let them breathe, they are where
the visuals land.

## How to record

**Per-line (recommended).** Record each line as its own file, named by its id,
into \`public/vo/\` — \`l01.mp3\`, \`l02.mp3\`, and so on. Then set
\`VO_MODE = 'perline'\` in \`src/config.ts\`. Each clip is mounted at its own start
frame, so re-recording one line never shifts any other.

**Single take.** Read straight through, watching the target times below, save as
\`public/vo/narration.mp3\`, and set \`VO_MODE = 'single'\`.

A line that runs slightly long is fine — the next one simply starts over the tail
of it. A line that runs *much* long will collide with the next caption; either
retake it or widen \`dur\` in the script and regenerate this guide.

## Delivery

Confident, calm, conversational. Slightly dramatic, not advertising. You are
explaining something you actually believe to one person, not pitching a room.
Let the punctuation do the pausing. **Bold** marks the words to lean on — they are
also the words the captions brighten, so the emphasis is visible as well as
audible.

## Lines

| # | in | target | words | pace | line |
|---|----|--------|-------|------|------|
`;

for (const r of rows) {
  let text = r.text;
  for (const e of r.emphasis ?? []) {
    const i = text.toLowerCase().indexOf(e.toLowerCase());
    if (i !== -1)
      text = text.slice(0, i) + '**' + text.slice(i, i + e.length) + '**' + text.slice(i + e.length);
  }
  md += `| \`${r.id}\` | ${tc(r.from)} | ${r.secs.toFixed(1)}s | ${r.words} | ${r.wpm} wpm | ${text} |\n`;
}

md += `
## Pauses

These are the silences. They are part of the edit, not gaps to fill.

`;
for (let i = 1; i < rows.length; i++) {
  const gap = (rows[i].from - (rows[i - 1].from + rows[i - 1].dur)) / FPS;
  if (gap >= 1.0)
    md += `- **${gap.toFixed(1)}s** after \`${rows[i - 1].id}\`, before \`${rows[i].id}\` — ${
      rows[i].section
    }\n`;
}

md += `
## Music and sound

Set \`MUSIC = true\` in \`src/config.ts\` and drop \`public/music.mp3\`. It sits at
0.16 gain under the voice and fades out over the last two seconds. Something
sparse and rhythmic — the piece is already busy visually and does not need help.

Set \`SFX = true\` and add the eight cues listed in \`src/components/Sound.tsx\`
under \`public/sfx/\`. All eight are optional; a missing file fails the render, so
add every one or leave the flag off.
`;

writeFileSync(new URL('../VO-SCRIPT.md', import.meta.url), md);
console.log(`wrote VO-SCRIPT.md — ${SCRIPT.length} lines, ${totalWords} words`);
