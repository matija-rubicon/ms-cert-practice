import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import type { ExamManifest, Question } from "../types";
import { historyForExam, clearSession } from "../lib/storage";
import { fmtDate } from "../lib/format";
import { playable, questionPool } from "../lib/sampling";

interface Props { manifest: ExamManifest; }

interface BankState {
  loading: boolean;
  error?: string;
  questions?: Question[];
}

export default function ExamHome({ manifest }: Props) {
  const { examId } = useParams<{ examId: string }>();
  const exam = manifest.exams.find((e) => e.id === examId);
  const nav = useNavigate();
  const [bank, setBank] = useState<BankState>({ loading: true });
  // Only one setup panel open at a time
  const [setup, setSetup] = useState<"exam" | "quick" | null>(null);
  const setupRef = useRef<HTMLDivElement>(null);
  const [examCount, setExamCount] = useState(0);
  const [examMin, setExamMin] = useState(0);
  const [quickCount, setQuickCount] = useState(20);
  const [quickCat, setQuickCat] = useState("all");
  const [bankOnly, setBankOnly] = useState(true);

  useEffect(() => {
    if (!exam) return;
    if (!exam.available) { setBank({ loading: false, questions: [] }); return; }
    setExamCount(exam.defaultQuestionCount);
    setExamMin(exam.defaultTimeMinutes);
    fetch(`exams/${exam.id}/questions.json`)
      .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then((qs: Question[]) => setBank({ loading: false, questions: playable(qs) }))
      .catch((e) => setBank({ loading: false, error: String(e.message || e) }));
  }, [examId, exam]);

  // Bring the opened panel into view (on phones it sits below the cards)
  useEffect(() => {
    if (setup) setupRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [setup]);

  if (!exam) return <div className="card"><p>Unknown exam.</p></div>;

  if (!exam.available) {
    return (
      <div className="card">
        <h2>{exam.code}: {exam.title}</h2>
        <p>This exam is not yet loaded. Drop a <code>questions.json</code> at <code>public/exams/{exam.id}/</code> and set <code>available: true</code> in the manifest.</p>
        <Link to="/" className="btn-secondary" style={{ display: "inline-block", padding: "9px 18px", borderRadius: 6, border: "1px solid var(--azure)", textDecoration: "none" }}>← Back</Link>
      </div>
    );
  }

  if (bank.loading) return <div className="card"><p>Loading question bank…</p></div>;
  if (bank.error) return (
    <div className="card">
      <h2>Could not load questions</h2>
      <p>{bank.error}</p>
    </div>
  );

  const allQuestions = bank.questions || [];
  const authoredCount = allQuestions.filter((q) => q.authored).length;
  const questions = questionPool(allQuestions, bankOnly);
  const history = historyForExam(exam.id);
  const last = history[0];
  const totalByCat: Record<string, number> = {};
  for (const q of questions) totalByCat[q.category] = (totalByCat[q.category] || 0) + 1;
  const cats = ["all", ...Object.keys(totalByCat).sort()];
  const topic = cats.includes(quickCat) ? quickCat : "all";

  const poolToggle = authoredCount > 0 && (
    <label className="check-row">
      <input type="checkbox" checked={bankOnly} onChange={(e) => setBankOnly(e.target.checked)} />
      <span>
        Only questions from the certification practice bank
        <span className="hint"> — leaves out the {authoredCount} questions written by Claude</span>
      </span>
    </label>
  );

  const startExam = () => {
    clearSession(exam.id);
    sessionStorage.setItem(
      `mscert.start.${exam.id}`,
      JSON.stringify({ mode: "exam", count: examCount, minutes: examMin, bankOnly })
    );
    nav(`/exam/${exam.id}/quiz`);
  };
  const startQuick = () => {
    clearSession(exam.id);
    sessionStorage.setItem(
      `mscert.start.${exam.id}`,
      JSON.stringify({ mode: "quick", count: quickCount, category: topic, bankOnly })
    );
    nav(`/exam/${exam.id}/quiz`);
  };

  return (
    <>
      <div className="card">
        <h2>{exam.code}: {exam.title}</h2>
        <p className="hint">
          {allQuestions.length} questions in bank{authoredCount > 0 && ` (${authoredCount} written by Claude)`}. Pass threshold: {exam.passingScaled}/1000 (≈{Math.round(exam.passingScaled / 10)}%).
          Default exam: {exam.defaultQuestionCount} questions in {exam.defaultTimeMinutes} minutes, weighted to match the official domain blueprint.
        </p>
        {last ? (
          <p className="hint">
            Last attempt: {fmtDate(last.finishedAt)} —{" "}
            <strong>{last.scaled}/1000</strong>{" "}
            {last.pass ? "✓ Pass" : "✗ Fail"}
          </p>
        ) : (
          <p className="hint">No attempts yet for this exam.</p>
        )}
      </div>

      <div className="mode-grid">
        <button
          type="button"
          className={`card mode-card${setup === "exam" ? " active" : ""}`}
          aria-expanded={setup === "exam"}
          onClick={() => setSetup((v) => (v === "exam" ? null : "exam"))}
        >
          <div className="mode-icon">▶</div>
          <div className="mode-body">
            <h3>Full exam</h3>
            <p>{exam.defaultQuestionCount} questions · {exam.defaultTimeMinutes} min · domain-weighted · scaled 0–1000</p>
          </div>
        </button>
        <button
          type="button"
          className={`card mode-card${setup === "quick" ? " active" : ""}`}
          aria-expanded={setup === "quick"}
          onClick={() => setSetup((v) => (v === "quick" ? null : "quick"))}
        >
          <div className="mode-icon">⚡</div>
          <div className="mode-body">
            <h3>Quick quiz</h3>
            <p>Pick length and topic. Instant feedback per question.</p>
          </div>
        </button>
        <Link to={`/exam/${exam.id}/history`} className="card mode-card">
          <div className="mode-icon">▤</div>
          <div className="mode-body">
            <h3>History ({history.length})</h3>
            <p>Review past attempts and missed questions.</p>
          </div>
        </Link>
      </div>

      {setup === "exam" && (
        <div className="card setup-card" ref={setupRef}>
          <h3>Full exam setup</h3>
          <div className="field-row">
            <label>Questions</label>
            <input type="number" inputMode="numeric" min={5} max={questions.length} value={examCount}
              onChange={(e) => setExamCount(parseInt(e.target.value, 10) || 0)} />
          </div>
          <div className="field-row">
            <label>Time limit (min)</label>
            <input type="number" inputMode="numeric" min={1} max={300} value={examMin}
              onChange={(e) => setExamMin(parseInt(e.target.value, 10) || 0)} />
          </div>
          <p className="hint">
            Selection is stratified across exam domains:{" "}
            {exam.domains.map((d) => `${d.name} ${Math.round(d.weight * 100)}%`).join(" · ")}.
          </p>
          {poolToggle}
          <div className="nav-row">
            <div></div>
            <div>
              <button className="btn-ghost" onClick={() => setSetup(null)}>Cancel</button>
              <button className="btn-primary" onClick={startExam}>Start exam</button>
            </div>
          </div>
        </div>
      )}

      {setup === "quick" && (
        <div className="card setup-card" ref={setupRef}>
          <h3>Quick quiz setup</h3>
          <div className="field-row">
            <label>Questions</label>
            <input type="number" inputMode="numeric" min={1} max={questions.length} value={quickCount}
              onChange={(e) => setQuickCount(parseInt(e.target.value, 10) || 1)} />
          </div>
          <div className="field-row">
            <label>Topic</label>
            <select value={topic} onChange={(e) => setQuickCat(e.target.value)}>
              {cats.map((c) => (
                <option key={c} value={c}>
                  {c === "all" ? `All categories (${questions.length})` : `${c} (${totalByCat[c]})`}
                </option>
              ))}
            </select>
          </div>
          <p className="hint">Untimed. Instant feedback and explanations after each answer.</p>
          {poolToggle}
          <div className="nav-row">
            <div></div>
            <div>
              <button className="btn-ghost" onClick={() => setSetup(null)}>Cancel</button>
              <button className="btn-primary" onClick={startQuick}>Start quiz</button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h3>How scoring works</h3>
        <p style={{ marginTop: 6 }}>
          <strong>{exam.passingScaled}/1000 to pass</strong> — Microsoft uses a scaled score, not a raw percentage. On the real exam, harder forms require fewer raw correct answers to hit the threshold; easier forms require more. This app approximates that as <code>scaled = round((earned / max) × 1000)</code> with no negative scoring.
        </p>
        <p>
          <strong>Partial credit</strong> — multi-select questions award 1 point per option matched correctly (correct picked, or wrong not picked). A 3-option multi where you got 2 of 3 right earns 2/3 points. Single-answer questions are 1 point all-or-nothing.
        </p>
        <p>
          <strong>Domain weights</strong> — full exam mode samples questions in proportion to the official exam blueprint, so a single 50-question run reflects the real domain distribution.
        </p>
      </div>
    </>
  );
}
