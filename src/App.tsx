import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate, useMatch, useLocation } from "react-router-dom";
import type { ExamManifest } from "./types";
import ExamPicker from "./components/ExamPicker";
import ExamHome from "./components/ExamHome";
import Quiz from "./components/Quiz";
import Results from "./components/Results";
import History from "./components/History";

interface LoadState {
  loading: boolean;
  error?: string;
  manifest?: ExamManifest;
}

export default function App() {
  const [state, setState] = useState<LoadState>({ loading: true });

  useEffect(() => {
    fetch("exams/manifest.json")
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then((manifest: ExamManifest) => setState({ loading: false, manifest }))
      .catch((e) => setState({ loading: false, error: String(e.message || e) }));
  }, []);

  return (
    <>
      <AppHeader manifest={state.manifest} />
      <main>
        {state.loading && (
          <div className="page"><div className="card"><p>Loading exam catalogue…</p></div></div>
        )}
        {state.error && (
          <div className="page"><div className="card">
            <h2>Could not load manifest</h2>
            <p>{state.error}</p>
            <p className="hint">
              Serve via HTTP (e.g. <code>npm run dev</code> or
              <code> npx http-server dist</code>), not <code>file://</code>.
            </p>
          </div></div>
        )}
        {state.manifest && (
          <Routes>
            <Route path="/" element={<div className="page"><ExamPicker manifest={state.manifest} /></div>} />
            <Route path="/exam/:examId" element={<div className="page"><ExamHome manifest={state.manifest} /></div>} />
            <Route path="/exam/:examId/quiz" element={<Quiz manifest={state.manifest} />} />
            <Route path="/exam/:examId/results" element={<Results manifest={state.manifest} />} />
            <Route path="/exam/:examId/history" element={<div className="page"><History manifest={state.manifest} /></div>} />
            <Route path="/exam/:examId/history/:attemptId" element={<Results manifest={state.manifest} reviewMode />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>
    </>
  );
}

function AppHeader({ manifest }: { manifest?: ExamManifest }) {
  const nav = useNavigate();
  const loc = useLocation();
  const match = useMatch("/exam/:examId/*");
  const examId = match?.params.examId;
  const exam = manifest?.exams.find((e) => e.id === examId);
  const inQuiz = loc.pathname.endsWith("/quiz");
  const goHome = () => {
    if (inQuiz && !window.confirm("Leave the quiz? Your progress will be lost.")) return;
    nav("/");
  };
  return (
    <header>
      <h1 onClick={goHome}>MS Cert Practice</h1>
      {exam && <span className="crumb">{exam.code}</span>}
    </header>
  );
}
