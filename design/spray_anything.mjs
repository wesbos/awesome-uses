/**
 * Spray Anything - Spray paint effect (JavaScript/sharp version)
 *
 * Port of the Python spray_anything.py using sharp for I/O and
 * raw Float32Array pixel manipulation for image processing.
 *
 * Usage:
 *   node spray_anything.mjs input.png output.png [--debug]
 */

import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Seeded PRNG (xoshiro128**) ──────────────────────────────────────────────

class SeededRNG {
  constructor(seed = 0) {
    // splitmix32 to initialize state from a single seed
    let s = seed >>> 0;
    const next = () => {
      s = (s + 0x9e3779b9) >>> 0;
      let z = s;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
      return (z ^ (z >>> 16)) >>> 0;
    };
    this.s = [next(), next(), next(), next()];
  }

  _next() {
    const s = this.s;
    const result = (Math.imul(s[1] * 5, 1) << 7 | Math.imul(s[1] * 5, 1) >>> 25) * 9;
    const t = s[1] << 9;
    s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3];
    s[2] ^= t;
    s[3] = (s[3] << 11 | s[3] >>> 21);
    return (result >>> 0) / 0x100000000;
  }

  /** Uniform float in [0, 1) */
  random() { return this._next(); }

  /** Uniform integer in [0, max) */
  randint(max) { return (this._next() * max) | 0; }

  /** Uniform float in [lo, hi) */
  uniform(lo, hi) { return lo + this._next() * (hi - lo); }

  /** Standard normal via Box-Muller */
  randn() {
    const u1 = this._next() || 1e-10;
    const u2 = this._next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}

// ── Image type helpers ──────────────────────────────────────────────────────

/**
 * @typedef {{ data: Float32Array, w: number, h: number, c: number }} Img
 */

function createImg(w, h, c = 3, fill = 0) {
  const data = new Float32Array(w * h * c);
  if (fill !== 0) data.fill(fill);
  return { data, w, h, c };
}

function cloneImg(img) {
  return { data: new Float32Array(img.data), w: img.w, h: img.h, c: img.c };
}

function clamp(v, lo = 0, hi = 255) {
  return v < lo ? lo : v > hi ? hi : v;
}

function reflectCoord(v, max) {
  // cv2.BORDER_REFLECT: reflect at edges
  if (v < 0) v = -v;
  if (v >= max) {
    const period = max * 2;
    v = v % period;
    if (v >= max) v = period - v - 1;
  }
  return v;
}

// ── I/O via sharp ───────────────────────────────────────────────────────────

async function loadImage(path) {
  const meta = await sharp(path).metadata();
  const channels = meta.channels || 3;
  const { data, info } = await sharp(path)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const img = createImg(info.width, info.height, 3);
  for (let i = 0; i < data.length; i++) img.data[i] = data[i];
  return img;
}

async function saveImage(img, path) {
  const buf = Buffer.alloc(img.w * img.h * img.c);
  for (let i = 0; i < buf.length; i++) buf[i] = clamp(Math.round(img.data[i]));
  await sharp(buf, { raw: { width: img.w, height: img.h, channels: img.c } })
    .png()
    .toFile(path);
}

// ── Pixel-level operations ──────────────────────────────────────────────────

function toGrayscale(img) {
  const out = createImg(img.w, img.h, 1);
  const n = img.w * img.h;
  for (let i = 0; i < n; i++) {
    // RGB weights (sharp gives us RGB, not BGR)
    out.data[i] = 0.299 * img.data[i * 3] + 0.587 * img.data[i * 3 + 1] + 0.114 * img.data[i * 3 + 2];
  }
  return out;
}

function grayToRgb(gray) {
  const out = createImg(gray.w, gray.h, 3);
  const n = gray.w * gray.h;
  for (let i = 0; i < n; i++) {
    out.data[i * 3] = out.data[i * 3 + 1] = out.data[i * 3 + 2] = gray.data[i];
  }
  return out;
}

