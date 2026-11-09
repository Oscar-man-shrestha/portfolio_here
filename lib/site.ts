// The site's public address, for absolute links (share cards, sitemap, search data). SITE_URL if set, else the
// Vercel production address, else the local server.
export const SITE_URL = (
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:4500")
).replace(/\/$/, "");

/** Oscar's GitHub account (the live data in lib/github, and the day panel under Contribution City). */
export const GITHUB_USER = "Oscar-man-shrestha";
