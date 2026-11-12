#!/usr/bin/env python3
"""Vehicle image pipeline: fit a supplied cutout to the house framing, export
the app WebP, and check masters before they enter the manifest.

The framing reference is assets/cars-2d/chevrolet-cobalt-white.png: a 2:1
canvas, the car at most 81.5% wide and 98% tall, centred, tyres on the bottom
edge. See docs/vehicle-images/chevrolet-asset-matrix.md sections 10-11.

This tool never creates or alters a vehicle's appearance. It only removes a
baked backdrop, crops, scales, places and verifies pixels it is given.

  python3 -I vehicle_image.py cutout <flat.png> <cutout_out.png>
  python3 -I vehicle_image.py fit  <cutout.png> <master_out.png> [--size 1200x600]
  python3 -I vehicle_image.py webp <master.png> <out.webp>
  python3 -I vehicle_image.py qa   <master.png> [--mask <mask.png> --base <white_master.png>]
"""
import json
import subprocess
import sys

from PIL import Image

MASTER = (2400, 1200)
APP = (1200, 600)
BOX_W, BOX_H = 0.815, 0.98  # max share of the canvas the car may occupy
ALPHA_ON = 8  # alpha above this counts as car
BACKDROP_MIN, BACKDROP_TINT = 238, 6  # neutral near-white backdrop, incl. light checkerboards


def car_bbox(img):
    return img.getchannel('A').point(lambda v: 255 if v > ALPHA_ON else 0).getbbox()


def is_backdrop(rgb):
    """Neutral near-white: a studio sweep or a checkerboard baked into an RGB
    file. White paint can be this bright too, so this is only used for pixels
    reached from the image border (see cutout)."""
    r, g, b = rgb[:3]
    return min(r, g, b) >= BACKDROP_MIN and max(r, g, b) - min(r, g, b) <= BACKDROP_TINT


def cutout(src, dst):
    """Real transparency for a file with the backdrop baked in: flood-fill
    from the border through backdrop-coloured pixels only, so the fill stops at
    the car's outline instead of eating white paint inside it."""
    img = Image.open(src).convert('RGBA')
    W, H = img.size
    px = img.load()
    seen = bytearray(W * H)
    stack = [(x, y) for x in range(W) for y in (0, H - 1)] + [(x, y) for y in range(H) for x in (0, W - 1)]
    removed = 0
    while stack:
        x, y = stack.pop()
        i = y * W + x
        if seen[i]:
            continue
        seen[i] = 1
        if not is_backdrop(px[x, y]):
            continue
        px[x, y] = (0, 0, 0, 0)
        removed += 1
        if x > 0: stack.append((x - 1, y))
        if x < W - 1: stack.append((x + 1, y))
        if y > 0: stack.append((x, y - 1))
        if y < H - 1: stack.append((x, y + 1))
    img.save(dst, optimize=True)
    print(json.dumps({'cutout': dst, 'removed_share': round(removed / (W * H), 4)}))


