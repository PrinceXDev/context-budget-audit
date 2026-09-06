import React from 'react';
import {AbsoluteFill, interpolate, Sequence, useCurrentFrame} from 'remotion';
import {S} from './config';
import {C} from './theme';
import {Backdrop} from './components/Backdrop';
import {Captions} from './components/Captions';
import {PresenterPip} from './components/Presenter';
import {Music, Narration, Sfx} from './components/Sound';
import {cubic} from './components/primitives';

import {S01ColdOpen} from './scenes/S01ColdOpen';
import {S02Problem} from './scenes/S02Problem';
import {S03Insight} from './scenes/S03Insight';
import {S04WhatIBuilt} from './scenes/S04WhatIBuilt';
import {S05FirstRun} from './scenes/S05FirstRun';
import {S06Verdict} from './scenes/S06Verdict';
import {S07WhatIsAPlay} from './scenes/S07WhatIsAPlay';
import {S08Reuse} from './scenes/S08Reuse';
import {S09Trust} from './scenes/S09Trust';
import {S10Different} from './scenes/S10Different';
import {S11Compounding} from './scenes/S11Compounding';
import {S12Finale} from './scenes/S12Finale';
import {S13Creator} from './scenes/S13Creator';

/**
 * Scenes are cut at exact frames rather than overlapped, because the captions
 * and the per-line voiceover are keyed to absolute frames and an overlapping
 * transition would shift every scene's internal clock.
 *
 * To keep the cuts from reading as hard cuts, each scene dissolves through a
 * persistent root backdrop instead of through black.
 */
const SceneFade: React.FC<{dur: number; children: React.ReactNode}> = ({dur, children}) => {
  const frame = useCurrentFrame();
  const inP = interpolate(frame, [0, 11], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: cubic,
  });
  const outP = interpolate(frame, [dur - 11, dur], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: cubic,
  });
  return <AbsoluteFill style={{opacity: Math.min(inP, outP)}}>{children}</AbsoluteFill>;
};

const SCENES: {key: keyof typeof S; el: React.ReactNode}[] = [
  {key: 'coldOpen', el: <S01ColdOpen />},
  {key: 'problem', el: <S02Problem />},
  {key: 'insight', el: <S03Insight />},
  {key: 'whatIBuilt', el: <S04WhatIBuilt />},
  {key: 'firstRun', el: <S05FirstRun />},
  {key: 'verdict', el: <S06Verdict />},
  {key: 'whatIsAPlay', el: <S07WhatIsAPlay />},
  {key: 'reuse', el: <S08Reuse />},
  {key: 'trust', el: <S09Trust />},
  {key: 'different', el: <S10Different />},
  {key: 'compounding', el: <S11Compounding />},
  {key: 'finale', el: <S12Finale />},
  {key: 'creator', el: <S13Creator />},
];

export const Main: React.FC = () => (
  <AbsoluteFill style={{background: C.bg}}>
    <Backdrop intensity={0.34} />

    {SCENES.map(({key, el}) => (
      <Sequence key={key} from={S[key].from} durationInFrames={S[key].dur} name={key}>
        <SceneFade dur={S[key].dur}>{el}</SceneFade>
      </Sequence>
    ))}

    {/* Outside every Sequence, so these read absolute frames. */}
    <PresenterPip enterAt={S.problem.from + 10} exitAt={S.finale.from + 300} />
    <Captions />

    <Narration />
    <Music />
    <Sfx />
  </AbsoluteFill>
);
