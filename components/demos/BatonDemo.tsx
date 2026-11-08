"use client";

// Baton Pass, illustrated: a made-up sample chat moves from one assistant to another in the four steps the
// README describes (capture, pass, draft you send yourself, check the first reply). No real AI is involved.
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

const chat = [
  { who: "you", text: "Let's build a budget tracker. It must work offline." },
  { who: "ai", text: "Plan: SQLite with two tables, accounts and transactions." },
  { who: "you", text: "No Firebase. We decided against any cloud sync." },
  { who: "ai", text: "Noted, Firebase is out. Next: CSV import." },
];
const steps = ["Limit hit", "Capture", "Pass", "Draft", "Check"] as const;

export default function BatonDemo() {
  const [step, setStep] = useState(0);
  const [sent, setSent] = useState(false);
  const [fixed, setFixed] = useState(false);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (step !== 2 || !stage.current) return;
    const reduce = document.documentElement.classList.contains("reduce-motion");
    const packets = stage.current.querySelectorAll(".bd__packet");
    const tl = gsap.timeline();
    tl.fromTo(packets, { x: 0, opacity: 0, scale: 0.8 }, {
      x: () => (stage.current ? stage.current.clientWidth * 0.52 : 300), opacity: 1, scale: 1, duration: reduce ? 0 : 1.1,
      ease: "power3.inOut", stagger: 0.18,
    }).to(packets, { opacity: 0, duration: reduce ? 0 : 0.3 }, "+=0.2");
    // if the visitor moves on mid-flight, hide the packets instead of leaving them frozen
    return () => { tl.kill(); gsap.set(packets, { opacity: 0 }); };
  }, [step]);

  const next = () => { if (step === 3 && !sent) { setSent(true); setStep(4); return; } setStep((s) => Math.min(4, s + 1)); };
  const reset = () => { setStep(0); setSent(false); setFixed(false); };

  return (
    <div className="demo bd">
      <p className="demo__note hud">Illustration · made-up sample chat · the real extension runs in Chrome on six AI sites</p>
      <ol className="bd__steps hud" aria-label="Steps">
        {steps.map((s, k) => (
          <li key={s} className={k === step ? "on" : k < step ? "done" : ""}>
            <button type="button" onClick={() => { setStep(k); if (k < 4) setSent(false); if (k < 4) setFixed(false); }}>
              <b>{String(k).padStart(2, "0")}</b> {s}
            </button>
          </li>
        ))}
      </ol>
      <div className="bd__stage" ref={stage}>
        <div className="bd__win">
          <div className="bd__bar hud"><span>Assistant A</span><span className={step === 0 ? "red" : "dim"}>{step === 0 ? "Limit reached" : "Paused"}</span></div>
          <div className="bd__msgs">
            {chat.map((m, k) => <p key={k} className={`bd__msg ${m.who}`}>{m.text}</p>)}
            <p className="bd__file mono">📎 budget.csv</p>
          </div>
          {step === 0 && <div className="bd__limit">You&apos;ve hit this assistant&apos;s limit. <b>Baton ▸</b></div>}
          {step >= 1 && (
            <div className="bd__capture mono" role="status">
              Captured: 4 messages (2 yours, 2 replies), in order · 1 file · 1 rejected option · 1 settled number
            </div>
          )}
        </div>
        <div className="bd__lane" aria-hidden="true">
          {["Chat", "Files", "Decisions"].map((p) => <span key={p} className="bd__packet hud" data-label={p} />)}
        </div>
        <div className="bd__win">
          <div className="bd__bar hud"><span>Assistant B</span><span className="dim">{step >= 3 ? "Draft ready" : "Waiting"}</span></div>
          <div className="bd__msgs">
            {step >= 3 && (
              <div className={`bd__draft${sent ? " sent" : ""}`}>
                <p className="hud dim">{sent ? "You sent" : "Draft (you press Send)"}</p>
                <p className="mono">Project: budget tracker · Rule: works offline · Rejected: Firebase · Settled: 2 tables · Next: CSV import · Attached: budget.csv</p>
              </div>
            )}
            {sent && <p className="bd__msg ai">Great start! Let&apos;s add Firebase so it syncs across devices.</p>}
            {sent && fixed && <p className="bd__msg you">Reminder: Firebase was rejected; we stay offline. Continue with CSV import.</p>}
          </div>
          {step === 4 && sent && (
            <div className={`bd__check${fixed ? " ok" : ""}`} role="status">
              {fixed ? (
                <span>Correction placed in the chat box. You send it when ready.</span>
              ) : (
                <>
                  <span><b>Reply check:</b> it brought back something you rejected (Firebase).</span>
                  <button type="button" className="btn btn--signal" onClick={() => setFixed(true)}><span>Insert correction</span></button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="demo__controls">
        <button type="button" className="btn btn--signal" onClick={next} disabled={step === 4}>
          <span>{step === 0 ? "Click Baton" : step === 3 ? "Press Send" : step === 4 ? "Done" : "Next step"}</span><b aria-hidden="true">↘</b>
        </button>
        <button type="button" className="btn" onClick={reset}><span>Reset</span></button>
      </div>
      <ul className="demo__metrics">
        <li><b>100%</b><span>must-keep facts reach the next AI (offline benchmark)</span></li>
        <li><b>12/12</b><span>real replies continued the work</span></li>
        <li><b>1 of 1</b><span>real slips caught, no false alarms</span></li>
        <li><b>357</b><span>automated tests</span></li>
      </ul>
    </div>
  );
}