function fade(orig, filt, pct) {
  const a = pct / 100;
  const b = 1 - a;
  const out = createImg(orig.w, orig.h, orig.c);
  for (let i = 0; i < out.data.length; i++) {
    out.data[i] = clamp(filt.data[i] * a + orig.data[i] * b);
  }
  return out;
}

function roll(img, dx, dy) {
  const out = createImg(img.w, img.h, img.c);
  const { w, h, c } = img;
  for (let y = 0; y < h; y++) {
    const sy = ((y - dy) % h + h) % h;
    for (let x = 0; x < w; x++) {
      const sx = ((x - dx) % w + w) % w;
      const di = (y * w + x) * c;
      const si = (sy * w + sx) * c;
      for (let ch = 0; ch < c; ch++) out.data[di + ch] = img.data[si + ch];
    }
  }
  return out;
}

function threshold(gray, thresh) {
  const out = createImg(gray.w, gray.h, 1);
  for (let i = 0; i < gray.data.length; i++) {
    out.data[i] = gray.data[i] > thresh ? 255 : 0;
  }
  return out;
}

function maxImages(a, b) {
  const out = createImg(a.w, a.h, a.c);
  for (let i = 0; i < out.data.length; i++) {
    out.data[i] = Math.max(a.data[i], b.data[i]);
  }
  return out;
}

function bitwiseOr(a, b) { return maxImages(a, b); }

// ── Bilinear remap ──────────────────────────────────────────────────────────

function sampleBilinear(img, fx, fy) {
  const { w, h, c } = img;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const x1 = x0 + 1, y1 = y0 + 1;
  const wx = fx - x0, wy = fy - y0;

  const rx0 = reflectCoord(x0, w), rx1 = reflectCoord(x1, w);
  const ry0 = reflectCoord(y0, h), ry1 = reflectCoord(y1, h);

  const i00 = (ry0 * w + rx0) * c;
  const i10 = (ry0 * w + rx1) * c;
  const i01 = (ry1 * w + rx0) * c;
  const i11 = (ry1 * w + rx1) * c;

  const result = new Array(c);
  const w00 = (1 - wx) * (1 - wy);
  const w10 = wx * (1 - wy);
  const w01 = (1 - wx) * wy;
  const w11 = wx * wy;
  for (let ch = 0; ch < c; ch++) {
    result[ch] = img.data[i00 + ch] * w00 + img.data[i10 + ch] * w10 +
                 img.data[i01 + ch] * w01 + img.data[i11 + ch] * w11;
  }
  return result;
}

function remap(img, mapX, mapY) {
  const out = createImg(img.w, img.h, img.c);
  const { w, h, c } = img;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const px = sampleBilinear(img, mapX[idx], mapY[idx]);
      const oi = idx * c;
      for (let ch = 0; ch < c; ch++) out.data[oi + ch] = px[ch];
    }
  }
  return out;
}

// ── Convolution ─────────────────────────────────────────────────────────────

function convolve2d(img, kernel, kw, kh) {
  const out = createImg(img.w, img.h, img.c);
  const { w, h, c } = img;
  const khh = (kh - 1) >> 1, kwh = (kw - 1) >> 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let ch = 0; ch < c; ch++) {
        let sum = 0;
        for (let ky = 0; ky < kh; ky++) {
          const sy = reflectCoord(y + ky - khh, h);
          for (let kx = 0; kx < kw; kx++) {
            const sx = reflectCoord(x + kx - kwh, w);
            sum += img.data[(sy * w + sx) * c + ch] * kernel[ky * kw + kx];
          }
        }
        out.data[(y * w + x) * c + ch] = sum;
      }
    }
  }
  return out;
}

// ── Gaussian blur via sharp ─────────────────────────────────────────────────

async function gaussianBlur(img, sigma) {
  const buf = Buffer.alloc(img.w * img.h * img.c);
  for (let i = 0; i < buf.length; i++) buf[i] = clamp(Math.round(img.data[i]));

  const { data } = await sharp(buf, { raw: { width: img.w, height: img.h, channels: img.c } })
    .blur(Math.max(sigma, 0.3))
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = createImg(img.w, img.h, img.c);
  for (let i = 0; i < data.length; i++) out.data[i] = data[i];
  return out;
}

