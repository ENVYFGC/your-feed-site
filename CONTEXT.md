## Project context (Dec 5, 2025)

- Custom domain live: https://envy.xx.kg on Cloudflare Pages.
- Branding: header shows ENVY, avatar https://i.imgur.com/1vwqgsW.png, footer text removed, share buttons on feed cards.
- Frontend: groups posts by keywords (GGST, UNI2, Other), 15 items/page, inline embeds (YouTube, Twitter) with URL sanitization. Pagination shows page label; Prev/Next only when >1 page.
- YouTube: Functions use YouTube Data API when `YOUTUBE_API_KEY` is set, fallback to RSS. Env var `YOUTUBE_CHANNEL_ID` defaults to UC4GVzh8HVrrtYEkgVskWTsg. PAGE_SIZE = 15.
- Twitter: Reverted to simple Nitter JSON/RSS handler (v2). Hosts: privacyredirect, nitter.net, nitter.fly.dev. Parses items, canonicalizes URLs to x.com, caches results. Returns [] if mirrors fail. Env vars: `TWITTER_HANDLE` (envy_fgc), optional `NITTER_HOSTS`.
- Pending issue: Twitter feed may still be empty if all Nitter mirrors fail; no JS-only non-Nitter source in place.
