#!/usr/bin/env python3
"""
Extract skillcertpro AZ-400 HTML dump into questions.json.

Usage:
  python3 scripts/extract.py <path-to-html> [exam-id]

Writes:
  public/exams/<exam-id>/questions.json
  scripts/images_needed.txt
"""
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

from textfix import fix_obj

if len(sys.argv) < 2:
    print(__doc__)
    sys.exit(1)

SRC = Path(sys.argv[1]).expanduser().resolve()
EXAM_ID = sys.argv[2] if len(sys.argv) > 2 else "az400"
APP_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = APP_ROOT / "public" / "exams" / EXAM_ID
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT = OUT_DIR / "questions.json"
INV = Path(__file__).resolve().parent / "images_needed.txt"


class QExtractor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.questions = []
        self.cur = None
        self.stack = []  # list of (tag, attrs_dict)
        self.capture = None  # which buffer to write text/html into
        self.buf = []
        # When inside q-text or explanation we re-emit HTML; when inside opt-text we collect text.

    def _attr_class(self, attrs):
        return dict(attrs).get("class", "") or ""

    def handle_starttag(self, tag, attrs):
        ad = dict(attrs)
        cls = ad.get("class", "") or ""

        if tag == "div" and "question" in cls.split():
            self.cur = {
                "id": ad.get("id"),
                "type": ad.get("data-type"),
                "category": ad.get("data-category"),
                "question_html": "",
                "options": [],
                "explanation_html": "",
                "page": None,
            }

        # Inside-question markers
        if self.cur is not None:
            if tag == "span" and "q-page" in cls.split():
                self.capture = "page"
                self.buf = []
            elif tag == "div" and "q-text" in cls.split():
                self.capture = "qtext"
                self.buf = []
                self._depth = 1
                return
            elif tag == "div" and "explanation" in cls.split():
                self.capture = "expl"
                self.buf = []
                self._depth = 1
                return
            elif tag == "input" and ("opt-input" in cls.split() or ad.get("type") in ("radio", "checkbox")):
                self.cur["options"].append({
                    "correct": ad.get("data-correct") == "true",
                    "text": "",
                })
            elif tag == "span" and "opt-text" in cls.split():
                self.capture = "opt"
                self.buf = []
                return

            # If currently capturing html content, re-emit nested tags
            if self.capture in ("qtext", "expl"):
                # Skip the wrapper's own re-entry (depth tracked via stack)
                attr_str = "".join(
                    f' {k}="{v}"' for k, v in attrs if k != "onclick"
                )
                self.buf.append(f"<{tag}{attr_str}>")
                self._depth += 1

    def handle_endtag(self, tag):
        if self.cur is None:
            return

        if self.capture == "qtext":
            self._depth -= 1
            if self._depth == 0:
                self.cur["question_html"] = "".join(self.buf).strip()
                self.capture = None
                return
            else:
                self.buf.append(f"</{tag}>")
                return

        if self.capture == "expl":
            self._depth -= 1
            if self._depth == 0:
                html = "".join(self.buf).strip()
                # strip leading "<strong>Explanation:</strong>"
                html = re.sub(r"^\s*<strong>\s*Explanation:\s*</strong>\s*", "", html, flags=re.I)
                self.cur["explanation_html"] = html.strip()
                self.capture = None
                return
            else:
                self.buf.append(f"</{tag}>")
                return

        if self.capture == "opt" and tag == "span":
            self.cur["options"][-1]["text"] = "".join(self.buf).strip()
            self.capture = None
            return

        if self.capture == "page" and tag == "span":
            txt = "".join(self.buf).strip()
            m = re.search(r"(\d+)", txt)
            if m:
                self.cur["page"] = int(m.group(1))
            self.capture = None
            return

        if tag == "div" and self.cur is not None:
            # We rely on the order: question div closes after explanation.
            # Use a sentinel: if explanation already filled OR no explanation expected, and we hit a top-level div close, flush.
            # Simpler: check the count of opened question divs via a counter.
            pass

    def handle_data(self, data):
        if self.capture in ("qtext", "expl"):
            self.buf.append(data)
        elif self.capture == "opt":
            self.buf.append(data)
        elif self.capture == "page":
            self.buf.append(data)


