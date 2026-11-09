import { projects } from "@/lib/content";
import { liveTags, type GitHubData } from "@/lib/github";
import MissionArt from "./MissionArt";

export default function Work({ releases }: { releases: GitHubData["releases"] }) {
  const n = String(projects.length).padStart(2, "0");
  return (
    <section className="sec sec--paper work" id="work" aria-labelledby="workTitle">
      <header className="sec__head">
        <p className="sec__kicker hud"><span className="sq" />01 // 任務 // Mission select</p>
        <h2 className="sec__title split" data-echo="Selected work" id="workTitle">Selected work</h2>
        <p className="sec__lede">{["Zero", "One", "Two", "Three", "Four", "Five", "Six"][projects.length] ?? projects.length} builds, each aimed at a real problem. Turn the wheel, open a mission for its live demo, or go straight to the source.</p>
      </header>
      <div className="work__pin">
        <ol className="work__track" id="workTrack">
          {projects.map((project, i) => {
            const p = { ...project, tags: liveTags(project, releases) };
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
                    {p.film && (
                      <video className="mission__film" src={p.film.video} poster={p.film.poster} muted playsInline preload="none" tabIndex={-1} style={p.film.focus ? { objectPosition: p.film.focus } : undefined} />
                    )}
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
            <div className="work__endcard">
              <p className="hud dim">End of list</p>
              <p className="big">More on<br />GitHub</p>
            </div>
          </li>
        </ol>
        {/* wide screens: the cards sit on a wheel that turns as you scroll, and this dial is its hub */}
        <div className="work__dial" aria-hidden="true">
          <svg className="work__ring" viewBox="-100 -100 200 200">
            <circle r="98" />
            <circle r="86" className="thin" />
            {Array.from({ length: 72 }, (_, i) => (
              <line key={i} x1="0" y1={i % 6 === 0 ? -98 : -95} x2="0" y2="-90" className={i % 6 === 0 ? "major" : undefined} transform={`rotate(${i * 5})`} />
            ))}
          </svg>
          <span className="work__dialtag hud">任務 // Mission</span>
          <span className="work__dialnum" id="workDialNum">01</span>
        </div>
        <div className="work__progress hud" aria-hidden="true">
          <span className="work__hint">Scroll to turn · click a card</span>
          <span id="workCount">01/{n}</span>
          <span className="bar"><i id="workBar" /></span>
        </div>
      </div>
    </section>
  );
}
