"""Repair Windows-1252 mojibake left in scraped question text.

Two patterns show up in the source HTML:
  * raw cp1252 bytes decoded as Latin-1, e.g. "\\x96" instead of "–"
  * UTF-8 bytes of a smart quote whose lead byte was lost to "?",
    e.g. "team?\\x80\\x99s" instead of "team’s"
"""
import re

_CP1252 = {
    "\x80": "€", "\x82": "‚", "\x84": "„", "\x85": "…", "\x86": "†", "\x87": "‡",
    "\x89": "‰", "\x8b": "‹", "\x91": "‘", "\x92": "’", "\x93": "“", "\x94": "”",
    "\x95": "•", "\x96": "–", "\x97": "—", "\x98": "˜", "\x99": "™", "\x9b": "›",
}
_BROKEN_UTF8 = re.compile(r"\?\x80([\x80-\x9f]?)")
_UTF8_TAIL = {"\x98": "‘", "\x99": "’", "\x9c": "“", "\x9d": "”", "\x93": "–", "\x94": "—", "\xa6": "…"}


def fix_text(s: str) -> str:
    s = _BROKEN_UTF8.sub(lambda m: _UTF8_TAIL.get(m.group(1), ""), s)
    s = s.replace("​", "")
    return "".join(_CP1252.get(c, c) for c in s)


def fix_obj(obj):
    if isinstance(obj, str):
        return fix_text(obj)
    if isinstance(obj, list):
        return [fix_obj(x) for x in obj]
    if isinstance(obj, dict):
        return {k: fix_obj(v) for k, v in obj.items()}
    return obj


# ---------------------------------------------------------------------------
# Code blocks: the source pages render scripts as plain text lines joined with
# <br/>, with "--" turned into "–" and straight quotes into smart quotes.
# Detect those runs of lines and turn them into <pre><code> blocks.

_HTML_TAGS = {
    "a", "b", "blockquote", "br", "code", "div", "em", "h1", "h2", "h3", "h4", "h5", "h6",
    "hr", "i", "img", "li", "ol", "p", "pre", "s", "span", "strong", "sub", "sup", "table",
    "tbody", "td", "th", "thead", "tr", "u", "ul",
}
_TAG = re.compile(r"<(/?)([a-zA-Z][\w-]*)([^<>]*)>")


def _escape_fake_tags(html: str) -> str:
    """`<resource-group-name>` placeholders got parsed as tags; show them as text."""
    def repl(m):
        closing, name = m.group(1), m.group(2).lower()
        if name in _HTML_TAGS:
            return m.group(0)
        return "" if closing else f"&lt;{m.group(2)}{m.group(3)}&gt;"
    return _TAG.sub(repl, html)


_CODE_START = re.compile(r"""^\s*(
    (az|kubectl|docker|helm|git|terraform)\s
  | [A-Z][a-z]+-Az[A-Za-z]+\b | [A-Z][a-z]+-AzureRm[A-Za-z]+\b
  | SLOT_\d\s+(-|\\|$) | az\sSLOT_\d
  | \$\w+\s*=
  | (C|c)onfiguration\s+\w+\s*\{?$
  | [{\[]$
  | ["“][\w$.-]+["”“]\s*:\s*[\[{]?
  | trigger:$
)""", re.X)
_PROSE = re.compile(
    r"^\s*(Which|What|How|To |You |Select|Identify|In the above|Cleanup|Prune|Below|Please)\b"
    r"|\s(is|are) (the|an?) (CORRECT|INCORRECT)\b| because | – This\b"
)


def _is_code_line(text: str) -> bool:
    t = text.strip()
    if not t:
        return False
    if _PROSE.search(t):
        return False
    return True


_CODE_CHARS = re.compile(r"^\s*([-–{}\[\]$`#\"“]|SLOT_\d)|[\\`{\[:,]\s*$| = ")


def _looks_code(text: str) -> bool:
    t = text.replace("\xa0", " ").strip()
    if len(t.split()) >= 6 and re.match(r"[A-Za-z]", t) and not _CODE_START.match(t):
        return False                                    # a sentence, e.g. "Few reference links ...:"
    return bool(_CODE_START.match(t) or _CODE_CHARS.search(t))


def _clean_code(text: str) -> str:
    text = text.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
    text = re.sub(r"–(eq|ne|gt|ge|lt|le|like|notlike|match|notmatch|contains|and|or|not)\b", r"-\1", text)
    text = re.sub(r"(?<![\w\s])?–(?=[a-zA-Z])", "--", text)   # –name  -> --name
    text = re.sub(r"(^|\s)–(?=[a-zA-Z])", r"\1--", text)
    text = re.sub(r"^(\s*)– ", r"\1- ", text)                   # YAML list item
    return text.replace("\xa0", " ").rstrip()


def _reindent_braces(lines):
    out, depth = [], 0
    for ln in lines:
        t = ln.strip()
        if t[:1] in "}]":
            depth = max(0, depth - 1)
        out.append("  " * depth + t if t else "")
        opens = t.count("{") + t.count("[") - t.count("}") - t.count("]")
        if t[:1] in "}]":
            opens += 1
        depth = max(0, depth + opens)
    return out


