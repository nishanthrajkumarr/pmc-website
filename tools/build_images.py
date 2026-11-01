"""Build web-ready images for the PMC site from the raw asset folders.

Usage: python3 tools/build_images.py <assets_dir> <live_site_media_dir> <site_root>
Writes WebP files under <site_root>/assets/img and prints the gallery manifest as JSON.
"""
import json, os, sys
from concurrent.futures import ProcessPoolExecutor
from PIL import Image, ImageOps

SRC, LIVE, ROOT = sys.argv[1], sys.argv[2], sys.argv[3]
OUT = os.path.join(ROOT, 'assets', 'img')

def live(prefix):
    return os.path.join(LIVE, next(f for f in os.listdir(LIVE) if f.startswith(prefix)))

def src(name):
    return os.path.join(SRC, name)

# (slug, source, category, alt, max width)
PHOTOS = [
    # CNC machining
    ('machined-parts-batch', src('Copy of IMG_8780.jpg'), 'machining', 'Batch of CNC-machined aluminium brackets and plates laid out for inspection', 1800),
    ('machined-frames-brackets', src('Copy of IMG_8782.jpg'), 'machining', 'Machined aluminium frames, brackets and mounting plates', 1800),
    ('machined-twin-pocket-frame', src('Copy of IMG_8784.jpg'), 'machining', 'Machined aluminium frame with twin rectangular pockets', 1400),
    ('machined-bracket-set', src('Copy of IMG_8785.jpg'), 'machining', 'Assorted machined brackets including a curved support arm', 1400),
    ('machined-support-plate', src('Copy of IMG_8791.jpg'), 'machining', 'Machined support plate with curved slot and counterbored holes', 1400),
    ('machined-clamp-arm', src('Copy of IMG_8792.jpg'), 'machining', 'Machined clamp arm with bored hub and slotted plates', 1400),
    ('machined-pocket-block', src('Copy of IMG_8795.jpg'), 'machining', 'Machined block with a pocketed slot and semicircular cut-out', 1400),
    ('machined-window-frames', src('Copy of IMG_8797.jpg'), 'machining', 'Machined aluminium frames with rectangular windows', 1400),
    ('machined-crossbar', src('Copy of IMG_8798.jpg'), 'machining', 'Machined crossbar and mounting blocks', 1800),
    ('machined-links', src('Copy of IMG_8799.jpg'), 'machining', 'Contoured machined links with bored holes', 1800),
    ('machined-bored-plate', src('Copy of IMG_8801.jpg'), 'machining', 'Machined aluminium plate with bored holes and a slot', 1400),
    ('machined-pin-block', src('Copy of IMG_8802.jpg'), 'machining', 'Machined block with bored holes and a pressed pin', 1400),
    ('machined-gusset', src('Copy of IMG_8805.jpg'), 'machining', 'Machined triangular gusset bracket with a hole pattern', 1400),
    ('machined-plate-insert', src('Copy of IMG_8808.jpg'), 'machining', 'Machined plate with a black anodised insert', 1400),
    ('machined-u-channel', src('Copy of IMG_8809.jpg'), 'machining', 'Small machined U-channel block', 1400),
    ('machined-mount-plate', src('Copy of IMG_8813.jpg'), 'machining', 'Machined mounting plate with a profiled edge and hole pattern', 1400),
    ('machined-small-parts', src('Copy of IMG_8815.jpg'), 'machining', 'Machined bracket set with a pocketed block', 1400),
    ('machined-l-bracket', src('Copy of IMG_8817.jpg'), 'machining', 'Machined L-shaped bracket with a profiled edge', 1400),
    ('machined-anodised-plate', src('Copy of IMG_8821.jpg'), 'machining', 'Black anodised profiled plate on a machined aluminium base', 1400),
    ('machined-ring-plate', src('Copy of IMG_8822.jpg'), 'machining', 'Machined plate with a circular recess and counterbores', 1400),
    ('machined-small-links', src('Copy of IMG_8827.jpg'), 'machining', 'Pair of small profiled machined links', 1800),
    ('machined-large-plate', src('Copy of IMG_8831.jpg'), 'machining', 'Large machined plate with face-milled pockets', 1400),
    ('machined-large-plate-2', src('Copy of IMG_8838.jpg'), 'machining', 'Large machined plate with face-milled pockets, second view', 1400),
    ('machined-spacer', src('Copy of IMG_8840.jpg'), 'machining', 'Machined spacer block with tapped holes', 1400),
    ('mould-contour-1', src('IMG_1916.png'), 'machining', 'Machined mould half with a 3D-contoured cavity', 1400),
    ('mould-contour-2', src('IMG_1917.png'), 'machining', 'Machined mould half with a 3D-contoured cavity, angled view', 1400),
    ('mould-contour-3', src('IMG_1918.png'), 'machining', 'Machined mould half with a 3D-contoured cavity, side view', 1400),
    ('mould-core', src('IMG_1919.png'), 'machining', 'Deep-pocketed machined mould core', 1400),
    ('mould-inserts', src('IMG_1923.png'), 'machining', 'Machined mould inserts with polished cavities', 1400),
    ('mould-cross-cavity', src('IMG_1925.png'), 'machining', 'Machined mould with a 3D-contoured cross-shaped cavity', 1400),
    ('mould-surface-insert', src('IMG_1926.png'), 'machining', '3D surface-machined mould insert', 1400),
    ('surface-machining-samples', src('IMG_1929.png'), 'machining', '3D surface-machined sample pieces', 1800),
    ('surface-machining-set', src('IMG_1930.png'), 'machining', 'Set of 3D surface-machining samples', 1800),
    ('machined-housing', src('IMG_1943.png'), 'machining', 'Machined housing with bored cross holes', 1400),
    ('turned-bushing', src('IMG_2150.png'), 'machining', 'Precision-turned aluminium bushing', 1800),
    ('turned-bushing-2', src('IMG_2151.png'), 'machining', 'Precision-turned aluminium bushing, bore view', 1800),
    ('profiled-frame-plate', src('IMG_20190313_134413.jpg'), 'machining', 'Profiled steel frame plate', 400),
    ('machined-flange-plate', src('IMG_20190313_134730.jpg'), 'machining', 'Machined flange plate with a bolt pattern', 400),
    ('coated-brackets', src('IMG_20190313_135000.jpg'), 'machining', 'Pair of coated machined brackets', 400),
    ('guide-rails', src('IMG_20190406_141356.jpg'), 'machining', 'Set of machined steel guide rails', 400),
    ('machined-extrusions', src('IMG_20190406_141838.jpg'), 'machining', 'Long machined aluminium extrusions', 400),
    # Die casting & assembly
    ('cast-elbow-strainer', src('IMG_2142.png'), 'casting', 'Die-cast aluminium elbow with a strainer basket', 1400),
    ('vent-valve-blue', src('IMG_2143.png'), 'casting', 'Assembled vent valve with a blue cover', 1400),
    ('valve-orange-cap', src('IMG_2144.png'), 'casting', 'Assembled valve with an orange cap', 1400),
    ('cast-flange-assembly', src('IMG_2145.png'), 'casting', 'Large cast flange plate with an assembled component', 1400),
    ('coated-handle', src('IMG_2146.png'), 'casting', 'Cast and powder-coated handle', 1400),
    ('castings-shelf', src('IMG_2147.png'), 'casting', 'Shelf of die-cast and machined components', 1800),
    ('castings-housings', src('IMG_2148.png'), 'casting', 'Die-cast housings, fittings and covers', 1800),
    ('cast-covers', src('IMG_2149.png'), 'casting', 'Two die-cast aluminium covers', 1400),
    ('cast-hubs-crate', src('IMG_2161.png'), 'casting', 'Crate of machined die-cast hubs', 1400),
    ('cast-disc-assembly', src('IMG_2163.png'), 'casting', 'Cast disc assembly with a mounted plate', 1800),
    ('cast-housing', src('IMG_2167.png'), 'casting', 'Die-cast aluminium housing with an internal passage', 1400),
    ('cast-housing-2', src('IMG_2168.png'), 'casting', 'Die-cast aluminium housing, second view', 1400),
    # Fabrication
    ('sheet-metal-enclosures', src('IMG_1414.png'), 'fabrication', 'Fabricated sheet-metal enclosures', 1400),
    ('blower-assembled', src('IMG_1434 (1).png'), 'fabrication', 'Fabricated centrifugal blower, painted and assembled with its motor', 1400),
    ('blower-fabrication', src('IMG_1435.png'), 'fabrication', 'Centrifugal blower housing during fabrication', 1800),
    ('rolled-cone', src('IMG_1779.png'), 'fabrication', 'Rolled sheet-metal cone and formed duct transition', 1400),
    # Robotics & automation
    ('lawn-robot', src('IMG_4154.png'), 'robotics', 'Autonomous tracked lawn care robot built with Concordia University', 1400),
    ('lawn-robot-2', src('IMG_4155.png'), 'robotics', 'Autonomous lawn care robot working on grass', 1400),
    ('drivetrain-bench', live('93083e'), 'robotics', 'Kinetic musical drivetrain on the test bench, built with Projet Eva', 1280),
    ('power-feed-panel', live('9f3c92'), 'robotics', 'Power feed control panel with clutch mechanism on a milling machine', 1280),
]

