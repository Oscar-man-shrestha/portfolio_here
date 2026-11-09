import { images, links, person } from "@/lib/content";

export default function Contact() {
  const shown = links.filter((l) => l.url);
  return (
    <section className="sec contact" id="contact" aria-labelledby="contactTitle">
      <div className="contact__top">
        <p className="hud" style={{ margin: 0 }}><span className="sq red" />05 // 連絡 // <span className="tag-red">Player two?</span></p>
        <p className="hud dim" style={{ margin: 0 }}>Press <kbd className="mono">E</kbd> to email</p>
      </div>
      <h2 className="contact__title" id="contactTitle">
        {/* data-text feeds the outline "ghost" drawn by CSS, so the words exist once in the text */}
        <span className="w" data-text="Press">Press</span><br /><span className="w red" data-text="start.">start.</span>
      </h2>
      <p className="contact__lede">Got a project, a role or a stubborn bug? Send it my way.</p>
      <a className="contact__mail" href={`mailto:${person.email}`} data-key="E">
        {person.email} <kbd aria-hidden="true">E</kbd>
      </a>
      <ul className="contact__links">
        {shown.map((l) => (
          <li key={l.label}>
            <a href={l.url!} target="_blank" rel="noopener noreferrer me" data-key={l.key} data-status={l.status}>
              <span className="nm">{l.label} <span aria-hidden="true">↗</span><span className="sr-only">(opens in a new tab)</span></span>
              {l.key && <kbd aria-hidden="true">{l.key}</kbd>}
            </a>
          </li>
        ))}
      </ul>
      <div className="contact__flood" aria-hidden="true" data-text="連絡" lang="ja" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="contact__fig" src={images.full.src} alt="" width={images.full.w} height={images.full.h} loading="lazy" decoding="async" aria-hidden="true" />
      <footer className="ftr hud">
        <span>© 2026 {person.name}</span>
        <span style={{ display: "flex", gap: 22 }}>
          <button type="button" id="replayIntro">Replay intro</button>
          <a href="#top">Escape ↑</a>
        </span>
      </footer>
    </section>
  );
}
