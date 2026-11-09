// OMS-mini's matcher, all in the browser. A question is matched to one answer card from lib/guide-kb:
//  1. exact rules first: "does he know X?" against the technologies the site lists, and "tell me more";
//  2. keywords (BM25 over each card's example questions), which work from the first moment;
//  3. meaning, once MiniLM has loaded (lib/minilm): cosine similarity between the question and the example questions.
// When the question is about a project, a word rule picks the facet ("how does it work", "built with", "results",
// "source code"), and pronouns ("is it finished?") refer to the project last discussed. Below a confidence threshold
// it says what it can answer instead of guessing.
import type { Facet, GuideCard, GuideKB, ProjectId } from "./guide";
import type { Embedder } from "./minilm";

export interface Match {
  card: GuideCard;
  score: number;
  via: "rule" | "meaning" | "keywords" | "fallback";
}

const STOP = new Set(
  ("a an the is are was were be been being am to of in on for and or but me my you your i we he his him she her it its this that these those " +
    "what which who whom whose how why when where does do did doing done can could would should will shall may might must about tell show " +
    "please any some there here with from by at as into than then so if just also really very much more most oscar oscars man shrestha s " +
    "know let lets give get got like want need").split(" "),
);

/** Light stemming so "projects" meets "project" and "contributed" meets "contribute". */
const stem = (w: string) =>
  w.length > 5 && w.endsWith("ing") ? w.slice(0, -3)
  : w.length > 4 && w.endsWith("ies") ? w.slice(0, -3) + "y"
  : w.length > 4 && w.endsWith("ed") ? w.slice(0, -2)
  : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1)
  : w;

