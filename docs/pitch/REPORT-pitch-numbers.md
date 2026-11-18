# Branch report — `docs/pitch-numbers` (autonomy run, 18 Nov 2026)

Docs only: no code, no deploy, **0 VoiceLab credits**. Not merged into `REPORT.md`, so the main agent's log stays untouched (main agent: merge or link this).

## Done
- `docs/pitch/business.md`: every number TODO filled with a sourced figure or a marked estimate. That covers PISA 2022 (364, 19 % ≥ Level 2), 6.87 M pupils, tutor rates, prices, market size and the cost-per-learner table (≈ 19.4k → 5.8k so'm/month, 60 % → 88 % margin).
- `docs/pitch/mentor-qa.md` (new): 23 likely mentor questions with short answers + "things NOT to claim".
- `docs/pitch/legal.md`: adds the 27 Mar 2026 amendment to the personal-data law (mandatory localisation narrowed to biometric/genetic data) and our "stricter rule anyway" position, plus sources.
- `docs/pitch/stack.md`, `docs/ARCHITECTURE.md`: diagrams no longer claim KaTeX/rough.js/SVG characters (neither library is imported in `src/`). They now say handwriting engine + three.js tutor.
- `docs/pitch/pitch-script.md` (new): 3-minute pitch + demo-day checklist.

## Decisions (one line each)
- Worked in a separate worktree on a branch from `origin/main`: the main checkout was 5 commits behind and may be in use by another agent.
- Skipped `pnpm build` before committing: docs-only change (no files under `src/`), and the worktree has no node_modules.
- Left `REPORT.md` alone and wrote this file instead, to avoid conflicts with the main agent's log.
- Exchange rate fixed at 12,000 so'm/USD (CBU, 12 Nov 2026: 11,964–12,014).
- 1 credit ≈ 0.96 so'm, derived from VoiceLab's public LLM table ($0.65 = 8,125 credits); the official rate needs the API or Billing panel.
- TTS cost uses 1.5 credits/char (our credit log's rate), the expensive side: public docs say 1/char for `lison`.
- Premium 49,000 so'm/month and B2B 120,000 so'm/student/year are **hypotheses**, chosen at ~1/14 of a tutor and ≈ $10/yr. Both are labelled as such.
- Grades 5–9 ≈ 5/11 of all pupils (equal cohorts assumed) → ≈ 3.1 M.
- Proposed free tier (3 voice lessons/week, text answers for fresh questions) uses the existing captions-only path. **It isn't built**, and the Q&A says so.
- PISA: cite 2022 (latest published maths score). PISA 2025 left out Uzbekistan's maths because of data issues, and the Q&A covers it.
- Legal 2026 amendment stated as "reportedly", from press reports only; the lawyer TODO stays.

## Not done / left for the team (`TODO(team)`)
- STT rate (not public; VoiceLab Billing panel).
- Regional tutor prices (no public data found).
- Lawyer review (2026 text, children's data, registration); teacher review of the skill graph.

## Known issues
- All market/price numbers are advertised or secondary-source figures. Say "est." on stage.
- The free and Premium tiers and billing don't exist in the product yet.
