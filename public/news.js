const cardsEl=document.getElementById('newsCards');
const listingEl=document.getElementById('newsListing');
const articleEl=document.getElementById('newsArticle');
const searchEl=document.getElementById('newsSearch');
const categoryEl=document.getElementById('newsCategory');
const countEl=document.getElementById('newsCount');
let debounce;
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const prettyDate=value=>{const date=new Date(value+'T12:00:00');return Number.isNaN(date.getTime())?value:date.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})};
async function loadNews(){
  const params=new URLSearchParams();if(searchEl.value.trim())params.set('search',searchEl.value.trim());if(categoryEl.value)params.set('category',categoryEl.value);
  cardsEl.innerHTML='<div class="news-loading">Synchronizing intelligence feed…</div>';
  try{const response=await fetch('/api/news?'+params.toString());if(!response.ok)throw new Error('News service unavailable');const articles=await response.json();countEl.textContent=String(articles.length).padStart(2,'0')+' REPORTS';
    cardsEl.innerHTML=articles.length?articles.map(article=>`<article class="news-card"><div class="news-card-top"><span class="news-tag">${escapeHtml(article.category)}</span><time class="news-date">${escapeHtml(prettyDate(article.published_at))}</time></div><h2>${escapeHtml(article.title)}</h2><p>${escapeHtml(article.description)}</p><div class="news-card-bottom"><span class="news-source">SOURCE / ${escapeHtml(article.source_name)}</span><a class="news-read" href="/news/article/${encodeURIComponent(article.slug)}">READ REPORT <i class="bi bi-arrow-right"></i></a></div></article>`).join(''):'<div class="news-empty">NO REPORTS MATCH YOUR SEARCH.</div>';
  }catch(error){cardsEl.innerHTML='<div class="news-empty">Could not load the news feed. Check that the CYBERTRACE server is running.</div>';countEl.textContent='FEED OFFLINE';}
}
async function loadArticle(slug){
  listingEl.hidden=true;articleEl.hidden=false;articleEl.innerHTML='<div class="news-loading">Opening report…</div>';
  try{const response=await fetch('/api/news/'+encodeURIComponent(slug));if(!response.ok)throw new Error('Article not found');const article=await response.json();
    articleEl.innerHTML=`<a class="news-back" href="/news"><i class="bi bi-arrow-left"></i> BACK TO NEWS</a><div class="article-meta"><span>${escapeHtml(article.category.toUpperCase())}</span><span>•</span><time>${escapeHtml(prettyDate(article.published_at))}</time><span>•</span><span>${escapeHtml(article.source_name)}</span></div><h1>${escapeHtml(article.title)}</h1><p class="article-deck">${escapeHtml(article.description)}</p><div class="article-body">${(article.content||[]).map(section=>`<section><h2>${escapeHtml(section.heading)}</h2><p>${escapeHtml(section.paragraph)}</p></section>`).join('')}</div><div class="article-source"><p>Original reporting and additional details are available from ${escapeHtml(article.source_name)}.</p><a href="${escapeHtml(article.source_url)}" target="_blank" rel="noopener noreferrer">READ ORIGINAL SOURCE <i class="bi bi-box-arrow-up-right"></i></a></div>`;
  }catch(error){articleEl.innerHTML='<a class="news-back" href="/news"><i class="bi bi-arrow-left"></i> BACK TO NEWS</a><div class="news-empty">This report could not be found.</div>';}
}
searchEl.addEventListener('input',()=>{clearTimeout(debounce);debounce=setTimeout(loadNews,220)});categoryEl.addEventListener('change',loadNews);
const match=location.pathname.match(/^\/news\/article\/([^/]+)\/?$/);if(match)loadArticle(decodeURIComponent(match[1]));else loadNews();
let articles = [];
let activeCategory = 'All';

const $ = id => document.getElementById(id);

// Load news from backend
async function loadNews() {
  try {
    const response = await fetch('/api/news');
    if (!response.ok) {
      throw new Error('News API error: ' + response.status);
    }

    articles = await response.json();
    renderNews();
  } catch (error) {
    $('newsGrid').textContent = 'Unable to connect to CYBERTRACE. Check that the backend is running.';
    console.error(error);
  }
}

