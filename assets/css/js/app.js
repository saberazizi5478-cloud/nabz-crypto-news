"use strict";

(() => {
  const NEWS_URL = "./data/news.json";

  const state = {
    news: [],
    category: "all",
    query: "",
    loading: true,
    error: false
  };

  const el = {
    list: document.getElementById("newsList"),
    search: document.getElementById("searchInput"),
    filters: document.querySelectorAll("[data-filter]"),
    status: document.getElementById("statusText"),
    statusDot: document.getElementById("statusDot"),
    empty: document.getElementById("emptyState"),
    refresh: document.getElementById("refreshBtn"),
    updated: document.getElementById("updatedAt"),
    count: document.getElementById("countBadge"),
    dialog: document.getElementById("detailDialog"),
    detail: document.getElementById("detailContent"),
    close: document.getElementById("closeDialog"),
    install: document.getElementById("installBtn")
  };

  const categories = {
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

  function text(value, limit = 3000) {
    return typeof value === "string"
      ? value.trim().slice(0, limit)
      : "";
  }

  function dateText(value) {
    if (!value) return "زمان نامشخص";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "زمان نامشخص";
    }

    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Tehran"
    }).format(date);
  }

  function node(tag, className, content) {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (content !== undefined) item.textContent = content;
    return item;
  }

  function setStatus(message, error = false) {
    if (el.status) el.status.textContent = message;

    if (el.statusDot) {
      el.statusDot.dataset.state = error ? "error" : "normal";
    }
  }

  function showEmpty(show, heading, description) {
    if (!el.empty) return;

    el.empty.hidden = !show;

    const h3 = el.empty.querySelector("h3");
    const p = el.empty.querySelector("p");

    if (h3 && heading) h3.textContent = heading;
    if (p && description) p.textContent = description;
  }

  function normalize(item, index) {
    if (!item || typeof item !== "object") return null;

    const title = text(item.title, 400);
    if (!title) return null;

    let url = "";
    try {
      const parsed = new URL(text(item.url, 2048));
      if (["https:", "http:"].includes(parsed.protocol)) {
        url = parsed.href;
      }
    } catch (_) {}

    const category = text(item.category, 40).toLowerCase();
    const importance = text(item.importance, 20).toLowerCase();

    return {
      id: text(item.id, 160) || `news-${index}`,
      title,
      summary: text(item.summary),
      impact: text(item.impact, 1500),
      source: text(item.source, 150),
      url,
      publishedAt: text(item.publishedAt, 80),
      category: categories[category] ? category : "other",
      importance: importanceNames[importance] ? importance : "low"
    };
  }

  function addLink(parent, url, label) {
    if (!url) return;

    const link = node("a", "news-link", label);
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    parent.append(link);
  }

  function showDetails(news) {
    if (!el.dialog || !el.detail) return;

    el.detail.replaceChildren();

    el.detail.append(
      node("h2", "news-title", news.title),
      node("p", "news-summary", `منبع: ${news.source || "نامشخص"}`),
      node("p", "news-disclaimer",
        `زمان انتشار: ${dateText(news.publishedAt)}`),
      node("h3", "", "خلاصه خبر"),
      node("p", "news-summary",
        news.summary || "خلاصه‌ای برای این خبر ثبت نشده است.")
    );

    if (news.impact) {
      el.detail.append(
        node("h3", "", "اثر احتمالی بر بازار"),
        node("p", "news-impact-text", news.impact)
      );
    }

    addLink(el.detail, news.url, "مشاهده منبع اصلی ↗");

    if (typeof el.dialog.showModal === "function") {
      if (!el.dialog.open) el.dialog.showModal();
    } else {
      el.dialog.setAttribute("open", "");
    }
  }

  function createCard(news) {
    const card = node("article", "news-card");
    const top = node("div", "news-card-top");

    top.append(
      node("span", "news-category", categories[news.category]),
      node("span", "news-importance",
        importanceNames[news.importance])
    );

    if (news.source) {
      top.append(node("span", "news-source", news.source));
    }

    top.append(node("time", "news-time", dateText(news.publishedAt)));

    card.append(
      top,
      node("h3", "news-title", news.title),
      node("p", "news-summary",
        news.summary || "خلاصه‌ای برای این خبر ثبت نشده است.")
    );

    if (news.impact) {
      const impact = node("div", "news-impact");
      impact.append(
        node("strong", "news-impact-title", "اثر احتمالی بر بازار"),
        node("p", "news-impact-text", news.impact)
      );
      card.append(impact);
    }

    const footer = node("div", "news-card-footer");

    addLink(footer, news.url, "مشاهده منبع اصلی ↗");

    const button = node("button", "button", "جزئیات خبر");
    button.type = "button";
    button.addEventListener("click", () => showDetails(news));

    footer.append(
      button,
      node("span", "news-disclaimer",
        "اثر احتمالی است؛ نه پیش‌بینی قطعی.")
    );

    card.append(footer);
    return card;
  }

  function filteredNews() {
    const query = state.query.toLocaleLowerCase("fa-IR");

    return state.news.filter(news => {
      const categoryMatches =
        state.category === "all" ||
        news.category === state.category;

      const searchable = [
        news.title,
        news.summary,
        news.impact,
        news.source,
        categories[news.category]
      ].join(" ").toLocaleLowerCase("fa-IR");

      return categoryMatches &&
        (!query || searchable.includes(query));
    });
  }

  function render() {
    if (!el.list) return;

    const results = filteredNews();
    const fragment = document.createDocumentFragment();

    results.forEach(news => fragment.append(createCard(news)));
    el.list.replaceChildren(fragment);

    if (el.count) {
      el.count.textContent = results.length.toLocaleString("fa-IR");
    }

    if (state.loading) {
      showEmpty(true, "در حال دریافت خبرها",
        "کمی صبر کن؛ خبرها در حال بارگذاری هستند.");
      return;
    }

    if (state.error && state.news.length === 0) {
      showEmpty(true, "دریافت خبرها ناموفق بود",
        "اتصال را بررسی کن و دوباره تلاش کن.");
      return;
    }

    if (results.length === 0) {
      showEmpty(true, "خبری پیدا نشد",
        "عبارت جست‌وجو یا دسته‌بندی را تغییر بده.");
    } else {
      showEmpty(false);
    }

    setStatus(`${results.length.toLocaleString("fa-IR")} خبر نمایش داده می‌شود`);
  }

  async function loadNews() {
    state.loading = true;
    state.error = false;
    setStatus("در حال دریافت خبرها...");
    render();

    try {
      const response = await fetch(
        `${NEWS_URL}?v=${Date.now()}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data || !Array.isArray(data.news)) {
        throw new Error("ساختار فایل خبرها معتبر نیست.");
      }

      state.news = data.news.map(normalize).filter(Boolean);

      if (el.updated) {
        el.updated.textContent = data.updatedAt
          ? `آخرین به‌روزرسانی: ${dateText(data.updatedAt)}`
          : "زمان به‌روزرسانی نامشخص";
      }

      state.loading = false;
      state.error = false;
      render();
    } catch (error) {
      console.error("News loading failed:", error);
      state.loading = false;
      state.error = true;
      setStatus("خبرها دریافت نشدند؛ بعداً دوباره تلاش کن.", true);
      render();
    }
  }

  function setup() {
    el.filters.forEach(button => {
      button.addEventListener("click", () => {
        state.category = text(button.dataset.filter, 40)
          .toLowerCase() || "all";

        el.filters.forEach(filter => {
          const active = filter === button;
          filter.classList.toggle("active", active);
          filter.setAttribute("aria-pressed", String(active));
        });

        render();
      });
    });

    if (el.search) {
      el.search.addEventListener("input", () => {
        state.query = text(el.search.value, 200);
        render();
      });
    }

    if (el.refresh) {
      el.refresh.addEventListener("click", loadNews);
    }

    if (el.close && el.dialog) {
      el.close.addEventListener("click", () => {
        if (typeof el.dialog.close === "function") {
          el.dialog.close();
        } else {
          el.dialog.removeAttribute("open");
        }
      });
    }

    if (el.dialog) {
      el.dialog.addEventListener("click", event => {
        if (event.target === el.dialog &&
            typeof el.dialog.close === "function") {
          el.dialog.close();
        }
      });
    }

    if (el.install) {
      el.install.hidden = true;

      window.addEventListener("beforeinstallprompt", event => {
        event.preventDefault();
        window.installPrompt = event;
        el.install.hidden = false;
      });

      el.install.addEventListener("click", async () => {
        if (!window.installPrompt) return;

        window.installPrompt.prompt();
        await window.installPrompt.userChoice;
        window.installPrompt = null;
        el.install.hidden = true;
      });
    }

    if ("serviceWorker" in navigator &&
        location.protocol === "https:") {
      navigator.serviceWorker.register("./sw.js")
        .catch(error => console.warn("Service worker:", error));
    }

    loadNews();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup, { once: true });
  } else {
    setup();
  }
})();
