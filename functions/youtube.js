// /functions/youtube.js
// Same behavior as the API route: prefer YouTube Data API, fall back to RSS.

const FALLBACK_CHANNEL = "UC4GVzh8HVrrtYEkgVskWTsg";

async function fetchUploadsPlaylistId(channelId, apiKey) {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "contentDetails");
  url.searchParams.set("id", channelId);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("channels request failed");
  const data = await res.json();
  const uploads =
    data?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads || "";
  if (!uploads) throw new Error("no uploads playlist id");
  return uploads;
}

async function fetchPlaylistItems(playlistId, apiKey) {
  const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
  url.searchParams.set("part", "snippet,contentDetails");
  url.searchParams.set("playlistId", playlistId);
  url.searchParams.set("maxResults", "50");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("playlistItems request failed");
  const data = await res.json();
  const items = Array.isArray(data?.items) ? data.items : [];

  return items.map((item) => {
    const snippet = item.snippet || {};
    const details = item.contentDetails || {};
    const thumbs = snippet.thumbnails || {};
    const videoId =
      snippet.resourceId?.videoId || details.videoId || snippet.videoId || "";
    const url = videoId ? `https://www.youtube.com/watch?v=${videoId}` : "";
    const thumbnail =
      thumbs.maxres?.url ||
      thumbs.standard?.url ||
      thumbs.high?.url ||
      thumbs.medium?.url ||
      thumbs.default?.url ||
      null;
    return {
      source: "youtube",
      title: snippet.title || "Untitled",
      description: snippet.description || "",
      url,
      thumbnail,
      publishedAt: details.videoPublishedAt || snippet.publishedAt || "",
    };
  });
}

function parseRss(text) {
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
  return items;
}

export async function onRequest(context) {
  const channelId = context?.env?.YOUTUBE_CHANNEL_ID || FALLBACK_CHANNEL;
  const apiKey = context?.env?.YOUTUBE_API_KEY || "";
  const rssUrl = channelId
    ? `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    : "";

  if (!channelId || (!rssUrl && !apiKey)) {
    return new Response("[]", {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const cache = caches.default;
  const cacheKey = new Request(
    `https://feed.local/youtube?src=${encodeURIComponent(
      apiKey ? `api:${channelId}` : rssUrl
    )}`
  );
  const cached = await cache.match(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    let items = [];

    if (apiKey) {
      try {
        const playlistId = await fetchUploadsPlaylistId(channelId, apiKey);
        items = await fetchPlaylistItems(playlistId, apiKey);
      } catch (err) {
        // fall through to RSS
      }
    }

    if (!items.length && rssUrl) {
      const res = await fetch(rssUrl);
      if (res.ok) {
        const text = await res.text();
        items = parseRss(text);
      }
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
