#!/usr/bin/env python3
"""
Extract skillcertpro WP-Pro-Quiz HTML dumps into questions.json.

Handles the raw "Answer Review" summary pages saved from skillcertpro
(WordPress wpProQuiz plugin). Reads every *.html in a directory, dedups
questions across exams, auto-classifies each into an exam domain, and
writes public/exams/<exam-id>/questions.json.

Usage:
  python3 scripts/extract_skillcertpro.py <dir-with-html> [exam-id]

  <dir-with-html>  folder containing exam1.html, exam2.html, ...
  exam-id          default: az104
"""
import json
import re
import sys
import hashlib
from pathlib import Path

try:
    from bs4 import BeautifulSoup
except ImportError:
    sys.exit("Need beautifulsoup4:  pip3 install beautifulsoup4")

if len(sys.argv) < 2:
    print(__doc__)
    sys.exit(1)

SRC_DIR = Path(sys.argv[1]).expanduser().resolve()
EXAM_ID = sys.argv[2] if len(sys.argv) > 2 else "az104"
APP_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = APP_ROOT / "public" / "exams" / EXAM_ID
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT = OUT_DIR / "questions.json"

# ---------------------------------------------------------------------------
# Keyword -> domain classification (AZ-104 blueprint). Order matters: first
# domain whose keywords hit wins; ties broken by score. Falls back to the
# highest-scoring domain, or "Compute" if nothing matches.
# ---------------------------------------------------------------------------
DOMAIN_KEYWORDS = {
    "Identity & Governance": [
        "entra", "azure ad", "active directory", "rbac", "role assignment",
        "role-based", "policy", "initiative", "management group", "subscription",
        "tag", "resource lock", "conditional access", "mfa", "sso", "guest user",
        "tenant", "identity", "governance", "blueprint", "custom role", "pim",
        "self-service password", "sspr", "administrative unit", "license",
    ],
    "Storage": [
        "storage account", "blob", "container", "file share", "azure files",
        "queue storage", "table storage", "sas", "shared access signature",
        "storage tier", "lifecycle management", "azcopy", "storage explorer",
        "soft delete", "immutable", "geo-redundant", "grs", "lrs", "zrs",
        "access key", "storage replication", "azure file sync", "data lake",
    ],
    "Compute": [
        "virtual machine", "vm-", "vm ", "vmss", "scale set", "availability set",
        "availability zone", "app service", "web app", "container instance",
        "aci", "aks", "kubernetes", "container app", "function app", "azure function",
        "app service plan", "vm size", "managed disk", "os disk", "vm extension",
        "custom script", "desired state", "dsc", "image", "gallery", "spot",
        "dedicated host", "runbook", "automation account",
    ],
    "Virtual Networking": [
        "virtual network", "vnet", "subnet", "nsg", "network security group",
        "load balancer", "application gateway", "front door", "traffic manager",
        "public ip", "private endpoint", "private link", "peering", "vpn gateway",
        "expressroute", "route table", "user-defined route", "udr", "dns",
        "nat gateway", "bastion", "network interface", "service endpoint",
        "firewall", "cidr", "ip address", "gateway",
    ],
    "Monitor & Maintain": [
        "azure monitor", "log analytics", "kusto", "kql", "metric", "alert",
        "action group", "diagnostic setting", "application insights", "workbook",
        "backup", "recovery services vault", "azure backup", "site recovery",
        "asr", "restore", "network watcher", "connection monitor", "activity log",
        "update management", "monitor", "retention",
    ],
}
FALLBACK_DOMAIN = "Compute"


def classify(text):
    t = text.lower()
    best, best_score = FALLBACK_DOMAIN, 0
    for domain, kws in DOMAIN_KEYWORDS.items():
        score = sum(t.count(kw) for kw in kws)
        if score > best_score:
            best, best_score = domain, score
    return best


