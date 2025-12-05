// functions/api/twitter.js

export async function onRequest(context) {
  // Your working Nitter JSON endpoint:
  // Make sure this matches exactly the URL that worked in the browser.
  const TWITTER_FEED_URL =
    "https://nitter.privacyredirect.com/envy_fgc/rss?format=json";

  // If somehow it’s empty, fail soft.
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

    // If Nitter returns a non-200 (blocked, rate-limited, etc.) → empty list.
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
      // Bad JSON from upstream → empty list.
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

      const url = tweet.url || tweet.link || tweet.permalink || "";

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
        "Cache-Control": "public, max-age=900", // 15 minutes
      },
    });

    await cache.put(cacheKey, response.clone());
    return response;
  } catch (err) {
    // Any unexpected error → return empty list to keep frontend happy.
    return new Response("[]", {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}
