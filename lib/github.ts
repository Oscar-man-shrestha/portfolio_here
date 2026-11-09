// Live GitHub data: everything the site shows from GitHub comes from here, fetched on the server and refreshed every
// hour (the pages using it set `revalidate`), so new contributions, merged pull requests and releases appear on
// their own. No key is needed: the contribution calendar is GitHub's public profile calendar, and the pull requests
// and releases come from GitHub's public API. A GITHUB_TOKEN environment variable (a token with no scopes at all is
// enough) is used if present, only to raise GitHub's rate limit.
//
// If GitHub can't be reached while the site is running, the error keeps the last good page (Next.js only swaps in
// a new version of a page once it has rendered). During a build with no network, the snapshot in data/ is used.
import { cache } from "react";
import snapshotDays from "@/data/contrib.json";
import { prSnapshot, prTitles, projects, type PullRequest } from "./content";
import type { Day } from "./contrib";

export const GITHUB_USER = "Oscar-man-shrestha";
/** How often the pages re-read GitHub, in seconds (each page exports the same number as `revalidate`). */
export const REFRESH = 3600;

/** A pull request counts as lined up when the maintainers label it like this (or put it in a milestone). */
const PLANNED_LABEL = /\b(plan(ned)? to merge|ready (to|for) merge|merge[- ]ready|will merge|approved for merge)\b/i;

const building = () => process.env.NEXT_PHASE === "phase-production-build";

async function get(url: string, accept: string) {
  const headers: Record<string, string> = { Accept: accept, "User-Agent": "oscar-portfolio" };
  if (process.env.GITHUB_TOKEN && url.startsWith("https://api.github.com/")) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers, next: { revalidate: REFRESH } });
  if (!res.ok) throw new Error(`GitHub ${res.status} for ${url}`);
  return res;
}

/** Live value, or (only while building without GitHub) the snapshot; at run time the error keeps the last good page. */
async function live<T>(what: string, load: () => Promise<T>, snapshot: () => T): Promise<{ value: T; live: boolean }> {
  try {
    return { value: await load(), live: true };
  } catch (err) {
    if (!building()) throw err;
    console.warn(`github: ${what} unavailable while building, using the snapshot:`, (err as Error).message);
    return { value: snapshot(), live: false };
  }
}

// ---------------- the contribution calendar ----------------
async function loadDays(): Promise<Day[]> {
  const html = await (await get(`https://github.com/users/${GITHUB_USER}/contributions`, "text/html")).text();
  const dateById = new Map<string, string>();
  for (const m of html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})"\s+id="([^"]+)"/g)) dateById.set(m[2], m[1]);
  const days: Day[] = [];
  for (const m of html.matchAll(/<tool-tip[^>]*\bfor="([^"]+)"[^>]*>\s*(No|\d[\d,]*) contributions?\b/g)) {
    const date = dateById.get(m[1]);
    if (date) days.push({ date, count: m[2] === "No" ? 0 : Number(m[2].replace(/,/g, "")) });
  }
  if (days.length < 300) throw new Error(`calendar: only ${days.length} days found (GitHub changed the page?)`);
  return days.sort((a, b) => a.date.localeCompare(b.date));
}
const snapDays = (): Day[] => (snapshotDays as [string, number][][]).flat().map(([date, count]) => ({ date, count }));

// ---------------- pull requests to other people's projects ----------------
type SearchItem = {
  html_url: string; number: number; title: string; state: string; repository_url: string; updated_at: string;
  labels: { name: string }[]; milestone: { title: string } | null; pull_request?: { merged_at: string | null };
};
const shortTitle = (t: string) => {
  const s = t
    .replace(/^(fix|feat|docs|chore|refactor|perf|test|build|ci|style)(\([^)]*\))?!?:\s*/i, "")
    .replace(/^(BUG|ENH|DOC|TST|BLD|MAINT|PERF|API|CLN|DEPR|TYP|REF|FIX|ENHANCEMENT)\s*:\s*/, "")
    .trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