// ── Resize via sharp ────────────────────────────────────────────────────────

async function resizeImg(img, newW, newH) {
  const buf = Buffer.alloc(img.w * img.h * img.c);
  for (let i = 0; i < buf.length; i++) buf[i] = clamp(Math.round(img.data[i]));

  const { data } = await sharp(buf, { raw: { width: img.w, height: img.h, channels: img.c } })
    .resize(newW, newH, { kernel: "cubic" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = createImg(newW, newH, img.c);
  for (let i = 0; i < data.length; i++) out.data[i] = data[i];
  return out;
}

// ── Morphological operations ────────────────────────────────────────────────

function makeEllipseKernel(size) {
  const r = (size - 1) / 2;
  const mask = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - r) / r, dy = (y - r) / r;
      mask[y * size + x] = (dx * dx + dy * dy <= 1) ? 1 : 0;
    }
  }
  return mask;
}

function erode(gray, kernelSize) {
  const mask = makeEllipseKernel(kernelSize);
  const out = createImg(gray.w, gray.h, 1);
  const { w, h } = gray;
  const r = (kernelSize - 1) >> 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let minVal = 255;
      for (let ky = 0; ky < kernelSize; ky++) {
        for (let kx = 0; kx < kernelSize; kx++) {
          if (!mask[ky * kernelSize + kx]) continue;
          const sy = reflectCoord(y + ky - r, h);
          const sx = reflectCoord(x + kx - r, w);
          const v = gray.data[sy * w + sx];
          if (v < minVal) minVal = v;
        }
      }
      out.data[y * w + x] = minVal;
    }
  }
  return out;
}

function dilate(gray, kernelSize) {
  const mask = makeEllipseKernel(kernelSize);
  const out = createImg(gray.w, gray.h, 1);
  const { w, h } = gray;
  const r = (kernelSize - 1) >> 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let maxVal = 0;
      for (let ky = 0; ky < kernelSize; ky++) {
        for (let kx = 0; kx < kernelSize; kx++) {
          if (!mask[ky * kernelSize + kx]) continue;
          const sy = reflectCoord(y + ky - r, h);
          const sx = reflectCoord(x + kx - r, w);
          const v = gray.data[sy * w + sx];
          if (v > maxVal) maxVal = v;
        }
      }
      out.data[y * w + x] = maxVal;
    }
  }
  return out;
}

// ── Core effects ────────────────────────────────────────────────────────────

function generateClouds(h, w, seed = 0) {
  const rng = new SeededRNG(seed);
  const result = new Float64Array(w * h);

  for (let o = 0; o < 7; o++) {
    const f = 2 ** o;
    const sh = Math.max(2, Math.floor(h / (128 / f)));
    const sw = Math.max(2, Math.floor(w / (128 / f)));
    // Generate small noise
    const small = new Float64Array(sh * sw);
    for (let i = 0; i < small.length; i++) small[i] = rng.randn();

    // Bicubic upscale (bilinear approximation)
    const weight = 1 / (f * 0.7 + 1);
    for (let y = 0; y < h; y++) {
      const fy = y * (sh - 1) / (h - 1 || 1);
      const y0 = Math.floor(fy), y1 = Math.min(y0 + 1, sh - 1);
      const wy = fy - y0;
      for (let x = 0; x < w; x++) {
        const fx = x * (sw - 1) / (w - 1 || 1);
        const x0 = Math.floor(fx), x1 = Math.min(x0 + 1, sw - 1);
        const wx = fx - x0;
        const v = small[y0 * sw + x0] * (1 - wx) * (1 - wy) +
                  small[y0 * sw + x1] * wx * (1 - wy) +
                  small[y1 * sw + x0] * (1 - wx) * wy +
                  small[y1 * sw + x1] * wx * wy;
        result[y * w + x] += v * weight;
      }
    }
  }

  // Normalize to 0-255
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < result.length; i++) {
    if (result[i] < mn) mn = result[i];
    if (result[i] > mx) mx = result[i];
  }
  const out = createImg(w, h, 1);
  const range = mx - mn || 1;
  for (let i = 0; i < result.length; i++) {
    out.data[i] = (result[i] - mn) / range * 255;
  }
  return out;
}

