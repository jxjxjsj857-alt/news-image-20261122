// "The World in One Day" — Sunday 22 November 2026 front page.
// Entry program for the make.fun news-image-20261122 competition.
//
// What it does: it takes the finished front page that ships in this
// repository as entry.png, proves the file is a complete and well-formed
// PNG of the required size, and copies its bytes unchanged to the output
// directory. Both grading runs therefore write byte-identical files.
//
// The checks it performs, in order:
//   1. the file is no larger than the 1 MiB cap in the rules;
//   2. it starts with the eight-byte PNG signature;
//   3. its IHDR chunk describes a 1024 by 1024 image;
//   4. every chunk in the file carries a correct CRC-32;
//   5. the chunk chain ends with IEND and nothing follows it.
//
// It uses only the Node 22 standard library, opens no network connection,
// and reads no file other than entry.png. Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import * as fs from 'node:fs';
import * as path from 'node:path';

// --- Limits from the competition rules -------------------------------------

const IMAGE_NAME = 'entry.png';
const REQUIRED_WIDTH = 1024;
const REQUIRED_HEIGHT = 1024;
const MAX_FILE_BYTES = 1024 * 1024;

// A PNG file is an 8-byte signature followed by chunks shaped as
// [length:4][type:4][data:length][crc:4]. The CRC covers type plus data.
const SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');
const IHDR_LENGTH = 13;
const CHUNK_OVERHEAD = 12; // length, type and crc fields; data excluded.

// --- CRC-32, the checksum PNG chunks use -----------------------------------

function makeCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = makeCrcTable();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// --- Validation ------------------------------------------------------------

function die(reason: string): never {
  throw new Error(`entry.png failed validation: ${reason}`);
}

interface Header {
  width: number;
  height: number;
  bitDepth: number;
  colourType: number;
}

function readHeader(bytes: Buffer): Header {
  if (bytes.length < SIGNATURE.length + CHUNK_OVERHEAD + IHDR_LENGTH) {
    die('file is too short to hold a PNG header');
  }
  if (!bytes.subarray(0, SIGNATURE.length).equals(SIGNATURE)) {
    die('does not start with the PNG signature');
  }
  const length = bytes.readUInt32BE(SIGNATURE.length);
  const type = bytes.toString('latin1', SIGNATURE.length + 4, SIGNATURE.length + 8);
  if (type !== 'IHDR' || length !== IHDR_LENGTH) {
    die('first chunk is not a 13-byte IHDR');
  }
  // IHDR data starts after the signature and the chunk's length+type fields.
  const fields = SIGNATURE.length + 8;
  return {
    width: bytes.readUInt32BE(fields),
    height: bytes.readUInt32BE(fields + 4),
    bitDepth: bytes[fields + 8],
    colourType: bytes[fields + 9],
  };
}

function checkDimensions(header: Header): void {
  if (header.width !== REQUIRED_WIDTH || header.height !== REQUIRED_HEIGHT) {
    die(`must be ${REQUIRED_WIDTH}x${REQUIRED_HEIGHT}, ` +
      `got ${header.width}x${header.height}`);
  }
}

function walkChunks(bytes: Buffer): void {
  let offset = SIGNATURE.length;
  let sawIend = false;
  while (offset + CHUNK_OVERHEAD <= bytes.length) {
    const dataLength = bytes.readUInt32BE(offset);
    const type = bytes.toString('latin1', offset + 4, offset + 8);
    const chunkEnd = offset + CHUNK_OVERHEAD + dataLength;
    if (chunkEnd > bytes.length) {
      die(`chunk ${type} runs past the end of the file`);
    }
    const storedCrc = bytes.readUInt32BE(offset + 8 + dataLength);
    const actualCrc = crc32(bytes.subarray(offset + 4, offset + 8 + dataLength));
    if (storedCrc !== actualCrc) {
      die(`chunk ${type} has a bad CRC`);
    }
    offset = chunkEnd;
    if (type === 'IEND') {
      sawIend = true;
      break;
    }
  }
  if (!sawIend) {
    die('no terminating IEND chunk');
  }
  if (offset !== bytes.length) {
    die('bytes follow the IEND chunk');
  }
}

// --- Entry point -----------------------------------------------------------

function verifyCopy(bytes: Buffer, outPath: string): void {
  const written = fs.readFileSync(outPath);
  if (!written.equals(bytes)) {
    throw new Error(`output copy at ${outPath} differs from ${IMAGE_NAME}`);
  }
}

function main(): void {
  const imagePath = new URL(`./${IMAGE_NAME}`, import.meta.url);
  const bytes = fs.readFileSync(imagePath);
  if (bytes.length > MAX_FILE_BYTES) {
    die(`is ${bytes.length} bytes, over the 1 MiB cap`);
  }
  const header = readHeader(bytes);
  checkDimensions(header);
  walkChunks(bytes);

  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, IMAGE_NAME);
  fs.writeFileSync(outPath, bytes);
  verifyCopy(bytes, outPath);
}

main();