FACILITY = [
    ('vmc-bfw', src('machining (1).png'), 'BFW vertical machining centre with its tooling cabinet', 1536),
    ('vmc-bfw-open', src('machining (6).png'), 'BFW vertical machining centre with doors open', 1024),
    ('vmc-cosmos', src('machining (5).png'), 'Cosmos vertical machining centre', 1024),
    ('milling-machine', src('machining (4).png'), 'Conventional turret milling machine', 1024),
    ('lathe-bay', src('machining (2).png'), 'HMT lathes in the turning bay', 1536),
    ('lathe-bay-2', src('machining (3).png'), 'Lathe bay with tooling laid out', 1536),
    ('die-casting-machine', src('IMG_2152.png'), 'Die-casting machine at the casting facility', 1400),
]

LOGOS = [
    ('bombardier', src('Bombardier-Logo.png'), 'Bombardier'),
    ('nilpeter', src('nilpeter.jpg'), 'Nilpeter'),
    ('vpg', src('vishay.png'), 'VPG — Vishay Precision Group'),
    ('lt', src('image (2).png'), 'L&T'),
    ('proteck', live('c6d4ce'), 'Proteck'),
    ('royal-enfield', src('Royal-Enfield.jpg'), 'Royal Enfield'),
    ('axel-india', src('image (3).png'), 'Axel India'),
    ('tvs', src('TVS_Motor.png'), 'TVS Motor'),
    ('arcelormittal', src('ArcelorMittal-Logo.jpg'), 'ArcelorMittal'),
]

