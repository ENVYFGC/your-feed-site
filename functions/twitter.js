// /functions/twitter.js

const toCanonicalTweetUrl = (url) => {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return "";
    u.protocol = "https:";
    if (u.hostname.includes("nitter")) {
      u.hostname = "x.com";
    }
    const host = u.hostname.toLowerCase();
    if (!host.endsWith("twitter.com") && !host.endsWith("x.com")) {
      return "";
    }
    return u.href;
  } catch {
    return "";
  }
};

export async function onRequest(context) {
  const TWITTER_FEED_URL =
    "https://nitter.privacyredirect.com/envy_fgc/rss?format=json";

  if (!TWITTER_FEED_URL) {
    return new Response("[]", {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  try {
    const cache = caches.default;
    const cacheKey = new Request(
      `https://feed.local/twitter?src=${encodeURIComponent(TWITTER_FEED_URL)}`
    );
    const cached = await cache.match(cacheKey);

    if (cached) {
      return cached;
    }

    const res = await fetch(TWITTER_FEED_URL);

    if (!res.ok) {
      return new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    let data;
    try {
      data = await res.json();
    } catch (e) {
      return new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const rawItems = Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data)
      ? data
      : [];

    const items = rawItems.map((tweet) => {
      const title =
        tweet.title ||
        tweet.text ||
        (tweet.description || "").slice(0, 80) ||
        "Tweet";

      const description =
        tweet.text ||
        tweet.description ||
        tweet.content ||
        tweet.summary ||
        "";

      const rawUrl = tweet.url || tweet.link || tweet.permalink || "";
      const url = toCanonicalTweetUrl(rawUrl) || rawUrl;

      const publishedAt =
        tweet.published ||
        tweet.pubDate ||
        tweet.date ||
        tweet.created_at ||
        "";

      const thumbnail =
        tweet.thumbnail ||
        tweet.image ||
        (tweet.enclosure && tweet.enclosure.url) ||
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

    const body = JSON.stringify(items);

    const response = new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=900",
      },
    });

    await cache.put(cacheKey, response.clone());
    return response;
  } catch (err) {
    return new Response("[]", {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}
