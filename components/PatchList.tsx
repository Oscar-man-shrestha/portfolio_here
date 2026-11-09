"use client";

// The live part of the open-source section: the pull requests and when GitHub was last checked. Starts from what the
// server rendered and switches to newer data from the minute-by-minute poll (lib/live), so a PR that gets merged
// shows up within about a minute, even on a page that's already open.
import type { PullRequest } from "@/lib/content";
import { newer, useLive } from "@/lib/live";
import { GITHUB_USER } from "@/lib/site";

export default function PatchList({ pullRequests: initial, fetchedAt }: { pullRequests: PullRequest[]; fetchedAt: string }) {
  const live = newer(useLive(), fetchedAt);
  const pullRequests = live?.pullRequests ?? initial;
  const synced = new Date(live?.fetchedAt ?? fetchedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return (
    <>
      <ol className="patches" key={pullRequests.map((p) => p.url + p.status.label).join("|")}>
        {pullRequests.map((pr, i) => (
          <li key={pr.url}>
            <a className="patch" href={pr.url} target="_blank" rel="noopener noreferrer">
              <span className="patch__idx hud">PR-{String(i + 1).padStart(2, "0")}</span>
              <span className="patch__repo mono">{pr.repo}<span className={`patch__status hud is-${pr.status.kind}`}>{pr.status.label}</span></span>
              <span className="patch__title">{pr.title}</span>
              <span className="patch__num mono">#{pr.number} <span aria-hidden="true">↗</span><span className="sr-only">(opens in a new tab)</span></span>
            </a>
          </li>
        ))}
      </ol>
      <p className="patches__sync hud">
        Live from <a href={`https://github.com/pulls?q=is%3Apr+author%3A${GITHUB_USER}`} target="_blank" rel="noopener noreferrer">GitHub</a> · checked {synced} UTC · updates every minute
      </p>
    </>
  );
}