async function loadPullRequests(): Promise<PullRequest[]> {
  const q = encodeURIComponent(`is:pr author:${GITHUB_USER} -user:${GITHUB_USER}`);
  const { items } = (await (await get(`https://api.github.com/search/issues?q=${q}&per_page=100&sort=updated`, "application/vnd.github+json")).json()) as { items: SearchItem[] };
  const out: (PullRequest & { at: string })[] = [];
  for (const it of items) {
    const repo = it.repository_url.split("/repos/")[1];
    const title = prTitles[`${repo}#${it.number}`] ?? shortTitle(it.title);
    const base = { repo, title, number: it.number, url: it.html_url };
    const merged = it.pull_request?.merged_at;
    if (merged) {
      out.push({ ...base, at: merged, status: { kind: "merged", label: "Merged", detail: "merged" } });
      continue;
    }
    if (it.state !== "open") continue; // closed without merging
    const label = it.labels.find((l) => PLANNED_LABEL.test(l.name))?.name;
    if (label) {
      out.push({ ...base, at: it.updated_at, status: { kind: "planned", label: label.charAt(0).toUpperCase() + label.slice(1), detail: `open, labelled "${label}" by the maintainers` } });
    } else if (it.milestone) {
      out.push({ ...base, at: it.updated_at, status: { kind: "planned", label: `${it.milestone.title} milestone`, detail: `open, on the maintainers' ${it.milestone.title} milestone` } });
    }
  }
  // merged first (newest first), then the ones lined up
  out.sort((a, b) => (a.status.kind === b.status.kind ? b.at.localeCompare(a.at) : a.status.kind === "merged" ? -1 : 1));
  return out.map(({ at: _at, ...pr }) => pr);
}

// ---------------- releases of Oscar's own projects ----------------
export type Release = { tag: string; license: string | null };
async function loadRelease(repo: string): Promise<Release | null> {
  const [releases, info] = await Promise.all([
    get(`https://api.github.com/repos/${repo}/releases?per_page=1`, "application/vnd.github+json").then((r) => r.json() as Promise<{ tag_name: string }[]>),
    get(`https://api.github.com/repos/${repo}`, "application/vnd.github+json").then((r) => r.json() as Promise<{ license: { spdx_id: string } | null }>),
  ]);
  if (!releases.length) return null;
  const spdx = info.license?.spdx_id;
  return { tag: releases[0].tag_name, license: spdx && spdx !== "NOASSERTION" ? spdx : null };
}

export type GitHubData = {
  days: Day[];
  pullRequests: PullRequest[];
  /** Latest release per repository ("owner/name"), for the projects that publish releases. */
  releases: Record<string, Release | null>;
  fetchedAt: string;
  live: boolean;
};

/** Oscar's projects that show a version tag ("v1.1.0 · MIT"): their latest GitHub release replaces it. */
const VERSIONED = projects.filter((p) => p.tags.some((t) => /^v\d/.test(t))).map((p) => p.url.replace("https://github.com/", ""));

/** A project's tags with the version tag taken from its latest GitHub release. */
export function liveTags(p: { url: string; tags: string[] }, releases: GitHubData["releases"]): string[] {
  const r = releases[p.url.replace("https://github.com/", "")];
  return r ? p.tags.map((t) => (/^v\d/.test(t) ? [r.tag, r.license].filter(Boolean).join(" · ") : t)) : p.tags;
}

/** Everything at once; cached for one render, so every component on a page sees the same numbers. */
export const getGitHub = cache(async (): Promise<GitHubData> => {
  const releaseRepos = VERSIONED;
  const [days, prs, ...rel] = await Promise.all([
    live("contribution calendar", loadDays, snapDays),
    live("pull requests", loadPullRequests, () => prSnapshot),
    ...releaseRepos.map((r) => live(`releases of ${r}`, () => loadRelease(r), () => null)),
  ]);
  return {
    days: days.value,
    pullRequests: prs.value,
    releases: Object.fromEntries(releaseRepos.map((r, i) => [r, rel[i].value])),
    fetchedAt: new Date().toISOString(),
    live: days.live && prs.live,
  };
});
