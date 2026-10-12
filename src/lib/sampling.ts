import type { Question, DomainConfig } from "../types";
import { domainForCategory } from "./scoring";

/** Questions that can be served in a quiz. */
export function playable(questions: Question[]): Question[] {
  return questions.filter((q) => !q.disabled);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Stratified sample matching domain weights. Rounding drift absorbed by largest domain. */
export function buildWeightedExam(
  questions: Question[],
  domains: DomainConfig[],
  count: number
): Question[] {
  const byDomain: Record<string, Question[]> = {};
  for (const d of domains) byDomain[d.name] = [];
  for (const q of questions) {
    const dname = domainForCategory(domains, q.category);
    if (byDomain[dname]) byDomain[dname].push(q);
  }
  const targets: Record<string, number> = {};
  let allocated = 0;
  for (const d of domains) {
    targets[d.name] = Math.round(d.weight * count);
    allocated += targets[d.name];
  }
  const drift = count - allocated;
  if (drift !== 0) {
    const largest = [...domains].sort((a, b) => b.weight - a.weight)[0];
    if (largest) targets[largest.name] += drift;
  }
  const selection: Question[] = [];
  for (const [name, n] of Object.entries(targets)) {
    const pool = shuffle(byDomain[name] || []);
    selection.push(...pool.slice(0, Math.min(n, pool.length)));
  }
  return shuffle(selection);
}

export function buildRandomExam(
  questions: Question[],
  count: number,
  category: string
): Question[] {
  let pool = questions;
  if (category && category !== "all") {
    pool = pool.filter((q) => q.category === category);
  }
  return shuffle(pool).slice(0, Math.min(count, pool.length));
}
