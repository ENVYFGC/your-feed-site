// main.js
const FEED_LIST = document.getElementById("feed-list");
const FEED_LOADING = document.getElementById("feed-loading");
const FEED_ERROR = document.getElementById("feed-error");

// Set footer year
const yearEl = document.getElementById("year");
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

const PAGE_SIZE = 10;
const GAME_KEYWORDS = [
  {
    key: "ggst",
    label: "Guilty Gear -Strive-",
    match: ["ggst", "guilty gear"],
  },
  {
    key: "uni2",
    label: "Under Night In-Birth II",
    match: ["uni2", "uni 2", "under night"],
  },
];
const FALLBACK_GAME = { key: "other", label: "Other", match: [] };
let groupState = {};

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
  const youtubeEmbedUrl =
    item.source === "youtube" ? getYouTubeEmbedUrl(safeUrl) : "";
  const twitterEmbedUrl =
    item.source === "twitter" ? getTwitterEmbedUrl(safeUrl) : "";
  const showThumbnail = item.thumbnail && !youtubeEmbedUrl && !twitterEmbedUrl;

  // Thumbnail (skip if we have an embed to avoid duplicate visuals)
  if (showThumbnail) {
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
  if (youtubeEmbedUrl) {
    embed = document.createElement("div");
    embed.className = "feed-embed feed-embed--video";
    const iframe = document.createElement("iframe");
    iframe.src = youtubeEmbedUrl;
    iframe.title = item.title || "YouTube video";
    iframe.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    iframe.loading = "lazy";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    embed.appendChild(iframe);
  } else if (twitterEmbedUrl) {
    embed = document.createElement("div");
    embed.className = "feed-embed feed-embed--tweet";
    const iframe = document.createElement("iframe");
    iframe.src = twitterEmbedUrl;
    iframe.title = "Tweet embed";
    iframe.loading = "lazy";
    iframe.referrerPolicy = "no-referrer-when-downgrade";
    embed.appendChild(iframe);
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

  const shareBtn = document.createElement("button");
  shareBtn.type = "button";
  shareBtn.className = "button-ghost";
  shareBtn.textContent = "Share";
  shareBtn.addEventListener("click", async () => {
    if (safeUrl === "#") return;
    const payload = {
      title: item.title || "Check this out",
      text: item.description || item.title || "",
      url: safeUrl,
    };
    if (navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch {
        // fall through to clipboard
      }
    }
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(safeUrl);
        shareBtn.textContent = "Copied";
        setTimeout(() => {
          shareBtn.textContent = "Share";
        }, 1200);
        return;
      } catch {
        // ignore
      }
    }
  });

  actions.appendChild(link);
  actions.appendChild(shareBtn);

  content.appendChild(meta);
  content.appendChild(title);
  if (desc) content.appendChild(desc);
  if (embed) content.appendChild(embed);
  content.appendChild(actions);

  inner.appendChild(content);
  wrapper.appendChild(inner);

  return wrapper;
}

function detectGame(item) {
  const haystack = `${item.title || ""} ${item.description || ""}`.toLowerCase();
  for (const game of GAME_KEYWORDS) {
    if (game.match.some((m) => haystack.includes(m.toLowerCase()))) {
      return game.key;
    }
  }
  return FALLBACK_GAME.key;
}

function buildGroupState(items) {
  const base = {};
  [...GAME_KEYWORDS, FALLBACK_GAME].forEach((g) => {
    base[g.key] = { def: g, items: [], page: 0 };
  });

  items.forEach((item) => {
    const key = detectGame(item);
    if (!base[key]) {
      base[key] = { def: FALLBACK_GAME, items: [], page: 0 };
    }
    base[key].items.push(item);
  });

  return base;
}

function renderGroups() {
  FEED_LIST.innerHTML = "";

  const entries = Object.values(groupState).filter((g) => g.items.length);
  if (!entries.length) {
    FEED_ERROR.hidden = false;
    FEED_ERROR.textContent = "No posts yet — go upload something 🔥";
    return;
  }

  entries.forEach((group) => {
    const section = document.createElement("section");
    section.className = "feed-group";

    const header = document.createElement("div");
    header.className = "feed-group__header";

    const title = document.createElement("h3");
    title.className = "feed-group__title";
    title.textContent = group.def.label;

    const count = document.createElement("span");
    count.className = "feed-group__count";
    count.textContent = `${group.items.length} posts`;

    header.appendChild(title);
    header.appendChild(count);

    const controls = document.createElement("div");
    controls.className = "feed-group__controls";

    const pageCount = Math.max(1, Math.ceil(group.items.length / PAGE_SIZE));
    group.page = Math.min(group.page, pageCount - 1);
    const currentPage = group.page;

    const prev = document.createElement("button");
    prev.className = "button-ghost";
    prev.textContent = "Prev";
    prev.disabled = currentPage === 0;
    prev.addEventListener("click", () => {
      groupState[group.def.key].page = Math.max(0, currentPage - 1);
      renderGroups();
    });

    const next = document.createElement("button");
    next.className = "button-ghost";
    next.textContent = "Next";
    next.disabled = currentPage >= pageCount - 1;
    next.addEventListener("click", () => {
      groupState[group.def.key].page = Math.min(pageCount - 1, currentPage + 1);
      renderGroups();
    });

    const pageLabel = document.createElement("span");
    pageLabel.className = "feed-group__page";
    pageLabel.textContent = `Page ${currentPage + 1} / ${pageCount}`;

    controls.appendChild(prev);
    controls.appendChild(pageLabel);
    controls.appendChild(next);

    const list = document.createElement("div");
    list.className = "feed-group__list";

    const start = currentPage * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const slice = group.items.slice(start, end);
    slice.forEach((item) => list.appendChild(createFeedCard(item)));

    section.appendChild(header);
    section.appendChild(controls);
    section.appendChild(list);
    FEED_LIST.appendChild(section);
  });
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

    groupState = buildGroupState(combined);
    FEED_ERROR.hidden = true;
    renderGroups();
  } catch (err) {
    console.error(err);
    FEED_LOADING.hidden = true;
    FEED_ERROR.hidden = false;
  }
}

loadFeed();
