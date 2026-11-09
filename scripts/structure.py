"""Give flat scraped questions real structure.

Some banks (AI-103) store everything as <p> blocks with <br/> line breaks:
requirement lists, answer banks, "match the following" items, code
snippets, and the explanation's "why the others are wrong" bullets and
reference titles. This pass turns those into lists, code blocks and
paragraphs, and rewrites positional "match" options so each line says
which requirement it answers ("1 → Mask").

Runs on freshly extracted questions, before textfix.fix_questions.
"""
import re
from html import unescape as html_unescape
from urllib.parse import quote_plus

_BR = re.compile(r"<br\s*/?>\s*", re.I)
_PARA = re.compile(r"<p(?:\s[^>]*)?>(.*?)</p>", re.S | re.I)
_RICH = re.compile(r"<(ul|ol|li|div|pre|table|h\d)\b", re.I)

_HEADINGS = {"requirements", "answer bank", "choices", "constraints", "goals",
             "scenario", "exhibit", "observed behaviour", "observed behavior",
             "overall explanation", "correct", "incorrect"}
_MATCH_INTRO = re.compile(r"^match the following:?$", re.I)
_NUMBERED = re.compile(r"^\d+[.)]\s+")
_LETTERED = re.compile(r"^([A-H])[.)]\s+")
_BULLET = re.compile(r"^[•·▪●]\s*|^[-–]\s+")
_LEARN_MORE_END = re.compile(r"[.!?:;)\"”’]$")


def _plain(s):
    return re.sub(r"<[^>]+>", "", s).strip()


def _lines(html):
    """Flatten <p>/<br/> markup into lines; None marks a paragraph break."""
    out = []
    for p in _PARA.findall(html):
        if out:
            out.append(None)
        out += [l.strip() for l in _BR.split(p)]
    return [l for l in out if l != ""]


_CODEISH = re.compile(
    r"^[{}\[\]()]|[{}\[\]()(,;:\\]$|\w\(|^[\w.]+\s*=|^[“”\"']?[\w$.-]+[“”\"']?\s*:\s*\S|^–\w|^--\w"
    r"|^(az|from|import|for|def|print|return|if|curl)\b")


def _codeish(line):
    t = _plain(line)
    if t.endswith(":") and len(t.split()) >= 4 and not re.search(r"[(=\[{]|^(for|with|if|def|while|class)\b", t):
        return False        # prose lead-in such as "The request content can then include:"
    if len(t.split()) >= 8 and t.endswith(".") and not _CODEISH.search(t):
        return False
    return bool(_CODEISH.search(t))


def _code_html(lines):
    code = _reindent([_fix_code_line(l) for l in lines])
    code = [re.sub(r"^(\s*)–(?=\w)", r"\1--", l) for l in code]
    return f"<pre><code>{_escape(chr(10).join(code))}</code></pre>"


def _is_heading(line):
    t = _plain(line).rstrip(":").strip().lower()
    if t.startswith("why the other options"):
        return True
    if t == "refer to" or "<a " in line:
        return False
    if t in _HEADINGS:
        return True
    return line.endswith(":") and len(line) <= 80 and not _BULLET.match(line)


def _list_html(items, ordered):
    strip = _NUMBERED if all(_NUMBERED.match(i) for i in items) else _BULLET
    if strip is _NUMBERED:
        ordered = True
    lis = "".join(f"<li>{strip.sub('', i)}</li>" for i in items)
    tag = "ol" if ordered else "ul"
    return f"<{tag}>{lis}</{tag}>"


def _fix_code_line(line):
    line = re.sub(r"<[^>]+>", "", line)
    for a, b in (("“", '"'), ("”", '"'), ("″", '"'), ("‘", "'"), ("’", "'"), ("\xa0", " ")):
        line = line.replace(a, b)
    return line.rstrip()


def _reindent(lines):
    """Rebuild indentation from bracket depth when the source flattened it."""
    if any(l.startswith((" ", "\t")) for l in lines):
        return lines
    out, depth = [], 0
    for l in lines:
        t = l.strip()
        lead = len(t) - len(t.lstrip(")]}"))
        out.append("    " * max(0, depth - lead) + t)
        depth = max(0, depth + sum(t.count(c) for c in "([{") - sum(t.count(c) for c in ")]}"))
    return out


