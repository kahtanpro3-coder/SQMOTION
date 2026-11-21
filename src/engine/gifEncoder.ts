/**
 * Lightweight, zero-dependency animated GIF89a encoder.
 * Uses uniform 6-8-5 (240 colors) + 16 grayscale palette quantization + Floyd-dither-free fast indexing + LZW compression.
 */

const PALETTE_SIZE = 256;

// Build a deterministic 256-color palette (216 web-safe RGB cube + 40 neutral grayscale/highlight steps)
function buildUniversalPalette(): Uint8Array {
  const palette = new Uint8Array(PALETTE_SIZE * 3);
  let idx = 0;

  // 6 x 6 x 6 RGB cube = 216 colors
  const levels = [0, 51, 102, 153, 204, 255];
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 6; g++) {
      for (let b = 0; b < 6; b++) {
        palette[idx++] = levels[r];
        palette[idx++] = levels[g];
        palette[idx++] = levels[b];
      }
    }
  }

  // Remaining 40 slots: smooth grayscale ramp for crisp black-to-white transitions & stars
  for (let i = 0; i < 40; i++) {
    const v = Math.round((i / 39) * 255);
    palette[idx++] = v;
    palette[idx++] = v;
    palette[idx++] = v;
  }

  return palette;
}

const UNIVERSAL_PALETTE = buildUniversalPalette();

// Fast lookup table for 5-bit per channel RGB (32x32x32 = 32KB)
let lookupTable: Uint8Array | null = null;

function getColorLookupTable(): Uint8Array {
  if (lookupTable) return lookupTable;
  const lut = new Uint8Array(32 * 32 * 32);

  for (let r5 = 0; r5 < 32; r5++) {
    const r = (r5 << 3) | (r5 >> 2);
    for (let g5 = 0; g5 < 32; g5++) {
      const g = (g5 << 3) | (g5 >> 2);
      for (let b5 = 0; b5 < 32; b5++) {
        const b = (b5 << 3) | (b5 >> 2);
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < PALETTE_SIZE; i++) {
          const pr = UNIVERSAL_PALETTE[i * 3];
          const pg = UNIVERSAL_PALETTE[i * 3 + 1];
          const pb = UNIVERSAL_PALETTE[i * 3 + 2];
          const dr = r - pr;
          const dg = g - pg;
          const db = b - pb;
          const dist = dr * dr + dg * dg + db * db;
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = i;
            if (dist === 0) break;
          }
        }
        lut[(r5 << 10) | (g5 << 5) | b5] = bestIdx;
      }
    }
  }

  lookupTable = lut;
  return lut;
}

function rgbaToIndexed(rgba: Uint8ClampedArray): Uint8Array {
  const lut = getColorLookupTable();
  const pixelCount = rgba.length >> 2;
  const indexed = new Uint8Array(pixelCount);

  for (let p = 0, s = 0; p < pixelCount; p++, s += 4) {
    const a = rgba[s + 3];
    if (a < 16) {
      indexed[p] = 0;
      continue;
    }
    const r5 = (rgba[s] >> 3) & 31;
    const g5 = (rgba[s + 1] >> 3) & 31;
    const b5 = (rgba[s + 2] >> 3) & 31;
    indexed[p] = lut[(r5 << 10) | (g5 << 5) | b5];
  }
  return indexed;
}

class ByteBuffer {
  private buf: number[] = [];

  writeByte(b: number) {
    this.buf.push(b & 0xff);
  }

  writeShortLE(v: number) {
    this.buf.push(v & 0xff, (v >> 8) & 0xff);
  }

  writeBytes(bytes: Uint8Array) {
    for (let i = 0; i < bytes.length; i++) {
      this.buf.push(bytes[i]);
    }
  }

  writeASCII(str: string) {
    for (let i = 0; i < str.length; i++) {
      this.buf.push(str.charCodeAt(i) & 0xff);
    }
  }

  toUint8Array(): Uint8Array {
    return new Uint8Array(this.buf);
  }
}

