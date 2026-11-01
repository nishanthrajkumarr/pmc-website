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

  /* ---------- RFQ form: Formspree upload, or a pre-filled email as fallback ---------- */
  const form = $('[data-rfq]');
  if (form) {
    const OFFICES = {
      india: { label: 'India office', email: 'precimechraj@yahoo.co.in' },
      canada: { label: 'Canada office', email: 'nishanth@precimechcnc.com' },
    };
    const FORMSPREE = /^https:\/\/formspree\.io\/f\/[\w-]+$/;
    const endpoints = {
      india: (form.dataset.endpoint || '').trim(),
      canada: (form.dataset.endpointCanada || '').trim() || (form.dataset.endpoint || '').trim(),
    };
    const formspreeMode = FORMSPREE.test(endpoints.india);
    const uploadsEnabled = formspreeMode && !!$('[data-upload]', form);
    form.classList.toggle('is-formspree', formspreeMode);
    form.classList.toggle('has-uploads', uploadsEnabled);
    if (!formspreeMode) form.removeAttribute('action');
    const label = $('[data-rfq-label]', form);
    if (formspreeMode && label) label.textContent = 'Send request';

    // Pre-select the service from ?service=<slug>; pick the office from the ship-to country.
    const params = new URLSearchParams(location.search);
    const service = params.get('service');
    if (service) {
      const opt = $$('option', form.service).find((o) => o.value === service || o.dataset.slug === service);
      if (opt) form.service.value = opt.value;
    }
    form.country.addEventListener('change', () => {
      const ca = ['Canada', 'United States', 'Mexico'].includes(form.country.value);
      const target = form.querySelector(`input[name="office"][value="${ca ? 'canada' : 'india'}"]`);
      if (target) target.checked = true;
    });

    const values = () => {
      const data = new FormData(form);
      const get = (k) => (data.get(k) || '').toString().trim();
      const office = OFFICES[get('office')] ? get('office') : 'india';
      const subject = `RFQ: ${get('service') || 'Custom part'}${get('company') ? ` — ${get('company')}` : ''}`;
      return { get, office, subject };
    };

    /* --- File selection (upload mode) --- */
    const MAX_FILES = 10;
    const MAX_FILE = 25 * 1024 * 1024;
    const MAX_TOTAL = 95 * 1024 * 1024; // Formspree caps the whole request at 100 MB.
    const input = $('[data-files]', form);
    const zone = $('[data-dropzone]', form);
    const list = $('[data-file-list]', form);
    const fileError = $('[data-file-error]', form);
    let files = [];
    const fmt = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
    const showFileError = (msg) => { if (fileError) { fileError.textContent = msg; fileError.hidden = !msg; } };
    const syncInput = () => {
      try {
        const dt = new DataTransfer();
        files.forEach((f) => dt.items.add(f));
        input.files = dt.files;
      } catch { /* Older browsers: the files array is still what gets submitted. */ }
    };
    const render = () => {
      if (!list) return;
      list.replaceChildren(...files.map((f, i) => {
        const li = document.createElement('li');
        li.className = 'file';
        li.innerHTML = '<svg class="i" aria-hidden="true"><use href="#i-file"/></svg><span class="file__name"></span><span class="file__size"></span>'
          + '<button class="file__remove" type="button"><svg class="i" aria-hidden="true"><use href="#i-close"/></svg></button>';
        $('.file__name', li).textContent = f.name;
        $('.file__size', li).textContent = fmt(f.size);
        const rm = $('.file__remove', li);
        rm.setAttribute('aria-label', `Remove ${f.name}`);
        rm.addEventListener('click', () => {
          files.splice(i, 1);
          syncInput(); render(); showFileError('');
          (list.querySelectorAll('.file__remove')[Math.min(i, files.length - 1)] || input).focus();
        });
        return li;
      }));
    };
    const addFiles = (incoming) => {
      const problems = [];
      for (const f of incoming) {
        if (files.some((x) => x.name === f.name && x.size === f.size)) continue;
        if (f.size > MAX_FILE) { problems.push(`${f.name} is over 25 MB`); continue; }
        if (files.length >= MAX_FILES) { problems.push('You can attach up to 10 files'); break; }
        if (files.reduce((t, x) => t + x.size, 0) + f.size > MAX_TOTAL) { problems.push('Files can total up to 95 MB per request'); break; }
        files.push(f);
      }
      syncInput(); render();
      showFileError(problems.length ? `${problems.join('. ')}. For larger files, email them to us or send a download link in the project details.` : '');
    };
    if (input) {
      input.addEventListener('change', () => addFiles(Array.from(input.files)));
      ['dragenter', 'dragover'].forEach((t) => zone.addEventListener(t, () => zone.classList.add('is-over')));
      ['dragleave', 'drop'].forEach((t) => zone.addEventListener(t, () => zone.classList.remove('is-over')));
    }

    /* --- Submission --- */
    const body = $('[data-rfq-body]', form);
    const done = $('[data-rfq-done]', form);
    const doneMsg = $('[data-rfq-done-msg]', form);
    const submitBtn = $('[data-rfq-submit]', form);
    const progress = $('[data-rfq-progress]', form);
    const bar = $('[data-rfq-progress-bar]', form);
    const progressText = $('[data-rfq-progress-text]', form);
    const errorBox = $('[data-rfq-error]', form);
    const setBusy = (busy) => {
      submitBtn.disabled = busy;
      form.setAttribute('aria-busy', String(busy));
      progress.hidden = !busy;
      if (busy) { bar.style.width = '0%'; progressText.textContent = files.length ? 'Uploading… 0%' : 'Sending…'; }
    };
    const showError = (detail, office) => {
      const to = OFFICES[office].email;
      errorBox.innerHTML = '';
      errorBox.append(`We couldn't send your request${detail ? ` (${detail})` : ''}. Please try again, or email it with your drawings to `);
      const a = document.createElement('a');
      a.href = `mailto:${to}`;
      a.textContent = to;
      errorBox.append(a, '.');
      errorBox.hidden = false;
    };

    const sendUpload = () => {
      const { get, office, subject } = values();
      const data = new FormData(form);
      data.delete('attachment');
      files.forEach((f) => data.append('attachment', f, f.name));
      data.set('_subject', `${subject} (${OFFICES[office].label})`);
      data.set('office', OFFICES[office].label);
      errorBox.hidden = true;
      setBusy(true);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', endpoints[office]);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.timeout = 180000;
      xhr.upload.addEventListener('progress', (e) => {
        if (!e.lengthComputable) return;
        const pct = Math.min(100, Math.round((e.loaded / e.total) * 100));
        bar.style.width = `${pct}%`;
        progressText.textContent = pct < 100 ? `Uploading… ${pct}%` : 'Finishing…';
      });
      xhr.addEventListener('load', () => {
        setBusy(false);
        let res = {};
        try { res = JSON.parse(xhr.responseText || '{}'); } catch { /* non-JSON error page */ }
        if (xhr.status >= 200 && xhr.status < 300 && res.ok !== false) {
          const n = files.length;
          const first = get('name').split(' ')[0] || 'and welcome';
          const shared = n || get('drawing_link');
          doneMsg.textContent = `Thanks, ${first}. Your request${n ? ` and ${n} file${n > 1 ? 's' : ''}` : ''} reached our team, and our ${OFFICES[office].label} will reply to ${get('email')} with a price and lead time.`
            + (shared ? '' : ` If you have drawings, email them to ${OFFICES[office].email} and mention your name.`);
          form.reset();
          files = []; syncInput(); render(); showFileError('');
          body.hidden = true;
          done.hidden = false;
          done.focus();
          done.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' });
        } else {
          const detail = Array.isArray(res.errors) ? res.errors.map((e) => e.message).join(' ') : (res.error || `error ${xhr.status}`);
          if (/file uploads not permitted/i.test(detail)) showError('file uploads are switched off right now, so please remove the attached files and send again', office);
          else showError(detail, office);
        }
      });
      xhr.addEventListener('error', () => { setBusy(false); showError('network error', office); });
      xhr.addEventListener('timeout', () => { setBusy(false); showError('the upload took too long', office); });
      xhr.send(data);
    };

    const result = $('[data-rfq-result]');
    const preview = $('[data-rfq-preview]');
    const copyBtn = $('[data-rfq-copy]');
    const addr = $('[data-rfq-address]');
    let lastText = '';
    const sendEmail = () => {
      const { get, office, subject } = values();
      const to = OFFICES[office].email;
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
        `Drawing link: ${get('drawing_link') || '—'}`,
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
      if (preview) preview.textContent = lastText;
      if (addr) { addr.textContent = to; addr.href = `mailto:${to}`; }
      if (result) { result.hidden = false; result.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'nearest' }); }
      window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      if (formspreeMode) sendUpload(); else sendEmail();
    });
    $('[data-rfq-again]', form).addEventListener('click', () => {
      done.hidden = true;
      body.hidden = false;
      form.name.focus();
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
