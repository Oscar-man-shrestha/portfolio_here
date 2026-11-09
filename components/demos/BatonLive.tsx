"use client";

// "Run Baton's own code" on the Baton project page: not an illustration. A visitor picks one of Baton's evaluation
// chats (or pastes one), and the page runs Baton's evidence selector and its trained topic layer (lib/baton, copied
// from the Baton repo) on the same on-device MiniLM model OMS-mini uses. Nothing leaves the browser.
import { useState } from "react";
import samples from "@/lib/baton/samples.json";
import type { Turn } from "@/lib/baton/run";

type Result = {
  topic: { label: string; confidence: number; probabilities: Record<string, number> };
  findings: string[]; findingsTokens: number; earlier: string[]; goal: string;
};
type Phase = { kind: "idle" } | { kind: "loading"; progress: number } | { kind: "running" } | { kind: "done"; result: Result } | { kind: "error"; message: string };

const chats = samples.chats as { id: string; label: string; turns: Turn[] }[];

export default function BatonLive() {
  const [pick, setPick] = useState<string>(chats[0].id);
  const [own, setOwn] = useState("User: \nAssistant: ");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [names, setNames] = useState<Record<string, string>>({});

  const run = async () => {
    try {
      setPhase({ kind: "loading", progress: 0 });
      const [{ loadRuntime }, baton] = await Promise.all([import("@/lib/minilm"), import("@/lib/baton/run")]);
      setNames(baton.TOPIC_NAMES);
      const turns = pick === "own" ? baton.parseChat(own) : chats.find((c) => c.id === pick)!.turns;
      if (!turns.some((t) => t.role === "user") || !turns.some((t) => t.role === "assistant")) {
        setPhase({ kind: "error", message: "Start each message with “User:” or “Assistant:”, with at least one of each." });
        return;
      }
      const rt = await loadRuntime((p) => setPhase({ kind: "loading", progress: p }));
      setPhase({ kind: "running" });
      const ev = baton.evidence(turns);
      const topic = await baton.topic(turns.find((t) => t.role === "user")!.text, rt);
      setPhase({ kind: "done", result: { topic, ...ev } });
    } catch (err) {
      setPhase({ kind: "error", message: `Couldn't run here: ${(err as Error).message}` });
    }
  };

  const chat = chats.find((c) => c.id === pick);
  const busy = phase.kind === "loading" || phase.kind === "running";
  return (
    <div className="demo blive">
      <p className="blive__note hud"><span className="sq" />Baton&apos;s own code, running in your browser · not an illustration</p>
      <div className="blive__picks" role="radiogroup" aria-label="Chat to hand off">
        {chats.map((c) => (
          <button key={c.id} type="button" role="radio" aria-checked={pick === c.id} className={pick === c.id ? "is-on" : ""} onClick={() => { setPick(c.id); setPhase({ kind: "idle" }); }}>{c.label}</button>
        ))}
        <button type="button" role="radio" aria-checked={pick === "own"} className={pick === "own" ? "is-on" : ""} onClick={() => { setPick("own"); setPhase({ kind: "idle" }); }}>Paste your own</button>
      </div>

      <div className="blive__grid">
        <div className="blive__chat">
          {pick === "own" ? (
            <textarea className="blive__ta mono" value={own} onChange={(e) => setOwn(e.target.value)} rows={12} spellCheck={false} aria-label="Your chat, one message per “User:” or “Assistant:” line" />
          ) : (
            <ol className="blive__turns">
              {chat!.turns.map((t, i) => (
                <li key={i} className={`is-${t.role}`}><span className="hud">{t.role === "user" ? "You" : "AI"}</span><p>{t.text}</p></li>
              ))}
            </ol>
          )}
          <button type="button" className="btn btn--signal blive__run" onClick={run} disabled={busy}>
            <span>{phase.kind === "loading" ? `Loading model ${Math.round(phase.progress * 100)}%` : phase.kind === "running" ? "Running Baton…" : "Run Baton"}</span><b aria-hidden="true">▸</b>
          </button>
        </div>

        <div className="blive__out" aria-live="polite">
          {phase.kind === "done" ? (
            <>
              <section>
                <p className="hud blive__k">Topic // Baton&apos;s trained topic layer</p>
                <p className="blive__topic"><b>{names[phase.result.topic.label] ?? phase.result.topic.label}</b> {Math.round(phase.result.topic.confidence * 100)}%</p>
                <ul className="blive__bars">
                  {Object.entries(phase.result.topic.probabilities).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                    <li key={k}><span>{names[k] ?? k}</span><i style={{ transform: `scaleX(${v})` }} /><em>{Math.round(v * 100)}%</em></li>
                  ))}
                </ul>
              </section>
              <section>
                <p className="hud blive__k">Carried forward // {phase.result.findingsTokens} / 520 tokens</p>
                {phase.result.findings.length ? (
                  <ul className="blive__list">{phase.result.findings.map((f) => <li key={f}>{f}</li>)}</ul>
                ) : <p className="blive__muted">Nothing to carry from the last reply.</p>}
              </section>
              {phase.result.earlier.length > 0 && (
                <section>
                  <p className="hud blive__k">Best point of each earlier reply</p>
                  <ul className="blive__list blive__list--dim">{phase.result.earlier.map((f) => <li key={f}>{f}</li>)}</ul>
                </section>
              )}
            </>
          ) : phase.kind === "error" ? (
            <p className="blive__muted">{phase.message}</p>
          ) : (
            <p className="blive__muted">Press <b>Run Baton</b>: the page loads the 23 MB model (once; OMS-mini shares it), then runs Baton&apos;s evidence selector and topic layer on this chat. Nothing leaves your browser.</p>
          )}
        </div>
      </div>
      <p className="blive__src hud">
        Code: <a href="https://github.com/Oscar-man-shrestha/Baton/blob/7c5b076d338a/src/core/extractive.ts" target="_blank" rel="noopener noreferrer">extractive.ts</a> ·{" "}
        <a href="https://github.com/Oscar-man-shrestha/Baton/blob/7c5b076d338a/src/core/embed.ts" target="_blank" rel="noopener noreferrer">embed.ts</a> ·{" "}
        <a href="https://github.com/Oscar-man-shrestha/Baton/blob/7c5b076d338a/src/model/topic-head.json" target="_blank" rel="noopener noreferrer">topic-head.json</a> · sample chats from Baton&apos;s evaluation set
      </p>
    </div>
  );
}
