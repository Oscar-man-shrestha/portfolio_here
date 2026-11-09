// /api/day?date=YYYY-MM-DD: Oscar's public GitHub activity on one day (commits, and pull requests and issues he
// opened), for the day panel under Contribution City. Asked from this server, not the visitor's browser, because
// privacy blockers (Brave Shields, for one) stop pages from calling api.github.com, and GitHub allows a browser only a
// few searches a minute. Each day's answer is cached: a finished day never changes, so it's kept for a day; today and
// yesterday are kept for ten minutes. GITHUB_TOKEN, if set, raises GitHub's limit (see lib/github).
import { NextResponse } from "next/server";
import { GITHUB_USER } from "@/lib/site";

export type DayActivity = {
  date: string;
  commits: { repo: string; message: string; url: string }[];
  commitTotal: number;
  opened: { kind: "pr" | "issue"; repo: string; title: string; url: string }[];
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

async function search(path: string, revalidate: number) {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "oscar-portfolio" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/search/${path}`, { headers, next: { revalidate } });
  if (res.status === 403 || res.status === 429) throw Object.assign(new Error("rate limited"), { status: 429 });
  if (!res.ok) throw Object.assign(new Error(`GitHub ${res.status}`), { status: 502 });
  return res.json();
}

export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get("date") ?? "";
  if (!DAY.test(date) || Number.isNaN(Date.parse(date))) return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  // contributions are dated in UTC; a day that may still be changing is cached briefly
  const ageDays = (Date.now() - Date.parse(`${date}T00:00:00Z`)) / 864e5;
  const fresh = ageDays < 2;
  const revalidate = fresh ? 600 : 86400;
  try {
    const [c, i] = await Promise.all([
      search(`commits?q=${encodeURIComponent(`author:${GITHUB_USER} author-date:${date}`)}&sort=author-date&order=desc&per_page=8`, revalidate),
      search(`issues?q=${encodeURIComponent(`author:${GITHUB_USER} created:${date}`)}&per_page=8`, revalidate),
    ]);
    const body: DayActivity = {
      date,
      commits: (c.items as { html_url: string; repository: { full_name: string }; commit: { message: string } }[]).map((x) => ({
        repo: x.repository.full_name.split("/")[1], message: x.commit.message.split("\n")[0], url: x.html_url,
      })),
      commitTotal: c.total_count,
      opened: (i.items as { html_url: string; title: string; repository_url: string; pull_request?: unknown }[]).map((x) => ({
        kind: x.pull_request ? "pr" : "issue", repo: x.repository_url.split("/").pop()!, title: x.title, url: x.html_url,
      })),
    };
    return NextResponse.json(body, { headers: { "Cache-Control": `public, s-maxage=${revalidate}, stale-while-revalidate=86400` } });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 502;
    return NextResponse.json({ error: status === 429 ? "GitHub is busy; try again in a minute." : "Couldn't reach GitHub." }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
