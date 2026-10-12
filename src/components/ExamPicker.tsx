import { Link } from "react-router-dom";
import type { ExamManifest } from "../types";
import { historyForExam } from "../lib/storage";

interface Props { manifest: ExamManifest; }

export default function ExamPicker({ manifest }: Props) {
  return (
    <>
      <div className="card">
        <h2>Microsoft certification practice</h2>
        <p className="hint">
          Pick an exam. Each exam ships its own question bank, domain weights, time limit,
          and scoring threshold. Pass mark is the official Microsoft scaled score (default 700/1000).
        </p>
      </div>
      <div className="mode-grid">
        {manifest.exams.map((e) => {
          const attempts = historyForExam(e.id).length;
          const card = (
            <>
              <div className="exam-code">{e.code}</div>
              <h3>{e.title}</h3>
              <p>{e.description}</p>
              <div className="exam-meta">
                <span className={`exam-badge ${e.available ? "ready" : "coming"}`}>
                  {e.available ? "Ready" : "Coming soon"}
                </span>
                {e.available && (
                  <>
                    {" · "}
                    {e.defaultQuestionCount}q · {e.defaultTimeMinutes} min · pass {e.passingScaled}/1000
                    {attempts > 0 && <> · {attempts} attempt{attempts === 1 ? "" : "s"}</>}
                  </>
                )}
              </div>
            </>
          );
          return e.available ? (
            <Link key={e.id} to={`/exam/${e.id}`} className="card mode-card exam-card">
              {card}
            </Link>
          ) : (
            <div key={e.id} className="card mode-card exam-card disabled">{card}</div>
          );
        })}
      </div>
      <div className="card">
        <h3>About this app</h3>
        <p style={{ marginTop: 6 }}>
          Multi-exam practice tool that approximates Microsoft's scoring model: partial credit
          on multi-select questions, scaled <code>0–1000</code> output, 700-to-pass threshold.
          Each exam's history lives in <code>localStorage</code> on this browser.
        </p>
        <p>
          Adding a new exam: drop <code>questions.json</code> into{" "}
          <code>public/exams/&lt;id&gt;/</code>, then add an entry to{" "}
          <code>public/exams/manifest.json</code> with the domain mapping. No code change needed.
        </p>
      </div>
    </>
  );
}
