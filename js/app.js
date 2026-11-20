(function () {
  'use strict';

  const TOTAL = 8;
  const content = window.PRESENTATION_CONTENT;
  if (!content) return;
  const { UI, SLIDES } = content;

  const html = document.documentElement;
  const slides = Array.from(document.querySelectorAll('.slide'));
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const nextLabel = document.getElementById('nextLabel');
  const nextIcon = document.getElementById('nextIcon');
  const restartIcon = document.getElementById('restartIcon');
  const restartBtn = document.getElementById('restartBtn');
  const indicator = document.getElementById('slideIndicator');
  const progressBar = document.getElementById('progressBar');
  const progressFill = document.getElementById('progressFill');
  const dotsWrap = document.getElementById('dots');
  const langToggle = document.getElementById('langToggle');
  const langIndicator = document.getElementById('langIndicator');
  const fullscreenToggle = document.getElementById('fullscreenToggle');
  const viewport = document.getElementById('slidesViewport');

  let current = 0;
  let lang = 'en';
  let isTransitioning = false;

  function pad(n) { return String(n).padStart(2, '0'); }

  function buildDots() {
    dotsWrap.innerHTML = '';
    for (let i = 0; i < TOTAL; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dot';
      b.dataset.index = String(i);
      b.setAttribute('role', 'tab');
      b.addEventListener('click', () => goTo(i));
      dotsWrap.appendChild(b);
    }
  }

  function isEditableTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function tUI(key) { return (UI[lang] && UI[lang][key]) || UI.en[key] || key; }
  function tSlide(key) {
    const [s, k] = key.split('.');
    return (SLIDES[lang] && SLIDES[lang][s] && SLIDES[lang][s][k]) || (SLIDES.en[s] && SLIDES.en[s][k]) || '';
  }

  function applyLanguage() {
    html.lang = lang;
    html.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = tUI('title');

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const val = key.indexOf('.') > -1 && /^s\d+\./.test(key) ? tSlide(key) : tUI(key);
      if (val != null && val !== '') el.textContent = val;
    });
    document.querySelectorAll('[data-i18n-svg]').forEach(el => {
      const key = el.getAttribute('data-i18n-svg');
      const val = tSlide(key);
      if (val != null && val !== '') el.textContent = val;
    });

    // UI-specific dynamic labels
    langIndicator.textContent = lang === 'en' ? 'AR' : 'EN';
    langToggle.setAttribute('aria-label', tUI('aria.lang'));
    langToggle.title = tUI('aria.lang');

    prevBtn.setAttribute('aria-label', tUI('aria.prev'));
    prevBtn.querySelector('span[data-i18n]').textContent = tUI('nav.prev');

    updateNavState();
    updateFullscreenLabel();
    updateAriaSlides();
    updateDotsAria();
  }

  function updateAriaSlides() {
    slides.forEach((s, i) => {
      const label = `${tUI('aria.slide')} ${i + 1} ${tUI('aria.of')} ${TOTAL}`;
      s.setAttribute('aria-label', label);
    });
  }

  function updateDotsAria() {
    const dots = dotsWrap.querySelectorAll('.dot');
    dots.forEach((d, i) => {
      d.setAttribute('aria-label', `${tUI('aria.goto')} ${i + 1}`);
      d.setAttribute('aria-selected', i === current ? 'true' : 'false');
      d.tabIndex = i === current ? 0 : -1;
    });
  }

  function updateNavState() {
    const atStart = current === 0;
    const atEnd = current === TOTAL - 1;
    prevBtn.disabled = atStart;

    indicator.textContent = `${pad(current + 1)} / ${pad(TOTAL)}`;
    const pct = ((current + 1) / TOTAL) * 100;
    progressFill.style.width = pct + '%';
    progressBar.setAttribute('aria-valuenow', String(current + 1));
    progressBar.setAttribute('aria-label', tUI('aria.progress'));

    if (atEnd) {
      nextLabel.textContent = tUI('nav.restart');
      nextBtn.setAttribute('aria-label', tUI('aria.restart'));
      nextIcon.style.display = 'none';
      restartIcon.style.display = 'block';
    } else {
      nextLabel.textContent = tUI('nav.next');
      nextBtn.setAttribute('aria-label', tUI('aria.next'));
      nextIcon.style.display = 'block';
      restartIcon.style.display = 'none';
    }

    updateDotsAria();
  }

  function restartAnimations(slide) {
    // retrigger CSS animations for elements inside active slide
    const animated = slide.querySelectorAll('.bar, .line-observed, .line-projected, .meter-fill, .result-line, .future-card, .hero-title .line, .tagline, .hero-sub, .eyebrow, .row, .viz-sources .source');
    animated.forEach(el => {
      el.style.animation = 'none';
      // force reflow
      void el.offsetHeight;
      el.style.animation = '';
    });
  }

  function goTo(index) {
    if (index < 0 || index >= TOTAL || index === current || isTransitioning) return;
    const dir = index > current ? 1 : -1;
    const prev = current;
    const prevSlide = slides[prev];
    const nextSlide = slides[index];

    isTransitioning = true;
    // In RTL visual flow, forward means moving leftwards in content logic but our classes handle transform;
    // we set exit class based on navigation direction in logical terms
    prevSlide.classList.remove('is-active');
    prevSlide.classList.add(dir > 0 ? 'exit-left' : 'exit-right');
    prevSlide.setAttribute('aria-hidden', 'true');

    nextSlide.classList.remove('exit-left', 'exit-right');
    // ensure starting position for enter animation
    nextSlide.style.transition = 'none';
    nextSlide.classList.remove('is-active');
    void nextSlide.offsetHeight;
    nextSlide.style.transition = '';
    nextSlide.classList.add('is-active');
    nextSlide.setAttribute('aria-hidden', 'false');

    current = index;
    updateNavState();
    restartAnimations(nextSlide);

    const done = () => {
      prevSlide.classList.remove('exit-left', 'exit-right');
      isTransitioning = false;
      prevSlide.removeEventListener('transitionend', onEnd);
    };
    const onEnd = (e) => { if (e.target === prevSlide && e.propertyName === 'opacity') done(); };
    prevSlide.addEventListener('transitionend', onEnd);
    // fallback
    setTimeout(done, 800);
  }

  function next() {
    if (current === TOTAL - 1) { goTo(0); return; }
    goTo(current + 1);
  }
  function prev() { goTo(current - 1); }

  // Buttons
  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);
  restartBtn.addEventListener('click', () => goTo(0));

  // Language
  langToggle.addEventListener('click', () => {
    lang = lang === 'en' ? 'ar' : 'en';
    applyLanguage();
  });

  // Fullscreen
  function isFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function updateFullscreenLabel() {
    const active = isFullscreen();
    const label = active ? tUI('aria.fullscreenExit') : tUI('aria.fullscreenEnter');
    fullscreenToggle.setAttribute('aria-label', label);
    fullscreenToggle.setAttribute('aria-pressed', active ? 'true' : 'false');
    fullscreenToggle.title = label;
  }
  async function toggleFullscreen() {
    try {
      if (!isFullscreen()) {
        const el = document.documentElement;
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      } else {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      }
    } catch (e) { /* ignore */ }
  }
  fullscreenToggle.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', updateFullscreenLabel);
  document.addEventListener('webkitfullscreenchange', updateFullscreenLabel);

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (isEditableTarget(e.target)) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const rtl = html.dir === 'rtl';
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        rtl ? prev() : next();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        rtl ? next() : prev();
        break;
      case ' ':
      case 'Spacebar':
        e.preventDefault();
        next();
        break;
      case 'Home':
        e.preventDefault();
        goTo(0);
        break;
      case 'End':
        e.preventDefault();
        goTo(TOTAL - 1);
        break;
      default:
        break;
    }
  });

  // Swipe / pointer
  let pointerId = null;
  let startX = 0, startY = 0, startT = 0;
  let dragging = false;
  let lockedAxis = null;

  function shouldIgnoreSwipe(target) {
    return !!target.closest('button, a, input, textarea, select, .dots, [data-no-swipe]');
  }

  viewport.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (shouldIgnoreSwipe(e.target)) return;
    pointerId = e.pointerId;
    startX = e.clientX; startY = e.clientY; startT = Date.now();
    dragging = true; lockedAxis = null;
  });

  viewport.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!lockedAxis) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        lockedAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
    }
    // if horizontal swipe, prevent accidental behaviors by capturing intent; we don't block vertical scroll of inner elements (none by default)
  });

  function endPointer(e) {
    if (!dragging || (e.pointerId != null && e.pointerId !== pointerId)) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const dt = Date.now() - startT;
    dragging = false; pointerId = null;
    if (lockedAxis !== 'x') return;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX < 45 || absX < absY * 1.2) return;
    if (dt > 900) return;
    const rtl = html.dir === 'rtl';
    // In LTR: swipe left (dx negative) -> next, swipe right -> prev
    // In RTL: mirror so gesture feels natural with visual flow
    if (!rtl) {
      if (dx < 0) next(); else prev();
    } else {
      if (dx < 0) prev(); else next();
    }
  }
  viewport.addEventListener('pointerup', endPointer);
  viewport.addEventListener('pointercancel', (e) => { if (e.pointerId === pointerId) { dragging = false; pointerId = null; } });

  // Prevent context menu interfering? not necessary
  // Init
  buildDots();
  applyLanguage();
  updateNavState();
  // Ensure correct initial states
  slides.forEach((s, i) => {
    s.setAttribute('aria-hidden', i === 0 ? 'false' : 'true');
    if (i === 0) s.classList.add('is-active'); else s.classList.remove('is-active');
  });
})();