/* CYBERTRACE News tab: renders /api/news with filters, search, and optional Albanian headlines. */
(function () {
  'use strict';
  const grid = document.getElementById('newsGrid');
  if (!grid) return;

  document.querySelectorAll('.news-tabs [data-pane]').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.news-tabs button').forEach(b => b.classList.toggle('active', b === btn));
    document.getElementById('paneEmbed').hidden = btn.dataset.pane !== 'embed';
    document.getElementById('paneFeed').hidden = btn.dataset.pane !== 'feed';
  }));

  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const filtersEl = document.getElementById('newsFilters');
  const searchEl = document.getElementById('newsSearch');
  const statusEl = document.getElementById('newsStatus');
  const threatEl = document.getElementById('newsThreat');
  const langBtn = document.getElementById('newsLang');
  const refreshBtn = document.getElementById('newsRefresh');

  const CATEGORIES = [
    ['all', 'All'], ['vulnerability', 'Vulnerabilities'], ['breach', 'Breaches'],
    ['malware', 'Malware'], ['ai', 'AI'], ['advisory', 'Advisories'], ['security', 'General']
  ];
  const state = { items: [], category: 'all', query: '', lang: 'en', loaded: false, loading: false, translations: new Map(), translationAvailable: false };

  filtersEl.innerHTML = CATEGORIES.map(([id, label]) =>
    '<button type="button" data-cat="' + id + '" class="' + (id === 'all' ? 'active' : '') + '">' + label + '</button>').join('');

  function timeAgo(iso) {
    if (!iso) return '';
    const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
    const rtf = new Intl.RelativeTimeFormat(state.lang === 'sq' ? 'sq' : 'en', { numeric: 'auto' });
    const abs = Math.abs(seconds);
    if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour');
    return rtf.format(Math.round(seconds / 86400), 'day');
  }

  function visibleItems() {
    const q = state.query.trim().toLowerCase();
    return state.items.filter(i =>
      (state.category === 'all' || i.category === state.category) &&
      (!q || (i.title + ' ' + i.summary + ' ' + i.source).toLowerCase().includes(q)));
  }

  function render() {
    const items = visibleItems();
    if (!items.length) {
      grid.innerHTML = '<div class="news-empty"><i class="bi bi-newspaper"></i><span>' +
        (state.loaded ? 'No stories match this filter.' : 'Loading the latest stories...') + '</span></div>';
      return;
    }
    grid.innerHTML = items.map(i => {
      const translated = state.lang === 'sq' && state.translations.get(i.title);
      const title = translated || i.title;
      return '<article class="news-card">' +
        (i.image ? '<a class="news-thumb" href="' + esc(i.link) + '" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-hidden="true"><img src="' + esc(i.image) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"></a>' : '') +
        '<div class="news-body"><div class="news-meta"><span class="news-tag ' + esc(i.category) + '">' + esc(i.category) + '</span>' +
        '<span>' + esc(i.source) + '</span><span>' + esc(timeAgo(i.published)) + '</span></div>' +
        '<h3><a href="' + esc(i.link) + '" target="_blank" rel="noopener noreferrer"' + (translated ? ' title="Original: ' + esc(i.title) + '"' : '') + '>' + esc(title) + '</a></h3>' +
        (i.summary ? '<p>' + esc(i.summary) + '</p>' : '') +
        '<a class="news-read" href="' + esc(i.link) + '" target="_blank" rel="noopener noreferrer">Read at ' + esc(i.source) + ' <i class="bi bi-box-arrow-up-right"></i></a></div></article>';
    }).join('');
  }

  function renderThreat(kev) {
    if (!kev) { threatEl.innerHTML = ''; return; }
    const latest = kev.latest
      ? '<div class="news-latest"><small>LATEST ADDED</small><a href="https://nvd.nist.gov/vuln/detail/' + esc(kev.latest.cve) + '" target="_blank" rel="noopener noreferrer">' + esc(kev.latest.name || kev.latest.cve) + '</a>' +
        '<span>' + esc(kev.latest.cve) + ' · ' + esc(kev.latest.vendor) + ' · ' + esc(kev.latest.dateAdded) + '</span></div>' : '';
    threatEl.innerHTML = '<div class="news-panel"><small>// THREAT LEVEL</small><h4>CISA Known Exploited Vulnerabilities</h4>' +
      '<div class="news-stats"><div><strong>' + esc(kev.last7) + '</strong><span>added in 7 days</span></div><div><strong>' + esc(kev.total) + '</strong><span>total in catalog</span></div></div>' + latest +
      '<p class="news-note">Vulnerabilities attackers are known to be using right now. Patch these first.</p></div>';
  }

  function setStatus(text) { statusEl.textContent = text; }

  async function load() {
    if (state.loading) return;
    state.loading = true;
    refreshBtn.disabled = true;
    setStatus('Loading headlines...');
    try {
      const response = await fetch('/api/news');
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not load the news.');
      state.items = data.items || [];
      state.translationAvailable = Boolean(data.translationAvailable);
      state.loaded = true;
      langBtn.hidden = !state.translationAvailable;
      renderThreat(data.kev);
      const down = (data.sources || []).filter(s => !s.ok).map(s => s.name);
      setStatus('Updated ' + new Date(data.updatedAt).toLocaleTimeString() + ' · ' + state.items.length + ' stories' +
        (data.stale ? ' · showing cached stories' : '') + (down.length ? ' · unavailable: ' + down.join(', ') : ''));
      render();
      if (state.lang === 'sq') translateVisible();
    } catch (error) {
      state.loaded = true;
      grid.innerHTML = '<div class="news-empty"><i class="bi bi-wifi-off"></i><span>' + esc(error.message) + '</span></div>';
      setStatus('');
    } finally {
      state.loading = false;
      refreshBtn.disabled = false;
    }
  }

  async function translateVisible() {
    const titles = visibleItems().map(i => i.title).filter(t => !state.translations.has(t)).slice(0, 40);
    if (!titles.length) return render();
    setStatus('Translating headlines to Albanian...');
    try {
      const response = await fetch('/api/news/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titles }) });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        state.lang = 'en'; langBtn.textContent = 'SQ · Shqip';
        throw new Error('Log in on the CYBERTRACE home page (top right), then come back to translate headlines.');
      }
      if (!response.ok) throw new Error(data.error || 'Translation failed.');
      titles.forEach((t, i) => state.translations.set(t, data.titles[i]));
      setStatus('Headlines auto-translated to Albanian (AI). Hover a title to see the original.');
    } catch (error) {
      if (state.lang === 'sq' && !state.translations.size) { state.lang = 'en'; langBtn.textContent = 'SQ · Shqip'; }
      setStatus(error.message);
    }
    render();
  }

  filtersEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    state.category = btn.dataset.cat;
    filtersEl.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
    render();
    if (state.lang === 'sq') translateVisible();
  });
  let timer;
  searchEl.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { state.query = searchEl.value; render(); if (state.lang === 'sq') translateVisible(); }, 200); });
  refreshBtn.addEventListener('click', load);
  langBtn.addEventListener('click', () => {
    state.lang = state.lang === 'en' ? 'sq' : 'en';
    langBtn.textContent = state.lang === 'en' ? 'SQ · Shqip' : 'EN · English';
    if (state.lang === 'sq') translateVisible(); else { setStatus(''); render(); }
  });

  render();
  load();

  // Show the account name if the visitor is already logged in (same session as the main site).
  fetch('/api/auth/me').then(r => r.json()).then(d => {
    const link = document.getElementById('newsAccount');
    if (d && d.user && link) { link.textContent = d.user.name; link.title = 'Open CYBERTRACE'; }
  }).catch(() => {});
})();
