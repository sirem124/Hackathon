// CYBERTRACE cybersecurity news aggregator (server side).
// Fetches public RSS/Atom feeds, keeps only headline + short excerpt + link back to the original
// article, and caches the result so we never hammer the sources.

const FEEDS = [
  { id: 'bleeping', name: 'BleepingComputer', url: 'https://www.bleepingcomputer.com/feed/' },
  { id: 'thehackernews', name: 'The Hacker News', url: 'https://feeds.feedburner.com/TheHackersNews' },
  { id: 'krebs', name: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/' },
  { id: 'record', name: 'The Record', url: 'https://therecord.media/feed' },
  { id: 'cisa', name: 'CISA Advisories', url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml', advisory: true }
];
const KEV_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
const CACHE_MS = 15 * 60 * 1000;
const MAX_ITEMS = 60;

function decode(text) {
  return String(text || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}
function stripHtml(text) {
  return decode(text).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
function getTag(block, name) {
  const m = block.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>', 'i'));
  return m ? m[1] : '';
}
function getLink(block) {
  const text = decode(getTag(block, 'link')).trim();
  if (text) return text;
  const m = block.match(/<link[^>]*href=["']([^"']+)["']/i);
  return m ? decode(m[1]).trim() : '';
}
function getImage(block) {
  const m =
    block.match(/<media:(?:content|thumbnail)[^>]*url=["']([^"']+)["']/i) ||
    block.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image/i) ||
    decode(getTag(block, 'content:encoded') || getTag(block, 'description')).match(/<img[^>]*src=["']([^"']+)["']/i);
  return m ? decode(m[1]).trim() : '';
}
const isHttp = u => /^https?:\/\//i.test(u);

function classify(text, feed) {
  const t = text.toLowerCase();
  if (feed.advisory) return 'advisory';
  if (/cve-\d{4}|vulnerab|zero-day|0-day|\bpatch|\brce\b|exploit/.test(t)) return 'vulnerability';
  if (/ransomware|malware|trojan|botnet|backdoor|stealer|worm\b|phishing/.test(t)) return 'malware';
  if (/breach|leak|data theft|stolen|hacked|exposed|compromis/.test(t)) return 'breach';
  if (/\bai\b|artificial intelligence|llm|chatgpt|openai|anthropic|grok|gemini/.test(t)) return 'ai';
  return 'security';
}

function parseFeed(xml, feed) {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  const items = [];
  for (const block of blocks.slice(0, 25)) {
    const title = decode(getTag(block, 'title')).replace(/\s+/g, ' ').trim(); // escaped by the browser when rendered
    const link = getLink(block);
    if (!title || !isHttp(link)) continue;
    const rawDate = decode(getTag(block, 'pubDate') || getTag(block, 'published') || getTag(block, 'updated') || getTag(block, 'dc:date')).trim();
    const date = new Date(rawDate);
    let summary = stripHtml(getTag(block, 'description') || getTag(block, 'summary') || getTag(block, 'content:encoded'));
    if (summary.length > 220) summary = summary.slice(0, 217).replace(/\s+\S*$/, '') + '...';
    const image = getImage(block);
    items.push({
      title: title.slice(0, 220),
      link,
      source: feed.name,
      sourceId: feed.id,
      category: classify(title + ' ' + summary, feed),
      summary,
      image: isHttp(image) && image.startsWith('https://') ? image : '',
      published: Number.isNaN(date.getTime()) ? null : date.toISOString()
    });
  }
  return items;
}

async function fetchText(url, ms = 8000) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(ms),
    headers: { 'user-agent': 'CYBERTRACE-News/1.0 (education project)', accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, application/json, */*' }
  });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return (await response.text()).slice(0, 3_000_000);
}

async function loadKev() {
  try {
    const data = JSON.parse(await fetchText(KEV_URL, 10000));
    const list = Array.isArray(data.vulnerabilities) ? data.vulnerabilities : [];
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const last7 = list.filter(v => new Date(v.dateAdded).getTime() >= weekAgo).length;
    const latest = list.slice().sort((a, b) => String(b.dateAdded).localeCompare(String(a.dateAdded)))[0] || null;
    return {
      total: list.length,
      last7,
      latest: latest && /^CVE-\d{4}-\d{4,}$/.test(latest.cveID) ? {
        cve: latest.cveID, vendor: String(latest.vendorProject || '').slice(0, 60),
        product: String(latest.product || '').slice(0, 60), name: String(latest.vulnerabilityName || '').slice(0, 140),
        dateAdded: latest.dateAdded
      } : null
    };
  } catch (e) {
    return null;
  }
}

let cache = null;
let inflight = null;

async function refresh() {
  const [results, kev] = await Promise.all([
    Promise.allSettled(FEEDS.map(async feed => parseFeed(await fetchText(feed.url), feed))),
    loadKev()
  ]);
  const sources = FEEDS.map((feed, i) => ({ name: feed.name, ok: results[i].status === 'fulfilled' && results[i].value.length > 0 }));
  const seen = new Set();
  const items = results
    .flatMap(r => (r.status === 'fulfilled' ? r.value : []))
    .filter(item => (seen.has(item.link) ? false : seen.add(item.link)))
    .sort((a, b) => String(b.published || '').localeCompare(String(a.published || '')))
    .slice(0, MAX_ITEMS);
  if (!items.length) throw new Error('No feed returned articles');
  return { items, kev, sources, updatedAt: new Date().toISOString() };
}

async function getNews() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  if (!inflight) {
    inflight = refresh()
      .then(data => { cache = { at: Date.now(), data }; return data; })
      .finally(() => { inflight = null; });
  }
  try {
    return await inflight;
  } catch (error) {
    if (cache) return { ...cache.data, stale: true }; // serve old news rather than nothing
    throw error;
  }
}

module.exports = { getNews, parseFeed, FEEDS };
