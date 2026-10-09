"use strict";

(() => {
  const $ = (selector) => document.querySelector(selector);

  const el = {
    installBtn: $("#installBtn"),
    refreshBtn: $("#refreshBtn"),
    statusDot: $("#statusDot"),
    statusText: $("#statusText"),
    updatedAt: $("#updatedAt"),
    searchInput: $("#searchInput"),
    filters: $("#filters"),
    countBadge: $("#countBadge"),
    newsList: $("#newsList"),
    emptyState: $("#emptyState"),
    detailDialog: $("#detailDialog"),
    closeDialog: $("#closeDialog"),
    detailContent: $("#detailContent")
  };

  const NEWS_URL = "./data/news.json";
  let allNews = [];
  let activeFilter = "all";
  let installPrompt = null;

  function normalize(value) {
    return String(value ?? "")
      .toLocaleLowerCase("fa")
      .replace(/ي/g, "ی")
      .replace(/ك/g, "ک")
      .trim();
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);
  }

  function formatDate(value) {
    if (!value) return "زمان نامشخص";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "زمان نامشخص";

    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function setStatus(message, state = "normal") {
    if (el.statusText) el.statusText.textContent = message;

    if (el.statusDot) {
      el.statusDot.dataset.state = state;
      el.statusDot.style.backgroundColor =
        state === "error" ? "#ff7777" :
        state === "success" ? "#64e6a5" : "#9aa9bd";
    }
  }

  function categoryLabel(category) {
    const labels = {
      btc: "بیت‌کوین",
      usdt: "تتر و استیبل‌کوین",
      market: "کل بازار",
      altcoin: "آلت‌کوین",
      regulation: "قوانین و مقررات",
      macro: "اقتصاد کلان",
      security: "امنیت",
      exchange: "صرافی",
      other: "سایر"
    };

    return labels[normalize(category)] || "بازار کریپتو";
  }

  function matchesFilter(item) {
    const category = normalize(item.category);

    if (activeFilter === "all") return true;
    if (activeFilter === "btc") return category === "btc";
    if (activeFilter === "usdt") return category === "usdt";
    if (activeFilter === "altcoin") return category === "altcoin";

    if (activeFilter === "market") {
      return [
        "market", "regulation", "macro",
        "security", "exchange", "other"
      ].includes(category);
    }

    return category === activeFilter;
  }

  function getVisibleNews() {
    const query = normalize(el.searchInput?.value || "");

    return allNews.filter((item) => {
      const text = normalize([
        item.title,
        item.summary,
        item.impact,
        item.source,
        item.category
      ].join(" "));

      return matchesFilter(item) && (!query || text.includes(query));
    });
  }

  function renderNews() {
    if (!el.newsList) return;

    const news = getVisibleNews();

    if (el.countBadge) {
      el.countBadge.textContent =
        new Intl.NumberFormat("fa-IR").format(news.length) + " خبر";
    }

    if (el.emptyState) el.emptyState.hidden = news.length > 0;
    el.newsList.replaceChildren();

    news.forEach((item) => {
      const article = document.createElement("article");
      article.className = "news-card";

      const title = escapeHtml(item.title || "بدون عنوان");
      const summary = escapeHtml(
        item.summary || "خلاصه‌ای برای این خبر ثبت نشده است."
      );
      const source = escapeHtml(item.source || "منبع نامشخص");
      const category = escapeHtml(categoryLabel(item.category));
      const date = escapeHtml(formatDate(item.publishedAt));
      const important = Number(item.importance || 0) >= 3;

      article.innerHTML = `
        <div class="news-card-meta">
          <span class="tag">${category}</span>
          <span class="tag">${important ? "مهم" : "خبر"}</span>
        </div>
        <h3>${title}</h3>
        <p>${summary}</p>
        <div class="news-card-meta">
          <span>${source}</span>
          <time>${date}</time>
        </div>
        <button type="button" class="read-more">
          جزئیات و اثر احتمالی
        </button>
      `;

      article.querySelector(".read-more")
        .addEventListener("click", () => showDetails(item));

      el.newsList.appendChild(article);
    });
  }

  function showDetails(item) {
    if (!el.detailDialog || !el.detailContent) return;

    const url = String(item.url || "");
    let safeUrl = "";

    try {
      const parsed = new URL(url);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") {
        safeUrl = parsed.href;
      }
    } catch (_) {}

    el.detailContent.innerHTML = `
      <h2>${escapeHtml(item.title || "جزئیات خبر")}</h2>
      <p><strong>منبع:</strong> ${escapeHtml(item.source || "نامشخص")}</p>
      <p><strong>دسته:</strong> ${escapeHtml(categoryLabel(item.category))}</p>
      <p><strong>خلاصه:</strong> ${escapeHtml(item.summary || "خلاصه‌ای موجود نیست.")}</p>
      <p><strong>اثر احتمالی:</strong> ${escapeHtml(item.impact || "اثر نامشخص است.")}</p>
      <p><strong>تاریخ:</strong> ${escapeHtml(formatDate(item.publishedAt))}</p>
      ${safeUrl
        ? `<p><a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">خواندن خبر اصلی</a></p>`
        : ""}
      <p class="detail-disclaimer">
        این توضیح احتمالی است و توصیه خریدوفروش نیست.
      </p>
    `;

    if (typeof el.detailDialog.showModal === "function") {
      el.detailDialog.showModal();
    } else {
      el.detailDialog.setAttribute("open", "");
    }
  }

  async function loadNews() {
    if (el.refreshBtn) el.refreshBtn.disabled = true;

    setStatus("در حال دریافت خبرها…");

    try {
      const response = await fetch(
        NEWS_URL + "?t=" + Date.now(),
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      const data = await response.json();

      if (!data || !Array.isArray(data.news)) {
        throw new Error("ساختار فایل خبرها معتبر نیست");
      }

      allNews = data.news;
      renderNews();

      if (el.updatedAt) {
        el.updatedAt.textContent = data.updatedAt
          ? "آخرین به‌روزرسانی: " + formatDate(data.updatedAt)
          : "";
      }

      setStatus(
        allNews.length
          ? "خبرها با موفقیت دریافت شدند"
          : "هنوز خبری ثبت نشده است",
        allNews.length ? "success" : "normal"
      );
    } catch (error) {
      console.error("Nabz Crypto:", error);
      setStatus("دریافت خبرها ناموفق بود؛ دوباره تلاش کن", "error");

      if (el.newsList) el.newsList.replaceChildren();
      if (el.countBadge) el.countBadge.textContent = "۰ خبر";
      if (el.emptyState) el.emptyState.hidden = false;
    } finally {
      if (el.refreshBtn) el.refreshBtn.disabled = false;
    }
  }

  el.refreshBtn?.addEventListener("click", loadNews);
  el.searchInput?.addEventListener("input", renderNews);

  el.filters?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;

    activeFilter = normalize(button.dataset.filter || "all");

    el.filters.querySelectorAll("[data-filter]").forEach((item) => {
      const selected = item === button;
      item.classList.toggle("active", selected);
      item.setAttribute("aria-pressed", String(selected));
    });

    renderNews();
  });

  el.closeDialog?.addEventListener("click", () => {
    if (el.detailDialog?.open) {
      el.detailDialog.close();
    } else {
      el.detailDialog?.removeAttribute("open");
    }
  });

  el.detailDialog?.addEventListener("click", (event) => {
    if (event.target === el.detailDialog) {
      el.detailDialog.close();
    }
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    if (el.installBtn) el.installBtn.hidden = false;
  });

  el.installBtn?.addEventListener("click", async () => {
    if (!installPrompt) return;

    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    el.installBtn.hidden = true;
  });

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((error) => {
        console.warn("Service worker:", error);
      });
    });
  }

  loadNews();
})();