def _escape(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _snippet(lines, i):
    """lines[i] is "Snippet": code runs to the closing question line."""
    end = len(lines)
    for j in range(len(lines) - 1, i, -1):
        if lines[j] is not None and _plain(lines[j]).endswith("?"):
            end = j
            break
    code = [_fix_code_line(l) for l in lines[i + 1:end] if l is not None]
    code = _reindent(code)
    return f"<pre><code>{_escape(chr(10).join(code))}</code></pre>", end


def structure_question_html(html):
    """Returns (html, info) where info carries match items / answer bank for options."""
    info = {"match_items": None, "bank": {}}
    if not html or _RICH.search(html):
        return html, info
    lines = _lines(html)
    if not lines:
        return html, info

    real = [k for k, l in enumerate(lines) if l is not None]
    has_intro = any(l and _MATCH_INTRO.match(_plain(l)) for l in lines)
    if not has_intro and real and _plain(lines[real[-1]]).lower() == "choices:":
        # "Match each requirement ...<br/>item<br/>item<br/>Choices:" — mark where items start
        intro = [k for k in real[:-1] if re.search(r"\bmatch\b", _plain(lines[k]), re.I)]
        if intro:
            lines.insert(intro[-1] + 1, "Match the following:")
            has_intro = True
    is_match = has_intro
    blocks, prose = [], []

    def flush():
        if prose:
            blocks.append("<p>" + "<br/>".join(prose) + "</p>")
            prose.clear()

    i = 0
    while i < len(lines):
        l = lines[i]
        if l is None:
            flush(); i += 1; continue
        t = _plain(l)
        if t.lower() == "snippet":
            flush()
            code, i = _snippet(lines, i)
            blocks.append(code)
            continue
        if t.lower() == "choices:" or (_MATCH_INTRO.match(t)):
            # The match items follow "Match the following:"; "Choices:" is a dangling label.
            flush()
            if _MATCH_INTRO.match(t):
                if not blocks:
                    blocks.append("<p>Match each item to the correct option.</p>")
                j = i + 1
                while j < len(lines) and (lines[j] is None or _is_heading(lines[j])):
                    j += 1          # paragraph break or a "Requirements:" label
                items = []
                while j < len(lines) and lines[j] is not None and _plain(lines[j]).lower() != "choices:":
                    items.append(lines[j]); j += 1
                if items:
                    blocks.append(_list_html(items, ordered=True))
                    info["match_items"] = len(items)
                i = j
                continue
            i += 1
            continue
        if _is_heading(l):
            j = i + 1
            items = []
            while j < len(lines) and lines[j] is not None:
                nt = _plain(lines[j])
                if nt.lower() == "choices:" or _is_heading(lines[j]) or \
                        (nt.endswith("?") and not _LETTERED.match(nt) and not _NUMBERED.match(nt)):
                    break
                items.append(lines[j]); j += 1
            if len(items) >= 2:
                flush()
                head = t.rstrip(":")
                blocks.append(f"<p><strong>{head}</strong></p>" if t.lower().rstrip(":") in _HEADINGS
                              else f"<p>{l}</p>")
                lettered = all(_LETTERED.match(_plain(x)) for x in items)
                if lettered:
                    for x in items:
                        m = _LETTERED.match(_plain(x))
                        info["bank"][m.group(1)] = _plain(x)[m.end():].strip()
                    blocks.append("<ul class=\"answer-bank\">" + "".join(f"<li>{x}</li>" for x in items) + "</ul>")
                else:
                    ordered = is_match or head.lower() == "requirements"
                    blocks.append(_list_html(items, ordered))
                    if is_match and info["match_items"] is None:
                        info["match_items"] = len(items)
                i = j
                continue
        if t.endswith("?") and i == max(k for k, x in enumerate(lines) if x is not None):
            flush()
            blocks.append(f"<p>{l}</p>")
            i += 1
            continue
        prose.append(l)
        i += 1
    flush()
    return "".join(blocks), info


_REQ_MAP = re.compile(r"^([A-H])\s*=\s*Requirement\s*(\d+)$", re.I)
_NUM_MAP = re.compile(r"^(\d+)\s*=\s*(.+)$")


def structure_options(options, info):
    out = []
    for o in options:
        t = _BR.sub("\n", o["text"]).replace("\xa0", " ")
        lines = [l.strip() for l in t.split("\n") if l.strip()]
        head = lines[0] if lines and re.fullmatch(r"[A-H][.)]", lines[0]) else None
        body = lines[1:] if head else lines
        maps = [_REQ_MAP.match(l) for l in body]
        nums = [_NUM_MAP.match(l) for l in body]
        if body and all(nums):
            body = [f"{m.group(1)} → {m.group(2).strip()}" for m in nums]
        elif body and all(maps):
            pairs = sorted((int(m.group(2)), m.group(1).upper()) for m in maps)
            body = [f"{n} → {L}" + (f". {info['bank'][L]}" if L in info["bank"] else "") for n, L in pairs]
        elif info["match_items"] and len(body) == info["match_items"] and len(body) > 1:
            body = [f"{n} → {x}" for n, x in enumerate(body, 1)]
        else:
            out.append(o)
            continue
        out.append({**o, "text": "\n".join(([head] if head else []) + body)})
    return out


def _learn_link(title):
    """The source kept reference titles but lost their URLs; search Microsoft Learn instead."""
    if "<a " in title:
        return title
    q = quote_plus(html_unescape(_plain(title)))
    return f'<a href="https://learn.microsoft.com/en-us/search/?terms={q}">{title}</a>'


def structure_explanation(html):
    if not html:
        return html
    html = re.sub(r"^\s*(<br\s*/?>\s*)+", "", html)
    # Pasted rich-text answers: drop wrapper <div>s, headings -> bold paragraphs
    html = re.sub(r"</?div[^>]*>", "", html)
    html = re.sub(r"<h[1-6][^>]*>(.*?)</h[1-6]>", r"<p><strong>\1</strong></p>", html, flags=re.S)
    html = re.sub(r"<p>\s*</p>", "", html)
    if _RICH.search(html):
        return html
    lines = _lines(html)
    if not lines:
        return html

    # Trailing doc titles (no sentence punctuation) are the source's reference links.
    refs = []
    while lines and lines[-1] is not None:
        t = _plain(lines[-1])
        if t and len(t) <= 150 and not _LEARN_MORE_END.search(t) and not _BULLET.match(t) \
                and not _LETTERED.match(t) and not _is_heading(lines[-1]):
            refs.insert(0, lines.pop())
        else:
            break
    if len(refs) == len([l for l in lines + refs if l is not None]):
        refs = []           # whole explanation is short title-like text; leave it
        lines = _lines(html)

    blocks, i = [], 0
    while i < len(lines):
        l = lines[i]
        if l is None:
            i += 1; continue
        t = _plain(l)
        if t.endswith(":") and not t.lower().startswith("why ") and i + 1 < len(lines) \
                and lines[i + 1] is not None and _codeish(lines[i + 1]):
            # "The corrected command is:" + code lines (possibly "for x in y:" itself)
            j, code = i + 1, []
            if _codeish(l) and not re.search(r"\s(is|are|resembles|follows this shape|include)\s*:?$", t):
                code.append(l)
            else:
                blocks.append(f"<p>{l}</p>")
            while j < len(lines):
                nl = lines[j]
                if nl is None:
                    if j + 1 < len(lines) and lines[j + 1] is not None and _codeish(lines[j + 1]):
                        j += 1; continue
                    break
                nt = _plain(nl)
                if nt.lower().startswith("why the other options") or nt.lower().rstrip(":") in _HEADINGS \
                        or not _codeish(nl):
                    break
                code.append(nl); j += 1
            blocks.append(_code_html(code))
            i = j
            continue
        if _is_heading(l):
            j, items = i + 1, []
            while j < len(lines) and lines[j] is not None and not _is_heading(lines[j]):
                nt = _plain(lines[j])
                listy = bool(_BULLET.match(nt) or _LETTERED.match(nt))
                if items and listy != bool(_BULLET.match(_plain(items[0])) or _LETTERED.match(_plain(items[0]))):
                    break
                items.append(lines[j]); j += 1
            short = len(t) <= 45 or t.lower().startswith("why ")
            blocks.append(f"<p><strong>{t.rstrip(':')}</strong></p>" if short else f"<p>{l}</p>")
            listy = t.lower().startswith("why ") or any(
                _BULLET.match(_plain(x)) or _LETTERED.match(_plain(x)) for x in items)
            if items and listy:
                blocks.append(_list_html(items, ordered=False))
            else:
                blocks += [f"<p>{x}</p>" for x in items]
            i = j
            continue
        if _BULLET.match(t):
            j, items = i, []
            while j < len(lines) and lines[j] is not None and _BULLET.match(_plain(lines[j])):
                items.append(lines[j]); j += 1
            blocks.append(_list_html(items, ordered=False))
            i = j
            continue
        blocks.append(f"<p>{l}</p>")
        i += 1
    blocks = [b for b in blocks if not re.fullmatch(r"<p>(<strong>\s*</strong>|\s*)</p>", b)]
    if refs:
        blocks.append("<p><strong>Learn more</strong></p>")
        blocks.append("<ul>" + "".join(f"<li>{_learn_link(r)}</li>" for r in refs) + "</ul>")
    return "".join(blocks)


def structure_questions(qs):
    for q in qs:
        q["question_html"], info = structure_question_html(q.get("question_html") or "")
        q["options"] = structure_options(q.get("options") or [], info)
        q["explanation_html"] = structure_explanation(q.get("explanation_html") or "")
    return qs
