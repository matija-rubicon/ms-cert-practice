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


if __name__ == "__main__":
    import json, sys
    for path in sys.argv[1:]:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(fix_obj(data), f, ensure_ascii=False, separators=(",", ":"))
        print("fixed", path)
