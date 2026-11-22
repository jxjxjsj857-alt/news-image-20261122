// "The World in One Day" — news-image-20261122 entry (Node 22, standard
// library only).
//
// The front page is composed at authoring time and shipped in this repository
// as entry.png. This program verifies that file is a whole 1024x1024 PNG and
// then writes those exact bytes to /output/entry.png, so the grader's two
// runs produce identical output. It reads nothing else, writes nothing else,
// and reaches for no network, so the result is deterministic by construction.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const EXPECTED_WIDTH = 1024;
const EXPECTED_HEIGHT = 1024;

const imagePath = new URL('./entry.png', import.meta.url);
const bytes = readFileSync(imagePath);

if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
  throw new Error('entry.png is not a PNG file');
}
const width = bytes.readUInt32BE(16);
const height = bytes.readUInt32BE(20);
if (width !== EXPECTED_WIDTH || height !== EXPECTED_HEIGHT) {
  throw new Error(`entry.png must be 1024x1024, got ${width}x${height}`);
}

const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, 'entry.png'), bytes);
