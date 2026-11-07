export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function percentile(xs: number[], p: number): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!;
}

export function time<T>(fn: () => T): { ms: number; result: T } {
  const t0 = performance.now();
  const result = fn();
  return { ms: performance.now() - t0, result };
}

/** Runs fn `warmup` times untimed, then `runs` times timed; returns all samples. */
export function sample(fn: (i: number) => unknown, runs: number, warmup = 2): number[] {
  for (let i = 0; i < warmup; i++) fn(-1 - i);
  const out: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    fn(i);
    out.push(performance.now() - t0);
  }
  return out;
}

export function rng(seed: number): () => number {
  // mulberry32
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
