import React from 'react';
import {Audio, Sequence, staticFile} from 'remotion';
import {MUSIC, MUSIC_VOLUME, SFX, VO_MODE} from '../config';
import {SCRIPT} from '../script';

/**
 * Every audio track in the piece.
 *
 * Nothing here is required. With VO_MODE 'none' and MUSIC/SFX off the video
 * renders silent, which is the state a fresh clone is in - a missing asset
 * would otherwise fail the render rather than merely sound wrong.
 */

export const Narration: React.FC = () => {
  if (VO_MODE === 'none') return null;

  if (VO_MODE === 'single') {
    return <Audio src={staticFile('vo/narration.mp3')} />;
  }

  // Per-line. Each clip is mounted at its own start frame, so re-recording one
  // line never shifts any other - the timings in script.ts stay authoritative.
  return (
    <>
      {SCRIPT.map((l) => (
        <Sequence key={l.id} from={l.from} durationInFrames={l.dur + 30} name={`vo/${l.id}`}>
          <Audio src={staticFile(`vo/${l.id}.wav`)} />
        </Sequence>
      ))}
    </>
  );
};

export const Music: React.FC = () => {
  if (!MUSIC) return null;
  return (
    <Audio
      src={staticFile('music.mp3')}
      volume={(f) =>
        // Sit under the voice, lift slightly in the two wordless stretches, and
        // fade out over the last two seconds rather than cutting.
        f < 30 ? (f / 30) * MUSIC_VOLUME : f > 6300 ? ((6360 - f) / 60) * MUSIC_VOLUME : MUSIC_VOLUME
      }
    />
  );
};

/** One-shot design cues, placed on the beats they punctuate. */
const CUES: {at: number; file: string; volume?: number}[] = [
  {at: 240, file: 'sfx/impact-soft.mp3', volume: 0.5}, // logo lands
  {at: 1605, file: 'sfx/keys.mp3', volume: 0.35}, // command typed
  {at: 1760, file: 'sfx/click.mp3', volume: 0.4}, // run starts
  {at: 2140, file: 'sfx/success.mp3', volume: 0.4}, // 39/39 self-check
  {at: 2295, file: 'sfx/impact.mp3', volume: 0.55}, // verdict lands
  {at: 3360, file: 'sfx/whoosh.mp3', volume: 0.4}, // second task arrives
  {at: 3670, file: 'sfx/impact.mp3', volume: 0.6}, // Play reused
  {at: 5975, file: 'sfx/impact-soft.mp3', volume: 0.5}, // "That's Rote."
];

export const Sfx: React.FC = () => {
  if (!SFX) return null;
  return (
    <>
      {CUES.map((c, i) => (
        <Sequence key={i} from={c.at} durationInFrames={90} name={c.file}>
          <Audio src={staticFile(c.file)} volume={c.volume ?? 0.5} />
        </Sequence>
      ))}
    </>
  );
};