function writeLzwImageData(out: ByteBuffer, indexedPixels: Uint8Array, minCodeSize = 8) {
  out.writeByte(minCodeSize);

  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  const subBlock = new Uint8Array(255);
  let subLen = 0;

  let curBitAcc = 0;
  let curBits = 0;

  const flushSubBlock = () => {
    if (subLen > 0) {
      out.writeByte(subLen);
      for (let i = 0; i < subLen; i++) {
        out.writeByte(subBlock[i]);
      }
      subLen = 0;
    }
  };

  const emitCode = (code: number, codeSize: number) => {
    curBitAcc |= code << curBits;
    curBits += codeSize;
    while (curBits >= 8) {
      subBlock[subLen++] = curBitAcc & 0xff;
      if (subLen === 255) flushSubBlock();
      curBitAcc >>= 8;
      curBits -= 8;
    }
  };

  let codeSize = minCodeSize + 1;
  let nextCode = endCode + 1;
  // Flat hash table: 5003 prime slots storing (key, code)
  const HASH_SIZE = 5003;
  const hashKeys = new Int32Array(HASH_SIZE).fill(-1);
  const hashVals = new Int32Array(HASH_SIZE);

  const resetTable = () => {
    hashKeys.fill(-1);
    nextCode = endCode + 1;
    codeSize = minCodeSize + 1;
  };

  emitCode(clearCode, codeSize);

  let prefix = indexedPixels[0] ?? 0;
  for (let i = 1; i < indexedPixels.length; i++) {
    const k = indexedPixels[i];
    const key = (prefix << 8) | k;
    let h = ((key << 4) ^ (key >> 8)) % HASH_SIZE;
    if (h < 0) h += HASH_SIZE;

    let foundCode = -1;
    while (hashKeys[h] !== -1) {
      if (hashKeys[h] === key) {
        foundCode = hashVals[h];
        break;
      }
      h = (h + 1) % HASH_SIZE;
    }

    if (foundCode !== -1) {
      prefix = foundCode;
    } else {
      emitCode(prefix, codeSize);
      if (nextCode < 4096) {
        hashKeys[h] = key;
        hashVals[h] = nextCode;
        if (nextCode === (1 << codeSize) && codeSize < 12) {
          codeSize++;
        }
        nextCode++;
      } else {
        emitCode(clearCode, codeSize);
        resetTable();
      }
      prefix = k;
    }
  }

  emitCode(prefix, codeSize);
  emitCode(endCode, codeSize);

  if (curBits > 0) {
    subBlock[subLen++] = curBitAcc & 0xff;
  }
  flushSubBlock();
  out.writeByte(0); // Block terminator
}

export function encodeAnimatedGif(
  frames: Uint8ClampedArray[],
  width: number,
  height: number,
  delayCentiseconds: number
): Blob {
  const out = new ByteBuffer();

  // Header
  out.writeASCII('GIF89a');

  // Logical Screen Descriptor
  out.writeShortLE(width);
  out.writeShortLE(height);
  // Global Color Table Flag (1), Color Res (7 -> 8bit), Sort (0), GCT Size (7 -> 2^(7+1)=256)
  out.writeByte(0xf7);
  out.writeByte(0); // Background color index
  out.writeByte(0); // Pixel aspect ratio

  // Global Color Table (256 * 3 bytes)
  out.writeBytes(UNIVERSAL_PALETTE);

  // Netscape 2.0 Application Extension for infinite looping
  out.writeByte(0x21);
  out.writeByte(0xff);
  out.writeByte(11);
  out.writeASCII('NETSCAPE2.0');
  out.writeByte(3);
  out.writeByte(1);
  out.writeShortLE(0); // 0 = loop forever
  out.writeByte(0);

  const safeDelay = Math.max(2, Math.round(delayCentiseconds));

  for (let f = 0; f < frames.length; f++) {
    // Graphic Control Extension
    out.writeByte(0x21);
    out.writeByte(0xf9);
    out.writeByte(4);
    out.writeByte(0x04); // Disposal method 1 (do not dispose), no transparency
    out.writeShortLE(safeDelay);
    out.writeByte(0); // Transparent color index
    out.writeByte(0);

    // Image Descriptor
    out.writeByte(0x2c);
    out.writeShortLE(0);
    out.writeShortLE(0);
    out.writeShortLE(width);
    out.writeShortLE(height);
    out.writeByte(0); // Use global color table, non-interlaced

    const indexed = rgbaToIndexed(frames[f]);
    writeLzwImageData(out, indexed, 8);
  }

  // GIF Trailer
  out.writeByte(0x3b);

  const bytes = out.toUint8Array();
  return new Blob([bytes.buffer as ArrayBuffer], { type: 'image/gif' });
}
