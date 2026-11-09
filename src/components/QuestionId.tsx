import { useState } from "react";

interface Props { examCode: string; questionId: string; }

/** Copyable question reference (e.g. "AI-103 q1021") for reporting faulty questions. */
export default function QuestionId({ examCode, questionId }: Props) {
  const ref = `${examCode} ${questionId}`;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ref);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — text stays selectable for manual copy */
    }
  };

  return (
    <button
      type="button"
      className={`q-id ${copied ? "copied" : ""}`}
      onClick={copy}
      title="Copy question ID to report a wrong answer, missing resource, or other issue"
    >
      <span className="q-id-text">{ref}</span>
      <span className="q-id-action">{copied ? "✓ Copied" : "⧉ Copy ID"}</span>
    </button>
  );
}
