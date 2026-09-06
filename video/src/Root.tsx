import React from 'react';
import {Composition} from 'remotion';
import {loadFont as loadInter} from '@remotion/google-fonts/Inter';
import {loadFont as loadMono} from '@remotion/google-fonts/JetBrainsMono';
import {FPS, HEIGHT, TOTAL, WIDTH} from './config';
import {Main} from './Main';

// Loaded at module scope so the faces are registered before the first frame is
// measured. theme.ts references these families by name.
loadInter();
loadMono();

export const RemotionRoot: React.FC = () => (
  <Composition
    id="RoteDemo"
    component={Main}
    durationInFrames={TOTAL}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
  />
);
