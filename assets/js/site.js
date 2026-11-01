/* PMC Industrial Solutions — site behaviour (no dependencies). */
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- Header: scrolled state + mobile menu ---------- */
  const header = $('[data-header]');
  const toggle = $('[data-nav-toggle]');
  const nav = $('[data-nav]');
  const onScroll = () => header && header.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const setNav = (open) => {
    if (!toggle || !nav) return;
    if (open) {
      const rect = header.getBoundingClientRect();
      nav.style.setProperty('--nav-top', `${Math.max(0, rect.bottom)}px`);
    }
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('nav-open', open);
  };
  if (toggle) {
    toggle.addEventListener('click', () => setNav(toggle.getAttribute('aria-expanded') !== 'true'));
    $$('a', nav).forEach((a) => a.addEventListener('click', () => setNav(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setNav(false); toggle.focus(); }
    });
    window.matchMedia('(min-width: 1061px)').addEventListener('change', (e) => e.matches && setNav(false));
  }

  /* ---------- Videos: play only while visible, honour reduced motion ---------- */
  const videos = $$('video[data-autoplay]');
  const userPaused = new WeakSet();
  const tryPlay = (v) => {
    if (reduceMotion.matches || userPaused.has(v)) return;
    if (v.preload === 'none') v.preload = 'auto';
    const p = v.play();
    if (p && p.catch) p.catch(() => {});
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => (isIntersecting ? tryPlay(target) : target.pause()));
    }, { rootMargin: '120px 0px', threshold: 0.15 });
    videos.forEach((v) => io.observe(v));
  } else {
    videos.forEach(tryPlay);
  }
  // Play/pause buttons (WCAG 2.2.2 for moving content).
  $$('[data-video-toggle]').forEach((btn) => {
    const v = document.getElementById(btn.getAttribute('aria-controls'));
    if (!v) return;
    const sync = () => btn.setAttribute('aria-pressed', String(v.paused));
    v.addEventListener('play', sync);
    v.addEventListener('pause', sync);
    btn.addEventListener('click', () => {
      if (v.paused) { userPaused.delete(v); v.preload = 'auto'; v.play().catch(() => {}); }
      else { userPaused.add(v); v.pause(); }
    });
    sync();
  });
  reduceMotion.addEventListener('change', () => videos.forEach((v) => (reduceMotion.matches ? v.pause() : tryPlay(v))));

  /* ---------- Reveal on scroll ---------- */
  const reveals = $$('[data-reveal]');
  if ('IntersectionObserver' in window && !reduceMotion.matches) {
    const ro = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); ro.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach((el) => ro.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- Gallery filters ---------- */
  const gallery = $('[data-gallery]');
  if (gallery) {
    const items = $$('.gallery__item', gallery);
    const status = $('[data-gallery-status]');
    const filters = $$('[data-filter]');
    filters.forEach((btn) => {
      const cat = btn.dataset.filter;
      const count = cat === 'all' ? items.length : items.filter((i) => i.dataset.cat === cat).length;
      const badge = $('.filter__count', btn);
      if (badge) badge.textContent = count;
    });
    const apply = (cat, push) => {
      if (!filters.some((b) => b.dataset.filter === cat)) cat = 'all';
      filters.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === cat)));
      let shown = 0;
      items.forEach((i) => { const on = cat === 'all' || i.dataset.cat === cat; i.hidden = !on; shown += on; });
      if (status) {
        const label = filters.find((b) => b.dataset.filter === cat)?.dataset.label || 'all work';
        status.textContent = `Showing ${shown} ${shown === 1 ? 'photo' : 'photos'} — ${label}`;
      }
      if (push) history.replaceState(null, '', cat === 'all' ? location.pathname : `#${cat}`);
    };
    filters.forEach((b) => b.addEventListener('click', () => apply(b.dataset.filter, true)));
    apply(location.hash.slice(1) || 'all', false);
  }

  /* ---------- Lightbox ---------- */
  const box = $('[data-lightbox]');
  if (box) {
    const img = $('[data-lightbox-img]', box);
    const cap = $('[data-lightbox-caption]', box);
    let list = [];
    let index = 0;
    let opener = null;
    const show = (i) => {
      index = (i + list.length) % list.length;
      const btn = list[index];
      const thumb = $('img', btn);
      img.src = btn.dataset.full;
      img.width = Number(btn.dataset.w) || 0;
      img.height = Number(btn.dataset.h) || 0;
      img.alt = thumb ? thumb.alt : '';
      cap.textContent = `${thumb ? thumb.alt : ''}  ·  ${index + 1} / ${list.length}`;
    };
    const open = (btn) => {
      list = $$('.gallery__open').filter((b) => !b.closest('[hidden]'));
      opener = btn;
      show(list.indexOf(btn));
      box.hidden = false;
      document.body.style.overflow = 'hidden';
      $('.lightbox__close', box).focus();
    };
    const close = () => {
      box.hidden = true;
      img.removeAttribute('src');
      document.body.style.overflow = '';
      if (opener) opener.focus();
    };
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.gallery__open');
      if (btn) open(btn);
    });
    $$('[data-lightbox-close]', box).forEach((el) => el.addEventListener('click', close));
    $('[data-lightbox-prev]', box).addEventListener('click', () => show(index - 1));
    $('[data-lightbox-next]', box).addEventListener('click', () => show(index + 1));
    document.addEventListener('keydown', (e) => {
      if (box.hidden) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(index - 1);
      else if (e.key === 'ArrowRight') show(index + 1);
      else if (e.key === 'Tab') {
        const focusables = $$('button', box);
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ---------- RFQ form → pre-filled email ---------- */
  const form = $('[data-rfq]');
  if (form) {
    const params = new URLSearchParams(location.search);
    const service = params.get('service');
    if (service) {
      const opt = $$('option', form.service).find((o) => o.value === service || o.dataset.slug === service);
      if (opt) form.service.value = opt.value;
    }
    const country = form.country;
    if (country) {
      country.addEventListener('change', () => {
        const ca = ['Canada', 'United States', 'Mexico'].includes(country.value);
        const target = form.querySelector(`input[name="office"][value="${ca ? 'canada' : 'india'}"]`);
        if (target) target.checked = true;
      });
    }
    const result = $('[data-rfq-result]');
    const preview = $('[data-rfq-preview]');
    const copyBtn = $('[data-rfq-copy]');
    const addr = $('[data-rfq-address]');
    const OFFICES = {
      india: 'precimechraj@yahoo.co.in',
      canada: 'nishanthrajkumar1@gmail.com',
    };
    let lastText = '';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const data = new FormData(form);
      const get = (k) => (data.get(k) || '').toString().trim();
      const office = get('office') || 'india';
      const to = OFFICES[office];
      const subject = `RFQ: ${get('service') || 'Custom part'}${get('company') ? ` — ${get('company')}` : ''}`;
      const lines = [
        'Hello PMC team,',
        '',
        'Please quote the following:',
        '',
        `Service: ${get('service') || 'Not sure'}`,
        `Material: ${get('material') || '—'}`,
        `Quantity: ${get('quantity') || '—'}`,
        `Required by: ${get('deadline') || '—'}`,
        `Ship to: ${get('country') || '—'}`,
        '',
        'Project details:',
        get('details'),
        '',
        'Drawings attached: [attach PDF / DXF / STEP / IGES files to this email]',
        '',
        'Thank you,',
        get('name'),
        get('company'),
        get('email'),
        get('phone'),
      ].filter((l, i, arr) => !(l === '' && arr[i - 1] === ''));
      lastText = `To: ${to}\nSubject: ${subject}\n\n${lines.join('\n')}`;
      const href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
      if (preview) preview.textContent = lastText;
      if (addr) { addr.textContent = to; addr.href = `mailto:${to}`; }
      if (result) { result.hidden = false; result.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'nearest' }); }
      window.location.href = href;
    });
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(lastText);
          copyBtn.textContent = 'Copied';
        } catch {
          const range = document.createRange();
          range.selectNodeContents(preview);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          copyBtn.textContent = 'Selected — press Ctrl/Cmd+C';
        }
        setTimeout(() => { copyBtn.textContent = 'Copy request'; }, 2500);
      });
    }
  }
})();
