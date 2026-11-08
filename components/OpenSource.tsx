import { pullRequests, stack } from "@/lib/content";

export default function OpenSource() {
  return (
    <section className="sec sec--paper oss" id="oss" aria-labelledby="ossTitle">
      <header className="sec__head">
        <p className="sec__kicker hud"><span className="sq" />03 // Patch log</p>
        <h2 className="sec__title split" id="ossTitle">Open source</h2>
        <p className="sec__lede">Pull requests to libraries the data and ML community relies on.</p>
      </header>
      <ol className="patches">
        {pullRequests.map((pr, i) => (
          <li key={pr.url}>
            <a className="patch" href={pr.url} target="_blank" rel="noopener noreferrer">
              <span className="patch__idx hud">PR-{String(i + 1).padStart(2, "0")}</span>
              <span className="patch__repo mono">{pr.repo}</span>
              <span className="patch__title">{pr.title}</span>
              <span className="patch__num mono">#{pr.number} <span aria-hidden="true">↗</span><span className="sr-only">(opens in a new tab)</span></span>
            </a>
          </li>
        ))}
      </ol>
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