def clean_html(node):
    """Serialize a bs4 node's children to a compact HTML string, rewriting
    <img src> to ./images/<basename> with a hide-on-error handler, and
    dropping noisy attrs — mirrors the AZ-400 extract.py conventions."""
    if node is None:
        return ""
    # drop the "Correct"/"Incorrect" heading + respone_span
    for junk in node.select(".wpProQuiz_respone_span"):
        junk.decompose()
    for h3 in node.find_all(["h3"]):
        if h3.get_text(strip=True).lower() in ("correct", "incorrect"):
            h3.decompose()
    for img in node.find_all("img"):
        for a in ("srcset", "sizes", "decoding", "loading", "onclick", "class",
                  "width", "height", "style"):
            if img.has_attr(a):
                del img[a]
        src = img.get("src", "")
        if src and not src.startswith("data:"):
            img["src"] = f"./images/{src.rsplit('/', 1)[-1]}"
        img["onerror"] = "this.style.display='none'; this.dataset.broken='1'"
    for tag in node.find_all(True):
        if tag.has_attr("onclick"):
            del tag["onclick"]
        if tag.has_attr("style"):
            del tag["style"]
    inner = node.decode_contents()
    inner = re.sub(r">\s+<", "><", inner)
    return inner.strip()


def parse_file(path):
    soup = BeautifulSoup(path.read_text(encoding="utf-8"), "html.parser")
    out = []
    skipped = {}
    for li in soup.select("li.wpProQuiz_listItem"):
        qtext_div = li.select_one(".wpProQuiz_question_text")
        ul = li.select_one("ul.wpProQuiz_questionList")
        if not qtext_div or not ul:
            continue
        qtype = ul.get("data-type", "single")
        if qtype not in ("single", "multiple"):
            skipped[qtype] = skipped.get(qtype, 0) + 1
            continue

        options = []
        for item in ul.select("li.wpProQuiz_questionListItem"):
            classes = item.get("class", [])
            correct = "wpProQuiz_answerCorrect" in classes
            label = item.find("label")
            txt_src = label if label else item
            # remove the hidden "1." numbering span + the input
            for junk in txt_src.select("span[style*='display:none'], span[style*='display: none']"):
                junk.decompose()
            for inp in txt_src.find_all("input"):
                inp.decompose()
            text = clean_html(txt_src)
            options.append({"correct": correct, "text": text})

        # explanation: the .wpProQuiz_correct block inside .wpProQuiz_response
        expl_node = li.select_one(".wpProQuiz_response .wpProQuiz_correct")
        explanation_html = clean_html(expl_node) if expl_node else ""

        question_html = clean_html(qtext_div)

        out.append({
            "type": qtype,
            "question_html": question_html,
            "options": options,
            "explanation_html": explanation_html,
        })
    return out, skipped


def main():
    files = sorted(SRC_DIR.glob("*.html"))
    if not files:
        sys.exit(f"No .html files in {SRC_DIR}")

    all_q = []
    seen = {}
    dup = 0
    for f in files:
        qs, skipped = parse_file(f)
        kept = 0
        for q in qs:
            # dedup on normalized question text
            key = hashlib.md5(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ",
                              q["question_html"])).strip().lower().encode()).hexdigest()
            if key in seen:
                dup += 1
                continue
            seen[key] = True
            all_q.append(q)
            kept += 1
        extra = f"  (skipped types: {skipped})" if skipped else ""
        print(f"{f.name}: {len(qs)} parsed, {kept} new{extra}")

    # drop questions with no correct option
    broken = [q for q in all_q if not any(o["correct"] for o in q["options"])]
    if broken:
        print(f"Dropping {len(broken)} questions with no marked correct option")
        all_q = [q for q in all_q if any(o["correct"] for o in q["options"])]

    # assign ids + categories
    cat_count = {}
    for i, q in enumerate(all_q, 1):
        q["id"] = f"q{i}"
        blob = q["question_html"] + " " + " ".join(o["text"] for o in q["options"])
        cat = classify(blob)
        q["category"] = cat
        cat_count[cat] = cat_count.get(cat, 0) + 1
        # reorder keys to match az400 shape
        q_ord = {"id": q["id"], "type": q["type"], "category": q["category"],
                 "question_html": q["question_html"], "options": q["options"],
                 "explanation_html": q["explanation_html"]}
        all_q[i - 1] = q_ord

    print(f"\nTotal unique questions: {len(all_q)}  (dropped {dup} cross-exam duplicates)")
    print("Category distribution:")
    for c, n in sorted(cat_count.items(), key=lambda x: -x[1]):
        print(f"  {n:4d}  {c}")

    OUT.write_text(json.dumps(all_q, ensure_ascii=False, separators=(",", ":")),
                   encoding="utf-8")
    print(f"\nWrote {OUT} ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
