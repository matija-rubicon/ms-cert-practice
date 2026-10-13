#!/usr/bin/env python3
"""
Original (non-scraped) questions live in scripts/authored/<exam>.json with ids
"a1", "a2", … so re-extracting the scraped bank never touches them. textfix's
pipeline appends them to public/exams/<exam>/questions.json.

Usage:
  python3 scripts/authored_questions.py add <exam-id> <new.json>...   # validate + append
  python3 scripts/authored_questions.py check <exam-id>                 # re-validate stored set
"""
import difflib
import json
import re
import sys
from pathlib import Path

from review_overrides import _bad_markup, _norm

ROOT = Path(__file__).resolve().parent.parent
AUTH_DIR = Path(__file__).resolve().parent / "authored"
SIMILAR = 0.85


def _categories(exam):
    man = json.loads((ROOT / "public" / "exams" / "manifest.json").read_text(encoding="utf-8"))
    e = next(x for x in man["exams"] if x["id"] == exam)
    return {c for d in e["domains"] for c in d["categories"]}


def load_authored(exam):
    p = AUTH_DIR / f"{exam}.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else []


def validate(q, cats):
    errs = []
    if q.get("type") not in ("single", "multiple"):
        errs.append("type")
    if q.get("category") not in cats:
        errs.append(f"category {q.get('category')!r}")
    opts = q.get("options") or []
    n_ok = sum(1 for o in opts if o.get("correct"))
    if len(opts) < 2:
        errs.append("fewer than 2 options")
    if q.get("type") == "single" and n_ok != 1:
        errs.append(f"single with {n_ok} correct")
    if q.get("type") == "multiple" and not (2 <= n_ok < len(opts)):
        errs.append(f"multiple with {n_ok} correct")
    texts = [" ".join((o.get("text") or "").split()).lower() for o in opts]   # plain text, may contain "<placeholder>"
    if any(not t for t in texts):
        errs.append("empty option")
    if len(set(texts)) != len(texts):
        errs.append("duplicate options")
    for o in opts:
        if re.search(r"<(br|p|code|strong|em|span|div|a)\b", o.get("text", "")):
            errs.append("HTML in option")
    for k in ("question_html", "explanation_html"):
        h = q.get(k) or ""
        if not _norm(h):
            errs.append(f"empty {k}")
        bad = _bad_markup(h)
        if bad:
            errs.append(f"{k} markup {bad[:4]}")
        if "<img" in h:
            errs.append(f"{k} has image")
    if not re.search(r'href="https://', q.get("explanation_html") or ""):
        errs.append("no reference link")
    return errs


def _stem(q):
    return _norm(q.get("question_html", "")).lower()


def add(exam, files):
    cats = _categories(exam)
    stored = load_authored(exam)
    bank = json.loads((ROOT / "public" / "exams" / exam / "questions.json").read_text(encoding="utf-8"))
    existing = [_stem(q) for q in bank if not q["id"].startswith("a")] + [_stem(q) for q in stored]
    next_id = max([int(q["id"][1:]) for q in stored] or [0]) + 1
    added, rejected = 0, []
    for f in files:
        for q in json.loads(Path(f).read_text(encoding="utf-8")):
            errs = validate(q, cats)
            stem = _stem(q)
            close = max((difflib.SequenceMatcher(None, stem, s, autojunk=False).ratio()
                         for s in existing if abs(len(s) - len(stem)) < len(stem) * 0.3), default=0)
            if close >= SIMILAR:
                errs.append(f"near-duplicate of an existing question ({close:.2f})")
            if errs:
                rejected.append((Path(f).stem, _norm(q.get("question_html", ""))[:70], errs))
                continue
            entry = {"id": f"a{next_id}", "type": q["type"], "category": q["category"],
                     "question_html": q["question_html"].strip(),
                     "options": [{"text": o["text"], "correct": bool(o["correct"]),
                                  **({"code": True} if o.get("code") else {})} for o in q["options"]],
                     "explanation_html": q["explanation_html"].strip(),
                     "authored": True}
            stored.append(entry)
            existing.append(stem)
            next_id += 1
            added += 1
    AUTH_DIR.mkdir(exist_ok=True)
    (AUTH_DIR / f"{exam}.json").write_text(json.dumps(stored, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{exam}: added {added}, rejected {len(rejected)}, total authored {len(stored)}")
    for src, stem, errs in rejected:
        print(f"  [{src}] {stem}… -> {'; '.join(errs)}")


def check(exam):
    cats = _categories(exam)
    for q in load_authored(exam):
        errs = validate(q, cats)
        if errs:
            print(q["id"], errs)
    print("checked")


if __name__ == "__main__":
    if len(sys.argv) >= 4 and sys.argv[1] == "add":
        add(sys.argv[2], sys.argv[3:])
    elif len(sys.argv) == 3 and sys.argv[1] == "check":
        check(sys.argv[2])
    else:
        sys.exit(__doc__)
