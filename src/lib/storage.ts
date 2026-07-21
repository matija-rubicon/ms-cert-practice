import type { Attempt } from "../types";

const HISTORY_KEY = "mscert.history.v1";
const MAX_HISTORY = 200;

export function loadHistory(): Attempt[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAttempt(a: Attempt): void {
  const h = loadHistory();
  h.unshift(a);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, MAX_HISTORY)));
}

export function deleteAttempt(id: number): void {
  const h = loadHistory().filter((x) => x.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}

export function historyForExam(examId: string): Attempt[] {
  return loadHistory().filter((x) => x.examId === examId);
}