BADGES = [
    ('badge-25-years', src('image (1).png'), 360),
    ('badge-iso', src('image.png'), 360),
    ('badge-trusted-seller', live('aae0ef'), 480),
]

def load(path):
    im = Image.open(path)
    im = ImageOps.exif_transpose(im)
    return im

def save_photo(args):
    slug, path, folder, maxw = args
    im = load(path).convert('RGB')
    w, h = im.size
    out = []
    for target in sorted({min(800, maxw), maxw}):
        tw = min(target, w)
        im2 = im.resize((tw, round(h * tw / w)), Image.LANCZOS) if tw < w else im
        fn = f'{slug}-{tw}.webp'
        im2.save(os.path.join(OUT, folder, fn), 'WEBP', quality=78, method=6)
        out.append((tw, im2.size[1], fn))
    return slug, out

def trim(im, bg_tol=12):
    """Crop away a uniform border (transparent or flat colour)."""
    if im.mode == 'RGBA':
        box = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
    else:
        rgb = im.convert('RGB')
        bg = Image.new('RGB', rgb.size, rgb.getpixel((0, 0)))
        from PIL import ImageChops
        diff = ImageChops.difference(rgb, bg).convert('L').point(lambda v: 255 if v > bg_tol else 0)
        box = diff.getbbox()
    return im.crop(box) if box else im

def main():
    for d in ('work', 'facility', 'clients', 'brand'):
        os.makedirs(os.path.join(OUT, d), exist_ok=True)
    jobs = [(s, p, 'work', m) for s, p, _, _, m in PHOTOS] + [(s, p, 'facility', m) for s, p, _, m in FACILITY]
    with ProcessPoolExecutor() as ex:
        sizes = dict(ex.map(save_photo, jobs))
    manifest = {
        'work': [dict(slug=s, cat=c, alt=a, files=sizes[s]) for s, _, c, a, _ in PHOTOS],
        'facility': [dict(slug=s, alt=a, files=sizes[s]) for s, _, a, _ in FACILITY],
        'clients': [],
    }
    for slug, path, name in LOGOS:
        im = load(path)
        im = im.convert('RGBA') if im.mode in ('P', 'RGBA', 'LA') else im.convert('RGB')
        # Logos whose artwork is a full-bleed colour block keep their background.
        if slug not in ('nilpeter', 'axel-india'):
            im = trim(im)
        im.thumbnail((480, 160), Image.LANCZOS)
        fn = f'{slug}.webp'
        im.save(os.path.join(OUT, 'clients', fn), 'WEBP', quality=90, method=6)
        manifest['clients'].append(dict(slug=slug, name=name, file=fn, w=im.size[0], h=im.size[1]))
    for slug, path, size in BADGES:
        im = load(path).convert('RGBA')
        im = trim(im)
        im.thumbnail((size, size), Image.LANCZOS)
        im.save(os.path.join(OUT, 'brand', f'{slug}.webp'), 'WEBP', quality=90, method=6)
        manifest.setdefault('badges', []).append(dict(slug=slug, w=im.size[0], h=im.size[1]))
    json.dump(manifest, open(os.path.join(ROOT, 'tools', 'media-manifest.json'), 'w'), indent=1)
    print('photos', len(PHOTOS), 'facility', len(FACILITY), 'logos', len(LOGOS))

if __name__ == '__main__':
    main()