// Safely create article cards
function renderNews() {
  const search = $('searchInput').value.toLowerCase();

  const filtered = articles.filter(article => {
    const matchesSearch =
      (article.title || '').toLowerCase().includes(search) ||
      (article.description || '').toLowerCase().includes(search);
    const matchesCategory = activeCategory === 'All' || article.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  $('newsGrid').replaceChildren();
  $('articleCount').textContent = filtered.length + ' REPORTS';
  $('emptyMessage').hidden = filtered.length !== 0;

  // Featured article only when viewing all reports
  const featured = articles[0];
  if (activeCategory === 'All' && !search && featured) {
    $('featured').hidden = false;
    $('featuredTitle').textContent = featured.title;
    $('featuredDescription').textContent = featured.description;
    $('featuredLink').href = '/news/article/' + encodeURIComponent(featured.slug);
  } else {
    $('featured').hidden = true;
  }

  filtered.forEach(article => {
    const card = document.createElement('article');
    card.className = 'news-card';

    const category = document.createElement('span');
    category.className = 'category-label';
    category.textContent = article.category || 'Cybersecurity';

    const title = document.createElement('h3');
    title.textContent = article.title;

    const description = document.createElement('p');
    description.textContent = article.description;

    const meta = document.createElement('div');
    meta.className = 'meta';
    const date = article.published_at
      ? new Date(article.published_at).toLocaleDateString()
      : 'Recently published';
    meta.textContent = (article.source_name || 'CYBERTRACE') + ' · ' + date;

    const link = document.createElement('a');
    link.className = 'read';
    link.href = '/news/article/' + encodeURIComponent(article.slug);
    link.textContent = 'READ FULL REPORT →';

    card.append(category, title, description, meta, link);
    $('newsGrid').appendChild(card);
  });
}

// Search
$('searchInput').addEventListener('input', renderNews);

// Category filters
document.querySelectorAll('.category').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.category').forEach(item => {
      item.classList.remove('active');
    });
    button.classList.add('active');
    activeCategory = button.dataset.filter;
    renderNews();
  });
});

// Render article content safely
function renderContent(content) {
  const body = $('articleBody');
  body.replaceChildren();

  String(content || '').split('\n\n').forEach(section => {
    const lines = section.split('\n');
    const first = lines[0].trim();

    if (/^(WHAT HAPPENED|WHY DOES IT MATTER|SECURITY LESSONS)$/i.test(first)) {
      const heading = document.createElement('h3');
      heading.textContent = first;
      body.appendChild(heading);

      if (lines.length > 1) {
        const paragraph = document.createElement('p');
        paragraph.textContent = lines.slice(1).join('\n');
        body.appendChild(paragraph);
      }
    } else {
      const paragraph = document.createElement('p');
      paragraph.textContent = section;
      body.appendChild(paragraph);
    }
  });
}

// Load individual article
async function loadArticle(slug) {
  $('newsHome').hidden = true;
  $('articleView').hidden = false;

  try {
    const response = await fetch('/api/news/' + encodeURIComponent(slug));
    if (!response.ok) {
      throw new Error('Article not found');
    }

    const article = await response.json();
    $('articleCategory').textContent = article.category;
    $('articleTitle').textContent = article.title;
    $('articleDescription').textContent = article.description;
    $('articleDate').textContent = new Date(article.published_at).toLocaleDateString();
    $('articleSource').textContent = 'Source: ' + article.source_name;
    renderContent(article.content);

    const source = $('sourceLink');
    source.href = article.source_url || '#';
    source.hidden = !article.source_url;
    document.title = article.title + ' | CYBERTRACE';
  } catch (error) {
    $('articleTitle').textContent = 'Article unavailable';
    $('articleDescription').textContent = 'The requested report could not be found.';
    $('articleBody').replaceChildren();
  }
}

// Back to News
$('backButton').addEventListener('click', () => {
  window.location.href = '/news';
});

// Detect article URL
const parts = window.location.pathname.split('/').filter(Boolean);
if (parts.length === 3 && parts[0] === 'news' && parts[1] === 'article') {
  loadArticle(decodeURIComponent(parts[2]));
} else {
  loadNews();
}