"""Render a dot-matrix world map SVG from Natural Earth land (world-atlas land-110m TopoJSON).

Usage: python3 tools/build_map.py <land-110m.json> <out.svg>
Projection is equirectangular: x = lon + 180, y = 80 - lat (viewBox 0 0 360 138).
"""
import json, sys
from PIL import Image, ImageDraw

LAT_TOP, LAT_BOTTOM, STEP = 80, -58, 2.0
topo = json.load(open(sys.argv[1]))
sx, sy = topo['transform']['scale']
tx, ty = topo['transform']['translate']

arcs = []
for arc in topo['arcs']:
    x = y = 0
    pts = []
    for dx, dy in arc:
        x += dx; y += dy
        pts.append((x * sx + tx, y * sy + ty))
    arcs.append(pts)

def ring(indices):
    pts = []
    for i in indices:
        a = arcs[i] if i >= 0 else arcs[~i][::-1]
        pts.extend(a if not pts else a[1:])
    return pts

SCALE = 8
W, H = 360 * SCALE, (LAT_TOP - LAT_BOTTOM) * SCALE
mask = Image.new('L', (W, H), 0)
draw = ImageDraw.Draw(mask)
for geom in topo['objects']['land']['geometries']:
    polys = geom['arcs'] if geom['type'] == 'MultiPolygon' else [geom['arcs']]
    for poly in polys:
        for k, r in enumerate(poly):
            # Unwrap longitudes so rings crossing the antimeridian stay continuous,
            # then draw shifted copies to cover both edges of the map.
            unwrapped, prev = [], None
            for lon, lat in ring(r):
                if prev is not None:
                    while lon - prev > 180: lon -= 360
                    while lon - prev < -180: lon += 360
                unwrapped.append((lon, lat)); prev = lon
            for shift in (-360, 0, 360):
                pts = [((lon + shift + 180) * SCALE, (LAT_TOP - lat) * SCALE) for lon, lat in unwrapped]
                draw.polygon(pts, fill=255 if k == 0 else 0)

d = []
lat = LAT_TOP - STEP / 2
while lat > LAT_BOTTOM:
    lon = -180 + STEP / 2
    while lon < 180:
        px, py = int((lon + 180) * SCALE), int((LAT_TOP - lat) * SCALE)
        if mask.getpixel((px, py)):
            d.append(f'M{lon + 180:.0f} {LAT_TOP - lat:.0f}h0')
        lon += STEP
    lat -= STEP

svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 138">'
       '<path fill="none" stroke="#9aa3af" stroke-width="1.15" stroke-linecap="round" d="'
       + ''.join(d) + '"/></svg>')
open(sys.argv[2], 'w').write(svg)
print(len(d), 'dots', len(svg), 'bytes')
