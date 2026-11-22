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