function ripple(img, amount, size = "large") {
  const wl = { small: 8, medium: 18, large: 40 }[size];
  const { w, h } = img;
  const rng = new SeededRNG(123);

  const yJitter = new Float32Array(h);
  const xJitter = new Float32Array(w);
  for (let i = 0; i < h; i++) yJitter[i] = rng.uniform(0.85, 1.15);
  for (let i = 0; i < w; i++) xJitter[i] = rng.uniform(0.85, 1.15);

  const mapX = new Float32Array(w * h);
  const mapY = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const dx = amount * Math.sin(2 * Math.PI * y / (wl * yJitter[y]));
      const dy = amount * Math.sin(2 * Math.PI * x / (wl * xJitter[x]));
      mapX[idx] = x + dx;
      mapY[idx] = y + dy;
    }
  }
  return remap(img, mapX, mapY);
}

function buildMotionKernel(angleDeg, distance) {
  const dist = Math.max(1, Math.round(distance));
  const ks = dist * 2 + 1;
  const kernel = new Float64Array(ks * ks);
  const rad = angleDeg * Math.PI / 180;
  const c = Math.cos(rad), s = Math.sin(rad);
  const ctr = dist;
  const numSamples = ks * 4;
  for (let i = 0; i < numSamples; i++) {
    const t = (i / (numSamples - 1)) * (ks - 1) - ctr;
    const fx = ctr + t * c;
    const fy = ctr - t * s;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const wx = fx - x0, wy = fy - y0;
    for (const [yy, yw] of [[y0, 1 - wy], [y0 + 1, wy]]) {
      for (const [xx, xw] of [[x0, 1 - wx], [x0 + 1, wx]]) {
        if (xx >= 0 && xx < ks && yy >= 0 && yy < ks) {
          kernel[yy * ks + xx] += yw * xw;
        }
      }
    }
  }
  let sum = 0;
  for (let i = 0; i < kernel.length; i++) sum += kernel[i];
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;
  return { kernel, ks };
}

function motionBlur(img, angleDeg, distance) {
  const { kernel, ks } = buildMotionKernel(angleDeg, distance);
  return convolve2d(img, kernel, ks, ks);
}

function displace(img, dmap, hScale, vScale) {
  const { w, h } = img;
  // sharp loads as RGB: channel 0 = R (horizontal), channel 1 = G (vertical)
  const mapX = new Float32Array(w * h);
  const mapY = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const hv = dmap.data[idx * dmap.c];       // R channel
      const vv = dmap.data[idx * dmap.c + 1];   // G channel
      mapX[idx] = x + (hv - 128) / 128 * hScale;
      mapY[idx] = y + (vv - 128) / 128 * vScale;
    }
  }
  return remap(img, mapX, mapY);
}

function mezzotint(gray, rng) {
  const out = createImg(gray.w, gray.h, 1);
  for (let i = 0; i < gray.data.length; i++) {
    out.data[i] = (rng.randint(256) < gray.data[i]) ? 255 : 0;
  }
  return out;
}

function levels(gray, lo, hi) {
  const out = createImg(gray.w, gray.h, 1);
  const range = Math.max(hi - lo, 1);
  for (let i = 0; i < gray.data.length; i++) {
    out.data[i] = clamp((gray.data[i] - lo) / range * 255);
  }
  return out;
}

