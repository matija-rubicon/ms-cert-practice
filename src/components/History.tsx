import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { ExamManifest } from "../types";
import { historyForExam, deleteAttempt, loadHistory } from "../lib/storage";
import { fmtDate } from "../lib/format";
import Modal from "./Modal";

interface Props { manifest: ExamManifest; }

export default function History({ manifest }: Props) {
  const { examId } = useParams<{ examId: string }>();
  const exam = manifest.exams.find((e) => e.id === examId);
  const nav = useNavigate();
  const [tick, setTick] = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);

  if (!exam) return <div className="card"><p>Unknown exam.</p></div>;

  const h = historyForExam(exam.id);

  if (h.length === 0) {
    return (
      <div className="card">
        <h2>{exam.code} history</h2>
        <p>No attempts logged yet. Run a full exam or quick quiz of 10+ questions to start tracking progress.</p>
        <Link to={`/exam/${exam.id}`} className="btn-primary" style={{ textDecoration: "none", padding: "9px 18px", borderRadius: 6 }}>← Back</Link>
      </div>
    );
  }

  const total = h.length;
  const passed = h.filter((x) => x.pass).length;
  const avg = Math.round(h.reduce((s, x) => s + x.scaled, 0) / total);
  const best = Math.max(...h.map((x) => x.scaled));

  const clearAll = () => {
    // Only clear this exam's attempts
    const all = loadHistory();
    const remaining = all.filter((x) => x.examId !== exam.id);
    localStorage.setItem("mscert.history.v1", JSON.stringify(remaining));
    setConfirmClear(false);
    setTick((t) => t + 1);
  };

  return (
    <>
      <div className="card" key={tick}>
        <h2>{exam.code} history</h2>
        <div className="stat-grid">
          <div className="stat"><div className="stat-val">{total}</div><div className="stat-lbl">Attempts</div></div>
          <div className="stat"><div className="stat-val">{passed}/{total}</div><div className="stat-lbl">Passes</div></div>
          <div className="stat"><div className="stat-val">{avg}</div><div className="stat-lbl">Avg scaled</div></div>
          <div className="stat"><div className="stat-val">{best}</div><div className="stat-lbl">Best scaled</div></div>
        </div>
        <div className="nav-row">
          <div><button className="btn-ghost" onClick={() => nav(`/exam/${exam.id}`)}>← {exam.code} home</button></div>
          <div><button className="btn-ghost" style={{ color: "var(--red)" }} onClick={() => setConfirmClear(true)}>Clear {exam.code} history</button></div>
        </div>
      </div>

      <div className="card">
        <h3>Past attempts</h3>
        {h.map((x) => (
          <div className="history-row" key={x.id}>
            <div>{fmtDate(x.finishedAt)}</div>
            <div className={x.pass ? "pass-pill" : "fail-pill"}>{x.scaled}</div>
            <div>{x.questionCount}q</div>
            <div>
              {x.mode === "exam" ? "Exam" : "Quick"}
              {x.category && x.category !== "all" ? ` · ${x.category}` : ""}
            </div>
            <div>
              <button className="btn-ghost" onClick={() => nav(`/exam/${exam.id}/history/${x.id}`)}>View</button>
              <button className="btn-ghost" style={{ color: "var(--red)" }} onClick={() => { deleteAttempt(x.id); setTick((t) => t + 1); }}>×</button>
            </div>
          </div>
        ))}
      </div>

      {confirmClear && (
        <Modal
          title={`Clear ${exam.code} history?`}
          body={`This permanently removes all ${total} ${exam.code} attempts from this browser. Cannot be undone.`}
          confirmText="Clear all"
          confirmKind="btn-danger"
          onConfirm={clearAll}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </>
  );
}
