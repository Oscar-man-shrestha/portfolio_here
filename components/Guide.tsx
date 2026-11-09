"use client";

// OMS-mini: a HUD terminal where visitors ask about Oscar. Everything runs in the browser: the engine
// (lib/guide-engine) matches the question to an answer written from the site's content (lib/guide-kb), first by
// keywords and, once it has loaded, by meaning with a small pretrained model (lib/minilm). An answer may move the
// page (turn the mission wheel, scroll to a section) through an "oms:guide" event that Experience carries out.
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { LINK_HOSTS, MAX_QUESTION, isAction, type GuideAction, type GuideKB } from "@/lib/guide";
import { createEngine, type GuideEngine } from "@/lib/guide-engine";
import Pet from "./Pet";
import { startTour } from "./Tour";

type Msg = { role: "user" | "assistant"; text: string; note?: string; next?: string[]; typing?: boolean };
type ModelState = { phase: "idle" | "loading" | "ready" | "keywords"; progress: number };

const STARTERS = ["Take the 60-second tour", "What does Oscar build?", "Show me his security work", "How can I contact him?"];
const STORE = "oms.guide";

declare global {
  interface Window { __omsGuide?: { match: (q: string) => Promise<{ id: string; score: number; via: string }>; model: () => ModelState } }
}

