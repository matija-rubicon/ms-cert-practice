#!/usr/bin/env python3
"""
Validate and merge per-question review edits into scripts/overrides/<exam>.json,
and apply overrides to a question bank.

Review edits only fix presentation (HTML structure, code blocks, lists, emphasis)
or disable unanswerable questions. Every edit is checked so wording, images and
answer keys can't drift:
  * visible text (tags stripped, quotes/dashes/whitespace normalised) ~unchanged
  * same <img> srcs
  * only whitelisted tags/attributes
  * options: same count, same correct flags, text ~unchanged, no HTML

Usage:
  python3 scripts/review_overrides.py merge <exam-id> <edits.json>...   # validate + merge
  python3 scripts/review_overrides.py apply <exam-id>                   # write into questions.json
"""
import difflib
import html as htmllib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OVR_DIR = Path(__file__).resolve().parent / "overrides"

ALLOWED_TAGS = {"p", "br", "strong", "em", "b", "i", "code", "pre", "ul", "ol", "li", "table",
                "thead", "tbody", "tr", "th", "td", "a", "img", "hr", "sup", "sub"}
ALLOWED_ATTRS = {"a": {"href", "rel", "target"},
                 "img": {"src", "alt", "style", "onerror", "width", "height", "class", "draggable", "role"}}


def _norm(s: str) -> str:
    s = re.sub(r"<br\s*/?>|</(p|li|tr|pre|h\d)>", "\n", s or "")
    s = re.sub(r"<[^>]+>", " ", s)
    s = htmllib.unescape(s)
    s = s.translate(str.maketrans({"“": '"', "”": '"', "‘": "'", "’": "'", "–": "-", "—": "-",
                                   "\xa0": " ", "•": " ", "·": " ", "▪": " ", "…": "..."}))
    s = s.replace("--", "-")
    s = re.sub(r"(^|\n)\s*-\s*", r"\1", s)          # bullets removed when converting to <li>
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def _imgs(s: str):
    return sorted(re.findall(r'<img[^>]*\ssrc="([^"]+)"', s or ""))


def _bad_markup(s: str):
    probs = []
    for m in re.finditer(r"<(/?)([a-zA-Z][\w-]*)([^>]*)>", s or ""):
        tag, attrs = m.group(2).lower(), m.group(3)
        if tag not in ALLOWED_TAGS:
            probs.append(f"tag <{tag}>")
            continue
        for a in re.findall(r"""([\w:-]+)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)""", attrs):
            if a.lower() not in ALLOWED_ATTRS.get(tag, set()):
                probs.append(f"attr {tag}.{a}")
    return sorted(set(probs))


def _word_diff(a: str, b: str):
    """Word-level changes between normalised texts, as ("old words", "new words")."""
    wa, wb = a.split(" "), b.split(" ")
    sm = difflib.SequenceMatcher(None, wa, wb, autojunk=False)
    return [(" ".join(wa[i1:i2]), " ".join(wb[j1:j2]))
            for op, i1, i2, j1, j2 in sm.get_opcodes() if op != "equal"]


# Deletions that are safe: scraper junk, or numbering an <ol> now renders.
_JUNK = re.compile(r"^(bash|powershell|yaml|json|copy code|ask our experts|\(image \d+:.*\)\.?)$", re.I)
_NUMBERING = re.compile(r"^(\d+\s*[.):-]\s*)+$")


def _safe_change(old: str, new: str, new_html: str) -> bool:
    if _only_spacing(old, new):
        return True
    if new:
        return False
    if _JUNK.match(old.strip()):
        return True
    return bool(_NUMBERING.match(old.strip())) and "<ol" in new_html


def _only_spacing(old: str, new: str) -> bool:
    return re.sub(r"[\s\W_]", "", old) == re.sub(r"[\s\W_]", "", new)