def fit(src, dst, size=MASTER):
    img = Image.open(src).convert('RGBA')
    bbox = car_bbox(img)
    if not bbox:
        sys.exit(f'{src}: no opaque pixels; expected a transparent cutout')
    car = img.crop(bbox)
    W, H = size
    scale = min(BOX_W * W / car.width, BOX_H * H / car.height)
    if scale > 1.0:
        sys.exit(f'{src}: would upscale x{scale:.2f} to {W}x{H}; use --size 1200x600 or a larger source')
    car_size = (round(car.width * scale), round(car.height * scale))
    car = car.resize(car_size, Image.LANCZOS)
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    canvas.alpha_composite(car, ((W - car_size[0]) // 2, H - car_size[1]))  # tyres on the bottom edge
    canvas.save(dst, optimize=True)
    print(json.dumps({'master': dst, 'size': (W, H), 'car_px': car_size, 'scale': round(scale, 4)}))


def webp(src, dst):
    img = Image.open(src).convert('RGBA')
    tmp = dst + '.tmp.png'
    img.resize(APP, Image.LANCZOS).save(tmp)
    subprocess.run(['cwebp', '-quiet', '-q', '86', '-alpha_q', '100', '-exact', tmp, '-o', dst], check=True)
    subprocess.run(['rm', '-f', tmp], check=True)


def qa(master, mask=None, base=None):
    problems = []
    img = Image.open(master)
    if img.size not in (MASTER, APP):
        problems.append(f'size {img.size} is neither {MASTER} (master) nor {APP} (app)')
    if img.mode != 'RGBA':
        problems.append(f'mode {img.mode} is not RGBA')
    img = img.convert('RGBA')
    W, H = img.size
    alpha = img.getchannel('A')
    bbox = car_bbox(img)
    report = {'master': master, 'size': img.size}
    if not bbox:
        problems.append('no opaque pixels')
    else:
        x0, y0, x1, y1 = bbox
        w, h = (x1 - x0) / W, (y1 - y0) / H
        report.update(car_width=round(w, 4), car_height=round(h, 4), bottom_gap=round((H - y1) / H, 4),
                      centre_offset=round(((x0 + x1) / 2 - W / 2) / W, 4))
        if w > BOX_W + 0.005 or h > BOX_H + 0.005:
            problems.append(f'car exceeds the {BOX_W:.1%} x {BOX_H:.0%} box')
        if abs(w - BOX_W) > 0.01 and abs(h - BOX_H) > 0.01:
            problems.append('car is not fitted to the box (neither width nor height at its limit)')
        if (H - y1) / H > 0.005:
            problems.append('tyres are not on the bottom edge')
        if abs(report['centre_offset']) > 0.01:
            problems.append('car is not horizontally centred')
    px = alpha.load()
    edge = [px[x, 0] for x in range(W)] + [px[0, y] for y in range(H)] + [px[W - 1, y] for y in range(H)]
    if max(edge) > ALPHA_ON:
        problems.append('opaque pixels on the top/left/right edge (background, floor or clipping)')
    hist = alpha.histogram()
    semi = sum(hist[ALPHA_ON + 1:247]) / (W * H)
    report['semi_transparent'] = round(semi, 4)
    if semi > 0.03:
        problems.append(f'{semi:.1%} semi-transparent pixels: likely a shadow, floor or halo')

    if mask or base:
        if not (mask and base):
            problems.append('--mask and --base must be given together')
        else:
            m = Image.open(mask).convert('L')
            b = Image.open(base).convert('RGBA')
            if m.size != img.size or b.size != img.size:
                problems.append('mask/base size differs from master')
            else:
                mp, bp, ip = m.load(), b.load(), img.load()
                changed_outside = sum(1 for y in range(H) for x in range(W) if mp[x, y] < 128 and ip[x, y] != bp[x, y])
                report['changed_outside_mask'] = changed_outside
                if changed_outside:
                    problems.append(f'{changed_outside} pixels changed outside the paint mask')
                painted_off_car = sum(1 for y in range(H) for x in range(W) if mp[x, y] >= 128 and bp[x, y][3] <= ALPHA_ON)
                if painted_off_car:
                    problems.append(f'paint mask covers {painted_off_car} transparent pixels')

    report['problems'] = problems
    print(json.dumps(report, indent=1))
    return 0 if not problems else 1


if __name__ == '__main__':
    args = sys.argv[1:]
    if len(args) >= 3 and args[0] == 'cutout':
        cutout(args[1], args[2])
    elif len(args) >= 3 and args[0] == 'fit':
        opts = dict(zip(args[3::2], args[4::2]))
        size = tuple(int(v) for v in opts.get('--size', '2400x1200').split('x'))
        fit(args[1], args[2], size)
    elif len(args) >= 3 and args[0] == 'webp':
        webp(args[1], args[2])
    elif len(args) >= 2 and args[0] == 'qa':
        opts = dict(zip(args[2::2], args[3::2]))
        sys.exit(qa(args[1], opts.get('--mask'), opts.get('--base')))
    else:
        sys.exit(__doc__)
