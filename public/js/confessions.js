/**
 * Confessions feed — composer expand, infinite scroll, relative time, read-more,
 * gentle pause nudge after extended scrolling.
 */
(function () {
  'use strict';

  // ─── Composer: expand on focus, autosize, char counter, submit guard ────
  (function () {
    var form = document.getElementById('confessComposer');
    if (!form) return;
    var body = document.getElementById('composerBody');
    var actions = document.getElementById('composerActions');
    var counter = document.getElementById('composerCounter');
    var share = form.querySelector('.composer-share');
    var MAX = 2000;

    function autosize() {
      body.style.height = 'auto';
      body.style.height = Math.min(body.scrollHeight, 280) + 'px';
    }

    function expand() {
      if (actions.hasAttribute('hidden')) actions.removeAttribute('hidden');
    }

    function collapseIfEmpty() {
      if (!body.value.trim() && document.activeElement !== body) {
        actions.setAttribute('hidden', '');
        body.style.height = '';
      }
    }

    function refreshCounter() {
      var len = body.value.length;
      counter.textContent = len + ' / ' + MAX;
      counter.classList.toggle('is-warn', len > MAX * 0.9 && len <= MAX);
      counter.classList.toggle('is-error', len > MAX);
      if (share) share.disabled = len < 4 || len > MAX;
    }

    body.addEventListener('focus', expand);
    body.addEventListener('blur', function () {
      // Defer so click on the share button still works
      setTimeout(collapseIfEmpty, 120);
    });
    body.addEventListener('input', function () {
      autosize();
      refreshCounter();
      if (body.value.trim()) expand();
    });

    refreshCounter();
  })();

  // ─── Relative timestamps ─────────────────────────────────────────────
  function relativeFromIso(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    var diff = Date.now() - d.getTime();
    var sec = Math.round(diff / 1000);
    if (sec < 30) return 'just now';
    if (sec < 60) return sec + 's';
    var min = Math.round(sec / 60);
    if (min < 60) return min + 'm';
    var hr = Math.round(min / 60);
    if (hr < 24) return hr + 'h';
    var day = Math.round(hr / 24);
    if (day < 7) return day + 'd';
    var wk = Math.round(day / 7);
    if (wk < 4) return wk + 'w';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function paintTimes(scope) {
    (scope || document).querySelectorAll('.confess-time').forEach(function (el) {
      var iso = el.getAttribute('data-time');
      if (!iso) return;
      var rel = relativeFromIso(iso);
      if (rel) el.textContent = rel;
    });
  }
  paintTimes();
  setInterval(paintTimes, 60 * 1000);

  // ─── Read more (delegated) ───────────────────────────────────────────
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.confess-readmore');
    if (!btn) return;
    var p = btn.closest('.confess-body-collapsed');
    if (!p) return;
    var encoded = p.getAttribute('data-full');
    if (!encoded) return;
    try {
      var full = decodeURIComponent(encoded);
      var span = p.querySelector('.confess-body-text');
      if (span) span.textContent = full;
      btn.remove();
      p.classList.remove('confess-body-collapsed');
    } catch (err) { /* noop */ }
  });

  // ─── Reactions: optimistic UI (form still submits + redirects) ──────
  document.addEventListener('submit', function (e) {
    var form = e.target.closest('.confess-react-form');
    if (!form) return;
    var btn = form.querySelector('.confess-react');
    var count = form.querySelector('.confess-react-count');
    if (!btn || !count) return;
    var card = form.closest('.confess-card');
    if (!card) return;

    var wasOn = btn.classList.contains('is-on');
    // Find any other reaction button on the same card that's currently on
    var prevOn = card.querySelector('.confess-react.is-on');

    if (wasOn) {
      // Toggling off
      btn.classList.remove('is-on');
      var n = parseInt(count.textContent, 10) || 0;
      count.textContent = String(Math.max(0, n - 1));
    } else {
      // Switching to a new reaction or adding the first
      if (prevOn && prevOn !== btn) {
        prevOn.classList.remove('is-on');
        var pc = prevOn.querySelector('.confess-react-count');
        if (pc) pc.textContent = String(Math.max(0, (parseInt(pc.textContent, 10) || 0) - 1));
      }
      btn.classList.add('is-on');
      count.textContent = String((parseInt(count.textContent, 10) || 0) + 1);
    }
    // Form still submits as POST → redirect normalizes state.
  });

  // ─── Sticky toolbar shadow ───────────────────────────────────────────
  (function () {
    var toolbar = document.querySelector('.confess-toolbar');
    if (!toolbar) return;
    var sentinel = document.createElement('div');
    sentinel.style.cssText = 'position:absolute;height:1px;width:1px;top:-1px;';
    toolbar.parentElement.insertBefore(sentinel, toolbar);
    var io = new IntersectionObserver(function (entries) {
      toolbar.classList.toggle('is-stuck', !entries[0].isIntersecting);
    }, { rootMargin: '0px' });
    io.observe(sentinel);
  })();

  // ─── Infinite scroll ─────────────────────────────────────────────────
  (function () {
    var page = document.querySelector('.confess-page');
    var feed = document.getElementById('confessFeed');
    var sentinel = document.getElementById('confessSentinel');
    if (!page || !feed || !sentinel) return;

    var pageSize = parseInt(page.getAttribute('data-page-size'), 10) || 20;
    var mood = page.getAttribute('data-mood') || '';
    var sort = page.getAttribute('data-sort') || 'newest';
    var loading = false;
    var cardsLoadedTotal = feed.querySelectorAll('.confess-card').length;
    var nudgeShown = false;

    function buildUrl() {
      var offset = parseInt(sentinel.getAttribute('data-offset'), 10) || 0;
      var params = new URLSearchParams();
      params.set('offset', String(offset));
      if (mood) params.set('mood', mood);
      if (sort && sort !== 'newest') params.set('sort', sort);
      return '/confessions/page?' + params.toString();
    }

    function showNudgeIfNeeded() {
      if (nudgeShown || cardsLoadedTotal < 40) return;
      nudgeShown = true;
      var nudge = document.createElement('div');
      nudge.className = 'confess-pause-nudge';
      nudge.innerHTML = '<strong>You\'ve been here a while.</strong>It\'s okay to step away. Take a breath, drink some water, and come back when you\'re ready.';
      sentinel.parentElement.insertBefore(nudge, sentinel);
    }

    async function loadMore() {
      if (loading) return;
      if (sentinel.getAttribute('data-done') === 'true') return;
      loading = true;
      sentinel.querySelector('.confess-sentinel-text').textContent = 'Loading more…';

      try {
        var res = await fetch(buildUrl(), { headers: { 'X-Requested-With': 'fetch' } });
        if (!res.ok) throw new Error('bad status ' + res.status);
        var html = (await res.text()).trim();
        if (!html) {
          sentinel.setAttribute('data-done', 'true');
          sentinel.innerHTML = '<span class="confess-sentinel-text">You\'ve reached the end.</span>';
          return;
        }
        var tmp = document.createElement('div');
        tmp.innerHTML = html;
        var newCards = tmp.querySelectorAll('.confess-card');
        // Reset CSS animation delays so newly-loaded cards animate in too
        newCards.forEach(function (c) { c.style.animationDelay = '0s'; });
        while (tmp.firstChild) feed.appendChild(tmp.firstChild);
        paintTimes(feed);
        var newOffset = (parseInt(sentinel.getAttribute('data-offset'), 10) || 0) + newCards.length;
        sentinel.setAttribute('data-offset', String(newOffset));
        cardsLoadedTotal += newCards.length;
        if (newCards.length < pageSize) {
          sentinel.setAttribute('data-done', 'true');
          sentinel.innerHTML = '<span class="confess-sentinel-text">You\'ve reached the end.</span>';
        }
        showNudgeIfNeeded();
      } catch (err) {
        sentinel.querySelector('.confess-sentinel-text').textContent = 'Couldn\'t load more. Scroll to retry.';
      } finally {
        loading = false;
      }
    }

    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: '300px 0px' });
    io.observe(sentinel);
  })();
})();
