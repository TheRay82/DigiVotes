// ==UserScript==
// @name         DigiVotes
// @namespace    https://github.com/TheRay82
// @version      1.0
// @description  adds number of voters on product cards in search/category pages
// @description:fa  نمایش تعداد رای دهندگان روی کارت محصولات در صفحه جستجو و دسته بندی دیجی کالا
// @author       TheRay82
// @license      MIT
// @homepageURL  https://github.com/TheRay82/DigiVotes
// @supportURL   https://github.com/TheRay82/DigiVotes/issues
// @updateURL    https://raw.githubusercontent.com/TheRay82/DigiVotes/main/DigiVotes.user.js
// @downloadURL  https://raw.githubusercontent.com/TheRay82/DigiVotes/main/DigiVotes.user.js
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBvbHlnb24gZmlsbD0iI0ZCQkYyNCIgcG9pbnRzPSIxMiwyIDE1LjA5LDguMjYgMjIsOS4yNyAxNywxNC4xNCAxOC4xOCwyMS4wMiAxMiwxNy43NyA1LjgyLDIxLjAyIDcsMTQuMTQgMiw5LjI3IDguOTEsOC4yNiIvPjwvc3ZnPg==
// @match        https://www.digikala.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  const DEBUG = false;
  const COUNT_SIDE = 'right';        // 'right' = between star and score, 'left' = after the score
  const REPLACE_SITE_SCORE = true;   // edit the site's own score text instead of showing a separate badge
  const log = (...a) => DEBUG && console.log('[dk-votes]', ...a);

  const ratings = new Map();        // id -> {rate, count}
  const waiting = new Map();        // id -> [badges]
  const fa = (n) => Number(n).toLocaleString('fa-IR');

  // ---------- collect rating data from any JSON ----------
  function harvest(node, depth = 0) {
    if (!node || typeof node !== 'object' || depth > 12) return;
    if (Array.isArray(node)) { node.forEach((n) => harvest(n, depth + 1)); return; }
    if (node.id != null && node.rating && typeof node.rating === 'object' &&
        node.rating.count != null && node.rating.rate != null) {
      setRating(String(node.id), node.rating);
    }
    for (const k in node) harvest(node[k], depth + 1);
  }

  function setRating(id, r) {
    if (ratings.has(id)) return;
    ratings.set(id, { rate: r.rate, count: r.count });
    (waiting.get(id) || []).forEach((b) => render(b, ratings.get(id)));
    waiting.delete(id);
  }

  // ---------- hook fetch + XHR (listing data loaded by the site itself) ----------
  const origFetch = window.fetch;
  window.fetch = function (...args) {
    const p = origFetch.apply(this, args);
    try {
      const url = String(args[0] && args[0].url || args[0]);
      if (url.includes('api.digikala.com')) {
        p.then((res) => res.clone().json().then((j) => { harvest(j); log('harvested', url, ratings.size); }).catch(() => {}));
      }
    } catch (e) {}
    return p;
  };

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, url) {
    if (String(url).includes('api.digikala.com')) {
      this.addEventListener('load', () => {
        try { harvest(JSON.parse(this.responseText)); } catch (e) {}
      });
    }
    return origOpen.apply(this, arguments);
  };

  function harvestNextData() {
    const el = document.getElementById('__NEXT_DATA__');
    if (el && !el.dataset.dkDone) {
      el.dataset.dkDone = '1';
      try { harvest(JSON.parse(el.textContent)); log('harvested __NEXT_DATA__', ratings.size); } catch (e) {}
    }
  }

  // ---------- fallback: product API ----------
  const queue = []; let active = 0;
  async function fallbackFetch(id) {
    let lastErr = 'no rating in response';
    for (const v of ['v2', 'v1']) {
      try {
        const res = await origFetch(`https://api.digikala.com/${v}/product/${id}/`, { credentials: 'omit' });
        if (!res.ok) { lastErr = `${v}: HTTP ${res.status}`; continue; }
        const j = await res.json();
        const found = findRating(j);
        if (found) return found;
        lastErr = `${v}: rating not found`;
      } catch (e) { lastErr = `${v}: ${e.message}`; }
    }
    throw new Error(lastErr);
  }
  function findRating(node, depth = 0) {
    if (!node || typeof node !== 'object' || depth > 8) return null;
    if (node.rating && node.rating.count != null && node.rating.rate != null) return node.rating;
    for (const k in node) { const r = findRating(node[k], depth + 1); if (r) return r; }
    return null;
  }
  function pump() {
    while (active < 3 && queue.length) {
      const id = queue.shift();
      if (ratings.has(id)) continue;
      active++;
      fallbackFetch(id)
        .then((r) => setRating(id, r))
        .catch((e) => {
          (waiting.get(id) || []).forEach((b) => { b.textContent = '؟'; b.title = e.message; });
          waiting.delete(id);
          log('failed', id, e.message);
        })
        .finally(() => { active--; pump(); });
    }
  }

  // ---------- UI ----------
  const toLatin = (str) => str.replace(/[۰-۹]/g, (c) => c.charCodeAt(0) - 1776)
                              .replace(/[٠-٩]/g, (c) => c.charCodeAt(0) - 1632)
                              .replace('٫', '.').replace(',', '.');

  function render(badge, d) {
    if (!d || !d.count) { badge.textContent = 'بدون امتیاز'; return; }
    const stars = d.rate > 5 ? d.rate / 20 : d.rate;   // API uses 0-100
    badge.textContent = `⭐ ${fa(stars.toFixed(1))} (${fa(d.count)} رای)`;
    badge._dk = { stars, count: d.count };
    applySiteScore(badge.parentElement, badge);
  }

  // Find the site's own score text (e.g. "2.8") inside the card and add the vote count next to it
  function applySiteScore(card, badge) {
    if (!REPLACE_SITE_SCORE || !card || !badge._dk) return;
    const { stars, count } = badge._dk;

    // 1) already processed? (never search inside our own output)
    let el = card.querySelector('[data-dk-score]');
    if (!el) {
      el = [...card.querySelectorAll('span,div,p')].find((e) => {
        if (e === badge || e.childElementCount !== 0) return false;
        const t = e.textContent.trim();
        if (t.length > 4 || !/^[\d۰-۹٠-٩]+([.٫,][\d۰-۹٠-٩]+)?$/.test(t)) return false;
        return Math.abs(parseFloat(toLatin(t)) - stars) < 0.06;
      });
      if (!el) return;                       // not found -> keep the dark badge
      el.setAttribute('data-dk-score', '1');
    }

    // 2) build once (rebuild only if the site's re-render wiped our children)
    if (!el.querySelector('.dk-count')) {
      const scoreText = el.textContent.trim();
      el.textContent = '';
      el.style.direction = 'rtl';            // first child = rightmost
      const sc = document.createElement('span');
      sc.textContent = scoreText;
      const cn = document.createElement('span');
      cn.className = 'dk-count';
      cn.textContent = `(${fa(count)})`;
      cn.style.margin = '0 4px';
      if (COUNT_SIDE === 'right') el.append(cn, sc); else el.append(sc, cn);
    }
    badge.style.display = 'none';
  }

  function makeBadge() {
    const b = document.createElement('div');
    b.textContent = '…';
    Object.assign(b.style, {
      position: 'absolute', top: '6px', right: '6px', zIndex: 5,
      background: 'rgba(0,0,0,.75)', color: '#fff',
      font: '12px/1.4 Vazirmatn, Tahoma, sans-serif',
      padding: '2px 8px', borderRadius: '10px',
      pointerEvents: 'none', direction: 'rtl',
    });
    return b;
  }

  function scan() {
    harvestNextData();
    // re-apply in case React re-rendered a card and reset our text
    document.querySelectorAll('[data-dk-votes]').forEach((c) => {
      const b = [...c.children].find((x) => x._dk);
      if (b) applySiteScore(c, b);
    });
    document.querySelectorAll('a[href*="/product/dkp-"]').forEach((a) => {
      const m = (a.getAttribute('href') || '').match(/dkp-(\d+)/);
      if (!m) return;
      const id = m[1];
      const card = a.closest('[data-product-index]') || a;
      if (card.dataset.dkVotes || !card.querySelector('img')) return;
      card.dataset.dkVotes = id;
      if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
      const badge = makeBadge();
      card.appendChild(badge);
      if (ratings.has(id)) return render(badge, ratings.get(id));
      if (!waiting.has(id)) waiting.set(id, []);
      waiting.get(id).push(badge);
      // give the listing response a moment to arrive before using the fallback
      setTimeout(() => { if (!ratings.has(id) && !queue.includes(id)) { queue.push(id); pump(); } }, 1500);
    });
  }

  let t;
  const start = () => {
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(scan, 400); })
      .observe(document.body, { childList: true, subtree: true });
    scan();
  };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