// ---------------- a small, safe markdown subset ----------------
function linkTarget(url: string, email: string): { href: string; external: boolean } | null {
  if (/^\/(?!\/)/.test(url) || /^#[\w-]+$/.test(url)) return { href: url, external: false };
  if (url === `mailto:${email}`) return { href: url, external: false };
  try {
    const u = new URL(url);
    if (u.protocol === "https:" && (LINK_HOSTS as readonly string[]).includes(u.host)) return { href: u.href, external: true };
  } catch {}
  return null;
}

function inline(text: string, key: string, email: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g;
  let last = 0, n = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) {
      const inner = m[1];
      out.push(<strong key={key + n++}>{inner === email ? <a href={`mailto:${email}`}>{inner}</a> : inner}</strong>);
    } else if (m[2]) {
      const t = linkTarget(m[3], email);
      out.push(t ? <a key={key + n++} href={t.href} {...(t.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{m[2]}</a> : m[2]);
    } else if (m[4]) out.push(m[4] === email ? <a key={key + n++} href={`mailto:${email}`}>{m[4]}</a> : m[4]);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Rich({ text, email }: { text: string; email: string }) {
  return (
    <>
      {text.trim().split(/\n{2,}/).map((block, b) => {
        const lines = block.split("\n");
        if (lines.length && lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
          return <ul key={b}>{lines.map((l, i) => <li key={i}>{inline(l.replace(/^\s*[-*•]\s+/, ""), `${b}.${i}.`, email)}</li>)}</ul>;
        }
        return <p key={b}>{lines.map((l, i) => <span key={i}>{i > 0 && <br />}{inline(l, `${b}.${i}.`, email)}</span>)}</p>;
      })}
    </>
  );
}

export default function Guide({ kb }: { kb: GuideKB }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [peek, setPeek] = useState(false);
  const [lifted, setLifted] = useState(false);
  const [model, setModel] = useState<ModelState>({ phase: "idle", progress: 0 });
  const panelId = useId(), titleId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launchRef = useRef<HTMLButtonElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GuideEngine | null>(null);
  const loaded = useRef(false);
  const engine = () => (engineRef.current ??= createEngine(kb));

  // the conversation lasts for the browser session (and survives a visit to a project page)
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE) ?? "null") as Msg[] | null;
      if (Array.isArray(saved)) setMsgs(saved.map((m) => ({ ...m, typing: false })));
    } catch {}
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current || busy) return;
    try { sessionStorage.setItem(STORE, JSON.stringify(msgs.slice(-40))); } catch {}
  }, [msgs, busy]);

  // the model loads the first time the panel opens (it's 23 MB); on data-saver connections it stays on keywords
  const loadModel = useCallback(() => {
    if (model.phase !== "idle") return;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType ?? "")) { setModel({ phase: "keywords", progress: 0 }); return; }
    setModel({ phase: "loading", progress: 0 });
    import("@/lib/minilm")
      // progress: the download is most of it, then the example questions are turned into vectors (first visit only)
      .then(({ loadEmbedder }) => loadEmbedder((p) => setModel((m) => (m.phase === "loading" ? { phase: "loading", progress: p * 0.8 } : m))))
      .then((e) => engine().useModel(e, (v) => setModel((m) => (m.phase === "loading" ? { phase: "loading", progress: 0.8 + v * 0.2 } : m))))
      .then(() => setModel({ phase: "ready", progress: 1 }))
      .catch((err) => { console.warn("guide: model unavailable, using keywords", err); setModel({ phase: "keywords", progress: 0 }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.phase]);

  // a test hook: what the engine would answer, without touching the page
  useEffect(() => {
    window.__omsGuide = {
      match: async (q) => { const m = await engine().match(q); return { id: m.card.id, score: +m.score.toFixed(3), via: m.via }; },
      model: () => model,
    };
  });

  const show = useCallback((next: boolean) => {
    setOpen(next);
    if (next) { setPeek(false); loadModel(); requestAnimationFrame(() => inputRef.current?.focus()); }
    else requestAnimationFrame(() => launchRef.current?.focus());
  }, [loadModel]);

  // "/" opens OMS-mini (unless typing somewhere); Escape inside it closes it
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || open) return;
      if ((e.target as HTMLElement)?.closest?.("input, textarea, select, [contenteditable]")) return;
      if (document.documentElement.classList.contains("is-loading")) return;
      e.preventDefault();
      show(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, show]);

  // the tour closes the panel while it runs; its last stop can open it
  useEffect(() => {
    const onTour = (e: Event) => { if ((e as CustomEvent<{ active: boolean }>).detail.active) setOpen(false); };
    const onOpen = () => show(true);
    window.addEventListener("oms:tour", onTour);
    window.addEventListener("oms:guide-open", onOpen);
    return () => { window.removeEventListener("oms:tour", onTour); window.removeEventListener("oms:guide-open", onOpen); };
  }, [show]);

  // move the launcher up while the footer's own links are on screen
  useEffect(() => {
    const ftr = document.querySelector(".ftr");
    if (!ftr) return;
    const io = new IntersectionObserver(([e]) => setLifted(e.isIntersecting));
    io.observe(ftr);
    return () => io.disconnect();
  }, []);

  // keep the newest line in view while an answer types, unless the visitor has scrolled up to read
  useEffect(() => {
    const log = logRef.current;
    if (log && log.scrollHeight - log.scrollTop - log.clientHeight < 120) log.scrollTop = log.scrollHeight;
  }, [msgs, open]);

  // shrinking to a peek (phones) keeps the newest answer in view, during and after the height transition
  useEffect(() => {
    if (!peek) return;
    const toEnd = () => { const log = logRef.current; if (log) log.scrollTop = log.scrollHeight; };
    const t1 = window.setTimeout(toEnd, 60), t2 = window.setTimeout(toEnd, 520);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [peek, msgs]);

  const update = (fn: (m: Msg) => Msg) => setMsgs((list) => list.map((m, i) => (i === list.length - 1 ? fn(m) : m)));

  const act = (action: GuideAction) => {
    window.dispatchEvent(new CustomEvent("oms:guide", { detail: action }));
    // phones: shrink the sheet so the page underneath is visible
    if (matchMedia("(max-width: 767px)").matches) setPeek(true);
  };

  const ask = async (raw: string) => {
    const question = raw.trim().slice(0, MAX_QUESTION);
    if (!question || busy) return;
    // "give me the tour", "quick tour": the guided tour answers it
    if (/\btour\b/i.test(question)) { setDraft(""); setOpen(false); startTour(); return; }
    setDraft("");
    setBusy(true);
    setMsgs((list) => [...list, { role: "user", text: question }, { role: "assistant", text: "", typing: true }]);
    try {
      const { card } = await engine().match(question);
      let text = card.a;
      if (card.id === "bot" && model.phase !== "ready") {
        text += model.phase === "keywords" ? " (On this connection I'm matching keywords instead of loading the model.)" : " (It's still loading, so for now I'm matching keywords.)";
      }
      const action = card.action && isAction(card.action) ? card.action : undefined;
      if (action) { update((m) => ({ ...m, note: action.label })); act(action); }
      // type the answer out, a few words at a time (all at once with reduced motion)
      const parts = document.documentElement.classList.contains("reduce-motion") ? [text] : text.match(/\S+\s*/g) ?? [text];
      for (let i = 0; i < parts.length; i += 3) {
        const chunk = parts.slice(i, i + 3).join("");
        update((m) => ({ ...m, text: m.text + chunk }));
        if (parts.length > 1) await new Promise((r) => setTimeout(r, 16));
      }
      update((m) => ({ ...m, typing: false, next: card.next?.slice(0, 3) }));
    } catch {
      update((m) => ({ ...m, typing: false, text: `Something went wrong. You can always email Oscar at ${kb.email}.` }));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setMsgs([]);
    try { sessionStorage.removeItem(STORE); } catch {}
    inputRef.current?.focus();
  };

  const status =
    model.phase === "ready" ? "Model loaded · on-device"
    : model.phase === "loading" ? `Loading model ${Math.round(model.progress * 100)}%`
    : model.phase === "keywords" ? "Keyword mode"
    : "Small model · 23 MB · on-device";
  const last = msgs[msgs.length - 1];

  return (
    <div className={`guide${open ? " is-open" : ""}${peek ? " is-peek" : ""}${lifted ? " is-lifted" : ""}`}>
      <Pet buttonRef={launchRef} open={open} panelId={panelId} onToggle={() => show(!open)} atFooter={lifted} />

      <section
        id={panelId}
        className="guide__panel"
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        hidden={!open}
        onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); show(false); } }}
      >
        <header className="guide__head">
          <button type="button" className="guide__grip" aria-label={peek ? "Expand OMS-mini" : "Shrink OMS-mini"} onClick={() => setPeek(!peek)} />
          <p className="guide__title hud" id={titleId}>
            <span className="sq" aria-hidden="true" />OMS-mini <span className="guide__jp" lang="ja" aria-hidden="true">// 小型モデル</span>
          </p>
          <p className={`guide__sub hud is-${model.phase}`} aria-live="polite">
            <span className="guide__led" aria-hidden="true" />{status}
            {model.phase === "loading" && <span className="guide__bar" aria-hidden="true"><i style={{ transform: `scaleX(${model.progress})` }} /></span>}
          </p>
          <div className="guide__tools">
            {msgs.length > 0 && <button type="button" className="hud" onClick={reset}>New chat</button>}
            <button type="button" className="guide__close" aria-label="Close OMS-mini" onClick={() => show(false)}>×</button>
          </div>
        </header>

        <div className="guide__log" ref={logRef} role="log" aria-busy={busy} data-lenis-prevent>
          <div className="guide__msg guide__msg--op">
            <p className="guide__who hud">OMS-mini</p>
            <div className="guide__text">
              <p>OMS-mini online: a small language model running in your browser. Ask me about Oscar&apos;s projects, skills or open-source work, and I&apos;ll show you where it is on the page.</p>
            </div>
            {msgs.length === 0 && (
              <ul className="guide__starters">
                {STARTERS.map((s) => <li key={s}><button type="button" onClick={() => ask(s)}>{s}</button></li>)}
              </ul>
            )}
          </div>
          {msgs.map((m, i) => (
            <div key={i} className={`guide__msg guide__msg--${m.role === "user" ? "you" : "op"}`}>
              <p className="guide__who hud">{m.role === "user" ? "You" : "OMS-mini"}</p>
              {m.note && <p className="guide__note hud">↳ Showing {m.note}</p>}
              <div className="guide__text">
                {m.role === "user" ? <p>{m.text}</p> : m.text ? <Rich text={m.text} email={kb.email} /> : null}
                {m.typing && <span className="guide__caret" aria-hidden="true" />}
              </div>
              {m === last && m.role === "assistant" && !m.typing && m.next && m.next.length > 0 && (
                <ul className="guide__starters guide__starters--next">
                  {m.next.map((s) => <li key={s}><button type="button" onClick={() => ask(s)}>{s}</button></li>)}
                </ul>
              )}
            </div>
          ))}
        </div>

        <form className="guide__form" onSubmit={(e) => { e.preventDefault(); ask(draft); }}>
          <span className="guide__prompt hud" aria-hidden="true">&gt;</span>
          <textarea
            ref={inputRef}
            value={draft}
            rows={1}
            maxLength={MAX_QUESTION}
            placeholder="Ask about Oscar's work…"
            aria-label="Ask OMS-mini about Oscar"
            onFocus={() => setPeek(false)}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); ask(draft); } }}
          />
          <button type="submit" className="guide__send" disabled={busy || !draft.trim()} aria-label="Send">↵</button>
        </form>
        <p className="guide__foot">OMS-mini runs on your device: MiniLM, a small pretrained model (23 MB), reads your question, and every answer comes from this site&apos;s content. Nothing you type leaves your browser.</p>
      </section>
    </div>
  );
}
