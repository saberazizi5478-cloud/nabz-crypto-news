#!/usr/bin/env python3
"""Nabz Crypto News - RSS collection engine."""

import hashlib
import html
import json
import logging
import re
import socket
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import feedparser

---------------- Configuration ----------------

ROOT = Path(file).resolve().parent.parent
OUTPUT_FILE = ROOT / "data" / "news.json"

MAX_NEWS = 100
MAX_SUMMARY_LENGTH = 1200
FEED_TIMEOUT_SECONDS = 15

socket.setdefaulttimeout(FEED_TIMEOUT_SECONDS)

logging.basicConfig(
level=logging.INFO,
format="%(levelname)s: %(message)s",
)

FEEDS = [
{
"name": "CoinDesk",
"url": "https://www.coindesk.com/arc/outboundfeeds/rss/",
},
{
"name": "Cointelegraph",
"url": "https://cointelegraph.com/rss",
},
{
"name": "Decrypt",
"url": "https://decrypt.co/feed",
},
]

CRYPTO_KEYWORDS = {
"bitcoin", "btc", "ethereum", "crypto", "cryptocurrency",
"blockchain", "stablecoin", "stablecoins", "tether", "usdt",
"usdc", "binance", "coinbase", "sec", "cftc", "etf",
"digital asset", "digital assets", "token", "tokens",
"defi", "exchange", "wallet", "altcoin", "altcoins",
"بیت کوین", "بیت‌کوین", "اتریوم", "ارز دیجیتال",
"رمزارز", "تتر", "استیبل کوین", "استیبل‌کوین",
}

HIGH_IMPACT_TERMS = {
"hack", "hacked", "exploit", "breach", "lawsuit",
"sued", "sec", "cftc", "ban", "banned", "approval",
"approved", "rejected", "etf", "bankruptcy", "insolvency",
"reserve", "reserves", "depeg", "depegged", "sanctions",
"hack", "هک", "هک شد", "ورشکستگی", "تحریم",
"تصویب", "رد درخواست", "مقررات", "ذخایر",
}

MEDIUM_IMPACT_TERMS = {
"launch", "partnership", "upgrade", "mainnet",
"integration", "funding", "investment", "adoption",
"launches", "upgrade", "راه‌اندازی", "همکاری",
"سرمایه‌گذاری", "به‌روزرسانی",
}

CATEGORY_RULES = {
"usdt": {
"tether", "usdt", "usdc", "stablecoin",
"stablecoins", "depeg", "depegged",
"استیبل کوین", "استیبل‌کوین", "تتر",
},
"btc": {
"bitcoin", "btc", "بیت کوین", "بیت‌کوین",
},
"regulation": {
"sec", "cftc", "regulation", "regulatory",
"lawsuit", "court", "legislation", "ban",
"قانون", "مقررات", "تحریم",
},
"security": {
"hack", "hacked", "exploit", "breach",
"vulnerability", "هک", "آسیب‌پذیری",
},
"exchange": {
"binance", "coinbase", "exchange",
"صرافی",
},
"macro": {
"federal reserve", "fed rate", "interest rate",
"inflation", "recession", "tariff",
"نرخ بهره", "تورم",
},
"altcoin": {
"altcoin", "altcoins", "solana", "sol ",
"xrp", "cardano", "dogecoin",
},
}

---------------- Safe text handling ----------------

def clean_text(value, limit=MAX_SUMMARY_LENGTH):
"""Convert untrusted feed text to plain text."""
if not value:
return ""

text = str(value)

# Remove script/style blocks before removing other HTML tags.
text = re.sub(
    r"<(script|style)\b[^>]*>.*?</\1\s*>",
    " ",
    text,
    flags=re.IGNORECASE | re.DOTALL,
)

text = re.sub(r"<[^>]+>", " ", text)
text = html.unescape(text)
text = re.sub(r"\s+", " ", text).strip()

return text[:limit]

def safe_http_url(value):
"""Accept only absolute HTTP or HTTPS URLs."""
if not value or not isinstance(value, str):
return ""

try:
    parts = urlsplit(value.strip())

    if parts.scheme.lower() not in {"http", "https"}:
        return ""

    if not parts.hostname:
        return ""

    if parts.username or parts.password:
        return ""

    return urlunsplit(parts)
except (ValueError, TypeError):
    return ""

def parse_date(entry):
"""Return an ISO UTC timestamp, or the current time if unavailable."""
candidates = [
entry.get("published"),
entry.get("updated"),
entry.get("created"),
]

for candidate in candidates:
    if not candidate:
        continue

    try:
        date = parsedate_to_datetime(candidate)

        if date.tzinfo is None:
            date = date.replace(tzinfo=timezone.utc)

        return date.astimezone(timezone.utc).isoformat()
    except (TypeError, ValueError, OverflowError):
        pass

# Some feeds expose parsed date tuples instead of date strings.
for field in ("published_parsed", "updated_parsed"):
    value = entry.get(field)

    if value:
        try:
            return datetime.fromtimestamp(
                time.mktime(value),
                timezone.utc,
            ).isoformat()
        except (TypeError, ValueError, OverflowError, OSError):
            pass

return None

---------------- News classification ----------------

def matching_terms(text, terms):
lowered = text.casefold()
return {
term for term in terms
if term.casefold() in lowered
}

def classify_category(text):
for category in (
"usdt", "btc", "regulation", "security",
"exchange", "macro", "altcoin",
):
if matching_terms(text, CATEGORY_RULES[category]):
return category

return "market"

def classify_importance(text):
if matching_terms(text, HIGH_IMPACT_TERMS):
return "high"

if matching_terms(text, MEDIUM_IMPACT_TERMS):
    return "medium"

return "low"