def extract():
    text = SRC.read_text(encoding="utf-8")
    # Split per question block via regex — simpler & robust given uniform markup
    block_re = re.compile(
        r'<div class="question" id="(?P<id>q\d+)" data-type="(?P<type>[^"]+)" data-category="(?P<cat>[^"]+)">(?P<body>.*?)</div>\s*(?=<div class="question"|</main>)',
        re.S,
    )
    qtext_re = re.compile(r'<div class="q-text">(?P<inner>.*?)</div>\s*<ul class="options"', re.S)
    page_re = re.compile(r'<span class="q-page">Page (\d+)</span>')
    opts_re = re.compile(r'<ul class="options">(?P<inner>.*?)</ul>', re.S)
    opt_re = re.compile(
        r'<input type="(?:radio|checkbox)"[^>]*data-correct="(?P<correct>true|false)"[^>]*>\s*<span class="opt-text">(?P<text>.*?)</span>',
        re.S,
    )
    expl_re = re.compile(r'<div class="explanation"[^>]*>\s*<strong>Explanation:</strong>\s*(?P<inner>.*?)</div>\s*$', re.S)

    questions = []
    for m in block_re.finditer(text):
        body = m.group("body")
        qid = m.group("id")
        qtype = m.group("type")
        cat = m.group("cat")

        qtext_m = qtext_re.search(body)
        question_html = qtext_m.group("inner").strip() if qtext_m else ""

        page_m = page_re.search(body)
        page = int(page_m.group(1)) if page_m else None

        options = []
        opts_m = opts_re.search(body)
        if opts_m:
            for om in opt_re.finditer(opts_m.group("inner")):
                options.append({
                    "correct": om.group("correct") == "true",
                    "text": om.group("text").strip(),
                })

        expl_m = expl_re.search(body)
        explanation_html = expl_m.group("inner").strip() if expl_m else ""

        # Strip onclick attrs, normalize <img> to ./images/<basename>, drop srcset
        def clean(html):
            html = re.sub(r'\s*onclick="[^"]*"', '', html)
            html = re.sub(r'\s*srcset="[^"]*"', '', html)
            html = re.sub(r'\s*sizes="[^"]*"', '', html)
            html = re.sub(r'\s*decoding="[^"]*"', '', html)
            html = re.sub(r'\s*loading="[^"]*"', '', html)
            # Rewrite src to local images/<basename>
            def rewrite_src(m):
                src = m.group(1)
                # Skip data: URIs
                if src.startswith("data:"):
                    return m.group(0)
                base = src.rsplit("/", 1)[-1]
                return f'src="./images/{base}"'
            html = re.sub(r'src="([^"]+)"', rewrite_src, html)
            # Add onerror handler to every <img> so missing images hide instead of showing broken icon
            def add_onerror(m):
                tag = m.group(0)
                if "onerror=" in tag:
                    return tag
                return tag[:-1].rstrip("/") + ' onerror="this.style.display=\'none\'; this.dataset.broken=\'1\'"' + ("/>" if tag.endswith("/>") else ">")
            html = re.sub(r'<img[^>]*>', add_onerror, html)
            return html

        questions.append({
            "id": qid,
            "type": qtype,
            "category": cat,
            "page": page,
            "question_html": clean(question_html),
            "options": [{"correct": o["correct"], "text": clean(o["text"])} for o in options],
            "explanation_html": clean(explanation_html),
        })

    return questions


def main():
    qs = extract()
    print(f"Extracted {len(qs)} questions")
    # Drop questions with no correct option (source data corruption)
    broken = [q for q in qs if not any(o["correct"] for o in q["options"])]
    if broken:
        print(f"Dropping {len(broken)} broken questions (no correct option): {[q['id'] for q in broken]}")
        qs = [q for q in qs if any(o["correct"] for o in q["options"])]
    # Sanity: types
    types = {}
    cats = {}
    no_opts = 0
    for q in qs:
        types[q["type"]] = types.get(q["type"], 0) + 1
        cats[q["category"]] = cats.get(q["category"], 0) + 1
        if not q["options"]:
            no_opts += 1
    print("Types:", types)
    print("Categories:", cats)
    print("No options:", no_opts)
    OUT.write_text(json.dumps(fix_obj(qs), ensure_ascii=False, indent=None, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")

    # Image inventory: list every basename referenced post-rewrite.
    img_set = set()
    for q in qs:
        for blob in (q.get("question_html", ""), q.get("explanation_html", "")):
            for m in re.finditer(r'src="\./images/([^"]+)"', blob):
                img_set.add(m.group(1))
    inv = Path(__file__).parent / "images_needed.txt"
    inv.write_text("\n".join(sorted(img_set)) + "\n", encoding="utf-8")
    print(f"Wrote {inv} — {len(img_set)} unique image filenames needed at app/public/exams/az400/images/")


if __name__ == "__main__":
    main()
