// The intro film (reference 6) is the loader, unchanged from the approved concept: the same remastered files,
// the same timing. Only the HUD around it now uses the new type system.

// Starts the film during HTML parsing, before React or any bundle loads. preload stays "none" in the markup so
// returning visitors (who skip the intro) never download it.
const startFilm = `(function(){var r=document.documentElement,v=document.getElementById("introVideo");
if(!v||r.classList.contains("no-intro")||r.classList.contains("reduce-motion"))return;
v.preload="auto";var p;try{performance.mark("oms:film-call");p=v.play()}catch(e){}
window.__omsFilm=p&&p.then?p.then(function(){return 1},function(){return 0}):Promise.resolve(0);})();`;

export default function Intro() {
  return (
    <div className="intro" id="intro" role="region" aria-label="Intro">
      {/* Phones get the native-resolution 9:16 crop (406×720); everything else gets the original 1280×720 stream,
          copied bit-for-bit from the source. */}
      <video
        className="intro__video"
        id="introVideo"
        muted
        playsInline
        preload="none"
        poster="/video/poster.jpg"
        suppressHydrationWarning
      >
        <source src="/video/intro-portrait.mp4" type="video/mp4" media="(max-aspect-ratio: 5/8)" />
        <source src="/video/intro.mp4" type="video/mp4" />
      </video>
      <script dangerouslySetInnerHTML={{ __html: startFilm }} />
      <div className="intro__shade" aria-hidden="true" />
      <div className="intro__frame" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="intro__top hud">
        <span className="intro__brand"><b>OMS</b>/26</span>
        <span className="intro__meta">Machine learning · Security · Web</span>
        <button className="intro__skip hud" id="skipIntro" type="button">Skip intro <span aria-hidden="true">↘</span></button>
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
