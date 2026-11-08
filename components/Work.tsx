import { projects } from "@/lib/content";
import MissionArt from "./MissionArt";

export default function Work() {
  const n = String(projects.length).padStart(2, "0");
  return (
    <section className="sec sec--paper work" id="work" aria-labelledby="workTitle">
      <header className="sec__head">
        <p className="sec__kicker hud"><span className="sq" />01 // Mission select</p>
        <h2 className="sec__title split" data-echo="Selected work" id="workTitle">Selected work</h2>
        <p className="sec__lede">Selected projects. Open any of them for a short interactive demo, or go straight to the source.</p>
      </header>
      <div className="work__pin">
        <ol className="work__track" id="workTrack">
          {projects.map((p, i) => {
            const num = String(i + 1).padStart(2, "0");
            return (
              <li className="mission" key={p.id} data-visual={p.visual}>
                <article className="mission__card" aria-labelledby={`m-${p.id}`}>
                  <div className="mission__top hud">
                    <span className="tab">Mission <b>{num}</b>/{n}</span>
                    <span className="meta">{p.tags[0]}</span>
                  </div>
                  <div className="mission__art" aria-hidden="true">
                    <MissionArt visual={p.visual} />
                    <span className="mission__num">{num}</span>
                  </div>
                  <div className="mission__body">
                    <h3 className="mission__title" id={`m-${p.id}`}>{p.title}</h3>
                    <p className="mission__desc">{p.description}</p>
                    {p.stats && (
                      <ul className="mission__stats">
                        {p.stats.map((s) => <li key={s.label}><b>{s.value}</b><span>{s.label}</span></li>)}
                      </ul>
                    )}
                    {/* facts only: the repository path comes from the project URL, the focus from its tags */}
                    <dl className="mission__spec hud">
                      <dt>Repository</dt><dd className="mono">{p.url.replace("https://github.com/", "")}</dd>
                      <dt>Focus</dt><dd>{p.tags.filter((t) => !/^v\d/.test(t)).join(" · ")}</dd>
                    </dl>
                  </div>
                  <div className="mission__foot">
                    <ul className="mission__tags hud">
                      {p.tags.map((t) => <li key={t}>{t}</li>)}
                    </ul>
                    <span className="mission__links">
                      {/* the whole card opens the project's demo page; Source stays a separate link above it */}
                      <a className="mission__cta hud" href={`/work/${p.id}`}>
                        Open demo<span className="sr-only">: {p.title}</span> <span aria-hidden="true">↘</span>
                      </a>
                      <a className="mission__src hud" href={p.url} target="_blank" rel="noopener noreferrer">
                        Source<span className="sr-only">: {p.title} on GitHub (opens in a new tab)</span> <span aria-hidden="true">↗</span>
                      </a>
                    </span>
                  </div>
                </article>
              </li>
            );
          })}
          <li className="work__end" aria-hidden="true">
            <p className="hud dim">End of list</p>
            <p className="big">More on<br />GitHub</p>
            <div className="work__progress hud"><span id="workCount">01/{n}</span><span className="bar"><i id="workBar" /></span></div>
          </li>
        </ol>
      </div>
    </section>
  );
}
