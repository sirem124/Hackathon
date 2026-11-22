document.addEventListener("DOMContentLoaded", () => {
    const newsGrid = document.getElementById("newsGrid");
    const searchInput = document.getElementById("searchInput");
    const categoryFilter = document.getElementById("categoryFilter");
    const refreshButton = document.getElementById("refreshButton");
    const feedStatus = document.getElementById("feedStatus");
    const breakingSection = document.getElementById("breakingSection");
    const breakingNews = document.getElementById("breakingNews");
    const articleView = document.getElementById("articleView");

    if (!newsGrid) {
        console.error("CYBERTRACE: newsGrid element not found!");
        return;
    }

    const featuredArticle = {
        title: "China-Linked Hackers Exploit Zero-Day Vulnerability",
        description:
            "Hackers linked to China are exploiting a zero-day vulnerability. Read the original report from Hack.al for the full details.",
        category: "Cyber Attack",
        source: "Hack.al",
        url: "https://hack.al/lajm/haker-te-lidhur-me-kinen-shfrytezojne-zero-day-x-1t2pmd8"
    };

    let allArticles = [];

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[char]);
    }

    function createFeaturedCard() {
        return `
            <article class="news-card featured-news">
                <div class="eyebrow">
                    <span class="pulse"></span>
                    FEATURED SECURITY REPORT
                </div>
                <div class="news-category">${escapeHTML(featuredArticle.category)}</div>
                <h2>${escapeHTML(featuredArticle.title)}</h2>
                <p>${escapeHTML(featuredArticle.description)}</p>
                <div class="news-meta">SOURCE: ${escapeHTML(featuredArticle.source)}</div>
                <a
                    class="news-button"
                    href="${escapeHTML(featuredArticle.url)}"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    READ FULL REPORT
                    <i class="bi bi-arrow-up-right"></i>
                </a>
            </article>
        `;
    }

    function createNewsCard(article) {
        const title = escapeHTML(article.title);
        const description = escapeHTML(article.description);
        const category = escapeHTML(article.category || "Cybersecurity");
        const source = escapeHTML(article.source_name || "CYBERTRACE");
        const date = escapeHTML(article.published_at || "");

        if (article.source_url) {
            return `
                <article class="news-card">
                    <div class="news-category">${category}</div>
                    <h2>${title}</h2>
                    <p>${description}</p>
                    <div class="news-meta">${source} · ${date}</div>
                    <a
                        class="news-button"
                        href="${escapeHTML(article.source_url)}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        READ FULL REPORT
                        <i class="bi bi-arrow-up-right"></i>
                    </a>
                </article>
            `;
        }

        return `
            <article class="news-card">
                <div class="news-category">${category}</div>
                <h2>${title}</h2>
                <p>${description}</p>
                <div class="news-meta">${source} · ${date}</div>
                <button class="news-button" data-slug="${escapeHTML(article.slug)}">
                    READ ARTICLE
                    <i class="bi bi-arrow-right"></i>
                </button>
            </article>
        `;
    }

    function displayNews(articles) {
        const featured = createFeaturedCard();

        if (!articles.length) {
            newsGrid.innerHTML = featured + `
                <div class="loading">No other articles found.</div>
            `;
            return;
        }

        newsGrid.innerHTML = featured + articles.map(createNewsCard).join("");
    }

    function displayBreakingNews() {
        if (!breakingSection || !breakingNews) return;

        breakingNews.innerHTML = `
            <a
                href="${escapeHTML(featuredArticle.url)}"
                target="_blank"
                rel="noopener noreferrer"
            >
                ${escapeHTML(featuredArticle.title)}
                <i class="bi bi-arrow-up-right"></i>
            </a>
        `;

        breakingSection.hidden = false;
    }

    function updateStatus(message, connected = true) {
        if (!feedStatus) return;

        feedStatus.innerHTML = `
            <span class="pulse"></span>
            ${escapeHTML(message)}
        `;

        feedStatus.dataset.connected = String(connected);
    }

    async function loadNews() {
        updateStatus("CONNECTING TO SECURITY FEEDS...");

        newsGrid.innerHTML = createFeaturedCard() + `
            <div class="loading">Loading cybersecurity intelligence...</div>
        `;

        const params = new URLSearchParams();

        if (searchInput && searchInput.value.trim()) {
            params.set("search", searchInput.value.trim());
        }

        if (categoryFilter && categoryFilter.value !== "All") {
            params.set("category", categoryFilter.value);
        }

        try {
            const response = await fetch("/api/news?" + params.toString());
            if (!response.ok) {
                throw new Error("News API returned " + response.status);
            }

            const data = await response.json();
            if (!Array.isArray(data)) {
                throw new Error("Invalid news data received.");
            }

            allArticles = data;
            displayNews(allArticles);
            updateStatus("SECURITY FEEDS CONNECTED");
        } catch (error) {
            console.error("CYBERTRACE NEWS ERROR:", error);
            newsGrid.innerHTML = createFeaturedCard() + `
                <div class="loading">
                    Additional news feeds are currently unavailable.
                    The featured report is still available above.
                </div>
            `;
            updateStatus("FEATURED REPORT AVAILABLE · FEED OFFLINE", false);
        }
    }

    async function openArticle(slug) {
        if (!articleView) return;

        try {
            const response = await fetch("/api/news/" + encodeURIComponent(slug));
            if (!response.ok) {
                throw new Error("Article not found.");
            }

            const article = await response.json();

            if (newsGrid.parentElement) {
                newsGrid.parentElement.hidden = true;
            }
            articleView.hidden = false;

            articleView.innerHTML = `
                <button class="back-button" id="backButton">
                    <i class="bi bi-arrow-left"></i>
                    BACK TO NEWS
                </button>
                <div class="eyebrow">${escapeHTML(article.category)}</div>
                <h1>${escapeHTML(article.title)}</h1>
                <p>${escapeHTML(article.description)}</p>
                <div class="news-meta">
                    ${escapeHTML(article.source_name || "CYBERTRACE")}
                    · ${escapeHTML(article.published_at || "")}
                </div>
                <div class="article-content">${escapeHTML(article.content)}</div>
                ${
                    article.source_url
                        ? `
                            <a
                                href="${escapeHTML(article.source_url)}"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                READ ORIGINAL REPORT
                            </a>
                        `
                        : ""
                }
            `;

            document.getElementById("backButton")?.addEventListener("click", closeArticle);
        } catch (error) {
            console.error(error);
            alert("Could not open this article.");
        }
    }

    function closeArticle() {
        if (articleView) {
            articleView.hidden = true;
        }
        if (newsGrid.parentElement) {
            newsGrid.parentElement.hidden = false;
        }
    }

    newsGrid.addEventListener("click", event => {
        const button = event.target.closest("[data-slug]");
        if (button) {
            openArticle(button.dataset.slug);
        }
    });

    let searchTimer;
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(loadNews, 400);
        });
    }

    if (categoryFilter) {
        categoryFilter.addEventListener("change", loadNews);
    }

    if (refreshButton) {
        refreshButton.addEventListener("click", loadNews);
    }

    displayBreakingNews();
    loadNews();
});