// Toy maths for the Malware Fingerprint demo. The six behaviour categories come from the project README; the two
// "families" are made up for the demo. Features follow the README's three axes: Jensen-Shannon divergence,
// entropy-rate gap and stationary-distribution L1 distance. (The demo's JS is row-wise and weighted by the
// stationary distribution; the project's exact implementation may differ.)
export const STATES = ["FILE", "REGISTRY", "NETWORK", "PROCESS", "MEMORY", "CRYPTO"] as const;
export const N = STATES.length;
export type Fam = "A" | "B";
type M = number[][];

const KERNELS: Record<Fam, M> = {
  A: [
    [0.3, 0.1, 0.05, 0.1, 0.05, 0.4],
    [0.4, 0.3, 0.05, 0.1, 0.1, 0.05],
    [0.2, 0.1, 0.3, 0.2, 0.1, 0.1],
    [0.3, 0.2, 0.1, 0.2, 0.1, 0.1],
    [0.2, 0.1, 0.1, 0.2, 0.3, 0.1],
    [0.55, 0.1, 0.05, 0.05, 0.05, 0.2],
  ],
  B: [
    [0.2, 0.05, 0.4, 0.15, 0.15, 0.05],
    [0.1, 0.2, 0.3, 0.25, 0.1, 0.05],
    [0.05, 0.05, 0.3, 0.35, 0.2, 0.05],
    [0.05, 0.05, 0.25, 0.2, 0.4, 0.05],
    [0.05, 0.05, 0.45, 0.25, 0.15, 0.05],
    [0.1, 0.05, 0.4, 0.2, 0.2, 0.05],
  ],
};

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function trace(fam: Fam, len: number, noise: number, r: () => number): number[] {
  const K = KERNELS[fam];
  const out = [Math.floor(r() * N)];
  for (let i = 1; i < len; i++) {
    if (r() < noise) { out.push(Math.floor(r() * N)); continue; }
    const row = K[out[i - 1]];
    let x = r(), j = 0;
    while (j < N - 1 && x > row[j]) { x -= row[j]; j++; }
    out.push(j);
  }
  return out;
}

export function counts(traces: number[][]): M {
  const C = Array.from({ length: N }, () => new Array(N).fill(0));
  for (const t of traces) for (let i = 1; i < t.length; i++) C[t[i - 1]][t[i]]++;
  return C;
}

export function normalize(C: M, eps = 1e-6): M {
  return C.map((row) => {
    const s = row.reduce((a, b) => a + b + eps, 0);
    return row.map((v) => (v + eps) / s);
  });
}

export function stationary(P: M): number[] {
  let pi = new Array(N).fill(1 / N);
  for (let k = 0; k < 300; k++) {
    const nx = new Array(N).fill(0);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) nx[j] += pi[i] * P[i][j];
    pi = nx;
  }
  return pi;
}

export const entropyRate = (P: M, pi: number[]) =>
  -pi.reduce((acc, p, i) => acc + p * P[i].reduce((s, q) => s + (q > 0 ? q * Math.log(q) : 0), 0), 0);

function js(p: number[], q: number[]) {
  let a = 0, b = 0;
  for (let i = 0; i < p.length; i++) {
    const m = (p[i] + q[i]) / 2;
    if (p[i] > 0) a += p[i] * Math.log(p[i] / m);
    if (q[i] > 0) b += q[i] * Math.log(q[i] / m);
  }
  return 0.5 * a + 0.5 * b;
}

export interface Ref { P: M; pi: number[]; H: number }

export function makeRef(P: M): Ref {
  const pi = stationary(P);
  return { P, pi, H: entropyRate(P, pi) };
}

/** Family references by count pooling (the README's maximum-likelihood construction), from made-up traces. */
export function familyRefs(seed = 7): Record<Fam, Ref> {
  const r = rng(seed);
  const pool = (f: Fam) => makeRef(normalize(counts(Array.from({ length: 30 }, () => trace(f, 150, 0.1, r)))));
  return { A: pool("A"), B: pool("B") };
}

export function features(q: Ref, ref: Ref): [number, number, number] {
  const jsw = q.pi.reduce((acc, p, i) => acc + p * js(q.P[i], ref.P[i]), 0);
  const dH = Math.abs(q.H - ref.H);
  const l1 = q.pi.reduce((acc, p, i) => acc + Math.abs(p - ref.pi[i]), 0);
  return [jsw, dH, l1];
}

export const norm3 = (f: [number, number, number]) => Math.hypot(f[0], f[1], f[2]);
