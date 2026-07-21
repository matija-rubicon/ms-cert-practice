import type { Question, QuestionScore, DomainConfig } from "../types";

/**
 * Microsoft scoring model (approximation):
 *  - 1 point per correct component
 *  - Multi-select: partial credit (1 pt per option matched correctly)
 *  - Single-select: 1 pt total, all-or-nothing
 *  - Scaled = round((earned / max) * 1000)
 *  - Pass = scaled >= 700 (default; configurable per exam)
 *
 * The real exam uses psychometric equating that adjusts difficulty per
 * delivered form; this app cannot replicate that, so we approximate with
 * a flat raw-to-scaled mapping.
 */
export function scoreQuestion(q: Question, picked: number[]): QuestionScore {
  if (q.type === "single") {
    const correctIdx = q.options.findIndex((o) => o.correct);
    const earned = picked.length === 1 && picked[0] === correctIdx ? 1 : 0;
    return { earned, max: 1, fullyCorrect: earned === 1 };
  }
  const max = q.options.length;
  let earned = 0;
  q.options.forEach((opt, i) => {
    const isPicked = picked.includes(i);
    if (opt.correct === isPicked) earned += 1;
  });
  return { earned, max, fullyCorrect: earned === max };
}

export function toScaled(earned: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round((earned / max) * 1000);
}

export function domainForCategory(
  domains: DomainConfig[],
  category: string
): string {
  for (const d of domains) {
    if (d.categories.includes(category)) return d.name;
  }
  return "Other";
}