def _reindent_yaml_trigger(lines):
    out, key_depth = [], 0
    for ln in lines:
        t = ln.strip()
        if t.startswith("- "):
            out.append("  " * (key_depth + 1) + t)
            continue
        key = t.split(":")[0]
        d = 0 if key == "trigger" else 1 if key in ("branches", "paths", "tags", "batch") else 2
        key_depth = d
        out.append("  " * d + t)
    return out


def _format_block(lines):
    lines = [_clean_code(l) for l in lines]
    while lines and not lines[-1].strip():
        lines.pop()
    flat = all(not l.startswith((" ", "\t")) for l in lines)
    if flat and lines[0].strip() == "trigger:":
        lines = _reindent_yaml_trigger(lines)
    elif flat and any(l.strip() and (l.strip()[0] in "{[" or l.strip()[-1] in "{[") for l in lines):
        lines = _reindent_braces(lines)
    body = "\n".join(lines)
    body = body.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    body = body.replace("&amp;lt;", "&lt;").replace("&amp;gt;", "&gt;").replace("&amp;amp;", "&amp;")
    return f"<pre><code>{body}</code></pre>"


def format_code_blocks(html: str) -> str:
    if not html or "<pre" in html:
        return html
    html = _escape_fake_tags(html)
    # Only handle plain <p>/<br> markup; richer HTML is already formatted.
    if re.search(r"<(?!/?(p|br|a)\b)[a-zA-Z/]", html):
        return html
    paras = re.findall(r"<p>(.*?)</p>", html, re.S)
    if not paras or re.sub(r"<p>.*?</p>|\s", "", html, flags=re.S):
        return html
    # Flatten into lines, marking paragraph breaks with None.
    lines = []
    for p in paras:
        if lines:
            lines.append(None)
        lines += [l.strip("\n") for l in re.split(r"<br\s*/?>\n?", p)]

    def plain(l):
        return l is not None and "<" not in l

    out, i, changed = [], 0, False
    while i < len(lines):
        l = lines[i]
        if plain(l) and _CODE_START.match(l.replace("\xa0", " ")) and not _PROSE.search(l):
            j, block = i, []
            while j < len(lines):
                cur = lines[j]
                if cur is None:
                    nxt = lines[j + 1] if j + 1 < len(lines) else None
                    if plain(nxt) and _is_code_line(nxt) and _looks_code(nxt):
                        block.append(""); j += 1; continue
                    break
                if not plain(cur) or not _is_code_line(cur):
                    break
                block.append(cur); j += 1
            if len(block) >= 2 or (block and re.search(r"SLOT_\d|\$\w+|--|–\w|^(git|az|kubectl|docker|helm)\s|^[A-Z][a-z]+-Az", block[0])):
                out.append(("code", block)); i = j; changed = True; continue
        out.append(("text", l)); i += 1
    if not changed:
        return html

    parts, buf = [], []
    def flush():
        if buf:
            parts.append("<p>" + "<br/>\n".join(buf) + "</p>")
            buf.clear()
    for kind, v in out:
        if kind == "code":
            flush(); parts.append(_format_block(v))
        elif v is None:
            flush()
        elif v.strip():
            buf.append(v)
    flush()
    return "\n".join(parts)


_CODE_OPTION = re.compile(
    r"^([A-F]\.\s*)?("
    r"(az|kubectl|docker|git|helm)(\s|$)|[A-Z][a-z]+-[A-Z][A-Za-z]+$|–[a-z]|--[a-z]|param\s"
    r"|.*\|\s*where\b|search in \("
    r")"
)


def fix_option(opt: dict) -> dict:
    """Options are plain text; turn stray <br/> markup into newlines and
    flag commands/snippets so the UI can render them monospaced."""
    t = opt.get("text") or ""
    t = re.sub(r"<br\s*/?>", "\n", t).replace("\xa0", " ")
    t = "\n".join(l.rstrip() for l in t.split("\n"))
    t = re.sub(r"\n{2,}", "\n", t).strip()
    t = re.sub(r"^\?(?=git\b)", "", t)          # lost nbsp before "git"
    opt = {k: v for k, v in opt.items() if k != "code"}
    if _CODE_OPTION.match(t):
        t = "\n".join(_clean_code(l) for l in t.split("\n"))
        opt["code"] = True
    opt["text"] = t
    return opt


def fix_questions(qs):
    qs = fix_obj(qs)
    for q in qs:
        for k in ("question_html", "explanation_html"):
            q[k] = format_code_blocks(q.get(k) or "")
        q["options"] = [fix_option(o) for o in q.get("options", [])]
    return qs


if __name__ == "__main__":
    import json, sys
    for path in sys.argv[1:]:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(fix_questions(data), f, ensure_ascii=False, separators=(",", ":"))
        print("fixed", path)
