/* ═══════════════════════════════════════════════════════════════════════════
   utils.js — Developer utilities, available in the browser console

   Usage:
     colorInventory()
       Returns an object with one array per layer (ch 1–10).
       Each array contains up to 7 hex color strings — the most-used
       distinct colors found on that layer, most-used first.
       Empty layers return an empty array.

   Example:
     > colorInventory()
     {
       "CH1 Lead":    ["#e84a2f", "#c93020", "#f07050"],
       "CH2 Strings": ["#3a7fc1"],
       "CH3 Bass":    [],
       ...
     }
   ═══════════════════════════════════════════════════════════════════════════ */

import { getPaintTexture } from './brush.js';
import { LAYER_CONFIG }    from './layers.js';

const MAX_COLORS  = 7;
const ALPHA_FLOOR = 0.04;   // ignore near-transparent pixels
const BUCKET_BITS = 4;      // quantise each channel to 4 bits (16 steps)
                             // gives ~4096 possible buckets — coarse enough
                             // to merge nearby shades, fine enough to split
                             // visually distinct colours

/**
 * Analyse all 10 paint layers and return the top-7 colours per layer.
 * @returns {{ [layerLabel: string]: string[] }}
 */
function colorInventory() {
  const result = {};

  for (let ch = 0; ch < 10; ch++) {
    const cfg = LAYER_CONFIG.find(c => c.ch === ch);
    const key = cfg ? `CH${ch + 1} ${cfg.label}` : `CH${ch + 1}`;

    const tex = getPaintTexture(ch);
    if (!tex) { result[key] = []; continue; }

    // .image.data is the live Float32Array [r,g,b,a, r,g,b,a, …] 0.0–1.0
    const data = tex.image?.data ?? tex.source?.data?.data ?? null;
    if (!data) { result[key] = []; continue; }

    // Count occurrences per quantised colour bucket
    const counts = new Map();   // bucketKey (int) → { count, rSum, gSum, bSum }

    const STEP = 1 << BUCKET_BITS;           // 16
    const MASK = 0xFF >> (8 - BUCKET_BITS);  // 0x0F

    const pixels = data.length / 4;
    for (let i = 0; i < pixels; i++) {
      const a = data[i * 4 + 3];
      if (a < ALPHA_FLOOR) continue;    // transparent — skip

      // Convert float → 8-bit, then quantise to BUCKET_BITS
      const r8 = Math.round(data[i * 4    ] * 255);
      const g8 = Math.round(data[i * 4 + 1] * 255);
      const b8 = Math.round(data[i * 4 + 2] * 255);

      const rq = (r8 >> (8 - BUCKET_BITS)) & MASK;
      const gq = (g8 >> (8 - BUCKET_BITS)) & MASK;
      const bq = (b8 >> (8 - BUCKET_BITS)) & MASK;

      // Pack into a single integer key
      const bucketKey = (rq << (BUCKET_BITS * 2)) | (gq << BUCKET_BITS) | bq;

      if (counts.has(bucketKey)) {
        const b = counts.get(bucketKey);
        b.count++;
        b.rSum += r8;
        b.gSum += g8;
        b.bSum += b8;
      } else {
        counts.set(bucketKey, { count: 1, rSum: r8, gSum: g8, bSum: b8 });
      }
    }

    if (counts.size === 0) { result[key] = []; continue; }

    // Sort buckets by count descending, take top MAX_COLORS
    const sorted = [...counts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_COLORS);

    // Convert each bucket's average colour to hex
    result[key] = sorted.map(({ count, rSum, gSum, bSum }) => {
      const r = Math.round(rSum / count);
      const g = Math.round(gSum / count);
      const b = Math.round(bSum / count);
      return '#' +
        r.toString(16).padStart(2, '0') +
        g.toString(16).padStart(2, '0') +
        b.toString(16).padStart(2, '0');
    });
  }

  return result;
}

/* ── Expose on window so it's callable from the browser console ── */
window.colorInventory = colorInventory;

console.log('[Utils] colorInventory() available in console');