// /functions/youtube.js
export async function onRequest(context) {
  // 👉 Replace with your channel ID
  const CHANNEL_ID = "UC4GVzh8HVrrtYEkgVskWTsg";
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

  const cache = caches.default;
  const cacheKey = new Request("https://feed.local/youtube");
  const cached = await cache.match(cacheKey);
  if (cached) {
    return cached;
  }

  const res = await fetch(rssUrl);
  if (!res.ok) {
    return new Response("Failed to fetch YouTube feed", { status: 500 });
  }

  const text = await res.text();

  // Basic RSS parsing using regex / DOMParser-like approach
  // Cloudflare runtimes support XML via DOMParser in some environments, but to stay safe, let's do a simple parse.
  const items = [];
  const itemRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = itemRegex.exec(text)) !== null) {
    const entry = match[1];

    const getTag = (tag) => {
      const m = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
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

  const json = JSON.stringify(items);

  const response = new Response(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=900", // 15 minutes
    },
  });

  await cache.put(cacheKey, response.clone());
  return response;
}
