# MS Cert Practice

Static React/Vite quiz app; question banks live in `public/exams/<exam-id>/questions.json`,
registered in `public/exams/manifest.json`. Pushing to `main` deploys to GitHub Pages.

## When importing or editing a question bank

Follow **README.md → "Importing a scraped question bank"**. In short:

- Never ship a scraped bank as-is. Review every question for text repair, list/match
  structure, code blocks, explanation formatting, answer-key sanity, and missing exhibits.
- Fix things in the pipeline (`scripts/extract_wpproquiz.py`, `scripts/structure.py`,
  `scripts/textfix.py`) or in `scripts/overrides/<exam-id>.json`, not by hand-editing
  `questions.json`, so a re-extract reproduces the result.
- Never write practice-site or vendor names anywhere: code, comments, data, docs, commit
  messages. Use neutral wording ("practice-test HTML dump") and Microsoft sample names
  (Contoso, Fabrikam). `textfix.scrub_vendor` holds the known names ROT13-encoded.
- Credit whoever provided a bank via the manifest `credit` field.
