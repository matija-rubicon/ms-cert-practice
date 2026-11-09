# MS Cert Practice

Multi-exam practice tool for Microsoft Azure certifications. Approximates Microsoft's
scaled-score (0–1000, 700 to pass) scoring model with partial credit on multi-select questions.

Currently shipping with:

- **AZ-400** — Designing and Implementing Microsoft DevOps Solutions (thanks to Enis for providing the bank)
- **AZ-104** — Microsoft Azure Administrator (thanks to Matija for providing the bank)
- **AI-103** — Developing AI Apps and Agents on Azure (1,488 questions — thanks to Nihad for providing the bank)

## Run locally

```bash
cd app
npm install
npm run dev   # → http://localhost:5173
```

## Production build

```bash
npm run build
# dist/ is a static site. Host on any static server.
npm run preview   # serve the build locally
```

## Adding a new exam

1. Extract your question bank into JSON with this shape (see `src/types.ts > Question`):

   ```json
   [
     {
       "id": "q1",
       "type": "single",          // or "multiple"
       "category": "Compute",
       "question_html": "<p>...</p>",
       "options": [
         { "text": "Option A", "correct": false },
         { "text": "Option B", "correct": true }
       ],
       "explanation_html": "<p>Because...</p>"
     }
   ]
   ```

2. Save it at `public/exams/<exam-id>/questions.json`.

3. Add the exam entry to `public/exams/manifest.json`:
   - `id` matches the folder name
   - `available: true`
   - `passingScaled` (default 700)
   - `defaultQuestionCount` / `defaultTimeMinutes` from the official exam
   - `credit` (optional) — thank-you note shown on the exam card
   - `domains[]` — list each skill domain with its midpoint weight (0..1) and the
     question-bank categories that map to it. Weights should sum to ~1.0.

4. Reload — the app picks it up. No code change.

## Importing a scraped question bank

Practice-test banks arrive as saved HTML pages (e.g. a folder of `ex1.html`, `ex2.html`, ...).
Never ship them straight from the scrape: every bank so far needed a cleanup pass.

1. **Extract**: `python3 scripts/extract_wpproquiz.py <dir-with-html> <exam-id>`
   (`scripts/extract.py` for the older single-page format). Add a keyword → domain map for
   the exam in `EXAM_DOMAINS` first, using the official "skills measured" weights.
   The extractor runs `scripts/structure.py` and `scripts/textfix.py`, then applies
   `scripts/overrides/<exam-id>.json` and appends `scripts/authored/<exam-id>.json`.
2. **Check the output** (counts, category spread, types, duplicates, questions with no
   correct answer) and fix the extractor/structure pass rather than hand-editing
   `questions.json`. Hand-written fixes go in `scripts/overrides/<exam-id>.json` so they
   survive a re-extract.
3. **Review checklist**: go through the whole bank, not a sample:
   - **Text repair**: mojibake (`â€™`, `?` where `‑ → –` were lost), smart quotes inside code.
   - **Structure**: requirement/condition lines → lists; "Match the following" questions →
     numbered items with options reading `1 → X`; answer-bank letters resolved
     (`1 → C. Custom analyzer`); the actual question as its own paragraph.
   - **Code**: snippets, CLI commands, JSON/YAML → `<pre><code>` with sane indentation;
     command-like options flagged `code: true`.
   - **Explanations**: paragraphs instead of `<br/>` runs, "Why the other options are
     incorrect" as a list, trailing doc titles as a "Learn more" list.
   - **Answers**: answer key matches the explanation; flag suspicious keys in
     `scripts/overrides/FLAGS.md`.
   - **Exhibits**: missing/wrong images or external case-study links → disable the question
     (`disabled` + `disabled_reason` in overrides) if it can't be answered as presented.
   - **Source names**: no practice-site or vendor names anywhere (questions, image names,
     scripts, commits). `textfix.scrub_vendor` maps known ones to Microsoft's sample
     names (Contoso, Fabrikam); add new ones there.
4. Add the exam to `manifest.json` (with `credit` for whoever provided the bank) and render
   a few of each question shape in the browser before shipping.

## Password gate

The site shows a password screen (`src/components/PasswordGate.tsx`); once unlocked, the
browser remembers it. It is a client-side gate only: GitHub Pages has no server auth, so the
question files stay reachable by direct URL and in this public repo. Only a salted SHA-256
of the password is stored. To change the password:

```bash
printf '%s' 'mscert.gate.v1:<new password>' | shasum -a 256
```

Put the hash in `PASSWORD_SHA256`; to force everyone to re-enter it, also bump `UNLOCK_KEY`.

## Scoring model

Microsoft uses a scaled 0–1000 score with psychometric difficulty adjustment.
This app approximates with `scaled = round((earned / max) × 1000)`:

- Single-answer: 1 pt all-or-nothing.
- Multi-select: 1 pt per option matched correctly (correct picked OR wrong not picked).
- No negative scoring.
- Default pass: 700/1000.
- Domain-weighted sampling makes a single 50-question run reflect the real exam blueprint.

## History

Per-exam attempt history (most recent 200) is stored in `localStorage` under
`mscert.history.v1`. It is private to the browser — nothing is sent anywhere.
