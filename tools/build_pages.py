"""Assemble the static site from src/ into the repository root.

Usage:
  python3 tools/build_pages.py            # draft build (noindex, for the GitHub Pages preview)
  python3 tools/build_pages.py --live     # production build for precimechcnc.com

Template syntax inside src/pages/*.html:
  front matter between --- lines: title, description, nav, path
  {{> name}}                     include src/partials/name.html
  {{img slug sizes="..." class="..." alt="..." eager}}   responsive <img> from tools/media-manifest.json
  {{gallery}}                    full filterable work gallery
  {{clients}}                    client logo list
  {{formspree}}                  quote-form endpoint from tools/site-config.json
"""
import html, json, re, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'src'
LIVE = '--live' in sys.argv
SITE = 'https://precimechcnc.com/'
VERSION = time.strftime('%Y%m%d%H%M')

manifest = json.loads((ROOT / 'tools' / 'media-manifest.json').read_text())
# Formspree endpoints (https://formspree.io/f/<id>). Empty = quote form falls back to opening an email.
config = json.loads((ROOT / 'tools' / 'site-config.json').read_text())
IMAGES = {}
for item in manifest['work']:
    IMAGES[item['slug']] = dict(item, folder='work')
for item in manifest['facility']:
    IMAGES[item['slug']] = dict(item, folder='facility')

CATEGORIES = {
    'machining': 'CNC machining',
    'casting': 'Die casting & assembly',
    'fabrication': 'Fabrication',
    'robotics': 'Robotics & automation',
}


def attrs(text):
    found = dict(re.findall(r'(\w+)="([^"]*)"', text))
    flags = set(re.sub(r'\w+="[^"]*"', '', text).split())
    return found, flags


def img_tag(slug, sizes='100vw', cls='', alt=None, eager=False, extra=''):
    item = IMAGES[slug]
    files = item['files']
    base = f"assets/img/{item['folder']}/"
    srcset = ', '.join(f'{base}{fn} {w}w' for w, h, fn in files)
    w, h, fn = files[0]
    alt_text = item['alt'] if alt is None else alt
    loading = 'fetchpriority="high"' if eager else 'loading="lazy"'
    cls_attr = f' class="{cls}"' if cls else ''
    return (f'<img{cls_attr} src="{base}{fn}" srcset="{srcset}" sizes="{sizes}" '
            f'width="{w}" height="{h}" alt="{html.escape(alt_text)}" {loading} decoding="async"{extra}>')


def render_img(match):
    parts = match.group(1).split(None, 1)
    slug = parts[0]
    found, flags = attrs(parts[1] if len(parts) > 1 else '')
    return img_tag(slug, found.get('sizes', '100vw'), found.get('class', ''),
                   found.get('alt'), 'eager' in flags)


def render_gallery(_match=None):
    out = []
    for item in manifest['work']:
        files = item['files']
        big = files[-1]
        cat = item['cat']
        out.append(
            f'<figure class="gallery__item" data-cat="{cat}">'
            f'<button class="gallery__open" type="button" data-full="assets/img/work/{big[2]}" '
            f'data-w="{big[0]}" data-h="{big[1]}">'
            + img_tag(item['slug'], '(min-width: 1200px) 290px, (min-width: 700px) 33vw, 50vw')
            + f'<span class="sr-only">Enlarge image</span></button>'
            f'<figcaption><span class="tag">{CATEGORIES[cat]}</span>{html.escape(item["alt"])}</figcaption>'
            '</figure>')
    return '\n'.join(out)


def render_clients(_match=None):
    out = []
    for c in manifest['clients']:
        out.append(
            f'<li class="client"><img src="assets/img/clients/{c["file"]}" width="{c["w"]}" height="{c["h"]}" '
            f'alt="{html.escape(c["name"])}" loading="lazy" decoding="async"></li>')
    return '\n'.join(out)


def partial(name):
    return (SRC / 'partials' / f'{name}.html').read_text()


def expand(text):
    for _ in range(3):
        text = re.sub(r'\{\{>\s*([\w-]+)\s*\}\}', lambda m: partial(m.group(1)), text)
    text = re.sub(r'\{\{img\s+([^}]+)\}\}', render_img, text)
    text = text.replace('{{gallery}}', render_gallery())
    text = text.replace('{{clients}}', render_clients())
    return text


def build_page(path):
    raw = path.read_text()
    _, front, body = raw.split('---', 2)
    meta = dict(line.split(':', 1) for line in front.strip().splitlines())
    meta = {k.strip(): v.strip() for k, v in meta.items()}
    page_path = meta.get('path', path.name)
    doc = expand(partial('head') + partial('header') + body + partial('footer'))
    nav = meta.get('nav', '')
    if nav:
        doc = doc.replace(f'data-nav="{nav}"', f'data-nav="{nav}" aria-current="page"')
    canonical_path = '' if page_path == 'index.html' else page_path
    values = {
        'title': html.escape(meta['title']),
        'description': html.escape(meta['description']),
        'robots': 'index, follow' if LIVE else 'noindex, nofollow',
        'canonical': SITE + canonical_path,
        'version': VERSION,
        'year': time.strftime('%Y'),
        'formspree': html.escape(config.get('formspree_endpoint', '').strip()),
        'formspree_canada': html.escape(config.get('formspree_endpoint_canada', '').strip()),
    }
    for key, value in values.items():
        doc = doc.replace('{{' + key + '}}', value)
    leftover = re.findall(r'\{\{[^}]*\}\}', doc)
    if leftover:
        raise SystemExit(f'{path.name}: unresolved template tags {leftover[:5]}')
    (ROOT / page_path).write_text(doc)
    return page_path


def main():
    pages = [build_page(p) for p in sorted((SRC / 'pages').glob('*.html'))]
    if LIVE:
        robots = f'User-agent: *\nAllow: /\nSitemap: {SITE}sitemap.xml\n'
    else:
        robots = 'User-agent: *\nDisallow: /\n'
    (ROOT / 'robots.txt').write_text(robots)
    urls = '\n'.join(
        f'  <url><loc>{SITE}{"" if p == "index.html" else p}</loc></url>' for p in pages)
    (ROOT / 'sitemap.xml').write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '\n</urlset>\n')
    print(('LIVE' if LIVE else 'DRAFT') + ' build:', ', '.join(pages))


if __name__ == '__main__':
    main()
