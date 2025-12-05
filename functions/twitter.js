// /functions/twitter.js

export async function onRequest(context) {
  // Your working Nitter JSON endpoint
  const TWITTER_FEED_URL =
    "https://nitter.privacyredirect.com/envy_fgc/rss?format=json";

  const cache = caches.default;
  const cacheKey = new Request("https://feed.local/twitter/envy_fgc");
  const cached = await cache.match(cacheKey);

  if (cached) {
    return cached;
  }

  const res = await fetch(TWITTER_FEED_URL);

  if (!res.ok) {
    return new Response("Failed to fetch Twitter feed", { status: 500 });
  }

  let data;
  try {
    data = await res.json();
  } catch (e) {
    return new Response("Invalid JSON from Twitter feed", { status: 500 });
  }

  // Handle common shapes:
  // - { items: [...] }
  // - [ ... ]
  const rawItems = Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data)
    ? data
    : [];

  const items = rawItems.map((tweet) => {
    // Try to be flexible about field names
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

    // Try some common thumbnail/media fields; if none present, null
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
}
