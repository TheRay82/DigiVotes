// ==UserScript==
// @name         DigiVotes
// @namespace    https://github.com/TheRay82
// @version      1.1
// @description  adds number of voters on product cards in search/category pages, and ranks results by vote count
// @description:fa  نمایش تعداد رای دهندگان روی کارت محصولات و مرتب سازی نتایج بر اساس تعداد رای در دیجی کالا
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
// @noframes
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
  let voteSortApi = null;           // filled in by initVoteSort() below


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
        try { const j = JSON.parse(this.responseText); harvest(j); } catch (e) {}
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
    if (voteSortApi) voteSortApi.mountBar();
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

  // =====================================================================
  // Vote Sort: rank search/category results by vote count (sort-bar button / Alt+S)
  // =====================================================================
  function initVoteSort() {
  'use strict';

    const API = 'https://api.digikala.com/v1';
    const PAGE_SIZE = 20;
    const CACHE_TTL = 10 * 60 * 1000;
    const CACHE_MAX = 200;              // pages kept in memory (about 6 KB each)
    const REQUEST_TIMEOUT = 20000;      // a request that takes longer counts as a failed attempt
    const FAIL_STREAK_LIMIT = 4;        // this many failed pages in a row -> stop scanning, keep what we have
    const CONCURRENCY = 2;

    // How far Digikala itself will page, measured against the live API:
    //   text search - results are capped at roughly 1000 items, so about 50
    //                 pages; a page past the end answers 200 with an empty list.
    //   category    - a hard 100-page limit; page 101 answers HTTP 400.
    // Nothing exists beyond these, so they are the real ceilings, not a policy.
    // tag      - /v1/tags/<slug>/ is not capped at 100 (one tag has 109 pages); past the
    //            last page it answers 200 with an empty list. 200 is a UI ceiling only,
    //            the scan is always bounded by pager.total_pages.
    const PAGE_LIMITS = { search: 50, category: 100, tag: 200 };
    const HARD_MAX_PAGES = Math.max(PAGE_LIMITS.search, PAGE_LIMITS.category, PAGE_LIMITS.tag);
    const limitFor = (kind) => PAGE_LIMITS[kind] || HARD_MAX_PAGES;

    const DEFAULTS = { pages: 10, hideUnrated: true };

    // Bumped when a stock value changes and the change should reach people who
    // already have settings saved. Version 2 raised the stock page count 5 -> 10.
    const SETTINGS_VERSION = 2;
    const SETTINGS_KEY = 'dkvs:settings';

    // The minimum-vote filter is opt-in and deliberately not persisted: a
    // remembered threshold would silently empty small categories again. It
    // starts off on every page load, so the one-click sort always shows
    // everything unless you ask otherwise.
    const voteFilter = { on: false, value: 100 };

    // Let a changed stock value reach existing installs, but never clobber a
    // number someone picked on purpose. Version 1 stored no stamp at all.
    function migrateSettings(raw) {
      if (!raw || typeof raw !== 'object') return null;
      if (raw.v === SETTINGS_VERSION) return raw;
      if (Number(raw.pages) === 5) {
        const next = Object.assign({}, raw);
        delete next.pages;
        return next;
      }
      return raw;
    }

    const nf = new Intl.NumberFormat('fa-IR');
    const sf = new Intl.NumberFormat('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

    // Digikala shows a 1-5 score; the API only gives a percentage of satisfied
    // raters. round(rate / 2) / 10 reproduces the site's number exactly.
    function starsOf(rate) {
      const n = Number(rate);
      if (!Number.isFinite(n) || n <= 0) return 0;
      return Math.round(n / 2) / 10;
    }

    // ---------------------------------------------------------------- settings

    // An explicit number is clamped to the ceiling for that page kind; only
    // missing or unparseable input falls back to the default. (A plain
    // `Number(v) || DEFAULTS` would turn a typed 0 into the default.)
    function clampedPages(v, kind) {
      if (v == null || v === '') return DEFAULTS.pages;
      const n = Number(v);
      if (!Number.isFinite(n)) return DEFAULTS.pages;
      return Math.min(limitFor(kind), Math.max(1, Math.trunc(n)));
    }

    const settings = (() => {
      const load = (store) => {
        try {
          return migrateSettings(JSON.parse(store.getItem(SETTINGS_KEY) || 'null'));
        } catch (_) {
          return null;
        }
      };
      const saved = load(localStorage) || {};
      const s = Object.assign({}, DEFAULTS, saved);
      s.pages = clampedPages(s.pages);
      return {
        get() {
          return s;
        },
        set(patch) {
          Object.assign(s, patch);
          s.pages = clampedPages(s.pages);
          try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(Object.assign({ v: SETTINGS_VERSION }, s)));
          } catch (_) {}
        },
      };
    })();

    // ------------------------------------------------------------------ helpers

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    function toman(rial) {
      if (!rial) return 'قیمت نامشخص';
      return nf.format(Math.round(rial / 10)) + ' تومان';
    }

    function stableKey(endpoint, params, page) {
      const qs = new URLSearchParams(params);
      qs.set('page', String(page));
      const entries = [...qs.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
      return endpoint + '?' + entries.map(([k, v]) => `${k}=${v}`).join('&');
    }

    // -------------------------------------------------------------- page target

    // Verified: https://api.digikala.com/v1/tags/<slug>/  (tag in the path, no /search/ suffix;
    // ?tag= / ?tags= on /v1/search/ are ignored and return the whole catalogue).
    function resolveTagTarget(url, rawSlug) {
      let slug = rawSlug;
      try { slug = decodeURIComponent(rawSlug); } catch (_) {}
      const params = new URLSearchParams(url.search);
      params.delete('sort');
      params.delete('page');
      return {
        kind: 'tag',
        slug,
        endpoint: `${API}/tags/${encodeURIComponent(slug)}/`,
        params,
        label: url.pathname + url.search,
      };
    }


    function resolveTarget() {
      const url = new URL(location.href);
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] === 'tags' && parts[1]) return resolveTagTarget(url, parts[1]);
      if (parts[0] !== 'search') return null;

      let endpoint;
      let kind;
      if (parts[1] && parts[1].startsWith('category-')) {
        kind = 'category';
        endpoint = `${API}/categories/${parts[1].slice('category-'.length)}/search/`;
      } else {
        kind = 'search';
        endpoint = `${API}/search/`;
      }

      const params = new URLSearchParams(url.search);
      params.delete('sort');
      params.delete('page');

      return { kind, endpoint, params, label: url.pathname + url.search };
    }

    // ----------------------------------------------------------------- fetching

    const cache = new Map();

    function cacheGet(key) {
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < CACHE_TTL) return hit.value;
      if (hit) cache.delete(key);
      try {
        const raw = sessionStorage.getItem('dkvs:' + key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Date.now() - parsed.at < CACHE_TTL) {
            cache.set(key, parsed);
            return parsed.value;
          }
          sessionStorage.removeItem('dkvs:' + key);
        }
      } catch (_) {}
      return null;
    }

    // Entries only expired when someone asked for them again, so old pages piled up
    // (memory until reload, sessionStorage until the tab closes or the quota hit).
    function sweepCache(withStorage) {
      const now = Date.now();
      for (const [k, v] of cache) if (now - v.at >= CACHE_TTL) cache.delete(k);
      if (!withStorage) return;
      try {
        Object.keys(sessionStorage).forEach((k) => {
          if (!k.startsWith('dkvs:') || k === SETTINGS_KEY) return;
          try {
            const e = JSON.parse(sessionStorage.getItem(k));
            if (!e || now - e.at >= CACHE_TTL) sessionStorage.removeItem(k);
          } catch (_) { sessionStorage.removeItem(k); }
        });
      } catch (_) {}
    }

    function cacheSet(key, value) {
      const entry = { at: Date.now(), value };
      cache.set(key, entry);
      while (cache.size > CACHE_MAX) {                      // drop the oldest first, in both copies
        const oldest = cache.keys().next().value;
        cache.delete(oldest);
        try { sessionStorage.removeItem('dkvs:' + oldest); } catch (_) {}
      }
      try {
        sessionStorage.setItem('dkvs:' + key, JSON.stringify(entry));
      } catch (_) {
        // Storage full: drop everything and keep the in-memory copy.
        try {
          Object.keys(sessionStorage)
            .filter((k) => k.startsWith('dkvs:'))
            .forEach((k) => sessionStorage.removeItem(k));
        } catch (__) {}
      }
    }

    function toItem(p) {
      const dv = p.default_variant || {};
      const price = dv.price || {};
      const img = p.images && p.images.main && p.images.main.url;
      const stock = Number(price.marketable_stock);
      const votes = Number(p.rating && p.rating.count);
      const rate = Number(p.rating && p.rating.rate);
      return {
        id: p.id,
        title: p.title_fa || p.title_en || '(بدون عنوان)',
        uri: (p.url && p.url.uri) || `/product/dkp-${p.id}/`,
        votes: Number.isFinite(votes) ? votes : 0,
        rate: Number.isFinite(rate) ? rate : 0,
        stars: starsOf(rate),
        price: price.selling_price || price.rrp_price || null,
        discount: Number(price.discount_percent) || 0,
        inStock: Number.isFinite(stock) ? stock > 0 : true,
        image: Array.isArray(img) ? img[0] : img || null,
      };
    }

    async function fetchPage(endpoint, params, page, opts) {
      const key = stableKey(endpoint, params, page);
      const cached = cacheGet(key);
      if (cached) return cached;

      const retries = (opts && opts.retries) != null ? opts.retries : 2;
      let lastErr = null;

      for (let attempt = 0; attempt <= retries; attempt++) {
        if (attempt > 0) await sleep(800 * Math.pow(3, attempt - 1));
        const ac = new AbortController();
        let timedOut = false;
        const timer = setTimeout(() => { timedOut = true; ac.abort(); }, REQUEST_TIMEOUT);
        const outer = opts && opts.signal;
        const onOuterAbort = () => ac.abort();
        if (outer) {
          if (outer.aborted) ac.abort();
          else outer.addEventListener('abort', onOuterAbort, { once: true });
        }
        try {
          const res = await origFetch(key, {
            headers: { accept: 'application/json' },
            // DigiCDN answers the first request with a 307 back to the same URL
            // plus a digicdn_cookie. With 'omit' the browser ignores Set-Cookie
            // and the redirect loops forever, so this has to be 'include' - the
            // API replies with ACAO echoing the origin and ACAC: true.
            credentials: 'include',
            signal: ac.signal,
          });
          if (res.status === 403 || res.status === 429) {
            lastErr = new Error('محدودیت درخواست (' + res.status + ')');
            continue;
          }
          if (res.status === 404) throw new Error('این صفحه جواب نداد (404)');
          if (!res.ok) {
            lastErr = new Error('خطای HTTP ' + res.status);
            continue;
          }
          const body = await res.json();
          const data = body && body.data;
          if (!data || !Array.isArray(data.products)) {
            lastErr = new Error('جواب غیرمنتظره از سرور');
            continue;
          }
          harvest(data.products);   // DigiVotes: fill card badges from scanned data
          const value = {
            items: data.products.map(toItem),
            pager: data.pager || null,
          };
          cacheSet(key, value);
          return value;
        } catch (err) {
          if (err && err.name === 'AbortError') {
            if (!timedOut) throw err;            // the user pressed Stop / left the page
            lastErr = new Error('سرور تا ' + nf.format(REQUEST_TIMEOUT / 1000) + ' ثانیه جواب نداد');
            continue;
          }
          // A redirect loop here means the digicdn cookie never landed. The
          // retry reuses the cookie jar, so it usually clears on attempt 2.
          if (err && /redirect/i.test(String(err.message))) {
            lastErr = new Error('چالش کوکی دیجی سی دی ان حل نشد؛ یک بار دیگر امتحان کنید');
            continue;
          }
          lastErr = err;
        } finally {
          clearTimeout(timer);
          if (outer) outer.removeEventListener('abort', onOuterAbort);
        }
      }
      throw lastErr || new Error('درخواست ناموفق');
    }

    async function mapLimit(items, limit, fn) {
      const out = new Array(items.length);
      let cursor = 0;
      const worker = async () => {
        while (cursor < items.length) {
          const idx = cursor++;
          out[idx] = await fn(items[idx], idx);
        }
      };
      const workers = [];
      for (let i = 0; i < Math.min(limit, items.length); i++) workers.push(worker());
      await Promise.all(workers);
      return out;
    }

    // -------------------------------------------------------------------- scan

    async function scan(target, opts) {
      const { pages, minVotes = 0, hideUnrated, signal, onProgress } = opts;

      const first = await fetchPage(target.endpoint, target.params, 1, { signal });
      if (signal && signal.aborted) throw new DOMException('aborted', 'AbortError');

      const totalPages = (first.pager && first.pager.total_pages) || 1;
      const totalItems = (first.pager && first.pager.total_items) || first.items.length;
      const lastPage = Math.min(clampedPages(pages, target.kind), totalPages);

      const bucket = [first.items];
      let done = 1;
      let failed = 0;
      let skippedPages = 0;
      let streak = 0;
      if (onProgress) onProgress({ done, lastPage, scanned: first.items.length, totalItems });

      const rest = [];
      for (let p = 2; p <= lastPage; p++) rest.push(p);

      const results = await mapLimit(rest, CONCURRENCY, async (p) => {
        // Repeated failures mean the server is throttling or down: stop hammering it.
        if (streak >= FAIL_STREAK_LIMIT) {
          skippedPages++;
          done++;
          if (onProgress) onProgress({ done, lastPage, scanned: done * PAGE_SIZE, totalItems });
          return [];
        }
        try {
          const data = await fetchPage(target.endpoint, target.params, p, { signal });
          streak = 0;
          done++;
          if (onProgress) onProgress({ done, lastPage, scanned: done * PAGE_SIZE, totalItems });
          return data.items;
        } catch (err) {
          if (err && err.name === 'AbortError') throw err;
          failed++;
          streak++;
          done++;
          if (onProgress) onProgress({ done, lastPage, scanned: done * PAGE_SIZE, totalItems });
          return [];
        }
      });
      results.forEach((items) => bucket.push(items));

      const seen = new Map();
      bucket.flat().forEach((item) => {
        if (!seen.has(item.id)) seen.set(item.id, item);
      });

      // Everything collected is kept unless the optional vote filter is on.
      const items = [...seen.values()].filter((item) => {
        if (hideUnrated && item.votes === 0) return false;
        if (item.votes < minVotes) return false;
        return true;
      });

      // Highest vote count first - the whole point of the script.
      items.sort((a, b) => b.votes - a.votes || b.stars - a.stars || a.title.localeCompare(b.title, 'fa'));

      return {
        items,
        scannedPages: lastPage - skippedPages,
        skippedPages,
        totalPages,
        totalItems,
        failedPages: failed,
        collected: seen.size,
        minVotes,
      };
    }

    // ---------------------------------------------------------------------- UI

    const CSS = `
      :host { all: initial; }
      * { box-sizing: border-box; }
      .wrap {
        font-family: "IRANSans", "Segoe UI", Tahoma, sans-serif;
        direction: rtl;
      }
      .overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483001;
        background: rgba(0, 0, 0, .45);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }
      .overlay[hidden] { display: none; }
      .panel {
        display: flex;
        flex-direction: column;
        width: min(860px, 100%);
        max-height: min(88vh, 920px);
        background: #fff;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0, 0, 0, .35);
      }
      .head {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        border-bottom: 1px solid #eef0f2;
      }
      .head h2 { margin: 0; font-size: 15px; }
      .head .spacer { flex: 1; }
      .x {
        border: 0;
        background: #f4f5f6;
        width: 30px;
        height: 30px;
        border-radius: 8px;
        font-size: 16px;
        cursor: pointer;
        color: #333;
      }
      .actions {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        background: #fafbfc;
        border-bottom: 1px solid #eef0f2;
      }
      .actions .go {
        flex: 1;
        padding: 11px 16px;
        border: 0;
        border-radius: 9px;
        background: #ef4056;
        color: #fff;
        font: inherit;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
      }
      .actions .go:hover { background: #d73246; }
      .actions button:disabled { opacity: .55; cursor: default; }
      .actions .more, .actions .stop {
        padding: 10px 14px;
        border: 1px solid #dfe2e6;
        border-radius: 9px;
        background: #fff;
        color: #333;
        font: inherit;
        font-size: 13px;
        cursor: pointer;
      }
      .advanced {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 16px;
        padding: 12px 16px;
        background: #fff;
        border-bottom: 1px solid #eef0f2;
        font-size: 13px;
        color: #333;
      }
      .advanced[hidden] { display: none; }
      .advanced label { display: flex; align-items: center; gap: 6px; }
      .advanced input[type=number] {
        width: 72px;
        padding: 6px 8px;
        border: 1px solid #dfe2e6;
        border-radius: 8px;
        font: inherit;
      }
      .advanced input[type=checkbox] { margin: 0; }
      .advhint {
        flex-basis: 100%;
        font-size: 11.5px;
        color: #8b9199;
        line-height: 1.9;
      }
      .clamp { color: #b3263a; font-weight: 700; }
      .bar { height: 3px; background: #eef0f2; overflow: hidden; }
      .bar[hidden] { display: none; }
      .bar > i { display: block; height: 100%; width: 0; background: #ef4056; transition: width .2s; }
      .searchbar { padding: 8px 16px; border-bottom: 1px solid #eef0f2; }
      .searchbar input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #dfe2e6;
        border-radius: 9px;
        font: inherit;
        font-size: 13px;
        direction: rtl;
      }
      .searchbar input:disabled { background: #f4f5f6; cursor: default; }
      .status {
        padding: 10px 16px;
        font-size: 12.5px;
        color: #555;
        border-bottom: 1px solid #eef0f2;
        line-height: 1.9;
      }
      .status b { color: #111; }
      .list { overflow-y: auto; padding: 8px 0; }
      .row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 16px;
        text-decoration: none;
        color: inherit;
        border-bottom: 1px solid #f4f5f6;
      }
      .row:hover { background: #fbfbfc; }
      .rank {
        flex: 0 0 28px;
        font-size: 12px;
        font-weight: 700;
        color: #8b9199;
        text-align: center;
      }
      .thumb {
        flex: 0 0 52px;
        width: 52px;
        height: 52px;
        border-radius: 8px;
        object-fit: contain;
        background: #f4f5f6;
      }
      .body { flex: 1; min-width: 0; }
      .title {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        font-size: 13px;
        line-height: 1.7;
        color: #222;
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 7px;
        margin-top: 6px;
        font-size: 12px;
        color: #6b7177;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 9px;
        border: 1px solid transparent;
        border-radius: 999px;
        white-space: nowrap;
      }
      .votes { background: #fff1f3; border-color: #ffd4da; color: #c2273c; font-weight: 700; }
      .score { background: #fff8e6; border-color: #ffe6ae; color: #8a6100; font-weight: 700; }
      .score .star { color: #f5a623; }
      .price { background: #f2f7ff; border-color: #d8e6ff; color: #12417a; font-weight: 700; }
      .off { background: #eaf7ef; border-color: #c9ecd8; color: #1c7a45; font-weight: 700; }
      .stock { background: #fdecec; border-color: #f7cdcd; color: #b3263a; font-weight: 700; }
      .empty { padding: 28px 16px; text-align: center; color: #6b7177; font-size: 13px; }
      .note {
        padding: 10px 16px;
        font-size: 11.5px;
        color: #8b9199;
        border-top: 1px solid #eef0f2;
        line-height: 1.9;
      }
    `;

    const state = {
      host: null,
      referer: null,
      scanning: false,
      controller: null,
      result: null,
      ui: null,
    };

    function buildUI() {
      const host = document.createElement('div');
      host.id = 'dkvs-host';
      const root = host.attachShadow({ mode: 'open' });
      root.innerHTML = `
        <style>${CSS}</style>
        <div class="wrap">
          <div class="overlay" hidden>
            <div class="panel" role="dialog" aria-modal="true">
              <div class="head">
                <h2>رتبه بندی از بیشترین رای به کمترین</h2>
                <span class="spacer"></span>
                <button class="x" type="button" title="بستن">×</button>
              </div>
              <div class="actions">
                <button class="go" type="button">مرتب سازی از بیشترین رای به کمترین</button>
                <button class="stop" type="button" hidden>توقف</button>
                <button class="more" type="button" aria-expanded="false">تنظیمات</button>
              </div>
              <div class="advanced" hidden>
                <label>تعداد صفحه
                  <input class="pages" type="number" min="1" max="${HARD_MAX_PAGES}" step="1">
                </label>
                <label><input class="hideUnrated" type="checkbox"> کالاهای بدون رای حذف شوند</label>
                <label><input class="useMinVotes" type="checkbox"> فقط کالاهای با حداقل رای</label>
                <input class="minVotes" type="number" min="0" step="10" value="${voteFilter.value}">
                <div class="advhint">
                  هر صفحه شامل ۲۰ کالا است و حداکثر میتوانید <span class="limitinfo"></span> صفحه را بررسی کنید.
                  هرچه تعداد صفحات بیشتر باشد، کالاهای بیشتری بررسی میشوند، اما زمان و داده بیشتری مصرف خواهد شد.
                  <span class="clamp"></span>
                </div>
              </div>
              <div class="bar" hidden><i></i></div>
              <div class="status"></div>
              <div class="searchbar"><input class="q" type="search" placeholder="جست و جو در عنوان نتایج..." autocomplete="off" disabled></div>
              <div class="list"></div>
              <div class="note">
                دیجی کالا امکان مرتب سازی بر اساس تعداد رای را ندارد؛ بنابراین، این لیست بر اساس کالاهای موجود در صفحاتی که بررسی میکنید ساخته میشود.
              </div>
            </div>
          </div>
        </div>
      `;
      document.documentElement.appendChild(host);

      const $ = (sel) => root.querySelector(sel);
      const ui = {
        overlay: $('.overlay'),
        close: $('.x'),
        go: $('.go'),
        stop: $('.stop'),
        more: $('.more'),
        advanced: $('.advanced'),
        pages: $('.pages'),
        hideUnrated: $('.hideUnrated'),
        useMinVotes: $('.useMinVotes'),
        minVotes: $('.minVotes'),
        limitinfo: $('.limitinfo'),
        clamp: $('.clamp'),
        bar: $('.bar'),
        barFill: $('.bar > i'),
        status: $('.status'),
      q: $('.q'),
        list: $('.list'),
      };

      const s = settings.get();
      ui.pages.value = s.pages;
      ui.hideUnrated.checked = s.hideUnrated;
      ui.useMinVotes.checked = voteFilter.on;
      ui.minVotes.value = voteFilter.value;
      ui.minVotes.disabled = !voteFilter.on;
      // Collapsed by default: the one-click path must not need a page number.
      ui.advanced.hidden = true;

      ui.more.addEventListener('click', () => {
        ui.advanced.hidden = !ui.advanced.hidden;
        ui.more.setAttribute('aria-expanded', String(!ui.advanced.hidden));
      });

      ui.close.addEventListener('click', () => closePanel(ui));
      ui.overlay.addEventListener('click', (e) => {
        if (e.target === ui.overlay) closePanel(ui);
      });
      document.addEventListener(
        'keydown',
        (e) => {
          if (e.key === 'Escape' && !ui.overlay.hidden) {
            if (ui.q.value) {
              ui.q.value = '';
              if (state.result) renderResult(ui, state.result);
            } else {
              closePanel(ui);
            }
          }
          if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 's' || e.key === 'S')) {
            e.preventDefault();
            openPanel(ui);
          }
        },
        true
      );

      // The main action: rank everything by vote count, no threshold at all.
      ui.go.addEventListener('click', () => {
        if (state.scanning) return;
        const kind = (resolveTarget() || {}).kind;
        const pages = clampedPages(ui.pages.value, kind);
        ui.pages.value = pages;
        voteFilter.on = ui.useMinVotes.checked;
        voteFilter.value = Math.max(0, Math.trunc(Number(ui.minVotes.value) || 0));
        ui.minVotes.value = voteFilter.value;
        settings.set({ pages, hideUnrated: ui.hideUnrated.checked });
        runScan(ui);
      });
      ui.stop.addEventListener('click', () => {
        if (state.controller) state.controller.abort();
      });

      // A page count over the ceiling is clamped and said out loud, instead of
      // silently scanning fewer pages than the box shows.
      const commitPages = () => {
        const kind = (resolveTarget() || {}).kind;
        const limit = limitFor(kind);
        const typed = Number(ui.pages.value);
        const fixed = clampedPages(ui.pages.value, kind);
        ui.pages.value = fixed;
        settings.set({ pages: fixed });
        ui.clamp.textContent =
          Number.isFinite(typed) && typed > limit
            ? `این نوع صفحه بیشتر از ${nf.format(limit)} صفحه نمیدهد؛ روی ${nf.format(limit)} تنظیم شد.`
            : Number.isFinite(typed) && typed < 1
            ? 'کمترین مقدار ۱ صفحه است.'
            : '';
      };
      ui.pages.addEventListener('blur', commitPages);
      ui.pages.addEventListener('change', commitPages);
      const commitMinVotes = () => {
        voteFilter.value = Math.max(0, Math.trunc(Number(ui.minVotes.value) || 0));
        ui.minVotes.value = voteFilter.value;
      };
      ui.minVotes.addEventListener('blur', commitMinVotes);
      ui.minVotes.addEventListener('change', commitMinVotes);
      ui.useMinVotes.addEventListener('change', () => {
        voteFilter.on = ui.useMinVotes.checked;
        ui.minVotes.disabled = !voteFilter.on;
      });
      ui.hideUnrated.addEventListener('change', () => settings.set({ hideUnrated: ui.hideUnrated.checked }));

      let qTimer = null;
      ui.q.addEventListener('input', () => {
        clearTimeout(qTimer);
        qTimer = setTimeout(() => { if (state.result) renderResult(ui, state.result); }, 150);
      });

      state.host = host;
      return ui;
    }

    function openPanel(ui) {
      if (!resolveTarget()) return;
      ui.overlay.hidden = false;
      if (!state.result && !state.scanning) runScan(ui);
    }

    function closePanel(ui) {
      if (state.controller) state.controller.abort();
      ui.overlay.hidden = true;
    }

    function setStatus(ui, html) {
      ui.status.innerHTML = html;
    }

    function progressTo(ui, pct) {
      ui.bar.hidden = pct == null;
      ui.barFill.style.width = (pct == null ? 0 : Math.round(pct * 100)) + '%';
    }

    async function runScan(ui) {
      const target = resolveTarget();
      if (!target) {
        setStatus(ui, 'این صفحه صفحه جست و جو یا دسته بندی نیست.');
        return;
      }
      if (state.referer !== target.label) {
        state.result = null;
        state.referer = target.label;
      }

      sweepCache(false);
      const s = settings.get();
      state.scanning = true;
      state.controller = new AbortController();
      ui.go.disabled = true;
      ui.stop.hidden = false;
      ui.list.textContent = '';
      ui.q.value = '';
      ui.q.disabled = true;
      progressTo(ui, 0);
      setStatus(ui, 'در حال گرفتن صفحه ها...');

      try {
        const result = await scan(target, {
          pages: s.pages,
          minVotes: voteFilter.on ? voteFilter.value : 0,
          hideUnrated: s.hideUnrated,
          signal: state.controller.signal,
          onProgress: (p) => {
            progressTo(ui, p.done / Math.max(1, p.lastPage));
            setStatus(
              ui,
              `${nf.format(p.done)} از ${nf.format(p.lastPage)} صفحه گرفته شد · این دسته روی هم <b>${nf.format(p.totalItems)}</b> کالا دارد`
            );
          },
        });

        state.result = result;
        progressTo(ui, null);
        renderResult(ui, result);
      } catch (err) {
        if (err && err.name === 'AbortError') {
          setStatus(ui, 'متوقف شد.');
        } else {
          setStatus(ui, 'خطا: ' + ((err && err.message) || 'نامشخص'));
        }
        progressTo(ui, null);
      } finally {
        state.scanning = false;
        state.controller = null;
        ui.go.disabled = false;
        ui.stop.hidden = true;
      }
    }

    function chip(cls, text, title) {
      const el = document.createElement('span');
      el.className = 'chip ' + cls;
      el.textContent = text;
      if (title) el.title = title;
      return el;
    }

    const normText = (t) =>
      String(t || '')
        .toLowerCase()
        .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
        .replace(/ي/g, 'ی')
        .replace(/ك/g, 'ک')
        .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776))
        .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632))
        .replace(/\u200c/g, '');
    const haystacks = new WeakMap();

    // Every word typed must appear in the title; "لپ تاپ" also matches "لپ‌تاپ".
    function filterItems(items, query) {
      const tokens = normText(query).split(/\s+/).filter(Boolean);
      if (!tokens.length) return items;
      return items.filter((item) => {
        let h = haystacks.get(item);
        if (!h) {
          const spaced = normText(item.title);
          h = { spaced, joined: spaced.replace(/\s+/g, '') };
          haystacks.set(item, h);
        }
        return tokens.every((t) => h.spaced.includes(t) || h.joined.includes(t));
      });
    }

    function renderResult(ui, result) {
      ui.q.disabled = false;
      const query = ui.q.value.trim();
      const visible = filterItems(result.items, query);
      const scannedProducts = Math.min(result.totalItems, result.scannedPages * PAGE_SIZE);
      const skipped =
        (result.failedPages ? ` · ${nf.format(result.failedPages)} صفحه جواب نداد و رد شد` : '') +
        (result.skippedPages
          ? ` · بعد از چند خطای پشت سر هم، ${nf.format(result.skippedPages)} صفحه ی باقی مانده گرفته نشد (احتمالا محدودیت یا مشکل سرور؛ کمی بعد دوباره امتحان کنید)`
          : '');
      const voteNote = result.minVotes > 0 ? ` · فقط کالاهای با حداقل ${nf.format(result.minVotes)} رای` : '';
      setStatus(
        ui,
        `از مجموع <b>${nf.format(result.totalItems)}</b> کالای این دسته، ` +
          `${nf.format(result.scannedPages)} صفحه (حدود ${nf.format(scannedProducts)} کالا) بررسی شد.` +
          `${skipped}${voteNote}<br>` +
          (query
            ? `${nf.format(visible.length)} کالا از ${nf.format(result.items.length)} کالا با این عبارت پیدا شد، مرتب شده از بیشترین رای به کمترین.`
            : `نمایش ${nf.format(result.items.length)} کالا، مرتب شده از بیشترین رای به کمترین.`)
      );

      ui.list.textContent = '';
      ui.list.scrollTop = 0;
      if (query && !visible.length) {
        const none = document.createElement('div');
        none.className = 'empty';
        none.textContent = 'کالایی با این عبارت پیدا نشد.';
        ui.list.appendChild(none);
        return;
      }
      if (!result.items.length) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent =
          'چیزی پیدا نشد. ' +
          (result.minVotes > 0 ? 'حداقل رای را کم کنید، ' : '') +
          'تعداد صفحه را بیشتر کنید یا تیک «کالاهای بدون رای حذف شوند» را بردارید.';
        ui.list.appendChild(empty);
        return;
      }

      const frag = document.createDocumentFragment();
      visible.forEach((item, i) => {   // rank = position in the filtered list

        const a = document.createElement('a');
        a.className = 'row';
        a.href = 'https://www.digikala.com' + item.uri;
        a.target = '_blank';
        a.rel = 'noopener';

        const rank = document.createElement('span');
        rank.className = 'rank';
        rank.textContent = nf.format(i + 1);

        if (item.image) {
          const img = document.createElement('img');
          img.className = 'thumb';
          img.loading = 'lazy';
          img.alt = '';
          img.src = item.image;
          a.appendChild(img);
        }

        const body = document.createElement('div');
        body.className = 'body';

        const title = document.createElement('span');
        title.className = 'title';
        title.dir = 'auto';
        title.textContent = item.title;

        const meta = document.createElement('div');
        meta.className = 'meta';

        // Each field gets its own colour so they stop blending together.
        meta.appendChild(
          chip(item.votes ? 'votes' : 'votes stock', item.votes ? `${nf.format(item.votes)} رای` : 'بدون رای')
        );

        if (item.stars > 0) {
          const score = chip('score', '', `${nf.format(Math.round(item.rate))}٪ رضایت`);
          const star = document.createElement('span');
          star.className = 'star';
          star.textContent = '★';
          const num = document.createElement('span');
          num.className = 'num';
          num.textContent = sf.format(item.stars);
          score.append(star, num);
          meta.appendChild(score);
        }

        meta.appendChild(chip('price', toman(item.price)));
        if (item.discount > 0) meta.appendChild(chip('off', `${nf.format(item.discount)}٪ تخفیف`));
        if (!item.inStock) meta.appendChild(chip('stock', 'ناموجود'));

        body.append(title, meta);
        a.append(rank, body);
        frag.appendChild(a);
      });

      ui.list.appendChild(frag);
    }

    // ------------------------------------------------------ SPA route watching

    let lastKey = null;

    function refreshVisibility() {
      if (!state.host) return;
      const target = resolveTarget();
      const ok = !!target;
      const ui = state.ui;
      if (ui) {
        // The page ceiling depends on what is in the address bar: a category
        // will page to 100, a text search only to about 50.
        ui.pages.max = String(limitFor(target && target.kind));
        ui.limitinfo.textContent = ok ? nf.format(limitFor(target.kind)) : '';
        if (!ok && ui.overlay.hidden === false) ui.overlay.hidden = true;
      }
    }

    function onNavigate() {
      if (!state.host) return;
      // A scan in flight belongs to the page we just left.
      if (state.controller) state.controller.abort();
      state.result = null;
      state.referer = null;
      if (state.ui) {
        state.ui.list.textContent = '';
        state.ui.q.value = '';
        state.ui.q.disabled = true;
        state.ui.status.textContent = 'صفحه عوض شد؛ دوباره شروع کنید.';
        state.ui.bar.hidden = true;
      }
      refreshVisibility();
    }

    function watchRoute() {
      const tick = () => {
        const key = location.pathname + location.search;
        if (key !== lastKey) {
          lastKey = key;
          onNavigate();
        }
      };
      ['pushState', 'replaceState'].forEach((name) => {
        const original = history[name];
        history[name] = function () {
          const out = original.apply(this, arguments);
          setTimeout(tick, 0);
          return out;
        };
      });
      window.addEventListener('popstate', tick);
      setInterval(tick, 700);
    }

    // ------------------------------------------------------ sort bar button

    // Digikala's own sort options. The bar is found by these labels, not by class
    // names, because the site's classes are generated and change between builds.
    const norm = (t) => String(t).replace(/[\u200c\s:：]/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک');
    const SORT_SET = new Set(
      ['مرتبط ترین', 'پربازدیدترین', 'پرفروش ترین', 'جدیدترین', 'ارزان ترین', 'گران ترین', 'پیشنهاد خریداران', 'محبوب ترین'].map(norm)
    );

    function findSortBar() {
      const leaves = [...document.querySelectorAll('button, a, span, div, li, label')].filter((e) => {
        if (e.childElementCount > 2) return false;
        const t = e.textContent;
        return t && t.length <= 24 && SORT_SET.has(norm(t)) && !e.closest('#dkvs-host') && !e.closest('#dkvs-sortbtn');
      });
      for (const leaf of leaves) {
        let el = leaf.parentElement;
        for (let i = 0; i < 5 && el; i++, el = el.parentElement) {
          const hits = new Set(leaves.filter((l) => el.contains(l)).map((l) => norm(l.textContent)));
          if (hits.size >= 3) {
            let item = leaf;
            while (item.parentElement && item.parentElement !== el) item = item.parentElement;
            return { container: el, item };
          }
        }
      }
      return null;
    }

    function makeSortButton(item) {
      const cs = getComputedStyle(item);
      const btn = document.createElement('button');
      btn.id = 'dkvs-sortbtn';
      btn.type = 'button';
      btn.title = 'مرتب سازی بر اساس تعداد رای (DigiVotes)';
      Object.assign(btn.style, {
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        lineHeight: cs.lineHeight,
        padding: '4px 14px',
        margin: '0 8px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        border: '0',
        borderRadius: '999px',      // pill
        background: '#eef0ff',      // indigo tint, not Digikala's red/grey
        color: '#3f3fb8',
        fontWeight: '600',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        direction: 'rtl',
      });
      const star = document.createElement('span');
      star.textContent = '★';
      star.style.fontSize = '0.9em';
      const label = document.createElement('span');
      label.textContent = 'بیشترین رای';
      btn.append(star, label);
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (state.ui) openPanel(state.ui);
      });
      return btn;
    }

    function mountBar() {
      if (!state.ui) return;
      const onListing = !!resolveTarget();
      const existing = document.getElementById('dkvs-sortbtn');
      if (!onListing) {
        if (existing) existing.remove();
        return;
      }
      if (existing && existing.isConnected) return;
      const found = findSortBar();
      if (found) found.container.appendChild(makeSortButton(found.item));
    }
    voteSortApi = { mountBar };

    // ------------------------------------------------------------------- boot

    // Internals are hung off window so they can be poked from devtools.
    // Handy for debugging: DKVS.scan(DKVS.resolveTarget(), {pages: 2})
    function expose() {
      try {
        window.__DKVS__ = {
          scan,
          resolveTarget,
          fetchPage,
          toItem,
          starsOf,
          settings,
          voteFilter,
          renderResult,
          clampedPages,
          limitFor,
          migrateSettings,
          defaults: DEFAULTS,
          types: { PAGE_LIMITS, PAGE_SIZE, CONCURRENCY, HARD_MAX_PAGES, SETTINGS_VERSION },
          get ui() {
            return state.ui;
          },
          clearCache() {
            cache.clear();
            try {
              Object.keys(sessionStorage)
                .filter((k) => k.startsWith('dkvs:'))
                .forEach((k) => sessionStorage.removeItem(k));
            } catch (_) {}
          },
        };
      } catch (_) {}
    }

    function boot() {
      state.ui = buildUI();
      sweepCache(true);
      expose();
      lastKey = location.pathname + location.search;
      refreshVisibility();
      mountBar();
      watchRoute();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
      boot();
    }
  }
  initVoteSort();

})();
