// main.js
const FEED_LIST = document.getElementById("feed-list");
const FEED_LOADING = document.getElementById("feed-loading");
const FEED_ERROR = document.getElementById("feed-error");

// Set footer year
document.getElementById("year").textContent = new Date().getFullYear();

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

  // Actions
  const actions = document.createElement("div");
  actions.className = "feed-actions";

  const link = document.createElement("a");
  link.href = item.url;
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

    // Expect arrays from both endpoints
    const combined = [...yt, ...tw].sort(
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
