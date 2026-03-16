"""
Spray Anything - Spray paint effect based on Texturelabs SprayAnything action.

The effect creates a soft, displaced look like spray paint - with uniform
softening, edge bleeding, and spray speckles at boundaries.

Usage:
  python3 spray_anything.py input.png output.png [--debug]

  --debug  Save each step as a numbered image and export a filmstrip
"""

import numpy as np
import cv2
import sys
import os
import argparse


def generate_clouds(h, w, seed=None):
    rng = np.random.RandomState(seed)
    result = np.zeros((h, w), dtype=np.float64)
    for o in range(7):
        f = 2 ** o
        sh, sw = max(2, h // (128 // f)), max(2, w // (128 // f))
        up = cv2.resize(rng.randn(sh, sw), (w, h), interpolation=cv2.INTER_CUBIC)
        result += up / (f * 0.7 + 1)
    mn, mx = result.min(), result.max()
    return ((result - mn) / (mx - mn + 1e-8) * 255).astype(np.uint8)


def load_spray_map(base_dir, h, w):
    """Load the actual SprayMap.psd composite (subtle displacement map)."""
    psd = os.path.join(base_dir, "SprayMap_composite.png")
    if not os.path.exists(psd):
        try:
            from psd_tools import PSDImage
            p = PSDImage.open(os.path.join(base_dir, "SprayMap.psd"))
            p.composite().save(psd)
        except Exception:
            print("WARNING: Could not load SprayMap, generating synthetic")
            return cv2.cvtColor(np.full((h, w), 128, dtype=np.uint8), cv2.COLOR_GRAY2BGR)

    spray = cv2.imread(psd)
    return cv2.resize(spray, (w, h), interpolation=cv2.INTER_LINEAR)


def ripple(img, amount, size="large"):
    """Ripple distortion with jittered wavelength to prevent banding."""
    h, w = img.shape[:2]
    wl = {"small": 8, "medium": 18, "large": 40}[size]
    y, x = np.mgrid[0:h, 0:w]

    rng = np.random.RandomState(123)
    y_jitter = rng.uniform(0.85, 1.15, (h, 1)).astype(np.float32)
    x_jitter = rng.uniform(0.85, 1.15, (1, w)).astype(np.float32)

    dx = (amount * np.sin(2 * np.pi * y / (wl * y_jitter))).astype(np.float32)
    dy = (amount * np.sin(2 * np.pi * x / (wl * x_jitter))).astype(np.float32)

    return cv2.remap(img, (x + dx).astype(np.float32), (y + dy).astype(np.float32),
                     cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def motion_blur(img, angle_deg, distance):
    """Anti-aliased motion blur using a properly drawn sub-pixel kernel."""
    dist = max(1, int(distance))
    ks = dist * 2 + 1
    kernel = np.zeros((ks, ks), dtype=np.float64)

    rad = np.radians(angle_deg)
    c, s = np.cos(rad), np.sin(rad)
    ctr = float(dist)
    num_samples = ks * 4
    for i in range(num_samples):
        t = (i / (num_samples - 1)) * (ks - 1) - ctr
        fx = ctr + t * c
        fy = ctr - t * s
        x0, y0 = int(np.floor(fx)), int(np.floor(fy))
        x1, y1 = x0 + 1, y0 + 1
        wx = fx - x0
        wy = fy - y0
        for (yy, yw) in [(y0, 1 - wy), (y1, wy)]:
            for (xx, xw) in [(x0, 1 - wx), (x1, wx)]:
                if 0 <= xx < ks and 0 <= yy < ks:
                    kernel[yy, xx] += yw * xw

    kernel /= kernel.sum()
    return cv2.filter2D(img, -1, kernel)


def displace(img, dmap, h_scale, v_scale):
    h, w = img.shape[:2]
    if len(dmap.shape) == 3:
        hc, vc = dmap[:, :, 2].astype(np.float32), dmap[:, :, 1].astype(np.float32)
    else:
        hc = vc = dmap.astype(np.float32)
    y, x = np.mgrid[0:h, 0:w]
    dx = (hc - 128.0) / 128.0 * h_scale
    dy = (vc - 128.0) / 128.0 * v_scale
    return cv2.remap(img, (x + dx).astype(np.float32), (y + dy).astype(np.float32),
                     cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def fade(orig, filt, pct):
    return cv2.addWeighted(filt, pct / 100.0, orig, 1 - pct / 100.0, 0).astype(np.uint8)


class DebugRecorder:
    """Records each processing step for debug filmstrip output."""

    def __init__(self, enabled, output_dir):
        self.enabled = enabled
        self.output_dir = output_dir
        self.steps = []  # list of (label, image_bgr)

    def save(self, label, img):
        if not self.enabled:
            return
        # Ensure 3-channel BGR for consistency
        if len(img.shape) == 2:
            vis = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        elif img.shape[2] == 4:
            # Composite BGRA on white for visibility
            alpha = img[:, :, 3:4].astype(np.float32) / 255.0
            rgb = img[:, :, :3].astype(np.float32)
            white = np.full_like(rgb, 255.0)
            vis = (rgb * alpha + white * (1 - alpha)).astype(np.uint8)
        else:
            vis = img.copy()
        self.steps.append((label, vis))

        # Save individual step
        idx = len(self.steps)
        step_path = os.path.join(self.output_dir, f"step_{idx:02d}_{label.replace(' ', '_')}.png")
        cv2.imwrite(step_path, vis)
        print(f"  [debug] saved {step_path}")

    def build_filmstrip(self, output_path):
        if not self.enabled or not self.steps:
            return

        padding = 16
        label_h = 32
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.5
        font_thick = 1
        cols = 5  # thumbnails per row

        # All thumbnails to same fixed size (square-ish, based on first image aspect)
        ref_h, ref_w = self.steps[0][1].shape[:2]
        thumb_w = 360
        thumb_h = int(thumb_w * ref_h / ref_w)

        thumbs = []
        for label, img in self.steps:
            thumb = cv2.resize(img, (thumb_w, thumb_h), interpolation=cv2.INTER_AREA)
            thumbs.append((label, thumb))

        rows = (len(thumbs) + cols - 1) // cols
        cell_w = thumb_w + padding
        cell_h = thumb_h + label_h + padding
        total_w = padding + cols * cell_w
        total_h = padding + rows * cell_h

        strip = np.full((total_h, total_w, 3), 30, dtype=np.uint8)

        for i, (label, thumb) in enumerate(thumbs):
            col = i % cols
            row = i // cols
            x = padding + col * cell_w
            y = padding + row * cell_h

            # Label
            text = f"{i + 1}. {label}"
            cv2.putText(strip, text, (x, y + label_h - 8),
                        font, font_scale, (200, 200, 200), font_thick, cv2.LINE_AA)

            # Thumbnail
            ty = y + label_h
            strip[ty:ty + thumb_h, x:x + thumb_w] = thumb

        cv2.imwrite(output_path, strip)
        print(f"\nFilmstrip saved to {output_path}")


def spray_anything(input_path, output_path, spray_map_dir=None, debug=False):
    print(f"Loading {input_path}...")
    img = cv2.imread(input_path, cv2.IMREAD_UNCHANGED)
    if img is None:
        print(f"Error: Could not load {input_path}")
        sys.exit(1)

    has_alpha = len(img.shape) > 2 and img.shape[2] == 4
    if has_alpha:
        orig_alpha = img[:, :, 3].copy()
        img = img[:, :, :3]
    else:
        orig_alpha = None

    h, w = img.shape[:2]
    print(f"Image: {w}x{h}")

    if spray_map_dir is None:
        spray_map_dir = os.path.dirname(input_path)

    # Set up debug recorder
    debug_dir = os.path.join(os.path.dirname(output_path), "debug_steps")
    if debug:
        os.makedirs(debug_dir, exist_ok=True)
    dbg = DebugRecorder(debug, debug_dir)

    spray_map = load_spray_map(spray_map_dir, h, w)
    original = img.copy()

    dbg.save("original", img)
    dbg.save("spray map", spray_map)

    # ==================================================================
    # 1. INITIAL DISTORTION: Ripple + Offset + Motion Blur
    # ==================================================================
    print("1. Initial distortion...")
    img = ripple(img, 14, "large")
    dbg.save("ripple 14 large", img)

    img = np.roll(np.roll(img, 6, axis=1), 6, axis=0)
    img = motion_blur(img, -27, 12)
    dbg.save("offset + motion blur", img)

    # ==================================================================
    # 2. SIX DISPLACEMENT PASSES (the core effect)
    # ==================================================================
    print("2. Displacement (6 passes)...")
    disp_params = [
        (120, 120, 75),
        (120, -120, 75),
        (0, 120, 75),
        (120, 0, 75),
        (999, 999, 75),
        (-999, 999, 25),
    ]
    for i, (hs, vs, fp) in enumerate(disp_params):
        pre = img.copy()
        img = displace(img, spray_map, hs, vs)
        img = fade(pre, img, fp)
        dbg.save(f"displace ({hs},{vs}) fade {fp}%", img)

    displaced_full = img.copy()
    dbg.save("6-pass displaced", displaced_full)

    img = fade(original, img, 70)
    displaced = img.copy()
    dbg.save("blend 70% displaced", img)

    # ==================================================================
    # 3. SPRAY COVERAGE TEXTURE (Quick Mask section)
    # ==================================================================
    print("3. Spray coverage variation...")
    clouds = generate_clouds(h, w, seed=42)
    dbg.save("clouds", clouds)

    mezz = np.where(np.random.randint(0, 256, (h, w), dtype=np.uint8) < clouds,
                    np.uint8(255), np.uint8(0))
    dbg.save("mezzotint", mezz)

    coverage = fade(clouds, mezz, 50)
    coverage = np.clip((coverage.astype(np.float32) - 8) / (194 - 8) * 255, 0, 255).astype(np.uint8)
    coverage_3 = motion_blur(cv2.cvtColor(coverage, cv2.COLOR_GRAY2BGR), -27, 6)
    coverage = cv2.cvtColor(coverage_3, cv2.COLOR_BGR2GRAY)
    dbg.save("coverage mask", coverage)

    cf = coverage.astype(np.float32) / 255.0
    cf3 = np.stack([cf] * 3, axis=-1)
    slight_original = fade(original, displaced, 90)
    img = (displaced.astype(np.float32) * cf3 +
           slight_original.astype(np.float32) * (1 - cf3)).astype(np.uint8)
    dbg.save("coverage applied", img)

    # ==================================================================
    # 4. EDGE SPECKLES
    # ==================================================================
    print("4. Edge speckles...")

    gray_orig = cv2.cvtColor(original, cv2.COLOR_BGR2GRAY)
    gx = cv2.Sobel(gray_orig, cv2.CV_64F, 1, 0, ksize=5)
    gy = cv2.Sobel(gray_orig, cv2.CV_64F, 0, 1, ksize=5)
    grad = np.sqrt(gx**2 + gy**2)
    grad = (grad / grad.max() * 255).astype(np.uint8)
    edge_zone = cv2.dilate(grad, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (51, 51)))
    edge_f = cv2.GaussianBlur(edge_zone.astype(np.float32) / 255.0, (61, 61), 20)
    dbg.save("edge zone", (edge_f * 255).astype(np.uint8))

    # Fine splatter dots
    noise1 = (np.random.randint(0, 256, (h, w), dtype=np.int16) * 52 // 100).astype(np.uint8)
    _, dots1 = cv2.threshold(noise1, 128, 255, cv2.THRESH_BINARY)
    dots1 = cv2.erode(dots1, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    dots1 = cv2.cvtColor(ripple(cv2.cvtColor(dots1, cv2.COLOR_GRAY2BGR), 150, "medium"),
                         cv2.COLOR_BGR2GRAY)
    dbg.save("fine dots", dots1)

    # Large splatter dots
    def make_dots(h, w):
        n = np.random.randint(0, 256, (h, w), dtype=np.int16) - 128
        return cv2.threshold(np.clip(128 + n * 50 // 100, 0, 255).astype(np.uint8),
                             253, 255, cv2.THRESH_BINARY)[1]

    dots2 = cv2.bitwise_or(make_dots(h, w), make_dots(h, w))
    dots2 = cv2.dilate(dots2, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)))
    dots2 = cv2.cvtColor(ripple(cv2.cvtColor(dots2, cv2.COLOR_GRAY2BGR), 150, "medium"),
                         cv2.COLOR_BGR2GRAY)
    dbg.save("large dots", dots2)

    all_dots = np.maximum(dots1, dots2).astype(np.float32) / 255.0
    speckle_weight = np.clip(all_dots * edge_f * 2.0, 0, 1)
    dbg.save("speckle mask", (speckle_weight * 255).astype(np.uint8))

    sw3 = np.stack([speckle_weight] * 3, axis=-1)
    heavy_disp = displace(displaced, spray_map, 150, 150)
    img = (heavy_disp.astype(np.float32) * sw3 +
           img.astype(np.float32) * (1 - sw3)).astype(np.uint8)
    dbg.save("speckles applied", img)

    # ==================================================================
    # 5. PAINT GRAIN
    # ==================================================================
    print("5. Paint grain...")
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    grain = np.random.randint(0, 256, (h, w), dtype=np.uint8)
    grain_mask = (grain < gray).astype(np.float32)
    grain_mask = cv2.GaussianBlur(grain_mask, (3, 3), 0.6)
    g3 = np.stack([grain_mask] * 3, axis=-1)
    dark = np.clip(img.astype(np.float32) * 0.85, 0, 255)
    img = (img.astype(np.float32) * g3 + dark * (1 - g3)).astype(np.uint8)
    dbg.save("paint grain", img)

    # ==================================================================
    # 6. SHARPEN
    # ==================================================================
    print("6. Sharpen...")
    img = cv2.GaussianBlur(img, (0, 0), 0.4)
    blur = cv2.GaussianBlur(img, (0, 0), 2.0)
    img = np.clip(img.astype(np.float64) + (img.astype(np.float64) - blur), 0, 255).astype(np.uint8)
    dbg.save("sharpen (final)", img)

    # ==================================================================
    # Output
    # ==================================================================
    if has_alpha and orig_alpha is not None:
        img = cv2.merge([img[:, :, 0], img[:, :, 1], img[:, :, 2], orig_alpha])

    print(f"Saving {output_path}...")
    cv2.imwrite(output_path, img)

    # Build debug filmstrip
    filmstrip_path = output_path.replace('.png', '_filmstrip.png')
    dbg.build_filmstrip(filmstrip_path)

    print("Done!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Spray Anything - spray paint effect")
    parser.add_argument("input", nargs="?", default="wes.png", help="Input image")
    parser.add_argument("output", nargs="?", default="wes_sprayed.png", help="Output image")
    parser.add_argument("--debug", action="store_true", help="Save each step and export filmstrip")
    args = parser.parse_args()

    d = os.path.dirname(os.path.abspath(__file__))
    input_path = args.input if os.path.isabs(args.input) else os.path.join(d, args.input)
    output_path = args.output if os.path.isabs(args.output) else os.path.join(d, args.output)

    spray_anything(input_path, output_path, debug=args.debug)
