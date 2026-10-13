import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { ExamManifest, Attempt, Question } from "../types";
import { loadHistory, clearSession } from "../lib/storage";
import { fmtDuration } from "../lib/format";
import { renderHtml } from "../lib/html";
import { domainForCategory } from "../lib/scoring";

interface Props { manifest: ExamManifest; reviewMode?: boolean; }

interface LoadedState {
  attempt?: Attempt;
  questions?: Question[];
  error?: string;
}

export default function Results({ manifest, reviewMode = false }: Props) {
  const { examId, attemptId } = useParams<{ examId: string; attemptId?: string }>();
  const exam = manifest.exams.find((e) => e.id === examId);
  const nav = useNavigate();
  const [state, setState] = useState<LoadedState>({});
  // Review list filters: domain picked in the breakdown, and missed-only vs all
  const [domainFilter, setDomainFilter] = useState<string | null>(null);
  const [missedOnly, setMissedOnly] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exam) return;
    if (reviewMode && attemptId) {
      const a = loadHistory().find((x) => x.id === parseInt(attemptId, 10));
      if (!a) { setState({ error: "Attempt not found" }); return; }
      fetch(`exams/${exam.id}/questions.json`)
        .then((r) => r.json())
        .then((qs: Question[]) => {
          const byId = new Map(qs.map((q) => [q.id, q]));
          const sel = a.questionIds.map((id) => byId.get(id)).filter((x): x is Question => !!x);
          setState({ attempt: a, questions: sel });
        })
        .catch((e) => setState({ error: String(e.message || e) }));
    } else {
      const raw = sessionStorage.getItem(`mscert.last.${exam.id}`);
      const qraw = sessionStorage.getItem(`mscert.lastqs.${exam.id}`);
      if (!raw || !qraw) { nav(`/exam/${exam.id}`, { replace: true }); return; }
      try {
        setState({ attempt: JSON.parse(raw), questions: JSON.parse(qraw) });
      } catch {
        nav(`/exam/${exam.id}`, { replace: true });
      }
    }
  }, [exam, attemptId, reviewMode, nav]);

  if (!exam) return <div className="card"><p>Unknown exam.</p></div>;
  if (state.error) return (
    <div className="card">
      <h2>Could not load results</h2>
      <p>{state.error}</p>
      <Link to={`/exam/${exam.id}`} className="btn-secondary" style={{ padding: "9px 18px", borderRadius: 6, border: "1px solid var(--azure)", textDecoration: "none" }}>← Back</Link>
    </div>
  );
  if (!state.attempt || !state.questions) return <div className="card"><p>Loading…</p></div>;

  const r = state.attempt;
  const questions = state.questions;
  const correctCount = r.perQ.filter((x) => x.fullyCorrect).length;
  const partialCount = r.perQ.filter((x) => !x.fullyCorrect && x.earned > 0).length;
  const wrongCount = r.perQ.filter((x) => x.earned === 0).length;

  const allQs = r.perQ.map((s, idx) => ({
    s, idx, q: questions[idx], picked: r.answers[idx],
    domain: domainForCategory(exam.domains, questions[idx].category),
  }));
  const missedCount = allQs.filter((x) => !x.s.fullyCorrect).length;
  const shownQs = allQs
    .filter((x) => !missedOnly || !x.s.fullyCorrect)
    .filter((x) => !domainFilter || x.domain === domainFilter);

  const pickDomain = (name: string) => {
    setDomainFilter((d) => (d === name ? null : name));
    requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const retake = () => {
    if (state.questions && exam) {
      // Stash a "retake set" config + re-run by feeding sessionStorage like a normal start
      const cfg = r.mode === "exam"
        ? { mode: "exam", count: r.questionCount, minutes: r.timeLimitMs ? r.timeLimitMs / 60000 : exam.defaultTimeMinutes, bankOnly: r.bankOnly }
        : { mode: "quick", count: r.questionCount, category: r.category || "all", bankOnly: r.bankOnly };
      clearSession(exam.id);
      sessionStorage.setItem(`mscert.start.${exam.id}`, JSON.stringify(cfg));
      nav(`/exam/${exam.id}/quiz`);
    }
  };

  return (
    <>
      <div className="results-layout">
        <div className="card">
          <div className="score-ring">
            <div className="score-label">SCALED SCORE</div>
            <div className={`score-big ${r.pass ? "pass" : "fail"}`}>
              {r.scaled}<span style={{ fontSize: 28, color: "var(--muted)", letterSpacing: 0 }}>/1000</span>
            </div>
            <div style={{ fontSize: 18, color: "var(--muted)", marginTop: -4, marginBottom: 8 }}>
              {r.max > 0 ? ((r.earned / r.max) * 100).toFixed(2) : "0.00"}%
            </div>
            <div className={`score-verdict ${r.pass ? "pass" : "fail"}`}>
              {r.pass ? "✓ PASS" : "✗ FAIL"} · need {exam.passingScaled}
            </div>
          </div>
          <div className="stat-grid">
            <div className="stat"><div className="stat-val" style={{ color: "var(--green)" }}>{correctCount}</div><div className="stat-lbl">Fully correct</div></div>
            <div className="stat"><div className="stat-val" style={{ color: "var(--amber)" }}>{partialCount}</div><div className="stat-lbl">Partial credit</div></div>
            <div className="stat"><div className="stat-val" style={{ color: "var(--red)" }}>{wrongCount}</div><div className="stat-lbl">Wrong / blank</div></div>
            <div className="stat"><div className="stat-val">{Math.round(r.earned)}<span style={{ fontSize: 13, color: "var(--muted)" }}>/{r.max}</span></div><div className="stat-lbl">Raw points</div></div>
            <div className="stat" style={{ gridColumn: "1 / -1" }}><div className="stat-val">{fmtDuration(r.durationMs)}</div><div className="stat-lbl">Time taken</div></div>
          </div>
        </div>

        <div className="card">
          <h3>Breakdown by domain</h3>
          <p className="hint">Tap a domain to review its questions.</p>
          {Object.entries(r.perDomain)
            .sort((a, b) => b[1].count - a[1].count)
            .map(([name, s]) => {
              const pct = s.max > 0 ? Math.round((s.earned / s.max) * 100) : 0;
              const color = pct >= 70 ? "var(--green)" : pct >= 50 ? "var(--amber)" : "var(--red)";
              return (
                <button
                  type="button"
                  className={`breakdown-row${domainFilter === name ? " active" : ""}`}
                  key={name}
                  aria-pressed={domainFilter === name}
                  onClick={() => pickDomain(name)}
                >
                  <div>{name}</div>
                  <div>{s.correct}/{s.count}</div>
                  <div style={{ textAlign: "right", color, fontWeight: 600 }}>{pct}%</div>
                  <div className="breakdown-bar"><div style={{ width: `${pct}%`, background: color }} /></div>
                </button>
              );
            })}
          <div className="nav-row" style={{ marginTop: 22 }}>
            <div>
              <button className="btn-ghost" onClick={() => nav(reviewMode ? `/exam/${exam.id}/history` : `/exam/${exam.id}`)}>
                ← {reviewMode ? "History" : "Home"}
              </button>
            </div>
            <div>
              {!reviewMode && <button className="btn-secondary" onClick={retake}>Retake shape</button>}
              <Link to={`/exam/${exam.id}`} className="btn-primary" style={{ textDecoration: "none", padding: "9px 18px", borderRadius: 6 }}>New exam</Link>
            </div>
          </div>
        </div>
      </div>

      <div className="page" style={{ marginTop: 16 }} ref={listRef}>
          <div className="card review-head">
            <h3>
              {missedOnly ? "Missed questions" : "All questions"}
              {domainFilter && <> · {domainFilter}</>} ({shownQs.length})
            </h3>
            <div className="review-filters">
              <div className="seg" role="group" aria-label="Show">
                <button className={missedOnly ? "on" : ""} aria-pressed={missedOnly} onClick={() => setMissedOnly(true)}>
                  Missed ({missedCount})
                </button>
                <button className={!missedOnly ? "on" : ""} aria-pressed={!missedOnly} onClick={() => setMissedOnly(false)}>
                  All ({allQs.length})
                </button>
              </div>
              {domainFilter && (
                <button className="chip" onClick={() => setDomainFilter(null)} aria-label="Clear domain filter">
                  {domainFilter} ×
                </button>
              )}
            </div>
            <p className="hint">Your wrong picks are red, correct answers you missed are dashed green.</p>
          </div>
          {shownQs.length === 0 && (
            <div className="card">
              <p className="hint" style={{ margin: 0 }}>
                {missedOnly ? "Nothing missed here — all correct." : "No questions in this domain."}
              </p>
            </div>
          )}
          {shownQs.map(({ s, idx, q, picked }) => (
            <div className="card" key={idx}>
              <div className="q-header">
                <span className="q-num">Q{idx + 1}</span>
                <span className="q-cat">{q.category}</span>
                {q.type === "multiple" && <span className="q-multi">Multi-select</span>}
                <span style={{ marginLeft: "auto", fontSize: 12, color: s.fullyCorrect ? "var(--green)" : s.earned > 0 ? "var(--amber)" : "var(--red)", fontWeight: 600 }}>
                  {s.earned}/{s.max} pts
                </span>
              </div>
              <div className="q-text" dangerouslySetInnerHTML={{ __html: renderHtml(q.question_html, exam.id) }} />
              <ul className="options">
                {q.options.map((opt, i) => {
                  const sel = picked.includes(i);
                  let cls = "";
                  if (opt.correct && sel) cls = " correct";
                  else if (!opt.correct && sel) cls = " wrong";
                  else if (opt.correct && !sel) cls = " should";
                  return (
                    <li key={i}>
                      <label className={`opt-label disabled${cls}`}>
                        <input type={q.type === "multiple" ? "checkbox" : "radio"} checked={sel} disabled readOnly />
                        <span className={`opt-text${opt.code ? " opt-code" : ""}`}>{opt.text}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {q.explanation_html && (
                <div className="explanation">
                  <strong>Explanation</strong><br />
                  <span dangerouslySetInnerHTML={{ __html: renderHtml(q.explanation_html, exam.id) }} />
                </div>
              )}
            </div>
          ))}
      </div>
    </>
  );
}
