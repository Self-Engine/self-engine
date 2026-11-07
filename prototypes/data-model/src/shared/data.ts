import { rng } from "./timing.ts";
import { roundingModes, type ObjectType, PAYOUT_COVERS } from "./modules.ts";

export type Obj = {
  id: string;
  type: ObjectType;
  data: Record<string, unknown>;
  custom: Record<string, unknown> | null;
  createdAt: number;
};
export type Bridge = { id: string; kind: string; fromId: string; toId: string; ownerModule: string; createdAt: number };
export type Dataset = { objects: Obj[]; bridges: Bridge[]; customers: string[]; projectIds: string[] };

export const SPACE = "space_1";
export const HISTORY_START = Date.UTC(2021, 10, 1);
export const HISTORY_END = Date.UTC(2026, 10, 1); // 5 years
const DAY = 86_400_000;
const HOUR = 3_600_000;

export const CUSTOMERS = ["ACME", "Globex", "Initech", "Umbrella", "Hooli", "Stark", "Wayne", "Wonka", "Tyrell", "Cyberdyne", "Soylent", "Oscorp"];

/**
 * Deterministic synthetic data shaped like Self-Engine.
 * - 60 projects with hourly rate + rounding, 80 % carry the user field `customer`.
 * - `timeEntries` entries over 5 years, 10 min – 3 h, skewed across projects.
 *   Overlaps are allowed (a single person could not log 200k entries without them).
 * - Payouts per project-month older than 3 months (80 % of those months are paid);
 *   each paid entry gets a `payout.covers` bridge link.
 * - Noise objects (tasks, appointments, cashflows, habit logs) = 1.0 × timeEntries;
 *   some reference projects, some carry `customer`.
 */
export function generate(timeEntries: number, seed = 42): Dataset {
  const r = rng(seed);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;
  const objects: Obj[] = [];
  const bridges: Bridge[] = [];
  const span = HISTORY_END - HISTORY_START;

  const projectIds: string[] = [];
  const rates = new Map<string, number>();
  for (let p = 0; p < 60; p++) {
    const id = `prj_${p}`;
    projectIds.push(id);
    const hourlyRate = 30 + Math.round(r() * 90);
    rates.set(id, hourlyRate);
    objects.push({
      id,
      type: "project",
      data: {
        name: `Project ${p}`,
        hourlyRate,
        currency: "EUR",
        roundingMode: pick(roundingModes),
        roundingIntervalMin: pick([1, 5, 15, 30]),
      },
      custom: r() < 0.8 ? { customer: pick(CUSTOMERS), color: pick(["red", "blue", "green"]) } : null,
      createdAt: HISTORY_START,
    });
  }

  // Skewed project choice: project i has weight 1/(i+1)^0.7
  const weights = projectIds.map((_, i) => 1 / Math.pow(i + 1, 0.7));
  const total = weights.reduce((a, b) => a + b, 0);
  const pickProject = () => {
    let x = r() * total;
    for (let i = 0; i < weights.length; i++) if ((x -= weights[i]!) <= 0) return projectIds[i]!;
    return projectIds[projectIds.length - 1]!;
  };

  // project-month -> entries (for payouts)
  const buckets = new Map<string, { ids: string[]; ms: number; projectId: string; monthEnd: number }>();
  const unpaidCutoff = HISTORY_END - 90 * DAY;
  for (let i = 0; i < timeEntries; i++) {
    const projectId = pickProject();
    const startAt = HISTORY_START + Math.floor((r() * span) / 60_000) * 60_000;
    const endAt = startAt + Math.floor((10 + r() * 170) * 60_000 / 60_000) * 60_000;
    const id = `te_${i}`;
    objects.push({
      id,
      type: "time_entry",
      data: { projectId, startAt, endAt, note: r() < 0.6 ? `worked on item #${Math.floor(r() * 1000)}` : undefined },
      custom: r() < 0.1 ? { customer: pick(CUSTOMERS) } : r() < 0.05 ? { invoiceRef: `INV-${i}` } : null,
      createdAt: endAt,
    });
    if (startAt < unpaidCutoff) {
      const d = new Date(startAt);
      const key = `${projectId}|${d.getUTCFullYear()}-${d.getUTCMonth()}`;
      let b = buckets.get(key);
      if (!b) {
        b = { ids: [], ms: 0, projectId, monthEnd: Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) };
        buckets.set(key, b);
      }
      b.ids.push(id);
      b.ms += endAt - startAt;
    }
  }

  let payoutN = 0;
  for (const b of buckets.values()) {
    if (r() >= 0.8) continue;
    const id = `pay_${payoutN++}`;
    const paidAt = b.monthEnd + 10 * DAY;
    objects.push({
      id,
      type: "payout",
      data: { projectId: b.projectId, amount: Math.round((b.ms / HOUR) * rates.get(b.projectId)! * 100) / 100, currency: "EUR", paidAt },
      custom: null,
      createdAt: paidAt,
    });
    for (const te of b.ids) {
      bridges.push({ id: `lnk_${bridges.length}`, kind: PAYOUT_COVERS, fromId: te, toId: id, ownerModule: "payout", createdAt: paidAt });
    }
  }

  const noise = timeEntries;
  for (let i = 0; i < noise; i++) {
    const at = HISTORY_START + Math.floor(r() * span);
    const k = i % 10; // 3 tasks : 2 appointments : 3 cashflows : 2 habit logs
    const customer = r() < 0.12 ? { customer: pick(CUSTOMERS) } : null;
    if (k < 3) {
      objects.push({
        id: `task_${i}`, type: "task", createdAt: at, custom: customer,
        data: { title: `Task ${i}`, status: pick(["todo", "doing", "done"] as const), dueAt: r() < 0.5 ? at + 7 * DAY : null, projectId: r() < 0.3 ? pickProject() : undefined },
      });
    } else if (k < 5) {
      objects.push({
        id: `apt_${i}`, type: "appointment", createdAt: at, custom: customer,
        data: { title: `Meeting ${i}`, startAt: at, endAt: at + HOUR, projectId: r() < 0.4 ? pickProject() : undefined },
      });
    } else if (k < 8) {
      objects.push({
        id: `cf_${i}`, type: "cashflow", createdAt: at, custom: customer,
        data: { amount: Math.round((r() * 400 - 200) * 100) / 100, currency: "EUR", at, category: pick(["food", "rent", "salary", "travel"]) },
      });
    } else {
      objects.push({
        id: `hl_${i}`, type: "habit_log", createdAt: at, custom: null,
        data: { habitId: `habit_${i % 7}`, at, value: 1 },
      });
    }
  }
  return { objects, bridges, customers: CUSTOMERS, projectIds };
}

/** Strips undefined values so every variant stores the same JSON. */
export function clean(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out;
}
