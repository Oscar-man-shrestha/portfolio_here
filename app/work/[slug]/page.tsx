import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import MissionArt from "@/components/MissionArt";
import ProjectFX from "@/components/ProjectFX";
import Demo from "@/components/demos/Demo";
import { person, projects } from "@/lib/content";
import { getGitHub, liveTags } from "@/lib/github";

// the version tag comes from the project's latest GitHub release (lib/github), re-read every hour
export const revalidate = 3600;

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = projects.find((x) => x.id === slug);
  return p ? { title: `${p.title} · ${person.name}`, description: p.page.tagline } : {};
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const i = projects.findIndex((x) => x.id === slug);
  if (i < 0) notFound();
  const p = { ...projects[i], tags: liveTags(projects[i], (await getGitHub()).releases) };
  const next = projects[(i + 1) % projects.length];
  const num = String(i + 1).padStart(2, "0");
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Header base="/" />
      <main id="main" className="pj">
        <section className="pj__hero">
          <div className="pj__top hud">
            <a className="pj__back" href="/#work">◂ All missions</a>
            <span className="dim">Mission <b className="red">{num}</b>/{String(projects.length).padStart(2, "0")} // {p.tags[0]}</span>
          </div>
          <div className="pj__head">
            <h1 className="pj__title" data-echo={p.title}>{p.title}</h1>
            <p className="pj__tag">{p.page.tagline}</p>
            <div className="pj__links">
              <a className="btn btn--signal" href={p.url} target="_blank" rel="noopener noreferrer"><span>Source on GitHub</span><b aria-hidden="true">↗</b><span className="sr-only">(opens in a new tab)</span></a>
              {p.page.extraLinks?.map((l) => (
                <a key={l.url} className="btn" href={l.url} target="_blank" rel="noopener noreferrer"><span>{l.label}</span><b aria-hidden="true">↗</b><span className="sr-only">(opens in a new tab)</span></a>
              ))}
            </div>
          </div>
          <div className="pj__art" aria-hidden="true">
            <MissionArt visual={p.visual} />
            <span className="pj__num">{num}</span>
          </div>
        </section>

        {p.film && (
          // the poster sits behind the video: it is what shows before the film plays, with reduced motion, or without JS
          <section className="pj__film" aria-hidden="true" style={{ backgroundImage: `url(${p.film.poster})` }}>
            <video src={p.film.video} muted playsInline preload="metadata" />
            <p className="pj__filmlabel hud"><span className="sq" />Mission film // made with Google Flow</p>
          </section>
        )}

        <section className="pj__demo" aria-labelledby="demoTitle">
          <header className="pj__demohead">
            <p className="hud red"><span className="sq" />Try it // Interactive demo</p>
            <h2 id="demoTitle" className="pj__h2">See how it works</h2>
          </header>
          <Demo id={p.id} />
        </section>

        <section className="pj__info">
          <div className="pj__block" data-reveal>
            <p className="hud red">The problem</p>
            <p className="pj__lede">{p.page.problem}</p>
          </div>
          <div className="pj__block" data-reveal>
            <p className="hud red">How it works</p>
            <ol className="pj__steps">
              {p.page.how.map((s, k) => <li key={k}><span className="pj__stepn">{String(k + 1).padStart(2, "0")}</span><span>{s}</span></li>)}
            </ol>
          </div>
          <div className="pj__block" data-reveal>
            <p className="hud red">Facts from the repository</p>
            <dl className="pj__facts">
              {p.page.facts.map((f) => <div key={f.k}><dt className="hud">{f.k}</dt><dd>{f.v}</dd></div>)}
            </dl>
            {p.page.caveat && <p className="pj__caveat">{p.page.caveat}</p>}
          </div>
          <div className="pj__block" data-reveal>
            <p className="hud red">Stack</p>
            <ul className="pj__stack">{p.page.stack.map((s) => <li key={s}>{s}</li>)}</ul>
          </div>
        </section>

        <nav className="pj__next" aria-label="Next project">
          <a href={`/work/${next.id}`}>
            <span className="hud dim">Next mission</span>
            <span className="pj__nexttitle">{next.title} <span aria-hidden="true">↘</span></span>
          </a>
        </nav>
        <footer className="ftr hud pj__ftr">
          <span>© 2026 {person.name}</span>
          <a href="/#contact">Contact ↘</a>
        </footer>
      </main>
      <div className="grain" aria-hidden="true" />
      <ProjectFX />
    </>
  );
}
