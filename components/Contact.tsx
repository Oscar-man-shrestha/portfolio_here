import { images, links, person } from "@/lib/content";

export default function Contact() {
  const shown = links.filter((l) => l.url);
  return (
    <section className="sec contact" id="contact" aria-labelledby="contactTitle">
      <div className="contact__top">
        <p className="hud" style={{ margin: 0 }}><span className="sq red" />05 // <span className="tag-red">Ready?</span></p>
        <p className="hud dim" style={{ margin: 0 }}>Press <kbd className="mono">E</kbd> to email</p>
      </div>
      <h2 className="contact__title" id="contactTitle">
        <span className="w">Let&apos;s</span> <span className="w">build</span><br /><span className="w red">something</span>
      </h2>
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
      <div className="contact__flood" aria-hidden="true" data-text="OMS" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="contact__fig" src={images.full.src} alt="" width={images.full.w} height={images.full.h} loading="lazy" decoding="async" aria-hidden="true" />
      <footer className="ftr hud">
        <span>© 2026 {person.name}</span>
        <span>Built with Next.js, Three.js &amp; GSAP · Activity data from GitHub</span>
        <span style={{ display: "flex", gap: 22 }}>
          <button type="button" id="replayIntro">Replay intro</button>
          <a href="#top">Escape ↑</a>
        </span>
      </footer>
    </section>
  );
}
