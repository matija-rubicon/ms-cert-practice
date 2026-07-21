interface Props {
  title: string;
  body: string;
  confirmText: string;
  confirmKind?: "btn-primary" | "btn-danger";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function Modal({ title, body, confirmText, confirmKind = "btn-primary", onConfirm, onCancel }: Props) {
  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal">
        <h3>{title}</h3>
        <p>{body}</p>
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className={confirmKind} onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}
