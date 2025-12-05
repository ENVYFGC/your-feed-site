// /functions/twitter.js
// Fetch Twitter/X feed via Nitter (fallback hosts, JSON or RSS). Returns list.

const DEFAULT_HANDLE = "envy_fgc";
const DEFAULT_HOSTS = [
  "https://nitter.privacyredirect.com",
  "https://nitter.net",
  "https://nitter.fly.dev",
  "https://nitter.woodland.cafe",
  "https://nitter.1d4.us",
  "https://nitter.sneed.network",
  "https://nitter.d420.de",
];
const CACHE_VERSION = "v4";

const toCanonicalTweetUrl = (url) => {
  try {
    const u = new URL(url);
    if (!/^https?:\/\//.test(u.protocol)) return "";
    u.protocol = "https:";
    if (u.hostname.includes("nitter")) {
      u.hostname = "x.com";
    }
    const host = u.hostname.toLowerCase();
    if (!host.endsWith("twitter.com") && !host.endsWith("x.com")) {
      return "";
    }
    u.hash = "";
    return u.href;
  } catch {
    return "";
  }
};

function parseFeedBody(body) {
  try {
    const data = JSON.parse(body);
    const rawItems = Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data)
      ? data
      : [];
    if (rawItems.length) return rawItems;
  } catch {
    // ignore
  }

  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  const stripTags = (str) => str.replace(/<[^>]+>/g, "").trim();

  while ((match = itemRegex.exec(body)) !== null) {
    const entry = match[1];
    const getTag = (tag) => {
      const m = entry.match(
        new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i")
      );
      return m ? stripTags(m[1]) : "";
    };

    const title = getTag("title") || getTag("description") || "Tweet";
    const description = getTag("description") || "";
    const url = getTag("link") || "";
    const publishedAt = getTag("pubDate") || getTag("date") || getTag("updated");
    const enclosureMatch = entry.match(/<enclosure[^>]*url="([^"]+)"/i);
    const thumbnail = enclosureMatch ? enclosureMatch[1] : null;

    items.push({
      title,
      description,
      url,
      publishedAt,
      thumbnail,
    });
  }

  return items;
}

async function fetchWithFallback(url) {
  const targets = [url];
  const stripped = url.replace(/^https?:\/\//, "");
  targets.push(`https://r.jina.ai/http://${stripped}`);

  for (const target of targets) {
    try {
      const res = await fetch(target, {
        headers: {
          "User-Agent": "Mozilla/5.0 (FeedFetcher; +https://envy.xx.kg)",
        },
      });
      if (!res.ok) continue;
      const text = await res.text();
      if (text) return text;
    } catch {
      continue;
    }
  }
  return "";
}

function parseStatusLinksFromPage(bodyText, root, handle) {
  const items = [];
  const seen = new Set();
  const re = /https?:\/\/[^"'\s]+\/status\/\d+/gi;
  const matches = bodyText.match(re) || [];
  for (const m of matches) {
    if (seen.has(m)) continue;
    seen.add(m);
    items.push({
      title: `Post by @${handle}`,
      description: "",
      url: m.replace(/#.*/, ""),
      publishedAt: "",
      thumbnail: null,
    });
    if (items.length >= 30) break;
  }
  return items;
}

export async function onRequest(context) {
  try {
    const handle = context?.env?.TWITTER_HANDLE || DEFAULT_HANDLE;
    const hostList =
      (context?.env?.NITTER_HOSTS &&
        context.env.NITTER_HOSTS.split(",").map((s) => s.trim()).filter(Boolean)) ||
      DEFAULT_HOSTS;

    const feedUrls = [];
    hostList.forEach((base) => {
      const root = base.replace(/\/+$/, "");
      feedUrls.push(`${root}/${handle}/rss?format=json`);
      feedUrls.push(`${root}/${handle}/rss`);
      feedUrls.push(`${root}/${handle}`);
    });

    const cache = caches.default;

    for (const feedUrl of feedUrls) {
      const cacheKey = new Request(
        `https://feed.local/twitter/${CACHE_VERSION}?src=${encodeURIComponent(feedUrl)}`
      );
      const cached = await cache.match(cacheKey);
      if (cached) {
        return cached;
      }

      try {
        const bodyText = await fetchWithFallback(feedUrl);
        if (!bodyText) continue;
        const rawItems = parseFeedBody(bodyText);

        if (!rawItems.length) {
          continue;
        }

        const items = rawItems.map((tweet) => {
          const title =
            tweet.title ||
            tweet.text ||
            (tweet.description || "").slice(0, 80) ||
            "Tweet";

          const rawDesc =
            tweet.text ||
            tweet.description ||
            tweet.content ||
            tweet.summary ||
            "";
          const description = rawDesc.replace(/]]>/g, "").trim();

          const rawUrl = tweet.url || tweet.link || tweet.permalink || "";
          const url = toCanonicalTweetUrl(rawUrl) || rawUrl;

          const publishedAt =
            tweet.published ||
            tweet.pubDate ||
            tweet.date ||
            tweet.created_at ||
            tweet.publishedAt ||
            tweet.updated ||
            "";

          const thumbnail =
            tweet.thumbnail ||
            tweet.image ||
            (tweet.enclosure && tweet.enclosure.url) ||
            tweet.media ||
            null;

          return {
            source: "twitter",
            title,
            description,
            url,
            thumbnail,
            publishedAt,
          };
        });

        const response = new Response(JSON.stringify(items), {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=600",
          },
        });

        await cache.put(cacheKey, response.clone());
        return response;
      } catch {
        // try next URL
      }

      if (!feedUrl.endsWith("/rss") && !feedUrl.includes("/rss?")) {
        try {
          const pageText = await fetchWithFallback(feedUrl);
          const scraped = parseStatusLinksFromPage(pageText, feedUrl, handle);
          if (scraped.length) {
            const response = new Response(JSON.stringify(scraped), {
              status: 200,
              headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Cache-Control": "public, max-age=600",
              },
            });
            await cache.put(cacheKey, response.clone());
            return response;
          }
        } catch {
          // ignore
        }
      }
    }

    const fallback = [
      {
        source: "twitter",
        title: `Twitter feed unavailable`,
        description:
          "Upstream Nitter mirrors are unavailable right now. Check back later or open the profile directly.",
        url: `https://x.com/${handle}`,
        thumbnail: null,
        publishedAt: new Date().toISOString(),
      },
    ];

    return new Response(JSON.stringify(fallback), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch {
    return new Response("[]", {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}
