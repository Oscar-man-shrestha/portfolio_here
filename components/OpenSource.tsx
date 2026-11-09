import { stack, type PullRequest } from "@/lib/content";
import { GITHUB_USER } from "@/lib/github";

export default function OpenSource({ pullRequests, fetchedAt }: { pullRequests: PullRequest[]; fetchedAt: string }) {
  const synced = new Date(fetchedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return (
    <section className="sec sec--paper oss" id="oss" aria-labelledby="ossTitle">
      <header className="sec__head">
        <p className="sec__kicker hud"><span className="sq" />03 // 公開 // Patch log</p>
        <h2 className="sec__title split" data-echo="Open source" id="ossTitle">Open source</h2>
        <p className="sec__lede">My code in libraries other developers rely on: merged, or lined up by the maintainers to ship.</p>
      </header>
      <ol className="patches">
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
        Live from <a href={`https://github.com/pulls?q=is%3Apr+author%3A${GITHUB_USER}`} target="_blank" rel="noopener noreferrer">GitHub</a> · checked {synced} UTC · refreshed every hour
      </p>
      <div className="loadout">
        <p className="hud">Loadout // Stack</p>
        <div className="slots">
          {stack.map((s, i) => (
            <div className="slot" key={s.slot}>
              <span className="slot__n hud">Slot {String(i + 1).padStart(2, "0")}<i aria-hidden="true" /></span>
              <h3>{s.slot}</h3>
              <ul>{s.items.map((it) => <li key={it}>{it}</li>)}</ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