function sobel5x5(gray) {
  // Sobel X 5x5
  const kx = [
    -1,-2,0,2,1, -4,-8,0,8,4, -6,-12,0,12,6, -4,-8,0,8,4, -1,-2,0,2,1
  ];
  // Sobel Y 5x5
  const ky = [
    -1,-4,-6,-4,-1, -2,-8,-12,-8,-2, 0,0,0,0,0, 2,8,12,8,2, 1,4,6,4,1
  ];
  const gx = convolve2d(gray, kx, 5, 5);
  const gy = convolve2d(gray, ky, 5, 5);
  const out = createImg(gray.w, gray.h, 1);
  for (let i = 0; i < out.data.length; i++) {
    out.data[i] = Math.sqrt(gx.data[i] ** 2 + gy.data[i] ** 2);
  }
  // Normalize to 0-255
  let mx = 0;
  for (let i = 0; i < out.data.length; i++) if (out.data[i] > mx) mx = out.data[i];
  if (mx > 0) for (let i = 0; i < out.data.length; i++) out.data[i] = out.data[i] / mx * 255;
  return out;
}

// ── Debug recorder ──────────────────────────────────────────────────────────

class DebugRecorder {
  constructor(enabled, outputDir) {
    this.enabled = enabled;
    this.outputDir = outputDir;
    this.steps = [];
    if (enabled) mkdirSync(outputDir, { recursive: true });
  }

  async save(label, img) {
    if (!this.enabled) return;
    // Convert gray to RGB for consistency
    const vis = img.c === 1 ? grayToRgb(img) : cloneImg(img);
    this.steps.push({ label, img: vis });

    const idx = this.steps.length;
    const safeName = label.replace(/[^a-zA-Z0-9]/g, "_");
    const path = join(this.outputDir, `step_${String(idx).padStart(2, "0")}_${safeName}.png`);
    await saveImage(vis, path);
    console.log(`  [debug] saved ${path}`);
  }

