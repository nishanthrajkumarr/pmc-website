# precimechcnc.com — PMC Industrial Solutions

Static website for PMC Industrial Solutions (CNC machining, die casting, fabrication).
Plain HTML/CSS/JS with no runtime dependencies, so it can be served by GitHub Pages or any static host.

## Editing

Edit the sources in `src/`, then rebuild the pages:

```bash
python3 tools/build_pages.py          # draft build: noindex, robots.txt disallows crawling
python3 tools/build_pages.py --live   # production build for precimechcnc.com
```

- `src/pages/*.html`: one file per page (front matter sets the title, description and active nav item)
- `src/partials/`: shared head, header, footer and quote band
- `assets/css/site.css`, `assets/js/site.js`: all styles and behaviour
- `{{img slug ...}}` inserts a responsive image from `tools/media-manifest.json`

## Media

Photos and videos are generated from the original asset folder:

```bash
python3 tools/build_images.py "<assets folder>" "<live-site media folder>" .
tools/build_videos.sh "<assets folder>" "<live-site media folder>" .
python3 tools/build_map.py land-110m.json assets/img/world-dots.svg
```

To add a gallery photo, add a line to `PHOTOS` in `tools/build_images.py`, rerun it, then rebuild the pages.

## Quote form (Formspree)

The contact form uploads drawings through [Formspree](https://formspree.io). File uploads need a paid
Formspree plan (Personal or higher). Formspree allows 10 files per submission, 25 MB each, and 100 MB per request.

1. In Formspree, create a form and set its notification emails (for example, both office addresses).
2. In the form's settings, turn off Formspree's reCAPTCHA. The site submits with JavaScript, and the built-in `_gotcha` honeypot handles spam.
3. Put the endpoint in `tools/site-config.json`, for example `"formspree_endpoint": "https://formspree.io/f/abcdwxyz"`.
   To route Canada requests to a separate form, also set `formspree_endpoint_canada`.
4. Rebuild with `python3 tools/build_pages.py`, then commit and push.

With no endpoint set, the form falls back to opening the visitor's email app with the request pre-filled.

## Going live on precimechcnc.com

1. `python3 tools/build_pages.py --live`, add a `CNAME` file containing `precimechcnc.com`, commit and push.
2. In GoDaddy DNS, point the apex `A` records to GitHub Pages
   (185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153) and set `www` as a `CNAME` to `<user>.github.io`.
3. In the repository's Settings → Pages, set the custom domain and enable "Enforce HTTPS" once the certificate is issued.