def validate(orig: dict, edit: dict):
    errs, notes = [], []
    for k in ("question_html", "explanation_html"):
        if k not in edit:
            continue
        a, b = orig.get(k) or "", edit[k] or ""
        if _imgs(a) != _imgs(b):
            errs.append(f"{k}: images changed")
        diffs = [d for d in _word_diff(_norm(a), _norm(b)) if not _safe_change(*d, b)]
        if diffs:
            errs.append(f"{k}: text changed {diffs[:4]}")
        bad = _bad_markup(b)
        if bad:
            errs.append(f"{k}: markup {bad[:5]}")
    if "options" in edit:
        oo, eo = orig["options"], edit["options"]
        if len(oo) != len(eo):
            errs.append("options: count changed")
        else:
            for i, (o, e) in enumerate(zip(oo, eo)):
                if "correct" in e and bool(e["correct"]) != bool(o["correct"]):
                    errs.append(f"option {i}: correct flag changed")
                if re.search(r"<(br|p|code|strong|em|span|div)\b", e.get("text", "")):
                    errs.append(f"option {i}: contains HTML")
                diffs = [d for d in _word_diff(_norm(o["text"]), _norm(e.get("text", ""))) if not _only_spacing(*d)]
                if diffs:
                    errs.append(f"option {i}: text changed {diffs[:3]}")
    if edit.get("disable") and not edit.get("disable_reason"):
        errs.append("disable without reason")
    return errs, notes


def _bank(exam):
    return ROOT / "public" / "exams" / exam / "questions.json"


def _load_overrides(exam):
    p = OVR_DIR / f"{exam}.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}


def merge(exam, files):
    bank = {q["id"]: q for q in json.loads(_bank(exam).read_text(encoding="utf-8"))}
    ovr = _load_overrides(exam)
    rejected, accepted = [], 0
    for f in files:
        for edit in json.loads(Path(f).read_text(encoding="utf-8")):
            qid = edit.get("id")
            if qid not in bank:
                rejected.append((qid, ["unknown id"]))
                continue
            errs, notes = validate(bank[qid], edit)
            entry = {}
            # Keep the valid parts of a partially bad edit; flags/disable always pass.
            for k in ("question_html", "explanation_html"):
                if k in edit and not any(e.startswith(k) for e in errs):
                    entry[k] = edit[k]
            if "options" in edit and not any(e.startswith("option") for e in errs):
                entry["options"] = [{"text": e["text"], **({"code": True} if e.get("code") else {})}
                                    for e in edit["options"]]
            if edit.get("disable"):
                entry["disabled"] = True
                entry["disabled_reason"] = edit.get("disable_reason", "")
            if edit.get("flags"):
                entry["flags"] = edit["flags"]
            if errs:
                rejected.append((qid, errs))
            if entry:
                ovr[qid] = {**ovr.get(qid, {}), **entry}
                accepted += 1
    OVR_DIR.mkdir(exist_ok=True)
    (OVR_DIR / f"{exam}.json").write_text(
        json.dumps(dict(sorted(ovr.items(), key=lambda kv: int(kv[0][1:]))), ensure_ascii=False, indent=1),
        encoding="utf-8")
    print(f"{exam}: {accepted} entries merged, {len(rejected)} with rejected parts")
    for qid, errs in rejected:
        print(f"  {qid}: {'; '.join(errs)}")


def apply_overrides(qs, exam):
    ovr = _load_overrides(exam)
    for q in qs:
        o = ovr.get(q["id"])
        if not o:
            continue
        for k in ("question_html", "explanation_html"):
            if k in o:
                q[k] = o[k]
        if "options_replace" in o:          # hand-written repair, not from review edits
            q["options"] = o["options_replace"]
        elif "options" in o:
            for opt, eo in zip(q["options"], o["options"]):
                opt["text"] = eo["text"]
                opt.pop("code", None)
                if eo.get("code"):
                    opt["code"] = True
        if o.get("disabled"):
            q["disabled"] = True
            q["disabled_reason"] = o.get("disabled_reason", "")
    return qs


def apply(exam):
    p = _bank(exam)
    qs = apply_overrides(json.loads(p.read_text(encoding="utf-8")), exam)
    p.write_text(json.dumps(qs, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{exam}: applied overrides, {sum(1 for q in qs if q.get('disabled'))} disabled")


if __name__ == "__main__":
    if len(sys.argv) >= 4 and sys.argv[1] == "merge":
        merge(sys.argv[2], sys.argv[3:])
    elif len(sys.argv) == 3 and sys.argv[1] == "apply":
        apply(sys.argv[2])
    else:
        sys.exit(__doc__)
