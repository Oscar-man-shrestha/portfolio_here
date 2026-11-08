import { person } from "@/lib/content";
import Turnaround from "./Turnaround";

export default function Profile() {
  return (
    <section className="sec profile" id="profile" aria-labelledby="profileTitle">
      <div className="profile__labels">
        <p className="hud" style={{ margin: 0 }}><span className="sq" />04 // Operator profile</p>
        <p className="hud dim" style={{ margin: 0 }}>Model turnaround · drag to rotate</p>
      </div>
      <div className="profile__stage">
        <p className="profile__word" aria-hidden="true"><span className="profile__track">Shrestha</span></p>
        <Turnaround />
        <p className="profile__word profile__word--outline" aria-hidden="true"><span className="profile__track">Shrestha</span></p>
      </div>
      <div className="profile__info">
        <p className="sec__kicker hud" style={{ margin: 0 }}>About</p>
        <div>
          <h2 className="sec__title split" id="profileTitle">About</h2>
          <p className="profile__lede reveal">
            I&apos;m a software engineer working across <em>machine learning</em>, <em>security</em> and the <em>web</em>.
            My work ranges from a Markov-chain malware classifier and a Chrome extension to upstream fixes in Hugging Face
            Datasets, xarray and skrub.
          </p>
        </div>
        <dl className="spec hud reveal">
          <dt>Name</dt><dd>{person.name}</dd>
          <dt>Class</dt><dd>{person.role}</dd>
          <dt>Spec</dt><dd>{person.disciplines.join(" · ")}</dd>
          <dt>Base</dt><dd>{person.base}</dd>
          <dt>Off the clock</dt><dd>{person.offClock.join(" · ")}</dd>
        </dl>
      </div>
    </section>
  );
}
