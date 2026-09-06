import {writeFileSync} from 'node:fs';
import {SCRIPT} from '../src/script.ts';
import {FPS} from '../src/config.ts';
writeFileSync(
  new URL('../out/lines.json', import.meta.url),
  JSON.stringify(SCRIPT.map((l) => ({id: l.id, text: l.text, target: +(l.dur / FPS).toFixed(2)})), null, 1),
);
console.log('lines dumped');