  async buildFilmstrip(outputPath) {
    if (!this.enabled || this.steps.length === 0) return;

    const cols = 5;
    const padding = 16;
    const labelH = 32;
    const thumbW = 360;
    const { img: ref } = this.steps[0];
    const thumbH = Math.round(thumbW * ref.h / ref.w);

    const rows = Math.ceil(this.steps.length / cols);
    const cellW = thumbW + padding;
    const cellH = thumbH + labelH + padding;
    const totalW = padding + cols * cellW;
    const totalH = padding + rows * cellH;

    // Dark background
    const strip = createImg(totalW, totalH, 3);
    strip.data.fill(30);

    for (let i = 0; i < this.steps.length; i++) {
      const { label, img } = this.steps[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const ox = padding + col * cellW;
      const oy = padding + row * cellH + labelH;

      // Resize thumbnail
      const thumb = await resizeImg(img, thumbW, thumbH);

      // Blit thumbnail onto strip
      for (let y = 0; y < thumbH; y++) {
        for (let x = 0; x < thumbW; x++) {
          const si = (y * thumbW + x) * 3;
          const di = ((oy + y) * totalW + (ox + x)) * 3;
          strip.data[di] = thumb.data[si];
          strip.data[di + 1] = thumb.data[si + 1];
          strip.data[di + 2] = thumb.data[si + 2];
        }
      }
    }

    // Save strip, then burn labels with sharp composite
    const buf = Buffer.alloc(totalW * totalH * 3);
    for (let i = 0; i < buf.length; i++) buf[i] = clamp(Math.round(strip.data[i]));

    // Create SVG text overlay for labels
    const textParts = this.steps.map((s, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = padding + col * cellW;
      const y = padding + row * cellH + labelH - 8;
      const escaped = `${i + 1}. ${s.label}`.replace(/&/g, "&amp;").replace(/</g, "&lt;");
      return `<text x="${x}" y="${y}" fill="#ccc" font-size="13" font-family="monospace">${escaped}</text>`;
    }).join("\n");

    const svg = Buffer.from(
      `<svg width="${totalW}" height="${totalH}" xmlns="http://www.w3.org/2000/svg">${textParts}</svg>`
    );

    await sharp(buf, { raw: { width: totalW, height: totalH, channels: 3 } })
      .composite([{ input: svg, top: 0, left: 0 }])
      .png()
      .toFile(outputPath);

    console.log(`\nFilmstrip saved to ${outputPath}`);
  }
}

// ── Main pipeline ───────────────────────────────────────────────────────────

async function sprayAnything(inputPath, outputPath, { debug = false } = {}) {
  console.log(`Loading ${inputPath}...`);
  const img = { current: await loadImage(inputPath) };
  const { w, h } = img.current;
  console.log(`Image: ${w}x${h}`);

  const sprayMapDir = dirname(inputPath);
  const sprayMap = await loadImage(join(sprayMapDir, "SprayMap_composite.png"))
    .then(async (sm) => resizeImg(sm, w, h));
  const original = cloneImg(img.current);

  const debugDir = join(dirname(outputPath), "debug_steps");
  const dbg = new DebugRecorder(debug, debugDir);

  await dbg.save("original", img.current);
  await dbg.save("spray map", sprayMap);

  // ── 1. Initial distortion ──
  console.log("1. Initial distortion...");
  img.current = ripple(img.current, 14, "large");
  await dbg.save("ripple 14 large", img.current);

  img.current = roll(img.current, 6, 6);
  img.current = motionBlur(img.current, -27, 12);
  await dbg.save("offset + motion blur", img.current);

  // ── 2. Six displacement passes ──
  console.log("2. Displacement (6 passes)...");
  const dispParams = [
    [120, 120, 75], [120, -120, 75], [0, 120, 75],
    [120, 0, 75], [999, 999, 75], [-999, 999, 25],
  ];
  for (const [hs, vs, fp] of dispParams) {
    const pre = cloneImg(img.current);
    img.current = displace(img.current, sprayMap, hs, vs);
    img.current = fade(pre, img.current, fp);
    await dbg.save(`displace (${hs},${vs}) fade ${fp}%`, img.current);
  }

  const displacedFull = cloneImg(img.current);
  await dbg.save("6-pass displaced", displacedFull);

  img.current = fade(original, img.current, 70);
  const displaced = cloneImg(img.current);
  await dbg.save("blend 70% displaced", img.current);

  // ── 3. Spray coverage texture ──
  console.log("3. Spray coverage variation...");
  const rng = new SeededRNG(42);
  const clouds = generateClouds(h, w, 42);
  await dbg.save("clouds", clouds);

  const rngMezz = new SeededRNG(99);
  const mezz = mezzotint(clouds, rngMezz);
  await dbg.save("mezzotint", mezz);

  let coverage = fade(clouds, mezz, 50);
  coverage = levels(coverage, 8, 194);
  const coverageRgb = grayToRgb(coverage);
  const coverageBlurred = motionBlur(coverageRgb, -27, 6);
  coverage = toGrayscale(coverageBlurred);
  await dbg.save("coverage mask", coverage);

  // Apply coverage
  const slightOriginal = fade(original, displaced, 90);
  const covOut = createImg(w, h, 3);
  const n = w * h;
  for (let i = 0; i < n; i++) {
    const cf = coverage.data[i] / 255;
    for (let ch = 0; ch < 3; ch++) {
      covOut.data[i * 3 + ch] = displaced.data[i * 3 + ch] * cf +
                                 slightOriginal.data[i * 3 + ch] * (1 - cf);
    }
  }
  img.current = covOut;
  await dbg.save("coverage applied", img.current);

  // ── 4. Edge speckles ──
  console.log("4. Edge speckles...");
  const grayOrig = toGrayscale(original);
  const grad = sobel5x5(grayOrig);
  let edgeZone = dilate(grad, 51);
  const edgeBlurred = await gaussianBlur(grayToRgb(edgeZone), 20);
  const edgeF = toGrayscale(edgeBlurred);
  // Normalize edgeF to 0-1 range
  for (let i = 0; i < edgeF.data.length; i++) edgeF.data[i] /= 255;
  await dbg.save("edge zone", grayToRgb(edgeZone));

  // Fine dots
  const rngDots = new SeededRNG(777);
  const fineDots = createImg(w, h, 1);
  for (let i = 0; i < n; i++) {
    fineDots.data[i] = clamp(rngDots.randint(256) * 52 / 100);
  }
  let dots1 = threshold(fineDots, 128);
  dots1 = erode(dots1, 3);
  dots1 = toGrayscale(ripple(grayToRgb(dots1), 150, "medium"));
  await dbg.save("fine dots", dots1);

  // Large dots
  function makeDots(rng) {
    const d = createImg(w, h, 1);
    for (let i = 0; i < n; i++) {
      d.data[i] = clamp(128 + (rng.randint(256) - 128) * 50 / 100);
    }
    return threshold(d, 253);
  }
  const rngD2a = new SeededRNG(888), rngD2b = new SeededRNG(999);
  let dots2 = bitwiseOr(makeDots(rngD2a), makeDots(rngD2b));
  dots2 = dilate(dots2, 13);
  dots2 = toGrayscale(ripple(grayToRgb(dots2), 150, "medium"));
  await dbg.save("large dots", dots2);

  const allDots = maxImages(dots1, dots2);
  // Speckle weight = dots * edgeF * 2, clamped to [0,1]
  const speckleWeight = createImg(w, h, 1);
  for (let i = 0; i < n; i++) {
    speckleWeight.data[i] = Math.min(1, (allDots.data[i] / 255) * edgeF.data[i] * 2);
  }
  await dbg.save("speckle mask", (() => {
    const v = createImg(w, h, 1);
    for (let i = 0; i < n; i++) v.data[i] = speckleWeight.data[i] * 255;
    return v;
  })());

  const heavyDisp = displace(displaced, sprayMap, 150, 150);
  for (let i = 0; i < n; i++) {
    const sw = speckleWeight.data[i];
    for (let ch = 0; ch < 3; ch++) {
      img.current.data[i * 3 + ch] = heavyDisp.data[i * 3 + ch] * sw +
                                      img.current.data[i * 3 + ch] * (1 - sw);
    }
  }
  await dbg.save("speckles applied", img.current);

  // ── 5. Paint grain ──
  console.log("5. Paint grain...");
  const gray = toGrayscale(img.current);
  const rngGrain = new SeededRNG(555);
  for (let i = 0; i < n; i++) {
    const g = rngGrain.randint(256);
    const mask = (g < gray.data[i]) ? 1 : 0;
    // Simple 1px approximation of the gaussian-blurred grain
    const darkFactor = 0.85;
    for (let ch = 0; ch < 3; ch++) {
      const v = img.current.data[i * 3 + ch];
      img.current.data[i * 3 + ch] = v * mask + v * darkFactor * (1 - mask);
    }
  }
  await dbg.save("paint grain", img.current);

  // ── 6. Sharpen ──
  console.log("6. Sharpen...");
  const blurred04 = await gaussianBlur(img.current, 0.4);
  const blurred2 = await gaussianBlur(blurred04, 2.0);
  for (let i = 0; i < blurred04.data.length; i++) {
    img.current.data[i] = clamp(blurred04.data[i] + (blurred04.data[i] - blurred2.data[i]));
  }
  await dbg.save("sharpen (final)", img.current);

  // ── Save ──
  console.log(`Saving ${outputPath}...`);
  await saveImage(img.current, outputPath);

  // Build filmstrip
  const ext = extname(outputPath);
  const filmstripPath = outputPath.replace(ext, `_filmstrip${ext}`);
  await dbg.buildFilmstrip(filmstripPath);

  console.log("Done!");
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const debugFlag = args.includes("--debug");
const positional = args.filter((a) => !a.startsWith("--"));

const inputFile = positional[0] || "wes.png";
const outputFile = positional[1] || "wes_sprayed.png";

const inputPath = inputFile.startsWith("/") ? inputFile : join(__dirname, inputFile);
const outputPath = outputFile.startsWith("/") ? outputFile : join(__dirname, outputFile);

sprayAnything(inputPath, outputPath, { debug: debugFlag });
