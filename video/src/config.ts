export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** Scene boundaries in frames. Single source of truth for the whole timeline. */
export const S = {
  coldOpen:    {from: 0,    dur: 300},
  problem:     {from: 300,  dur: 540},
  insight:     {from: 840,  dur: 360},
  whatIBuilt:  {from: 1200, dur: 390},
  firstRun:    {from: 1590, dur: 690},
  verdict:     {from: 2280, dur: 480},
  whatIsAPlay: {from: 2760, dur: 600},
  reuse:       {from: 3360, dur: 780},
  trust:       {from: 4140, dur: 480},
  different:   {from: 4620, dur: 480},
  compounding: {from: 5100, dur: 540},
  finale:      {from: 5640, dur: 390},
  creator:     {from: 6030, dur: 330},
} as const;

export const TOTAL = S.creator.from + S.creator.dur; // 6360 frames = 3:32

/**
 * How narration audio is supplied.
 *
 *   'none'    - render silent. Captions still burn in. This is the default so
 *               the project renders the moment it is cloned.
 *   'perline' - one file per script line at public/vo/<id>.mp3 (l01.mp3 ...).
 *               Each is mounted at its line's own start frame, so re-recording
 *               one line never shifts the rest.
 *   'single'  - one continuous take at public/vo/narration.mp3, played from
 *               frame 0. Use only if you recorded against the caption timings.
 *
 * Flip this AFTER dropping the files in - a missing file renders as silence in
 * the studio but fails a real render.
 */
export const VO_MODE: 'none' | 'perline' | 'single' = 'perline';

/** public/music.mp3 - set false if you have not added a bed track. */
export const MUSIC = false;
export const MUSIC_VOLUME = 0.16;

/** public/sfx/*.mp3 - keystrokes, impacts, transitions. */
export const SFX = false;

/** public/presenter.jpg - your portrait. Detected at render time; falls back
 *  to a monogram if the file is not there. */
export const PRESENTER_PHOTO = 'presenter.jpg';

export const SHOW_CAPTIONS = true;
