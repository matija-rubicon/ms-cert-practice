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

/** In-progress quiz, so an accidental refresh resumes instead of starting over. */
export interface SavedSession {
  questionIds: string[];
  answers: number[][];
  flags: boolean[];
  revealed: boolean[];
  current: number;
  startedAt: number;
  timeLimitMs: number | null;
  mode: "exam" | "quick";
  category: string | null;
}

const sessionKey = (examId: string) => `mscert.session.${examId}`;

export function loadSession(examId: string): SavedSession | null {
  try {
    const raw = localStorage.getItem(sessionKey(examId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(examId: string, s: SavedSession): void {
  try { localStorage.setItem(sessionKey(examId), JSON.stringify(s)); } catch { /* storage full/blocked */ }
}

export function clearSession(examId: string): void {
  try { localStorage.removeItem(sessionKey(examId)); } catch { /* ignore */ }
}
