# MS Cert Practice

Multi-exam practice tool for Microsoft Azure certifications. Approximates Microsoft's
scaled-score (0–1000, 700 to pass) scoring model with partial credit on multi-select questions.

Currently shipping with:

- **AZ-400** — Designing and Implementing Microsoft DevOps Solutions (908 questions)
- *Stubs for AZ-104, AZ-204, AZ-305 — drop in a `questions.json` to enable.*

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
   - `domains[]` — list each skill domain with its midpoint weight (0..1) and the
     question-bank categories that map to it. Weights should sum to ~1.0.

4. Reload — the app picks it up. No code change.

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
