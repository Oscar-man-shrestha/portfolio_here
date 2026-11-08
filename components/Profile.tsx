import { person } from "@/lib/content";
import Operator from "./Operator";

// Operator profile: a pinned, scroll-driven turntable of Oscar's four real views, his full name stacked behind
// with echo outlines (from the Soka / SECONDVISION reference), a red sun, a view rail and a character card.
export default function Profile() {
  return (
    <section className="sec profile op" id="profile" aria-labelledby="profileTitle">
      {/* readable profile for screen readers; the visual card below repeats it */}
      <div className="sr-only">
        <h2 id="profileTitle">About</h2>
        <p>{person.about}</p>
        <p>{person.role} · {person.disciplines.join(", ")} · {person.base}. Off the clock: {person.offClock.join(", ")}.</p>
      </div>
      <div className="op__pin">
        <div className="op__labels hud" aria-hidden="true">
          <span className="red"><span className="sq" />04 // Operator profile</span>
          <span className="dim">Scroll to turn · 4 views</span>
        </div>
        <div className="op__sun" aria-hidden="true" />
        <p className="op__name" aria-hidden="true">
          {["Oscar", "Man", "Shrestha"].map((w, k) => (
            <span key={w} className={`op__line l${k}`} data-echo={w}><span>{w}</span></span>
          ))}
        </p>
        <p className="op__vert hud" aria-hidden="true">Operator // Profile // {person.base} // 2026</p>
        <Operator />
      </div>
    </section>
  );
}