const norm = (s: string) =>
  s.toLowerCase()
    .replace(/c\+\+/g, " cpp ").replace(/c#/g, " csharp ")
    .replace(/\b(next|three|node|vue|react)\.js\b/g, "$1js")
    .replace(/[’']s\b/g, "")
    .replace(/[^a-z0-9+#]+/g, " ")
    .trim();

const words = (s: string) => norm(s).split(" ").filter(Boolean);
const terms = (s: string) => words(s).filter((w) => !STOP.has(w)).map(stem);
const squash = (s: string) => norm(s).replace(/ /g, "");

// which facet of a project a question asks about
const CUES: [Facet, RegExp][] = [
  ["how", /\b(how (does|do|did) (it|this|that|they|he|[a-z]+( [a-z]+)?) work|how it works|explain|walk me through|in detail|under the hood|mechanism|approach|architecture|step by step)\b/],
  ["stack", /\b(built with|made with|written in|tech stack|stack|technolog\w*|languages?|frameworks?|librar(y|ies)|tools?)\b/],
  ["facts", /\b(accura\w*|results?|numbers?|metrics?|performance|benchmark\w*|status|finished|evaluat\w*|tests?|datasets?|stats?|how well|does it work|proven)\b/],
  ["links", /\b(links?|source code|source|code|repo|repository|github|demo|try it|install|download|website|url)\b/],
];
const cue = (q: string): Facet | null => { const n = norm(q); for (const [f, re] of CUES) if (re.test(n)) return f; return null; };
const PRONOUN = /\b(it|its|this|that|the project|this project|that project)\b/;
const MORE = /^(tell me more|more|more details|more info|go on|continue|and|details|elaborate|anything else)\W*$/i;

// technologies people ask about that the site doesn't list (so the answer can say so plainly)
const OTHER_TECH = (
  "rust go golang kotlin swift cpp csharp ruby php scala haskell matlab julia perl tensorflow keras jax django flask fastapi spring " +
  "vue angular svelte aws gcp azure docker kubernetes k8s terraform sql postgres postgresql mysql sqlite redis graphql spark hadoop " +
  "unity flutter android ios javascript html css tailwind firebase supabase langchain opencv"
).split(" ");
const ALIAS: Record<string, string> = { py: "python", ts: "typescript", torch: "pytorch", sklearn: "scikitlearn", scikit: "scikitlearn", mongo: "mongodb", golang: "go", k8s: "kubernetes", postgres: "postgresql", nodejs: "node", js: "javascript", tailwind: "tailwindcss", onnx: "onnxruntime", socketio: "socketio", dsa: "datastructuresandalgorithms", oop: "objectorientedprogramming", oops: "objectorientedprogramming", dbms: "databasemanagementsystems", sh: "bash", shell: "bash" };
const SKILL_INTENT = /\b(know|knows|use|uses|used|using|experience|experienced|familiar|proficient|skilled|worked with|work with|code in|codes in|program in|write|writes|good at)\b/;

const COMMON_NAMES = new Set("datasets data pandas numpy react node core utils docs python website app api cli tools models examples".split(" "));

// ---------------- the example questions' vectors, kept in the browser between visits ----------------
const VEC_STORE = "oms.guide.vectors";
function hash(s: string) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16); }
function saveVectors(key: string, vs: Float32Array[]) {
  try {
    // 8 bits per number and one scale per vector: ~90 KB for the whole set
    const dim = vs[0]?.length ?? 0, bytes = new Int8Array(vs.length * dim), scales: number[] = [];
    vs.forEach((v, i) => { let m = 1e-9; for (const x of v) m = Math.max(m, Math.abs(x)); scales.push(m / 127); for (let d = 0; d < dim; d++) bytes[i * dim + d] = Math.round(v[d] / (m / 127)); });
    let bin = ""; const u = new Uint8Array(bytes.buffer);
    for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode(...u.subarray(i, i + 0x8000));
    localStorage.setItem(VEC_STORE, JSON.stringify({ key, dim, scales, data: btoa(bin) }));
  } catch {}
}
type StoredVectors = { key: string; dim: number; scales: number[]; data: string };
function decodeVectors(j: StoredVectors | null, key: string, n: number): Float32Array[] | null {
  if (!j || j.key !== key || j.scales?.length !== n) return null;
  const bin = atob(j.data), b = new Int8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = (bin.charCodeAt(i) << 24) >> 24;
  return j.scales.map((s, i) => { const v = new Float32Array(j.dim); for (let d = 0; d < j.dim; d++) v[d] = b[i * j.dim + d] * s; return v; });
}
function loadVectors(key: string, n: number): Float32Array[] | null {
  try { return decodeVectors(JSON.parse(localStorage.getItem(VEC_STORE) ?? "null"), key, n); } catch { return null; }
}
/**
 * The same vectors, worked out ahead of time by tools/guide/vectors.mjs and served with the site, so a first visit
 * doesn't spend half a minute on them. Used only when they were made from today's example questions (the key says);
 * otherwise the browser works them out itself.
 */
const SHIPPED = "/guide/vectors.json";
async function fetchVectors(key: string, n: number): Promise<Float32Array[] | null> {
  try { const r = await fetch(SHIPPED, { cache: "no-cache" }); return r.ok ? decodeVectors(await r.json(), key, n) : null; } catch { return null; }
}

export function createEngine(kb: GuideKB) {
  const byId = new Map(kb.cards.map((c) => [c.id, c]));
  const answerable = kb.cards.filter((c) => c.a || c.generic);
  const titles = new Map(kb.projects.map((p) => [p.id, p.title]));

  // ---------------- keywords: BM25 over each card's example questions and keys ----------------
  const docs = answerable.map((c) => {
    const toks = [...c.q.flatMap(terms), ...(c.keys ?? []).flatMap((k) => [stem(norm(k)), stem(norm(k))])];
    const tf = new Map<string, number>();
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { card: c, tf, len: toks.length, keys: new Set((c.keys ?? []).map((k) => stem(norm(k)))) };
  });
  const avgLen = docs.reduce((s, d) => s + d.len, 0) / docs.length;
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const idf = (t: string) => Math.log(1 + (docs.length - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));

  function keywordScores(q: string) {
    const qt = [...new Set(terms(q))];
    return docs.map((d) => {
      let s = 0;
      for (const t of qt) {
        const f = d.tf.get(t);
        if (f) s += idf(t) * ((f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (d.len / avgLen))));
      }
      return { card: d.card, s: s / (s + 4), keyHit: qt.some((t) => d.keys.has(t)) };
    });
  }

  // ---------------- meaning: MiniLM vectors for the example questions ----------------
  // a project's facet cards are left out: the meaning only has to find the project, the word rule picks the facet
  const indexed = answerable.filter((c) => !c.facet || c.facet === "main").flatMap((c) => c.q.map((q) => ({ card: c, q })));
  let embedder: Embedder | null = null;
  let vecs: { card: GuideCard; v: Float32Array }[] = [];
  async function useModel(e: Embedder, onProgress?: (fraction: number) => void) {
    const key = hash("minilm-l6-v2-q8|" + indexed.map((x) => x.q).join("\n"));
    let vs = loadVectors(key, indexed.length);
    if (!vs && (vs = await fetchVectors(key, indexed.length))) saveVectors(key, vs);
    if (!vs) {
      vs = [];
      for (let i = 0; i < indexed.length; i += 16) {
        vs.push(...(await e.embed(indexed.slice(i, i + 16).map((x) => x.q))));
        onProgress?.(Math.min(1, (i + 16) / indexed.length));
      }
      saveVectors(key, vs);
    }
    vecs = indexed.map((x, i) => ({ card: x.card, v: vs![i] }));
    embedder = e;
  }

  // ---------------- rules ----------------
  let lastProject: ProjectId | null = null, lastFacet: Facet = "main";
  const GENERIC_KEYS = new Set(["security", "research", "hardware", "sensor", "chrome", "extension", "education", "educational", "iot", "embedded", "cyber", "workshop", "handoff", "hand-off"]);
  const projectIn = (q: string): ProjectId | null => {
    const qt = new Set(terms(q)), sq = squash(q);
    for (const p of kb.projects) {
      const card = byId.get(p.id);
      if (sq.includes(squash(p.title)) || (card?.keys ?? []).some((k) => !GENERIC_KEYS.has(k) && qt.has(stem(norm(k))))) return p.id;
    }
    return null;
  };
  const skillNames = kb.skills.map((s) => ({ ...s, key: squash(s.name) }));
  function techIn(q: string): { known?: (typeof skillNames)[number]; other?: string } | null {
    const w = words(q), grams = new Set<string>();
    for (let i = 0; i < w.length; i++) { grams.add(ALIAS[w[i]] ?? w[i]); if (i + 1 < w.length) grams.add(w[i] + w[i + 1]); if (i + 2 < w.length) grams.add(w[i] + w[i + 1] + w[i + 2]); }
    const known = skillNames.find((s) => grams.has(s.key) && (s.key.length > 1 || SKILL_INTENT.test(norm(q))));
    if (known) return { known };
    const other = OTHER_TECH.find((t) => grams.has(t));
    return other ? { other } : null;
  }
  function skillAnswer(q: string, project: ProjectId | null): GuideCard | null {
    const t = techIn(q);
    if (!t) return null;
    if (!(SKILL_INTENT.test(norm(q)) || words(q).length <= 3)) return null;
    const raw = t.known?.name ?? t.other!;
    const label = t.known ? raw : raw === "cpp" ? "C++" : raw === "csharp" ? "C#" : raw.charAt(0).toUpperCase() + raw.slice(1);
    if (project) {
      const p = kb.projects.find((x) => x.id === project)!;
      const used = p.stack.some((s) => squash(s).includes(squash(label)));
      return {
        id: `skill:${project}`, project, facet: "stack", action: byId.get(project)?.action, q: [],
        a: used ? `Yes: **${p.title}** is built with ${p.stack.join(", ")}.` : `${p.title} doesn't list **${label}**. It's built with ${p.stack.join(", ")}.`,
        next: [`How does ${p.title} work?`, "What are his skills?"],
      };
    }
    const skills = byId.get("skills")!;
    if (t.known) return { id: "skill:yes", action: skills.action, q: [], a: `Yes: **${t.known.name}** appears in ${t.known.where.join(" and in ")}.`, next: ["What are his skills?", "What does Oscar build?"] };
    return { id: "skill:no", action: skills.action, q: [], a: `**${label}** isn't listed on this site. ${skills.a}`, next: ["What does Oscar build?", "How can I contact him?"] };
  }
  const facetCard = (project: ProjectId, facet: Facet) => byId.get(facet === "main" ? project : `${project}:${facet}`)!;
  const pick: GuideCard = { id: "pick", q: [], a: "Which project do you mean?", next: kb.projects.map((p) => `Tell me about ${p.title}`) };
  const fallback: GuideCard = {
    id: "fallback", q: [],
    a: `I can only answer from what's on this site: Oscar's projects, skills, open-source work, GitHub activity and how to reach him. For anything else, ask Oscar: **${kb.email}**.`,
    next: ["What does Oscar build?", "Show me his security work", "How can I contact him?"],
  };
  const done = (card: GuideCard, score: number, via: Match["via"]): Match => {
    if (card.project) { lastProject = card.project; lastFacet = card.facet ?? "main"; }
    return { card, score, via };
  };

  async function match(question: string): Promise<Match> {
    const q = question.trim(), n = norm(q);
    const named = projectIn(q), pronoun = PRONOUN.test(n);
    // 1. rules: "does he know X?", then "tell me more" about the last project
    const skill = skillAnswer(q, named ?? (pronoun ? lastProject : null));
    if (skill) return done(skill, 1, "rule");
    // "are you a bot?", "is this Oscar?": answered even before the model loads (these are all stop words)
    if (/^(is this|are you|am i (talking|speaking|chatting) (to|with)|who are you|what are you)\b/.test(n)) return done(byId.get("bot")!, 1, "rule");
    if (MORE.test(q)) {
      if (!lastProject) return done(pick, 1, "rule");
      const order: Facet[] = ["main", "facts", "how", "links"];
      return done(facetCard(lastProject, order[(order.indexOf(lastFacet) + 1) % order.length]), 1, "rule");
    }
    // a repository he contributed to, by name ("what did he fix in xarray?"); words that are also ordinary
    // questions ("datasets", "react") are left to the scoring below
    if (!named) {
      const sq = squash(q), qw = new Set(words(q));
      for (const c of answerable) for (const nm of c.names ?? []) {
        const k = squash(nm);
        if (COMMON_NAMES.has(k)) continue;
        if (qw.has(nm.toLowerCase()) || (k.length >= 5 && sq.includes(k))) return done(c, 1, "rule");
      }
    }
    // 2 and 3. keywords, and meaning once the model is ready
    const kw = keywordScores(q);
    let best: GuideCard | null = null, score = 0, via: Match["via"] = embedder ? "meaning" : "keywords";
    if (embedder) {
      const [qv] = await embedder.embed([q]);
      const sem = new Map<GuideCard, number>();
      for (const { card, v } of vecs) {
        let dot = 0;
        for (let d = 0; d < v.length; d++) dot += v[d] * qv[d];
        if (dot > (sem.get(card) ?? -1)) sem.set(card, dot);
      }
      for (const k of kw) {
        const s = (sem.get(k.card) ?? 0) + 0.15 * k.s + (k.keyHit ? 0.08 : 0);
        if (s > score) { best = k.card; score = s; }
      }
      if (score < 0.5) best = null;
    } else {
      for (const k of kw) {
        const s = k.s + (k.keyHit ? 0.3 : 0);
        if (s > score) { best = k.card; score = s; }
      }
      if (score < 0.42) best = null;
    }
    // a project question: which project, then which facet
    const facet = cue(q);
    const project = named ?? best?.project ?? (best?.generic || (pronoun && facet) ? lastProject : null);
    if (project && (named || best?.project || best?.generic || (pronoun && facet))) return done(facetCard(project, facet ?? "main"), score, via);
    if (best?.generic) return done(pick, score, via);
    if (!best) return done(fallback, score, "fallback");
    return done(best, score, via);
  }

  return {
    match,
    useModel,
    get semantic() { return embedder !== null; },
    title: (id: ProjectId) => titles.get(id),
  };
}

export type GuideEngine = ReturnType<typeof createEngine>;
