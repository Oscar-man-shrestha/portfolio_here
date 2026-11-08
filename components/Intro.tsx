// The intro film is the loader: "Who is Oscar?", the cyber-thriller Oscar made in Google Flow (it replaced the
// earlier 10-second film at his request). It starts muted, as browsers require; the Sound button turns sound on.
import { FILM } from "@/lib/film";

// Starts the film during HTML parsing, before React or any bundle loads. preload stays "none" in the markup so
// returning visitors (who skip the intro) never download it.
const startFilm = `(function(){var r=document.documentElement,v=document.getElementById("introVideo");
if(!v||r.classList.contains("no-intro")||r.classList.contains("reduce-motion"))return;
v.preload="auto";var p;try{performance.mark("oms:film-call");p=v.play()}catch(e){}
window.__omsFilm=p&&p.then?p.then(function(){return 1},function(){return 0}):Promise.resolve(0);})();`;

export default function Intro() {
  return (
    <div className="intro" id="intro" role="region" aria-label="Intro">
      {/* Phones get a native-resolution 9:16 centre crop (406×720); everything else gets the full 1280×720 film. */}
      <video
        className="intro__video"
        id="introVideo"
        muted
        playsInline
        preload="none"
        poster={FILM.poster}
        suppressHydrationWarning
      >
        <source src={FILM.tall} type="video/mp4" media="(max-aspect-ratio: 5/8)" />
        <source src={FILM.wide} type="video/mp4" />
      </video>
      <script dangerouslySetInnerHTML={{ __html: startFilm }} />
      <div className="intro__shade" aria-hidden="true" />
      <div className="intro__frame" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="intro__top hud">
        <span className="intro__brand"><b>OMS</b>/26</span>
        <span className="intro__meta">Machine learning · Security · Web</span>
        <span className="intro__actions">
          <button className="intro__sound hud" id="soundIntro" type="button" aria-pressed="false">Sound <span data-state>off</span></button>
          <button className="intro__skip hud" id="skipIntro" type="button">Skip intro <span aria-hidden="true">↘</span></button>
        </span>
      </div>
      <p className="intro__name" id="introName" aria-hidden="true">
        <span><span>Osc<span className="red">a</span>r</span></span>
        <span><span>Man Shrestha</span></span>
      </p>
      <div className="intro__bottom hud">
        <span className="intro__pct" id="loadPct">000</span>
        <span className="intro__bar" id="loadBar" aria-hidden="true">
          {Array.from({ length: 20 }, (_, i) => <i key={i} />)}
        </span>
        <span className="intro__status" id="loadStatus" aria-live="polite">Loading</span>
        <button className="intro__enter btn btn--signal" id="enterBtn" type="button" hidden>
          <span>Enter</span><b aria-hidden="true">↘</b>
        </button>
      </div>
      <div className="intro__flash" id="flash" aria-hidden="true" />
    </div>
  );
}
