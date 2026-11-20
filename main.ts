// Palmera Bay — Streets of the Sun, a gta6-01 entry (Node 22, standard library only).
// The game is this directory's game/ folder: plain static files a desktop browser
// loads offline (game/index.html and its ES modules plus one vendored three.js
// build under game/vendor/, no network request). This program hands it in: it
// copies game/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored make.fun
// library. Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function countFiles(dir) {
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    n += entry.isDirectory() ? countFiles(p) : 1;
  }
  return n;
}

function fail(message) {
  throw new Error(`main.ts: ${message}`);
}

// The entry point the judges load must exist, and the screenshots the
// dossier points at must be real files, or the handoff is worthless.
const entryHtml = join(here, 'game', 'index.html');
if (!existsSync(entryHtml)) fail('game/index.html is missing');
if (!existsSync(join(here, 'game', 'src', 'main.js'))) fail('game/src/main.js is missing');
if (!existsSync(join(here, 'game', 'vendor', 'three.module.min.js'))) fail('game/vendor/three.module.min.js is missing');

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

const shots = readdirSync(join(out, 'screenshots')).filter((f) => /\.(jpe?g|png)$/i.test(f));
for (const shot of shots) {
  const bytes = statSync(join(out, 'screenshots', shot)).size;
  if (bytes > 262144) fail(`screenshots/${shot} is ${bytes} bytes, over the 256 KiB cap`);
}
if (shots.length > 4) fail(`${shots.length} screenshots, over the cap of 4`);

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`Palmera Bay handed in: ${countFiles(join(out, 'game'))} game files, ${shots.length} screenshots, dossier written to ${join(out, 'dossier.json')}`);
