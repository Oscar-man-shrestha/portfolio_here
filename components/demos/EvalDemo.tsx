"use client";

// Eval Validity, illustrated with a toy log: learners mostly follow the curriculum and sometimes repeat an item.
// Three predictors that know nothing about learning (repeat-last, next-in-curriculum, a Markov table) are scored on
// next-item accuracy at three action units. If they score high, the metric is rewarding repetition and order.
import { useMemo, useState } from "react";
import { rng } from "@/lib/markov";

const Q = 12; // questions
const unitOf = { question: (q: number) => q, topic: (q: number) => Math.floor(q / 3), skill: (q: number) => Math.floor(q / 6) };
type Unit = keyof typeof unitOf;
const UNITS: Unit[] = ["question", "topic", "skill"];
const PREDICTORS = ["Repeat last", "Next in curriculum", "Markov table"] as const;

function makeLog(rep: number, order: number, seed: number) {
  const r = rng(seed);
  return Array.from({ length: 160 }, () => {
    let q = 0;
    const seq = [q];
    for (let i = 0; i < 40; i++) {
      const x = r();
      if (x < rep) { /* repeats the same item */ }
      else if (x < rep + (1 - rep) * order) q = Math.min(Q - 1, q + 1);
      else q = Math.floor(r() * Q);
      seq.push(q);
    }
    return seq;
  });
}

function score(log: number[][], unit: Unit) {
  const u = unitOf[unit];
  const train = log.slice(0, 112), test = log.slice(112);
  const nU = u(Q - 1) + 1;
  const C = Array.from({ length: nU }, () => new Array(nU).fill(0));
  for (const s of train) for (let i = 1; i < s.length; i++) C[u(s[i - 1])][u(s[i])]++;
  const best = C.map((row) => row.indexOf(Math.max(...row)));
  const hits = [0, 0, 0];
  let n = 0;
  for (const s of test) for (let i = 1; i < s.length; i++) {
    const last = s[i - 1], truth = u(s[i]);
    n++;
    if (u(last) === truth) hits[0]++;
    if (u(Math.min(Q - 1, last + 1)) === truth) hits[1]++;
    if (best[u(last)] === truth) hits[2]++;
  }
  return hits.map((h) => h / n);
}

export default function EvalDemo() {
  const [rep, setRep] = useState(0.35);
  const [order, setOrder] = useState(0.8);
  const [seed, setSeed] = useState(3);
  const res = useMemo(() => {
    const log = makeLog(rep, order, seed);
    return Object.fromEntries(UNITS.map((u) => [u, score(log, u)])) as Record<Unit, number[]>;
  }, [rep, order, seed]);
  const top = Math.max(...res.skill);

  return (
    <div className="demo ev">
      <p className="demo__note hud">Toy log made in your browser to illustrate the question · the study&apos;s confirmatory test has not been run, so no results are shown</p>
      <div className="ev__grid">
        <div className="ev__controls">
          <label className="md__range hud">Repetition (learner repeats the same item) <b>{Math.round(rep * 100)}%</b>
            <input type="range" min={0} max={0.8} step={0.05} value={rep} onChange={(e) => setRep(+e.target.value)} />
          </label>
          <label className="md__range hud">Curriculum order (otherwise a random jump) <b>{Math.round(order * 100)}%</b>
            <input type="range" min={0} max={1} step={0.05} value={order} onChange={(e) => setOrder(+e.target.value)} />
          </label>
          <div className="demo__controls">
            <button type="button" className="btn" onClick={() => setSeed((s) => s + 1)}><span>New toy log</span></button>
          </div>
          <p className="ev__msg">
            None of these predictors models learning. At the <b>skill</b> level the best of them still reaches <b className="red">{Math.round(top * 100)}%</b> next-item accuracy.
            That is why the study asks whether such scores measure learning or mainly reward repetition and curriculum order, and how the action unit changes the answer.
          </p>
          <p className="hud dim">160 toy learners × 40 actions · 12 questions in 4 topics and 2 skills · scored on the last 30% of learners</p>
        </div>
        <div className="ev__chart" role="img" aria-label="Next-item accuracy of three naive predictors at three action units">
          {UNITS.map((u) => (
            <div key={u} className="ev__group">
              <p className="hud">{u}</p>
              {res[u].map((v, k) => (
                <div key={k} className={`ev__bar b${k}`}>
                  <span className="ev__name">{PREDICTORS[k]}</span>
                  <span className="ev__track"><i style={{ width: `${(v * 100).toFixed(1)}%` }} /></span>
                  <span className="ev__val mono">{Math.round(v * 100)}%</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
