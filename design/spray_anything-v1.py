"""
Spray Anything - Spray paint effect based on Texturelabs SprayAnything action.

The effect creates a soft, displaced look like spray paint - with uniform
softening, edge bleeding, and spray speckles at boundaries.
"""

import numpy as np
import cv2
import sys
import os


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
    h, w = img.shape[:2]
    wl = {"small": 8, "medium": 18, "large": 40}[size]
    y, x = np.mgrid[0:h, 0:w]
    dx = (amount * np.sin(2 * np.pi * y / wl)).astype(np.float32)
    dy = (amount * np.sin(2 * np.pi * x / wl)).astype(np.float32)
    return cv2.remap(img, (x + dx).astype(np.float32), (y + dy).astype(np.float32),
                     cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def motion_blur(img, angle_deg, distance):
    dist = max(1, int(distance))
    ks = dist * 2 + 1
    kernel = np.zeros((ks, ks), dtype=np.float64)
    rad = np.radians(angle_deg)
    c, s = np.cos(rad), np.sin(rad)
    ctr = dist
    for i in range(ks):
        t = i - ctr
        xi, yi = int(round(ctr + t * c)), int(round(ctr - t * s))
        if 0 <= xi < ks and 0 <= yi < ks:
            kernel[yi, xi] = 1.0
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


def spray_anything(input_path, output_path, spray_map_dir=None):
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

    # Use the ACTUAL SprayMap (subtle, std~4.4) - the 6 cumulative passes
    # with high scale factors create the soft spray-painted blur look
    spray_map = load_spray_map(spray_map_dir, h, w)
    original = img.copy()

    # ==================================================================
    # 1. INITIAL DISTORTION: Ripple + Offset + Motion Blur
    # ==================================================================
    print("1. Initial distortion...")
    img = ripple(img, 14, "large")
    img = np.roll(np.roll(img, 6, axis=1), 6, axis=0)
    img = motion_blur(img, -27, 12)

    # ==================================================================
    # 2. SIX DISPLACEMENT PASSES (the core effect)
    # With the subtle SprayMap (std=4.4), even scale 999 creates moderate
    # displacement (~35px for 1σ, ~70px for 2σ). Six cumulative passes
    # create the soft, blurred spray-paint look visible in the reference.
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
    for hs, vs, fp in disp_params:
        pre = img.copy()
        img = displace(img, spray_map, hs, vs)
        img = fade(pre, img, fp)

    # The 6-pass displaced result is the spray-painted base.
    # Blend back some original to retain subject clarity.
    # Reference shows ~60-70% clarity, so blend 50% original back.
    displaced_full = img.copy()
    img = fade(original, img, 70)  # 70% displaced + 30% original
    displaced = img.copy()

    # ==================================================================
    # 3. SPRAY COVERAGE TEXTURE (Quick Mask section)
    # Clouds + Mezzotint creates variable spray density.
    # This adds subtle variation - some areas have thicker coverage
    # (closer to displaced), others slightly thinner (hint of original).
    # ==================================================================
    print("3. Spray coverage variation...")
    clouds = generate_clouds(h, w, seed=42)
    mezz = np.where(np.random.randint(0, 256, (h, w), dtype=np.uint8) < clouds,
                    np.uint8(255), np.uint8(0))
    coverage = fade(clouds, mezz, 50)
    coverage = np.clip((coverage.astype(np.float32) - 8) / (194 - 8) * 255, 0, 255).astype(np.uint8)
    coverage_3 = motion_blur(cv2.cvtColor(coverage, cv2.COLOR_GRAY2BGR), -27, 6)
    coverage = cv2.cvtColor(coverage_3, cv2.COLOR_BGR2GRAY)

    # Subtle: blend displaced (spray effect) with very little original
    # Coverage bright → full displaced, dark → 90% displaced + 10% original
    cf = coverage.astype(np.float32) / 255.0
    cf3 = np.stack([cf] * 3, axis=-1)
    slight_original = fade(original, displaced, 90)
    img = (displaced.astype(np.float32) * cf3 +
           slight_original.astype(np.float32) * (1 - cf3)).astype(np.uint8)

    # ==================================================================
    # 4. EDGE SPECKLES (the scattered spray dots at silhouette boundaries)
    # From PS: QM → Noise → Threshold → Minimum → Ripple
    # These dots appear where dark subject meets light background.
    # ==================================================================
    print("4. Edge speckles...")

    # Detect high-contrast edges
    gray_orig = cv2.cvtColor(original, cv2.COLOR_BGR2GRAY)
    # Use gradient magnitude for edge detection
    gx = cv2.Sobel(gray_orig, cv2.CV_64F, 1, 0, ksize=5)
    gy = cv2.Sobel(gray_orig, cv2.CV_64F, 0, 1, ksize=5)
    grad = np.sqrt(gx**2 + gy**2)
    grad = (grad / grad.max() * 255).astype(np.uint8)
    # Wide edge zone for spray scatter - extend further for visible speckles
    edge_zone = cv2.dilate(grad, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (51, 51)))
    edge_f = cv2.GaussianBlur(edge_zone.astype(np.float32) / 255.0, (61, 61), 20)

    # Fine splatter dots
    noise1 = (np.random.randint(0, 256, (h, w), dtype=np.int16) * 52 // 100).astype(np.uint8)
    _, dots1 = cv2.threshold(noise1, 128, 255, cv2.THRESH_BINARY)
    dots1 = cv2.erode(dots1, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    dots1 = cv2.cvtColor(ripple(cv2.cvtColor(dots1, cv2.COLOR_GRAY2BGR), 150, "medium"),
                         cv2.COLOR_BGR2GRAY)

    # Large splatter dots
    def make_dots(h, w):
        n = np.random.randint(0, 256, (h, w), dtype=np.int16) - 128
        return cv2.threshold(np.clip(128 + n * 50 // 100, 0, 255).astype(np.uint8),
                             253, 255, cv2.THRESH_BINARY)[1]

    dots2 = cv2.bitwise_or(make_dots(h, w), make_dots(h, w))
    dots2 = cv2.dilate(dots2, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)))
    dots2 = cv2.cvtColor(ripple(cv2.cvtColor(dots2, cv2.COLOR_GRAY2BGR), 150, "medium"),
                         cv2.COLOR_BGR2GRAY)

    all_dots = np.maximum(dots1, dots2).astype(np.float32) / 255.0

    # Speckles near edges (weighted by edge zone), with higher intensity
    speckle_weight = np.clip(all_dots * edge_f * 2.0, 0, 1)
    sw3 = np.stack([speckle_weight] * 3, axis=-1)

    # At speckle locations, show more heavily displaced content
    heavy_disp = displace(displaced, spray_map, 150, 150)
    img = (heavy_disp.astype(np.float32) * sw3 +
           img.astype(np.float32) * (1 - sw3)).astype(np.uint8)

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

    # ==================================================================
    # 6. SHARPEN
    # ==================================================================
    print("6. Sharpen...")
    img = cv2.GaussianBlur(img, (0, 0), 0.4)
    blur = cv2.GaussianBlur(img, (0, 0), 2.0)
    img = np.clip(img.astype(np.float64) + (img.astype(np.float64) - blur), 0, 255).astype(np.uint8)

    # ==================================================================
    # Output
    # ==================================================================
    if has_alpha and orig_alpha is not None:
        img = cv2.merge([img[:, :, 0], img[:, :, 1], img[:, :, 2], orig_alpha])

    print(f"Saving {output_path}...")
    cv2.imwrite(output_path, img)
    print("Done!")


if __name__ == "__main__":
    input_file = sys.argv[1] if len(sys.argv) > 1 else "wes.png"
    output_file = sys.argv[2] if len(sys.argv) > 2 else "wes_sprayed.png"
    d = os.path.dirname(os.path.abspath(__file__))
    spray_anything(os.path.join(d, input_file), os.path.join(d, output_file))
