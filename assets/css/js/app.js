/* =========================================
NABZ CRYPTO NEWS
News interface and filtering
Version: 1.0
========================================= */

"use strict";

(() => {
const NEWS_URL = "./data/news.json";

const state = {
allNews: [],
activeCategory: "all",
searchQuery: "",
loading: true,
error: false
};

const elements = {
newsList: document.getElementById("newsList"),
searchInput: document.getElementById("searchInput"),
filters: document.querySelectorAll("[data-category]"),
status: document.getElementById("statusText"),
emptyState: document.getElementById("emptyState"),
refreshButton: document.getElementById("refreshButton"),
lastUpdated: document.getElementById("lastUpdated"),
newsDialog: document.getElementById("newsDialog"),
dialogContent: document.getElementById("dialogContent")
};

const categoryNames = {
btc: "بیت‌کوین",
usdt: "تتر و استیبل‌کوین",
market: "کل بازار",
altcoin: "آلت‌کوین‌ها",
regulation: "قوانین و مقررات",
macro: "اقتصاد کلان",
security: "امنیت",
exchange: "صرافی‌ها",
other: "سایر خبرها"
};

const importanceNames = {
high: "اهمیت زیاد",
medium: "اهمیت متوسط",
low: "اهمیت کم"
};

function getText(value, maxLength = 5000) {
if (typeof value !== "string") return "";
return value.trim().slice(0, maxLength);
}

function safeDate(value) {
if (!value) return null;

const date = new Date(value);

if (Number.isNaN(date.getTime())) return null;

return date;

}

function formatDate(value) {
const date = safeDate(value);

if (!date) return "زمان نامشخص";

try {
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tehran"
  }).format(date);
} catch {
  return date.toLocaleString("fa-IR");
}

}

function safeExternalUrl(value) {
const raw = getText(value, 2048);

try {
  const url = new URL(raw);

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return "";
  }

  return url.href;
} catch {
  return "";
}

}

function createElement(tag, className, text) {
const element = document.createElement(tag);

if (className) {
  element.className = className;
}

if (text !== undefined) {
  element.textContent = text;
}

return element;

}

function setStatus(message, isError = false) {
if (!elements.status) return;

elements.status.textContent = message;
elements.status.setAttribute(
  "aria-live",
  "polite"
);

elements.status.dataset.state = isError
  ? "error"
  : "normal";

}

function setEmptyState(visible, title, description) {
if (!elements.emptyState) return;

elements.emptyState.hidden = !visible;

const heading = elements.emptyState.querySelector("h3");
const paragraph = elements.emptyState.querySelector("p");

if (heading && title) {
  heading.textContent = title;
}

if (paragraph && description) {
  paragraph.textContent = description;
}

}

function normalizeNews(item, index) {
if (!item || typeof item !== "object") {
return null;
}

const title = getText(item.title, 400);

if (!title) return null;

const category = getText(item.category, 40).toLowerCase();

const allowedCategories = [
  "btc",
  "usdt",
  "market",
  "altcoin",
  "regulation",
  "macro",
  "security",
  "exchange",
  "other"
];

const importance = getText(
  item.importance,
  20
).toLowerCase();

const allowedImportance = [
  "high",
  "medium",
  "low"
];

return {
  id: getText(item.id, 160) || `news-${index}`,
  title,
  summary: getText(item.summary, 3000),
  impact: getText(item.impact, 1500),
  source: getText(item.source, 150),
  url: safeExternalUrl(item.url),
  publishedAt: getText(item.publishedAt, 80),
  category: allowedCategories.includes(category)
    ? category
    : "other",
  importance: allowedImportance.includes(importance)
    ? importance
    : "low"
};

}

function createNewsCard(news) {
const card = createElement("article", "news-card");
const top = createElement("div", "news-card-top");

top.append(
  createElement(
    "span",
    "news-category",
    categoryNames[news.category] || "سایر خبرها"
  )
);

top.append(
  createElement(
    "span",
    "news-importance",
    importanceNames[news.importance] || "اهمیت نامشخص"
  )
);

if (news.source) {
  top.append(
    createElement("span", "news-source", news.source)
  );
}

top.append(
  createElement(
    "time",
    "news-time",
    formatDate(news.publishedAt)
  )
);

const title = createElement("h3", "news-title", news.title);
const summary = createElement(
  "p",
  "news-summary",
  news.summary || "خلاصه‌ای برای این خبر ثبت نشده است."
);

card.append(top, title, summary);

if (news.impact) {
  const impactBox = createElement("div", "news-impact");

  impactBox.append(
    createElement(
      "strong",
      "news-impact-title",
      "اثر احتمالی بر بازار"
    ),
    createElement(
      "p",
      "news-impact-text",
      news.impact
    )
  );

  card.append(impactBox);
}

const footer = createElement("div", "news-card-footer");
const disclaimer = createElement(
  "span",
  "news-disclaimer",
  "اثر احتمالی است؛ نه پیش‌بینی قطعی."
);

if (news.url) {
  const link = createElement(
    "a",
    "news-link",
    "مشاهده منبع اصلی ↗"
  );

  link.href = news.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.referrerPolicy = "no-referrer";

  footer.append(link);
} else {
  footer.append(
    createElement(
      "span",
      "news-disclaimer",
      "لینک منبع موجود نیست."
    )
  );
}

const detailsButton = createElement(
  "button",
  "button",
  "جزئیات خبر"
);

detailsButton.type = "button";
detailsButton.addEventListener("click", () => {
  showNewsDetails(news);
});

footer.append(detailsButton, disclaimer);
card.append(footer);

return card;

}

