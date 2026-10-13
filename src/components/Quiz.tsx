import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ExamManifest, Question, Attempt, SessionMode, QuestionScore, DomainBreakdown } from "../types";
import { buildRandomExam, buildWeightedExam, playable, questionPool } from "../lib/sampling";
import { scoreQuestion, toScaled, domainForCategory } from "../lib/scoring";
import { saveAttempt, loadSession, saveSession, clearSession } from "../lib/storage";
import { fmtDuration } from "../lib/format";
import { renderHtml } from "../lib/html";
import Modal from "./Modal";

interface Props { manifest: ExamManifest; }
interface StartConfig {
  mode: SessionMode;
  count: number;
  minutes?: number;
  category?: string;
  /** Leave out authored (non-bank) questions */
  bankOnly?: boolean;
}

interface QuizState {
  questions: Question[];
  answers: number[][];
  flags: boolean[];
  revealed: boolean[];
  current: number;
  startedAt: number;
  timeLimitMs: number | null;
  mode: SessionMode;
  category: string | null;
  bankOnly: boolean;
}

export default function Quiz({ manifest }: Props) {
  const { examId } = useParams<{ examId: string }>();
  const exam = manifest.exams.find((e) => e.id === examId);
  const nav = useNavigate();
  const [state, setState] = useState<QuizState | null>(null);
  const [now, setNow] = useState(Date.now());
  const [submitOpen, setSubmitOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const initialized = useRef(false);

  // Load bank + start config, build session.
  useEffect(() => {
    if (initialized.current || !exam) return;
    initialized.current = true;
    const saved = loadSession(exam.id);
    const raw = sessionStorage.getItem(`mscert.start.${exam.id}`);
    if (!saved && !raw) { nav(`/exam/${exam.id}`, { replace: true }); return; }
    let cfg: StartConfig = { mode: "quick", count: 0 };
    if (!saved) {
      try { cfg = JSON.parse(raw!); } catch { nav(`/exam/${exam.id}`, { replace: true }); return; }
    }

    fetch(`exams/${exam.id}/questions.json`)
      .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then((all: Question[]) => {
        // Resume an in-progress session (e.g. after an accidental refresh)
        if (saved) {
          const byId = new Map(all.map((q) => [q.id, q]));
          const resumed = saved.questionIds.map((id) => byId.get(id));
          if (resumed.length > 0 && resumed.every(Boolean)) {
            const { questionIds: _ids, ...rest } = saved;
            setState({ ...rest, bankOnly: rest.bankOnly ?? false, questions: resumed as Question[] });
            return;
          }
          clearSession(exam.id);
          if (!raw) { nav(`/exam/${exam.id}`, { replace: true }); return; }
          try { cfg = JSON.parse(raw); } catch { nav(`/exam/${exam.id}`, { replace: true }); return; }
        }
        const qs = questionPool(playable(all), cfg.bankOnly ?? false);
        const questions = cfg.mode === "exam"
          ? buildWeightedExam(qs, exam.domains, cfg.count)
          : buildRandomExam(qs, cfg.count, cfg.category || "all");
        if (questions.length === 0) {
          setLoadError("No questions matched the filter.");
          return;
        }
        setState({
          questions,
          answers: questions.map(() => []),
          flags: questions.map(() => false),
          revealed: questions.map(() => false),
          current: 0,
          startedAt: Date.now(),
          timeLimitMs: cfg.mode === "exam" && cfg.minutes ? cfg.minutes * 60 * 1000 : null,
          mode: cfg.mode,
          category: cfg.category || null,
          bankOnly: cfg.bankOnly ?? false,
        });
      })
      .catch((e) => setLoadError(String(e.message || e)));
  }, [exam, nav]);

  // Persist progress on every change
  useEffect(() => {
    if (!state || !exam) return;
    const { questions, ...rest } = state;
    saveSession(exam.id, { ...rest, questionIds: questions.map((q) => q.id), updatedAt: Date.now() });
  }, [state, exam]);

  // Jump back to the top whenever the user moves to another question
  const current = state?.current;
  useEffect(() => { window.scrollTo(0, 0); }, [current]);

  // Timer tick
  useEffect(() => {
    if (!state || !state.timeLimitMs) return;
    const iv = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(iv);
  }, [state]);

  // Auto-submit when timer hits zero
  useEffect(() => {
    if (!state || !state.timeLimitMs) return;
    const remaining = state.timeLimitMs - (now - state.startedAt);
    if (remaining <= 0) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  if (!exam) return <div className="card"><p>Unknown exam.</p></div>;
  if (loadError) return (
    <div className="card">
      <h2>Could not start quiz</h2>
      <p>{loadError}</p>
      <button className="btn-secondary" onClick={() => nav(`/exam/${exam.id}`)}>← Back</button>
    </div>
  );
  if (!state) return <div className="card"><p>Preparing questions…</p></div>;

  const i = state.current;
  const q = state.questions[i];
  const picked = state.answers[i];
  const revealed = state.revealed[i];
  const isMulti = q.type === "multiple";
  const total = state.questions.length;

  const remaining = state.timeLimitMs ? state.timeLimitMs - (now - state.startedAt) : null;
  const timerCls = remaining == null
    ? ""
    : remaining <= 2 * 60 * 1000 ? "danger"
    : remaining <= 10 * 60 * 1000 ? "warning"
    : "";

  const setPicked = (newPicks: number[]) => {
    setState((s) => {
      if (!s) return s;
      const ans = s.answers.slice();
      ans[i] = newPicks;
      return { ...s, answers: ans };
    });
  };

  const toggleOption = (idx: number) => {
    if (revealed) return;
    if (isMulti) {
      if (picked.includes(idx)) setPicked(picked.filter((x) => x !== idx));
      else setPicked([...picked, idx]);
    } else {
      setPicked([idx]);
    }
  };

  const toggleFlag = () => {
    setState((s) => {
      if (!s) return s;
      const flags = s.flags.slice();
      flags[i] = !flags[i];
      return { ...s, flags };
    });
  };

  const reveal = () => {
    setState((s) => {
      if (!s) return s;
      const r = s.revealed.slice();
      r[i] = true;
      return { ...s, revealed: r };
    });
  };

  const goto = (idx: number) => setState((s) => s ? { ...s, current: idx } : s);

  const finish = () => {
    if (!state) return;
    let earned = 0, max = 0;
    const perQ: QuestionScore[] = [];
    const perDomain: Record<string, DomainBreakdown> = {};
    const perCat: Record<string, DomainBreakdown> = {};

    state.questions.forEach((qq, idx) => {
      const s = scoreQuestion(qq, state.answers[idx]);
      earned += s.earned; max += s.max;
      perQ.push(s);
      const d = domainForCategory(exam.domains, qq.category);
      perDomain[d] = perDomain[d] || { earned: 0, max: 0, count: 0, correct: 0 };
      perDomain[d].earned += s.earned;
      perDomain[d].max += s.max;
      perDomain[d].count += 1;
      perDomain[d].correct += s.fullyCorrect ? 1 : 0;
      perCat[qq.category] = perCat[qq.category] || { earned: 0, max: 0, count: 0, correct: 0 };
      perCat[qq.category].earned += s.earned;
      perCat[qq.category].max += s.max;
      perCat[qq.category].count += 1;
      perCat[qq.category].correct += s.fullyCorrect ? 1 : 0;
    });

    const scaled = toScaled(earned, max);
    const attempt: Attempt = {
      id: Date.now(),
      examId: exam.id,
      startedAt: new Date(state.startedAt).toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - state.startedAt,
      mode: state.mode,
      category: state.category,
      bankOnly: state.bankOnly,
      timeLimitMs: state.timeLimitMs,
      questionCount: total,
      earned, max, scaled,
      pass: scaled >= exam.passingScaled,
      perDomain, perCat,
      questionIds: state.questions.map((qq) => qq.id),
      answers: state.answers,
      perQ,
    };

    if (state.mode === "exam" || total >= 10) saveAttempt(attempt);
    clearSession(exam.id);
    sessionStorage.setItem(`mscert.last.${exam.id}`, JSON.stringify(attempt));
    sessionStorage.setItem(`mscert.lastqs.${exam.id}`, JSON.stringify(state.questions));
    nav(`/exam/${exam.id}/results`);
  };

  const answeredCount = state.answers.filter((a) => a.length > 0).length;
  const flaggedCount = state.flags.filter(Boolean).length;
  const unanswered = total - answeredCount;

  return (
    <div className="quiz-layout">
      <div className="quiz-main">
        <div className="card">
          <div className="q-header">
            <span className="q-num">Q{i + 1} of {total}</span>
            <span className="q-cat">{q.category}</span>
            {isMulti && <span className="q-multi">Select all that apply</span>}
            <button
              className={`q-flag ${state.flags[i] ? "flagged" : ""}`}
              onClick={toggleFlag}
            >
              {state.flags[i] ? "★ Flagged" : "☆ Flag"}
            </button>
          </div>

          <div className="q-text" dangerouslySetInnerHTML={{ __html: renderHtml(q.question_html, exam.id) }} />

          <ul className="options">
            {q.options.map((opt, idx) => {
              const sel = picked.includes(idx);
              let cls = "";
              if (revealed) {
                if (opt.correct && sel) cls = " correct";
                else if (!opt.correct && sel) cls = " wrong";
                else if (opt.correct && !sel) cls = " should";
              } else if (sel) cls = " selected";
              return (
                <li key={idx}>
                  <label className={`opt-label${cls}${revealed ? " disabled" : ""}`}>
                    <input
                      type={isMulti ? "checkbox" : "radio"}
                      checked={sel}
                      disabled={revealed}
                      onChange={() => toggleOption(idx)}
                    />
                    <span className={`opt-text${opt.code ? " opt-code" : ""}`}>{opt.text}</span>
                  </label>
                </li>
              );
            })}
          </ul>

          {revealed && q.explanation_html && (
            <div className="explanation">
              <strong>Explanation</strong><br />
              <span dangerouslySetInnerHTML={{ __html: renderHtml(q.explanation_html, exam.id) }} />
            </div>
          )}

          <div className="nav-row">
            <div>
              <button className="btn-ghost" disabled={i === 0} onClick={() => goto(i - 1)}>← Prev</button>
              {i < total - 1 ? (
                <button className="btn-secondary" onClick={() => goto(i + 1)}>Next →</button>
              ) : (
                <button className="btn-primary" onClick={() => setSubmitOpen(true)}>
                  {state.mode === "exam" ? "Submit exam" : "Finish & score"}
                </button>
              )}
            </div>
            <div>
              {state.mode === "quick" && !revealed && (
                <button className="btn-primary" disabled={picked.length === 0} onClick={reveal}>Check answer</button>
              )}
            </div>
          </div>
        </div>
      </div>

      <aside className="quiz-side">
        {remaining != null && (
          <div className={`side-timer ${timerCls}`}>{fmtDuration(Math.max(0, remaining))}</div>
        )}
        <div className="side-card">
          <div className="side-progress">
            <span>{answeredCount}/{total} answered</span>
            {flaggedCount > 0 && <span style={{ color: "var(--amber)" }}>★ {flaggedCount}</span>}
          </div>
          <div className="qgrid">
            {state.questions.map((_, idx) => {
              const answered = state.answers[idx].length > 0;
              const flagged = state.flags[idx];
              const cur = idx === i;
              const reviewed = state.revealed[idx];
              let cls = "";
              if (cur) cls += " current";
              if (flagged) cls += " flagged";
              else if (answered) cls += " answered";
              if (state.mode === "quick" && reviewed) {
                const s = scoreQuestion(state.questions[idx], state.answers[idx]);
                cls += s.fullyCorrect ? " correct" : " wrong";
              }
              return (
                <button key={idx} className={cls.trim()} onClick={() => goto(idx)}>{idx + 1}</button>
              );
            })}
          </div>
          <div className="side-legend">
            <span><i className="answered"></i>answered</span>
            <span><i className="flagged"></i>flagged</span>
            <span><i className="unanswered"></i>unseen</span>
          </div>
        </div>
        <button className="btn-primary side-submit" onClick={() => setSubmitOpen(true)}>
          {state.mode === "exam" ? "Submit exam" : "Finish & score"}
        </button>
      </aside>

      {submitOpen && (
        <Modal
          title="Submit?"
          body={
            unanswered > 0
              ? `You have ${unanswered} unanswered question${unanswered === 1 ? "" : "s"}. Submit anyway?`
              : `Submit and score this ${state.mode === "exam" ? "exam" : "quiz"}?`
          }
          confirmText="Submit"
          onCancel={() => setSubmitOpen(false)}
          onConfirm={() => { setSubmitOpen(false); finish(); }}
        />
      )}
    </div>
  );
}
