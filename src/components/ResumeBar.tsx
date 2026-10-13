import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ExamManifest } from "../types";
import { loadSession, clearSession, type SavedSession } from "../lib/storage";
import { fmtDuration } from "../lib/format";
import Modal from "./Modal";

interface Props { manifest: ExamManifest; }

/** Most recently touched in-progress session across all exams. */
function latestSession(manifest: ExamManifest): { examId: string; code: string; s: SavedSession } | null {
  let best: { examId: string; code: string; s: SavedSession } | null = null;
  for (const e of manifest.exams) {
    const s = loadSession(e.id);
    if (s && (!best || (s.updatedAt ?? 0) > (best.s.updatedAt ?? 0))) best = { examId: e.id, code: e.code, s };
  }
  return best;
}

/** Fixed bar shown on every page except the quiz itself while a session is in progress. */
export default function ResumeBar({ manifest }: Props) {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const [, setTick] = useState(0);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const inQuiz = pathname.endsWith("/quiz");
  const found = inQuiz ? null : latestSession(manifest);
  const timed = !!found?.s.timeLimitMs;

  // Re-render each second for the countdown
  useEffect(() => {
    if (!timed) return;
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, [timed]);

  // Reserve space so the bar never covers page content
  useEffect(() => {
    document.body.classList.toggle("has-resume-bar", !!found);
    return () => document.body.classList.remove("has-resume-bar");
  }, [found]);

  if (!found) return null;
  const { examId, code, s } = found;
  const total = s.questionIds.length;
  const answered = s.answers.filter((a) => a.length > 0).length;
  const remaining = s.timeLimitMs ? s.timeLimitMs - (Date.now() - s.startedAt) : null;

  return (
    <>
      <div className="resume-bar" role="region" aria-label="Quiz in progress">
        <div className="resume-info">
          <strong>{code} · {s.mode === "exam" ? "Exam" : "Quick quiz"} in progress</strong>
          <span>
            Q{s.current + 1} of {total} · {answered} answered
            {remaining != null && (remaining > 0 ? ` · ${fmtDuration(remaining)} left` : " · time's up")}
          </span>
        </div>
        <div className="resume-actions">
          <button className="btn-primary" onClick={() => nav(`/exam/${examId}/quiz`)}>
            {remaining != null && remaining <= 0 ? "See results" : "Resume"}
          </button>
          <button className="btn-ghost resume-x" onClick={() => setConfirmDiscard(true)} aria-label="Discard progress" title="Discard progress">×</button>
        </div>
      </div>
      {confirmDiscard && (
        <Modal
          title="Discard progress?"
          body={`Your in-progress ${code} ${s.mode === "exam" ? "exam" : "quiz"} (${answered}/${total} answered) will be lost and not scored.`}
          confirmText="Discard"
          confirmKind="btn-danger"
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={() => { clearSession(examId); setConfirmDiscard(false); }}
        />
      )}
    </>
  );
}
