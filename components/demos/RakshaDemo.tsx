"use client";

// RAKSHA's bench logic in the browser: Rothfusz heat index (NWS form, reproduces the README's 31.9 °C and 30.7 °C),
// the five bands, an exposure clock that only runs while someone is at the bench, the fan relay, and the fall
// machine (free-fall → impact → still → alarm; shaking never dips below 1 g, so it stays idle).
import { useEffect, useRef, useState } from "react";

export function heatIndexC(c: number, rh: number) {
  const T = (c * 9) / 5 + 32;
  const simple = 0.5 * (T + 61 + (T - 68) * 1.2 + rh * 0.094);
  let h = simple;
  if ((simple + T) / 2 >= 80) {
    h = -42.379 + 2.04901523 * T + 10.14333127 * rh - 0.22475541 * T * rh - 0.00683783 * T * T - 0.05481717 * rh * rh
      + 0.00122874 * T * T * rh + 0.00085282 * T * rh * rh - 0.00000199 * T * T * rh * rh;
    if (rh < 13 && T >= 80 && T <= 112) h -= ((13 - rh) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
    if (rh > 85 && T >= 80 && T <= 87) h += ((rh - 85) / 10) * ((87 - T) / 5);
  }
  return ((h - 32) * 5) / 9;
}
const BANDS = [
  { n: "Below 27 °C", max: 27, c: "#5d6154" },
  { n: "Caution", max: 32, c: "#d9c25a" },
  { n: "Extreme caution", max: 41, c: "#f08a34" },
  { n: "Danger", max: 54, c: "#ff2e4c" },
  { n: "Extreme", max: Infinity, c: "#a3001d" },
];
const bandOf = (hi: number) => BANDS.findIndex((b) => hi < b.max);
type FallState = "IDLE" | "FREEFALL" | "IMPACT" | "CONFIRM" | "ALARM";
const fmt = (s: number) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function RakshaDemo() {
  const [shift, setShift] = useState(false);
  const [present, setPresent] = useState(true);
  const [temp, setTemp] = useState(30);
  const [rh, setRh] = useState(55);
  const [exposure, setExposure] = useState(0);
  const [danger, setDanger] = useState(0);
  const [fall, setFall] = useState<FallState>("IDLE");
  const [note, setNote] = useState("Tap the card to sign SIM-01 onto the shift.");
  const accel = useRef<number[]>(Array(120).fill(1));
  const motion = useRef<{ kind: "rest" | "shake" | "drop"; t: number }>({ kind: "rest", t: 0 });
  const [, force] = useState(0);
  const timers = useRef<number[]>([]);

  const hi = heatIndexC(temp, rh);
  const band = bandOf(hi);
  const fan = shift && present && band >= 3;
  const beacon = fall === "ALARM";

  // 1 s clock: exposure only while a signed-on worker is at the bench
  useEffect(() => {
    const id = window.setInterval(() => {
      if (shift && present) {
        setExposure((e) => e + 1);
        if (band >= 3) setDanger((d) => d + 1);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [shift, present, band]);

  // 20 Hz accelerometer magnitude (in g)
  useEffect(() => {
    const id = window.setInterval(() => {
      const m = motion.current;
      m.t += 0.05;
      let g = 1 + (Math.random() - 0.5) * 0.03;
      if (m.kind === "shake") { g = 1.35 + Math.sin(m.t * 38) * 0.3; if (m.t > 2.5) motion.current = { kind: "rest", t: 0 }; }
      if (m.kind === "drop") {
        if (m.t < 0.35) g = 0.12 + Math.random() * 0.05;      // free-fall
        else if (m.t < 0.5) g = 2.9;                           // impact
        else g = 1 + (Math.random() - 0.5) * 0.01;             // still, tilted
        if (m.t > 2) motion.current = { kind: "rest", t: 0 };
      }
      accel.current = [...accel.current.slice(1), g];
      force((x) => (x + 1) % 1e6);
    }, 50);
    return () => clearInterval(id);
  }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const tapCard = () => {
    if (fall === "ALARM") { setFall("IDLE"); setNote("Second tap acknowledged the alarm. Beacon released."); return; }
    if (!shift) { setShift(true); setNote("SHIFT worker=SIM-01. The exposure clock runs while someone is at the bench."); return; }
    setNote("Already signed on. A second tap acknowledges an alarm.");
  };
  const shake = () => {
    motion.current = { kind: "shake", t: 0 };
    setNote("Shaking the bench for 2.5 s: magnitude stays above 1 g, so there is no free-fall dip. Fall stays IDLE.");
  };
  const drop = () => {
    if (fall !== "IDLE") return;
    motion.current = { kind: "drop", t: 0 };
    const seq: [FallState, number][] = [["FREEFALL", 0], ["IMPACT", 380], ["CONFIRM", 600], ["ALARM", 1700]];
    seq.forEach(([s, ms]) => timers.current.push(window.setTimeout(() => setFall(s), ms)));
    timers.current.push(window.setTimeout(() => setNote("FREEFALL → IMPACT → CONFIRM → ALARM. Beacon on and latched; the vibration motor warns the worker. Tap the card to acknowledge."), 1750));
  };
  const reset = () => {
    timers.current.forEach(clearTimeout);
    setShift(false); setPresent(true); setTemp(30); setRh(55); setExposure(0); setDanger(0); setFall("IDLE");
    setNote("Tap the card to sign SIM-01 onto the shift.");
  };

  const pts = accel.current.map((g, i) => `${(i / 119) * 300},${70 - Math.min(3, g) * 20}`).join(" ");
  return (
    <div className="demo rk">
      <p className="demo__note hud">Browser simulation of the node&apos;s logic, using the README&apos;s formula and thresholds · the real node runs on an ESP32</p>
      <div className="rk__grid">
        <div className="rk__node">
          <div className="rk__oled mono" aria-live="polite">
            <p>RAKSHA {shift ? "SHIFT" : "IDLE"}</p>
            <p>{shift ? "SIM-01" : "NO WORKER"}</p>
            <p>HI {hi.toFixed(1)}C {BANDS[band].n.toUpperCase()}</p>
            <p>FAN {fan ? "ON" : "OFF"} {fall}</p>
          </div>
          <div className="rk__leds hud">
            <span><i style={{ background: fall === "ALARM" ? "#ff2e4c" : BANDS[band].c }} /> RGB</span>
            <span><i className={fan ? "on" : ""} /> Fan relay</span>
            <span><i className={beacon ? "on blink" : ""} /> Beacon relay</span>
            <span><i className={fall === "ALARM" ? "on blink" : ""} /> Vibration</span>
          </div>
          <div className="rk__clock">
            <p className="hud dim">Exposure clock</p>
            <p className="rk__time mono">{fmt(exposure)}</p>
            <p className="hud dim">Danger seconds · {danger}</p>
            <p className="hud">{shift ? (present ? "Counting: worker at the bench" : "Paused: bench empty") : "No shift open"}</p>
          </div>
        </div>

        <div className="rk__controls">
          <div className="demo__controls">
            <button type="button" className="btn btn--signal" onClick={tapCard}><span>{fall === "ALARM" ? "Tap card (acknowledge)" : "Tap RFID card"}</span></button>
            <button type="button" className="btn" aria-pressed={present} onClick={() => setPresent((p) => !p)}><span>{present ? "Worker leaves" : "Worker returns"}</span></button>
          </div>
          <label className="md__range hud">Air temperature <b>{temp} °C</b>
            <input type="range" min={20} max={46} value={temp} onChange={(e) => setTemp(+e.target.value)} />
          </label>
          <label className="md__range hud">Relative humidity <b>{rh}%</b>
            <input type="range" min={10} max={95} value={rh} onChange={(e) => setRh(+e.target.value)} />
          </label>
          <div className="rk__bands" aria-label={`Heat index ${hi.toFixed(1)} °C, ${BANDS[band].n}`}>
            {BANDS.map((b, k) => <span key={b.n} className={k === band ? "on" : ""} style={{ ["--c" as string]: b.c }}>{b.n}</span>)}
          </div>
          <p className="rk__hi"><b className="mono">{hi.toFixed(1)} °C</b> heat index · fan closes on danger heat while someone is present</p>
          <div className="rk__accel">
            <p className="hud dim">MPU6050 magnitude (g)</p>
            <svg viewBox="0 0 300 75" aria-hidden="true">
              <line x1="0" x2="300" y1="50" y2="50" stroke="rgba(236,236,230,.25)" strokeDasharray="4 4" />
              <polyline points={pts} fill="none" stroke="#ff2e4c" strokeWidth="1.5" />
            </svg>
            <div className="demo__controls">
              <button type="button" className="btn" onClick={shake}><span>Shake the bench</span></button>
              <button type="button" className="btn" onClick={drop} disabled={fall !== "IDLE"}><span>Simulate a fall</span></button>
              <button type="button" className="btn" onClick={reset}><span>Reset</span></button>
            </div>
          </div>
          <p className="rk__note" role="status">{note}</p>
        </div>
      </div>
      <details className="rk__run">
        <summary className="hud">Recorded run from the project report (Logicraft simulator)</summary>
        <table className="md__table">
          <tbody>
            <tr><td>Card, 30 °C / 55% RH, person present</td><td className="mono">Heat index 31.9 °C · CAUTION · risk 13.1 · fan off</td></tr>
            <tr><td>Short clap, 28 °C / 70% RH</td><td className="mono">Heat index 30.7 °C · risk 19.6 · fan stays off</td></tr>
            <tr><td>Sustained noise</td><td className="mono">Risk 58.6 · air alert · fan on</td></tr>
            <tr><td>Shake for 2.5 s</td><td className="mono">Fall stays IDLE</td></tr>
            <tr><td>Drop, then still, person gone</td><td className="mono">FREEFALL → IMPACT → CONFIRM → ALARM · beacon on</td></tr>
          </tbody>
        </table>
      </details>
    </div>
  );
}
