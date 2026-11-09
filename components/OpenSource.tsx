import { stack, type PullRequest } from "@/lib/content";
import PatchList from "./PatchList";

export default function OpenSource({ pullRequests, fetchedAt }: { pullRequests: PullRequest[]; fetchedAt: string }) {
  return (
    <section className="sec sec--paper oss" id="oss" aria-labelledby="ossTitle">
      <header className="sec__head">
        <p className="sec__kicker hud"><span className="sq" />03 // 公開 // Patch log</p>
        <h2 className="sec__title split" data-echo="Open source" id="ossTitle">Open source</h2>
        <p className="sec__lede">My code in libraries other developers rely on: merged, or lined up by the maintainers to ship.</p>
      </header>
      <PatchList pullRequests={pullRequests} fetchedAt={fetchedAt} />
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