function showNewsDetails(news) {
if (!elements.newsDialog || !elements.dialogContent) {
return;
}

elements.dialogContent.replaceChildren();

const heading = createElement(
  "h2",
  "news-title",
  news.title
);

const source = createElement(
  "p",
  "news-summary",
  `منبع: ${news.source || "نامشخص"}`
);

const date = createElement(
  "p",
  "news-disclaimer",
  `زمان انتشار: ${formatDate(news.publishedAt)}`
);

const summaryHeading = createElement("h3", "", "خلاصه خبر");

const summary = createElement(
  "p",
  "news-summary",
  news.summary || "خلاصه‌ای ثبت نشده است."
);

elements.dialogContent.append(
  heading,
  source,
  date,
  summaryHeading,
  summary
);

if (news.impact) {
  elements.dialogContent.append(
    createElement("h3", "", "اثر احتمالی بر بازار"),
    createElement("p", "news-impact-text", news.impact)
  );
}

if (news.url) {
  const link = createElement(
    "a",
    "news-link",
    "رفتن به منبع اصلی ↗"
  );

  link.href = news.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.referrerPolicy = "no-referrer";

  elements.dialogContent.append(link);
}

if (typeof elements.newsDialog.showModal === "function") {
  elements.newsDialog.showModal();
} else {
  elements.newsDialog.setAttribute("open", "");
}

}

function getFilteredNews() {
const query = state.searchQuery.toLocaleLowerCase("fa-IR");

return state.allNews.filter((news) => {
  const matchesCategory =
    state.activeCategory === "all" ||
    news.category === state.activeCategory;

  const searchableText = [
    news.title,
    news.summary,
    news.impact,
    news.source,
    categoryNames[news.category] || ""
  ].join(" ").toLocaleLowerCase("fa-IR");

  const matchesSearch =
    !query || searchableText.includes(query);

  return matchesCategory && matchesSearch;
});

}

function renderNews() {
if (!elements.newsList) return;

const filteredNews = getFilteredNews();
const fragment = document.createDocumentFragment();

filteredNews.forEach((news) => {
  fragment.append(createNewsCard(news));
});

elements.newsList.replaceChildren(fragment);

if (state.loading) {
  setEmptyState(
    true,
    "در حال دریافت خبرها",
    "کمی صبر کن؛ داریم خبرها را بارگذاری می‌کنیم."
  );
  return;
}

if (state.error && state.allNews.length === 0) {
  setEmptyState(
    true,
    "دریافت خبرها ناموفق بود",
    "ممکن است هنوز فایل خبرها ساخته نشده باشد یا اتصال برقرار نباشد."
  );
  return;
}

if (filteredNews.length === 0) {
  setEmptyState(
    true,
    "خبری پیدا نشد",
    "عبارت جست‌وجو یا دسته‌بندی را تغییر بده."
  );
} else {
  setEmptyState(false);
}

setStatus(
  `${filteredNews.length.toLocaleString("fa-IR")} خبر نمایش داده می‌شود`
);

}

async function loadNews() {
state.loading = true;
state.error = false;

setStatus("در حال دریافت خبرها...");
renderNews();

try {
  const response = await fetch(
    `${NEWS_URL}?v=${Date.now()}`,
    {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!data || !Array.isArray(data.news)) {
    throw new Error("ساختار فایل خبرها معتبر نیست.");
  }

  state.allNews = data.news
    .map(normalizeNews)
    .filter(Boolean);

  state.loading = false;
  state.error = false;

  if (elements.lastUpdated) {
    elements.lastUpdated.textContent =
      data.updatedAt
        ? `آخرین به‌روزرسانی: ${formatDate(data.updatedAt)}`
        : "زمان به‌روزرسانی نامشخص";
  }

  renderNews();
} catch (error) {
  state.loading = false;
  state.error = true;

  console.error("News loading failed.");

  setStatus(
    "خبرها دریافت نشدند؛ بعداً دوباره تلاش کن.",
    true
  );

  renderNews();
}

}

function setupFilters() {
elements.filters.forEach((button) => {
button.addEventListener("click", () => {
state.activeCategory =
getText(button.dataset.category, 40) || "all";

    elements.filters.forEach((item) => {
      const active = item === button;

      item.classList.toggle("active", active);
      item.setAttribute(
        "aria-pressed",
        String(active)
      );
    });

    renderNews();
  });
});

}

function setupSearch() {
if (!elements.searchInput) return;

elements.searchInput.addEventListener("input", () => {
  state.searchQuery = getText(
    elements.searchInput.value,
    200
  );

  renderNews();
});

}

function setupRefresh() {
if (!elements.refreshButton) return;

elements.refreshButton.addEventListener("click", () => {
  loadNews();
});

}

function setupDialog() {
if (!elements.newsDialog) return;

const closeButton =
  elements.newsDialog.querySelector("[data-close-dialog]");

if (closeButton) {
  closeButton.addEventListener("click", () => {
    elements.newsDialog.close();
  });
}

elements.newsDialog.addEventListener("click", (event) => {
  if (event.target === elements.newsDialog) {
    elements.newsDialog.close();
  }
});

}

function init() {
setupFilters();
setupSearch();
setupRefresh();
setupDialog();
loadNews();
}

if (document.readyState === "loading") {
document.addEventListener("DOMContentLoaded", init, {
once: true
});
} else {
init();
}
})();
