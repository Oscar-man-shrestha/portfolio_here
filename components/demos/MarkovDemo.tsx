"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { familyRefs, features, makeRef, normalize, counts, norm3, rng, STATES, trace, type Fam } from "@/lib/markov";
import type { Pt } from "./MarkovSpace";

const MarkovSpace = dynamic(() => import("./MarkovSpace"), { ssr: false, loading: () => <div className="ms ms--loading hud">Loading 3D space…</div> });

interface Run { tokens: number[]; fam: Fam; fA: [number, number, number]; fB: [number, number, number] }

export default function MarkovDemo() {
  const refs = useMemo(() => familyRefs(7), []);
  const [fam, setFam] = useState<Fam>("A");
  const [len, setLen] = useState(120);
  const [noise, setNoise] = useState(0.15);
  const [seed, setSeed] = useState(1);
  const [runs, setRuns] = useState<Run[]>([]);
  const [view, setView] = useState<Fam>("A");

  const make = (f: Fam, s: number): Run => {
    const tokens = trace(f, len, noise, rng(s * 9973 + len));
    const q = makeRef(normalize(counts([tokens])));
    return { tokens, fam: f, fA: features(q, refs.A), fB: features(q, refs.B) };
  };
  const gen = (k = 1) => {
    const out: Run[] = [];
    for (let i = 0; i < k; i++) out.push(make(k === 1 ? fam : (i % 2 ? "B" : "A"), seed + i));
    setSeed((s) => s + k);
    setRuns((r) => [...r.slice(-(40 - k)), ...out]);
  };

  const cur = runs[runs.length - 1];
  const P = cur ? normalize(counts([cur.tokens])) : null;
  const dA = cur ? norm3(cur.fA) : 0, dB = cur ? norm3(cur.fB) : 0;
  const pred: Fam | null = cur ? (dA <= dB ? "A" : "B") : null;
  const correct = runs.filter((r) => (norm3(r.fA) <= norm3(r.fB) ? "A" : "B") === r.fam).length;
  const pts: Pt[] = runs.map((r, k) => ({ f: view === "A" ? r.fA : r.fB, fam: r.fam, current: k === runs.length - 1 }));

  return (
    <div className="demo md">
      <p className="demo__note hud">Toy traces made in your browser from two made-up families · shows the technique, not the project&apos;s data or results</p>
      <div className="md__grid">
        <div className="md__controls">
          <fieldset className="md__fam">
            <legend className="hud">Next trace comes from</legend>
            {(["A", "B"] as Fam[]).map((f) => (
              <label key={f} className={fam === f ? "on" : ""}><input type="radio" name="fam" checked={fam === f} onChange={() => setFam(f)} /> Toy family {f}</label>
            ))}
          </fieldset>
          <label className="md__range hud">Trace length <b>{len}</b> API calls
            <input type="range" min={20} max={300} step={10} value={len} onChange={(e) => setLen(+e.target.value)} />
          </label>
          <label className="md__range hud">Noise (random calls) <b>{Math.round(noise * 100)}%</b>
            <input type="range" min={0} max={0.7} step={0.05} value={noise} onChange={(e) => setNoise(+e.target.value)} />
          </label>
          <div className="demo__controls">
            <button type="button" className="btn btn--signal" onClick={() => gen(1)}><span>Generate trace</span><b aria-hidden="true">↘</b></button>
            <button type="button" className="btn" onClick={() => gen(10)}><span>+10 mixed</span></button>
            <button type="button" className="btn" onClick={() => setRuns([])}><span>Clear</span></button>
          </div>
          {cur && (
            <div className="md__tokens" aria-label="First calls of the trace">
              {cur.tokens.slice(0, 42).map((t, k) => <span key={k} className={`tk t${t}`}>{STATES[t].slice(0, 3)}</span>)}
              {cur.tokens.length > 42 && <span className="tk more">+{cur.tokens.length - 42}</span>}
            </div>
          )}
        </div>

        <div className="md__matrix">
          <p className="hud">Transition matrix of this trace</p>
          {P ? (
            <svg viewBox="0 0 330 330" role="img" aria-label="Heatmap of the trace's transition probabilities">
              {P.map((row, i) => row.map((v, j) => (
                <rect key={`${i}-${j}`} x={60 + j * 45} y={30 + i * 45} width={43} height={43} fill={`rgba(255,46,76,${Math.min(1, v * 1.6).toFixed(3)})`} stroke="rgba(236,236,230,.12)" />
              )))}
              {STATES.map((s, k) => (
                <g key={s}>
                  <text x={56} y={56 + k * 45} textAnchor="end" className="md__lbl">{s.slice(0, 4)}</text>
                  <text x={81 + k * 45} y={22} textAnchor="middle" className="md__lbl">{s.slice(0, 3)}</text>
                </g>
              ))}
            </svg>
          ) : <p className="md__empty">Generate a trace to see its fingerprint.</p>}
        </div>

        <div className="md__space">
          <div className="md__spacehead">
            <p className="hud">3D feature space, relative to family</p>
            <div className="md__seg" role="group" aria-label="Reference family">
              {(["A", "B"] as Fam[]).map((f) => <button key={f} type="button" aria-pressed={view === f} onClick={() => setView(f)}>{f}</button>)}
            </div>
          </div>
          <MarkovSpace pts={pts} />
        </div>
      </div>

      {cur && (
        <div className="md__result">
          <table className="md__table">
            <thead><tr><th className="hud">vs family</th><th className="hud">JS</th><th className="hud">ΔH</th><th className="hud">‖Δπ‖₁</th><th className="hud">distance</th></tr></thead>
            <tbody>
              {(["A", "B"] as Fam[]).map((f) => {
                const v = f === "A" ? cur.fA : cur.fB;
                return (
                  <tr key={f} className={pred === f ? "on" : ""}>
                    <td>{f}{pred === f ? " ◂ nearest" : ""}</td>
                    {v.map((x, k) => <td key={k} className="mono">{x.toFixed(3)}</td>)}
                    <td className="mono">{norm3(v).toFixed(3)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="md__verdict">
            Trace from <b>family {cur.fam}</b> → classified as <b className={pred === cur.fam ? "ok" : "red"}>family {pred}</b>.
            {runs.length > 1 && <> In this session: {correct}/{runs.length} toy traces matched their family.</>}
          </p>
        </div>
      )}
    </div>
  );
}
