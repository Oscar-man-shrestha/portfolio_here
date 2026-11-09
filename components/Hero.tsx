import { images, person, projects } from "@/lib/content";
import { Barcode, Emblem, JumpArrow, TextRing } from "./bits";
import HeroGLMount from "./gl/HeroGLMount";

const tickerFor = (prs: number) => [
  ...person.disciplines,
  person.base,
  "Portfolio 2026",
  `Selected work · ${String(projects.length).padStart(2, "0")}`,
  `Open source · ${String(prs).padStart(2, "0")} pull requests`,
];

function Oscar() {
  return <>Osc<span className="red">a</span>r</>;
}

export default function Hero({ prCount }: { prCount: number }) {
  const ticker = tickerFor(prCount);
  return (
    <section className="hero" id="top" aria-labelledby="heroTitle">
      <div className="hero__glow" aria-hidden="true" />
      {/* the red sun of the Soka reference, behind the name and the portrait */}
      <div className="hero__sun" aria-hidden="true" />

      <h1 className="hero__title" id="heroTitle" tabIndex={-1}>
        <span className="sr-only">{person.name}</span>
        <span className="hero__first" aria-hidden="true"><span className="hero__word"><Oscar /></span></span>
        <span className="hero__last" aria-hidden="true">
          <span className="ln"><span>Man</span></span> <span className="ln"><span className="dim">Shrestha</span></span>
        </span>
      </h1>

      {/* Plain <img> on purpose: the files are already optimised WebP, and on a cold server the image optimiser's
          on-demand encodes competed with the intro film for connections. */}
      {/* frame 0 of the head turn (the photo itself); WebGL takes over from it and scrubs the turn with scroll */}
      <div className="hero__portrait" id="heroPortrait" style={{ aspectRatio: `${images.hero.w} / ${images.hero.h}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images.hero.src} alt={images.hero.alt} width={images.hero.w} height={images.hero.h} decoding="async" fetchPriority="low" draggable={false} />
      </div>
      {/* WebGL covers the whole hero so the petals can fall across all of it */}
      <div className="hero__gl" aria-hidden="true"><HeroGLMount /></div>
      {/* Oscar Man Shrestha in katakana, as vertical neon signage */}
      <p className="hero__kana" aria-hidden="true" lang="ja">オスカー・マン・シュレスタ</p>
      <span className="hero__seal" aria-hidden="true" lang="ja">桜</span>

      <p className="hero__outline" aria-hidden="true"><span className="hero__word"><Oscar /></span></p>

      <div className="hero__lines" aria-hidden="true">
        <i className="v v1" /><i className="v v2" />
        <i className="h h1" /><i className="h h2" /><i className="h h3" />
        <i className="tick t1" /><i className="tick t2" /><i className="tick t3" /><i className="tick t4" />
      </div>

      <a className="panel panel--unit hud" href="#profile">
        <span className="panel__lbl" aria-hidden="true"><span>Unit <b>01</b></span><span>View 01/04</span></span>
        <span className="unit__img">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images.turnaround[0].src} alt="" width={images.turnW} height={images.turnH} decoding="async" fetchPriority="low" />
          <span className="scan" />
        </span>
        <span className="panel__lbl"><span>Model turnaround</span><b aria-hidden="true">↘</b><span className="sr-only"> — open profile</span></span>
      </a>

      <div className="panel panel--class hud">
        <span className="emblem"><Emblem /><b>OMS</b></span>
        <p><strong>Class //</strong> {person.role}</p>
        <p><strong>Base //</strong> {person.base}</p>
      </div>

      <a className="panel panel--badge hud" href="#profile">
        <span className="sr-only">Open profile: </span>
        <span className="badge__ring">
          <TextRing text="Player 01 · Oscar Man Shrestha · Player 01 · Oscar Man Shrestha · " />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images.avatar.src} alt="" width={images.avatar.w} height={images.avatar.h} decoding="async" fetchPriority="low" />
          <span className="arrow" aria-hidden="true">↘</span>
        </span>
        <span className="who"><b>Player 01</b>Profile, stack and side quests</span>
      </a>

      <a className="panel panel--jump hud" href="#work">
        <span className="lbl"><b>Selected work</b><span>{String(projects.length).padStart(2, "0")} projects</span></span>
        <JumpArrow />
      </a>

      <p className="hero__role hud">{person.role} — {person.disciplines.join(" / ")}</p>
      <div className="hero__ctas">
        <a className="btn btn--signal magnetic" href="#work"><span>View work</span><b aria-hidden="true">↘</b></a>
        <a className="btn magnetic" href="#contact"><span>Get in touch</span></a>
      </div>
      {/* its own line, so the two calls to action keep their room next to the tagline */}
      <button type="button" className="hero__tour hud" data-tour-start><i aria-hidden="true">▶</i> 60-second tour</button>

      <div className="hero__bar hud" aria-hidden="true">
        <div className="prog">
          <span>Scroll</span>
          <span className="prog__cells" id="scrollCells">{Array.from({ length: 12 }, (_, i) => <i key={i} />)}</span>
        </div>
        <div className="ticker">
          <div className="ticker__track" id="ticker">
            {[0, 1].map((k) => (
              <div key={k} style={{ display: "flex" }}>
                {ticker.map((t) => <span key={t}>{t}</span>)}
              </div>
            ))}
          </div>
        </div>
        <div className="code">
          <Barcode />
          <b>01<small>/05</small></b>
        </div>
      </div>
    </section>
  );
}
