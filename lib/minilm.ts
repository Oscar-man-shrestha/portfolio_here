// MiniLM in the browser. all-MiniLM-L6-v2 (Apache-2.0, 8-bit, 23 MB) runs on ONNX Runtime Web (MIT) and turns a
// sentence into a 384-number vector, so OMS-mini can compare a visitor's question with its example questions
// by meaning rather than by exact words. Everything is served from this site (public/models, public/vendor); no text
// leaves the browser. The tokenizer below is BERT's uncased WordPiece, which this model was trained with.
import type * as OrtModule from "onnxruntime-web";

const ORT_DIR = "/vendor/ort-1.31.1/";
const MODEL_DIR = "/models/minilm-l6-v2-q8/";
/** Bytes in model.onnx (the server may compress it, so Content-Length can't be used for progress). */
export const MODEL_BYTES = 22972370;
const MAX_TOKENS = 128;

export interface Embedder {
  /** Unit-length sentence vectors; cosine similarity is their dot product. */
  embed(texts: string[]): Promise<Float32Array[]>;
}

async function fetchBytes(url: string, onProgress?: (loaded: number) => void): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`${url}: HTTP ${res.status}`);
  const reader = res.body.getReader(), chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress?.(loaded);
  }
  const out = new Uint8Array(loaded);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

// ---------------- BERT uncased WordPiece ----------------
const isPunct = (ch: string) => {
  const c = ch.codePointAt(0)!;
  return (c >= 33 && c <= 47) || (c >= 58 && c <= 64) || (c >= 91 && c <= 96) || (c >= 123 && c <= 126) || /\p{P}/u.test(ch);
};
const isCJK = (c: number) =>
  (c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3400 && c <= 0x4dbf) || (c >= 0x20000 && c <= 0x2a6df) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0x2f800 && c <= 0x2fa1f);

function basicTokens(text: string): string[] {
  let clean = "";
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c === 0 || c === 0xfffd || (/\p{Cc}/u.test(ch) && !/\s/.test(ch))) continue;
    clean += /\s/.test(ch) ? " " : isCJK(c) ? ` ${ch} ` : ch;
  }
  const out: string[] = [];
  for (const word of clean.toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "").split(" ")) {
    let buf = "";
    for (const ch of word) {
      if (isPunct(ch)) { if (buf) out.push(buf); out.push(ch); buf = ""; } else buf += ch;
    }
    if (buf) out.push(buf);
  }
  return out;
}

function makeTokenizer(vocabText: string) {
  const vocab = new Map<string, number>();
  vocabText.split("\n").forEach((t, i) => { const k = t.replace(/\r$/, ""); if (k) vocab.set(k, i); });
  const id = (t: string) => vocab.get(t)!;
  const UNK = id("[UNK]"), CLS = id("[CLS]"), SEP = id("[SEP]"), PAD = id("[PAD]");
  const piece = (word: string): number[] => {
    if (word.length > 100) return [UNK];
    const ids: number[] = [];
    for (let start = 0; start < word.length; ) {
      let end = word.length, found = -1;
      for (; end > start; end--) {
        const sub = (start > 0 ? "##" : "") + word.slice(start, end);
        const v = vocab.get(sub);
        if (v !== undefined) { found = v; break; }
      }
      if (found < 0) return [UNK];
      ids.push(found);
      start = end;
    }
    return ids;
  };
  return {
    PAD,
    encode(text: string): number[] {
      const ids = basicTokens(text).flatMap(piece).slice(0, MAX_TOKENS - 2);
      return [CLS, ...ids, SEP];
    },
  };
}

/** Loads ONNX Runtime, the model and the vocabulary. `onProgress` gets 0..1 for the model download. */
export async function loadEmbedder(onProgress?: (fraction: number) => void): Promise<Embedder> {
  // served as a static file and imported at run time, so the bundler leaves it alone
  const ort = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ `${ORT_DIR}ort.wasm.min.mjs`)) as typeof OrtModule;
  ort.env.wasm.wasmPaths = ORT_DIR;
  ort.env.wasm.numThreads = 1; // threads need cross-origin isolation, which this site doesn't set
  ort.env.wasm.proxy = true; // run the model in a web worker, so the page never stutters while it works
  const [model, vocabText] = await Promise.all([
    fetchBytes(`${MODEL_DIR}model.onnx`, (n) => onProgress?.(Math.min(1, n / MODEL_BYTES))),
    fetch(`${MODEL_DIR}vocab.txt`).then((r) => { if (!r.ok) throw new Error(`vocab: HTTP ${r.status}`); return r.text(); }),
  ]);
  // "basic" builds the session in under half a second; "all" took seven and ran no faster
  const session = await ort.InferenceSession.create(model, { executionProviders: ["wasm"], graphOptimizationLevel: "basic" });
  const tok = makeTokenizer(vocabText);
  const inputs = new Set(session.inputNames);
  const outName = session.outputNames.includes("last_hidden_state") ? "last_hidden_state" : session.outputNames[0];

  return {
    async embed(texts) {
      if (!texts.length) return [];
      const enc = texts.map((t) => tok.encode(t));
      const len = Math.max(...enc.map((e) => e.length)), n = enc.length;
      const ids = new BigInt64Array(n * len), mask = new BigInt64Array(n * len);
      enc.forEach((e, r) => e.forEach((v, c) => { ids[r * len + c] = BigInt(v); mask[r * len + c] = BigInt(1); }));
      if (tok.PAD !== 0) for (let i = 0; i < ids.length; i++) if (mask[i] === BigInt(0)) ids[i] = BigInt(tok.PAD);
      const feeds: Record<string, OrtModule.Tensor> = {};
      if (inputs.has("input_ids")) feeds.input_ids = new ort.Tensor("int64", ids, [n, len]);
      if (inputs.has("attention_mask")) feeds.attention_mask = new ort.Tensor("int64", mask, [n, len]);
      if (inputs.has("token_type_ids")) feeds.token_type_ids = new ort.Tensor("int64", new BigInt64Array(n * len), [n, len]);
      const out = (await session.run(feeds))[outName];
      const h = out.data as Float32Array, dim = out.dims[2] as number;
      // mean over the real tokens, then scale to unit length
      return enc.map((e, r) => {
        const v = new Float32Array(dim);
        for (let t = 0; t < e.length; t++) for (let d = 0; d < dim; d++) v[d] += h[(r * len + t) * dim + d];
        let norm = 0;
        for (let d = 0; d < dim; d++) { v[d] /= e.length; norm += v[d] * v[d]; }
        norm = Math.sqrt(norm) || 1;
        for (let d = 0; d < dim; d++) v[d] /= norm;
        return v;
      });
    },
  };
}
