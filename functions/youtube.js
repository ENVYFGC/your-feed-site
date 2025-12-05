// /functions/youtube.js
export async function onRequest(context) {
  const CHANNEL_ID = "UC4GVzh8HVrrtYEkgVskWTsg"; // replace with your channel ID
  const rssUrl = CHANNEL_ID
    ? `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`
    : "";

  if (!rssUrl) {
    return new Response("[]", {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  try {
    const cache = caches.default;
    const cacheKey = new Request(
      `https://feed.local/youtube?src=${encodeURIComponent(rssUrl)}`
    );
    const cached = await cache.match(cacheKey);
    if (cached) {
      return cached;
    }

    const res = await fetch(rssUrl);
    if (!res.ok) {
      return new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const text = await res.text();

    const items = [];
    const itemRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = itemRegex.exec(text)) !== null) {
      const entry = match[1];

      const getTag = (tag) => {
        const m = entry.match(
          new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)
        );
        return m ? m[1].trim() : "";
      };

      const title = getTag("title");
      const published = getTag("published");
      const linkMatch = entry.match(/<link rel="alternate" href="([^"]+)"/);
      const url = linkMatch ? linkMatch[1] : "";
      const thumbMatch = entry.match(/<media:thumbnail url="([^"]+)"/);
      const thumbnail = thumbMatch ? thumbMatch[1] : "";
      const desc = getTag("media:description");

      items.push({
        source: "youtube",
        title,
        description: desc,
        url,
        thumbnail,
        publishedAt: published,
      });
    }

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
