import { useState, type FormEvent, type ReactNode } from "react";

/**
 * Client-side access gate. GitHub Pages can't do server auth, so this only keeps
 * casual visitors out of the UI: the question files stay reachable by direct URL.
 * Only the salted SHA-256 of the password lives in the code.
 */
const SALT = "mscert.gate.v1:";
const PASSWORD_SHA256 = "7c4c72aaa1a0ebc87af0a92161c5b36ec916ac89869048cdf3d74a93b713b1ed";
const UNLOCK_KEY = "mscert.unlocked.v1";

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function isUnlocked(): boolean {
  try {
    return localStorage.getItem(UNLOCK_KEY) === PASSWORD_SHA256;
  } catch {
    return false;
  }
}

export default function PasswordGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(isUnlocked);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  if (unlocked) return <>{children}</>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setChecking(true);
    const ok = (await sha256Hex(SALT + value)) === PASSWORD_SHA256;
    setChecking(false);
    if (!ok) { setError(true); return; }
    try { localStorage.setItem(UNLOCK_KEY, PASSWORD_SHA256); } catch { /* unlock for this visit only */ }
    setUnlocked(true);
  };

  return (
    <main>
      <div className="page">
        <form className="card gate" onSubmit={submit}>
          <h2>MS Cert Practice</h2>
          <p className="hint">This site is private. Enter the password to continue.</p>
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(false); }}
            aria-label="Password"
            placeholder="Password"
          />
          {error && <p className="gate-error">Wrong password.</p>}
          <button type="submit" className="btn-primary" disabled={checking || !value}>
            Unlock
          </button>
        </form>
      </div>
    </main>
  );
}