def make_impact(category, importance):
"""A transparent template, not an AI prediction."""
descriptions = {
"btc": (
"خبر مرتبط با بیت‌کوین است. اثر واقعی آن به جزئیات خبر "
"و واکنش بازار بستگی دارد."
),
"usdt": (
"خبر به تتر یا استیبل‌کوین‌ها مربوط است. در خبرهای مربوط "
"به پشتوانه یا حفظ برابری قیمت، اعتبار منبع اهمیت ویژه دارد."
),
"regulation": (
"تغییرات مقرراتی ممکن است بر فعالیت شرکت‌ها و دسترسی "
"سرمایه‌گذاران اثر بگذارد؛ نتیجه به جزئیات تصمیم بستگی دارد."
),
"security": (
"خبر امنیتی ممکن است بر اعتماد کاربران و دارایی‌های "
"درگیر اثر بگذارد. جزئیات و تأیید مستقل باید بررسی شود."
),
"exchange": (
"خبر مرتبط با صرافی‌ها ممکن است بر کاربران یا دسترسی "
"به خدمات اثر بگذارد؛ دامنه اثر به موضوع خبر بستگی دارد."
),
"macro": (
"اخبار اقتصاد کلان می‌توانند بر دارایی‌های پرریسک اثر بگذارند؛ "
"جهت و شدت اثر از پیش قطعی نیست."
),
"altcoin": (
"خبر به یک یا چند آلت‌کوین مربوط است؛ اثر آن ممکن است "
"محدود به همان دارایی‌ها باشد."
),
"market": (
"این خبر به بازار کریپتو مربوط است؛ برای ارزیابی اثر آن "
"باید متن کامل و منبع اصلی بررسی شود."
),
}

return descriptions.get(category, descriptions["market"])

---------------- Deduplication ----------------

def make_id(url, title):
source = url or title.casefold()

return hashlib.sha256(
    source.encode("utf-8")
).hexdigest()[:20]

def normalize_entry(entry, feed_name):
title = clean_text(entry.get("title"), 400)

if not title:
    return None

summary_source = (
    entry.get("summary")
    or entry.get("description")
    or ""
)

summary = clean_text(summary_source)

link = safe_http_url(entry.get("link", ""))

if not summary:
    summary = "خلاصه قابل‌دسترسی در فید خبری موجود نیست."

combined = f"{title} {summary}"
lowered = combined.casefold()

if not matching_terms(lowered, CRYPTO_KEYWORDS):
    return None

category = classify_category(lowered)
importance = classify_importance(lowered)

published_at = parse_date(entry)

# A stable ID prevents the same URL being shown repeatedly.
# Entries without links fall back to their title.
return {
    "id": make_id(link, title),
    "title": title,
    "summary": summary,
    "impact": make_impact(category, importance),
    "source": feed_name,
    "url": link,
    "publishedAt": published_at,
    "category": category,
    "importance": importance,
}

---------------- RSS collection ----------------

def read_existing_news():
try:
with OUTPUT_FILE.open("r", encoding="utf-8") as file:
data = json.load(file)

    if isinstance(data, dict) and isinstance(data.get("news"), list):
        return data["news"]
except (OSError, json.JSONDecodeError):
    pass

return []

def fetch_feed(feed):
logging.info("Reading feed: %s", feed["name"])

try:
    parsed = feedparser.parse(feed["url"])

    if getattr(parsed, "bozo", False):
        logging.warning(
            "Feed reported a parsing issue: %s",
            feed["name"],
        )

    entries = getattr(parsed, "entries", [])

    if not entries:
        logging.warning("No entries received: %s", feed["name"])

    result = []

    for entry in entries:
        item = normalize_entry(entry, feed["name"])

        if item:
            result.append(item)

    logging.info(
        "%s: accepted %d entries",
        feed["name"],
        len(result),
    )

    return result

except Exception:
    # One unavailable feed must not stop the other feeds.
    logging.exception("Feed failed: %s", feed["name"])
    return []

def parse_timestamp(value):
if not value:
return 0

try:
    date = datetime.fromisoformat(
        value.replace("Z", "+00:00")
    )

    if date.tzinfo is None:
        date = date.replace(tzinfo=timezone.utc)

    return date.timestamp()
except (TypeError, ValueError, OverflowError):
    return 0

def main():
OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

existing_news = read_existing_news()
collected_news = []

# Preserve old items if a source is temporarily unavailable.
for item in existing_news:
    if not isinstance(item, dict):
        continue

    if item.get("id") and item.get("title"):
        collected_news.append(item)

successful_feeds = 0

for feed in FEEDS:
    before = len(collected_news)
    items = fetch_feed(feed)

    if items:
        successful_feeds += 1

    collected_news.extend(items)

if successful_feeds == 0 and not collected_news:
    raise RuntimeError(
        "No usable news is available from any feed."
    )

# Deduplicate by stable ID; newer entries are retained first.
unique = {}

for item in collected_news:
    item_id = item.get("id")

    if not item_id:
        continue

    if item_id not in unique:
        unique[item_id] = item

news = list(unique.values())

news.sort(
    key=lambda item: parse_timestamp(
        item.get("publishedAt")
    ),
    reverse=True,
)

news = news[:MAX_NEWS]

output = {
    "updatedAt": datetime.now(timezone.utc).isoformat(),
    "news": news,
}

temporary_file = OUTPUT_FILE.with_suffix(".tmp")

with temporary_file.open("w", encoding="utf-8") as file:
    json.dump(
        output,
        file,
        ensure_ascii=False,
        indent=2,
    )
    file.write("\n")

temporary_file.replace(OUTPUT_FILE)

logging.info("Saved %d news items.", len(news))
logging.info("Output: %s", OUTPUT_FILE)

if name == "main":
main()
