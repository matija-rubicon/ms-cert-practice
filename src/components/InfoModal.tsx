import { useEffect, type ReactNode } from "react";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Read-only dialog: closes on backdrop click, Esc or the Close button. */
export default function InfoModal({ title, onClose, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal info-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="info-modal-head">
          <h3>{title}</h3>
          <button className="btn-ghost info-modal-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="info-modal-body">{children}</div>
        <div className="modal-actions">
          <button className="btn-primary" onClick={onClose} autoFocus>Close</button>
        </div>
      </div>
    </div>
  );
}
