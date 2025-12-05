// main.js
const FEED_LIST = document.getElementById("feed-list");
const FEED_LOADING = document.getElementById("feed-loading");
const FEED_ERROR = document.getElementById("feed-error");

// Set footer year
document.getElementById("year").textContent = new Date().getFullYear();

function sanitizeExternalUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url) ? url : "#";
}

function getYouTubeEmbedUrl(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return "";

    let id = "";
    const host = u.hostname.toLowerCase();
    const path = u.pathname;

    if (host.includes("youtu.be")) {
      id = path.slice(1);
    } else if (host.includes("youtube.com")) {
      if (path.startsWith("/shorts/") || path.startsWith("/embed/")) {
        id = path.split("/")[2] || "";
      } else {
        id = new URLSearchParams(u.search).get("v") || "";
      }
    }

    return id ? `https://www.youtube.com/embed/${id}` : "";
  } catch {
    return "";
  }
}

function getTwitterEmbedUrl(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return "";
    u.protocol = "https:";
    if (u.hostname.includes("nitter")) {
      u.hostname = "x.com";
    }
    const host = u.hostname.toLowerCase();
    if (!host.endsWith("twitter.com") && !host.endsWith("x.com")) return "";
    return `https://twitframe.com/show?url=${encodeURIComponent(u.href)}`;
  } catch {
    return "";
  }
}

/**
 * Fetch JSON helper
 */
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Render a single item card
 * Item shape:
 *  {
 *    source: "youtube" | "twitter",
 *    title: string,
 *    description?: string,
 *    url: string,
 *    thumbnail?: string,
 *    publishedAt: string
 *  }
 */
function createFeedCard(item) {
  const wrapper = document.createElement("article");
  wrapper.className = "feed-card";

  const inner = document.createElement("div");
  inner.className = "feed-card-inner";

  const safeUrl = sanitizeExternalUrl(item.url);

  // Thumbnail
  if (item.thumbnail) {
    const thumb = document.createElement("div");
    thumb.className = "feed-thumbnail";

    const img = document.createElement("img");
    img.src = item.thumbnail;
    img.alt = item.title || "";

    const badge = document.createElement("div");
    badge.className = "feed-badge";

    const iconSpan = document.createElement("span");
    iconSpan.className = "icon";
    iconSpan.textContent = item.source === "youtube" ? "▶︎" : "✕";

    const labelSpan = document.createElement("span");
    labelSpan.textContent = item.source === "youtube" ? "YouTube" : "X / Twitter";

    badge.appendChild(iconSpan);
    badge.appendChild(labelSpan);

    thumb.appendChild(img);
    thumb.appendChild(badge);
    inner.appendChild(thumb);
  }

  // Content
  const content = document.createElement("div");
  content.className = "feed-content";

  // Top meta row
  const meta = document.createElement("div");
  meta.className = "feed-meta";

  const sourceSpan = document.createElement("span");
  sourceSpan.textContent =
    item.source === "youtube" ? "YouTube video" : "X / Twitter post";

  const dateSpan = document.createElement("span");
  dateSpan.textContent = formatDate(item.publishedAt);

  meta.appendChild(sourceSpan);
  meta.appendChild(dateSpan);

  // Title
  const title = document.createElement("h2");
  title.className = "feed-title";
  title.textContent = item.title || "(Untitled)";

  // Description
  let desc;
  if (item.description) {
    desc = document.createElement("p");
    desc.className = "feed-description";
    desc.textContent = item.description;
  }

  // Embed (best-effort)
  let embed;
  if (item.source === "youtube") {
    const embedUrl = getYouTubeEmbedUrl(safeUrl);
    if (embedUrl) {
      embed = document.createElement("div");
      embed.className = "feed-embed feed-embed--video";
      const iframe = document.createElement("iframe");
      iframe.src = embedUrl;
      iframe.title = item.title || "YouTube video";
      iframe.allow =
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      iframe.allowFullscreen = true;
      iframe.loading = "lazy";
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      embed.appendChild(iframe);
    }
  } else if (item.source === "twitter") {
    const embedUrl = getTwitterEmbedUrl(safeUrl);
    if (embedUrl) {
      embed = document.createElement("div");
      embed.className = "feed-embed feed-embed--tweet";
      const iframe = document.createElement("iframe");
      iframe.src = embedUrl;
      iframe.title = "Tweet embed";
      iframe.loading = "lazy";
      iframe.referrerPolicy = "no-referrer-when-downgrade";
      embed.appendChild(iframe);
    }
  }

  // Actions
  const actions = document.createElement("div");
  actions.className = "feed-actions";

  const link = document.createElement("a");
  link.href = safeUrl;
  link.target = "_blank";
  link.rel = "noopener";
  link.className = "button-ghost";
  link.innerHTML =
    item.source === "youtube"
      ? '<span>Watch on YouTube</span> <span>↗</span>'
      : '<span>View on X</span> <span>↗</span>';

  actions.appendChild(link);

  content.appendChild(meta);
  content.appendChild(title);
  if (desc) content.appendChild(desc);
  if (embed) content.appendChild(embed);
  content.appendChild(actions);

  inner.appendChild(content);
  wrapper.appendChild(inner);

  return wrapper;
}

async function loadFeed() {
  try {
    const [yt, tw] = await Promise.all([
      fetchJSON("/api/youtube"),
      fetchJSON("/api/twitter"),
    ]);

    const ytItems = Array.isArray(yt) ? yt : [];
    const twItems = Array.isArray(tw) ? tw : [];

    const combined = [...ytItems, ...twItems].sort(
      (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)
    );

    FEED_LOADING.hidden = true;

    if (!combined.length) {
      FEED_ERROR.hidden = false;
      FEED_ERROR.textContent = "No posts yet — go upload something 🔥";
      return;
    }

    combined.forEach((item) => {
      FEED_LIST.appendChild(createFeedCard(item));
    });
  } catch (err) {
    console.error(err);
    FEED_LOADING.hidden = true;
    FEED_ERROR.hidden = false;
  }
}

loadFeed();
