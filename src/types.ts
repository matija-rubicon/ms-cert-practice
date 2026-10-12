export type QuestionType = "single" | "multiple";

export interface Option {
  text: string;
  correct: boolean;
  /** Command or snippet; rendered monospaced. */
  code?: boolean;
}

export interface Question {
  id: string;
  type: QuestionType;
  category: string;
  page?: number | null;
  question_html: string;
  options: Option[];
  explanation_html?: string;
  /** Can't be answered as presented (e.g. exhibit missing); excluded from quizzes. */
  disabled?: boolean;
  disabled_reason?: string;
}

export interface DomainConfig {
  /** Display name e.g. "Pipelines" */
  name: string;
  /** Midpoint weight (0..1) from official exam blueprint */
  weight: number;
  /** Categories from the bank that belong to this domain */
  categories: string[];
}

export interface ExamManifestEntry {
  id: string;
  /** Microsoft exam code, e.g. "AZ-400" */
  code: string;
  /** Full title */
  title: string;
  description: string;
  /** True if questions.json is present; false = stub/coming-soon */
  available: boolean;
  /** 0..1000, default 0.7 (i.e. 700) */
  passingScaled: number;
  defaultQuestionCount: number;
  defaultTimeMinutes: number;
  domains: DomainConfig[];
}

export interface ExamManifest {
  exams: ExamManifestEntry[];
}

export type SessionMode = "exam" | "quick";

export interface QuestionScore {
  earned: number;
  max: number;
  fullyCorrect: boolean;
}

export interface DomainBreakdown {
  earned: number;
  max: number;
  count: number;
  correct: number;
}

export interface Attempt {
  id: number;
  examId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  mode: SessionMode;
  category: string | null;
  timeLimitMs: number | null;
  questionCount: number;
  earned: number;
  max: number;
  scaled: number;
  pass: boolean;
  perDomain: Record<string, DomainBreakdown>;
  perCat: Record<string, DomainBreakdown>;
  questionIds: string[];
  answers: number[][];
  perQ: QuestionScore[];
}
