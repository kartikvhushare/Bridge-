# Bridge — Phase 3 (Vite project split)

Source of truth for this split: `bridge-latest.html`, md5 `a9e5b9b6…`, 11,781 lines. Identical behavior, zero visual change.

## Commands

```
npm install
npm run dev        # local dev server
npm run test       # vitest — 3 harnesses, 46 tests / 61 assertions
npm run build      # production build → dist/
npm run preview    # serve the production build locally
```

## Deploy (Vercel)

Framework preset: **Vite**. Push/upload this whole folder (GitHub web upload works — Vercel auto-builds). `vercel.json` here is an empty placeholder — if your previous deployment had a real one, restore it over this file.

## How the split works (read before editing)

The original app was ONE classic `<script>` — every function and variable was a global. The split preserves that world:

- Each module is a **verbatim cut** of the original statements (proven byte-identical by the splitter, `work/split-report.txt`). Comments travel with the statement that follows them.
- At the end of every module, an auto-generated block does `window.foo=foo;` for each declaration. Cross-file references and inline `onclick="App.x()"` handlers resolve through `window`, exactly as before. **When you add a new top-level function a page needs, add it to that file's window-attach block.**
- 22 top-level `let`s that get **reassigned** (e.g. `DB`, `CLD`, `RUN`, `_QED`, `_AF…`) were converted to `window.X = init;` at the declaration site — required so reassignment in one file is seen by all others. These are the ONLY statements that differ from the original (list in `work/split-report.txt`).
- `src/main.js` imports every module in a verified execution order, then runs the boot block (moved from mid-file; in the original, function hoisting made its position irrelevant). **Don't reorder the imports** without re-checking top-level dependencies.
- `index.html` keeps the original head verbatim: Tailwind CDN + config, fonts, supabase-js and Chart.js as classic scripts (they load before the module bundle by spec). Both original `<style>` blocks live in `src/styles.css` (`#polish` appended, cascade order preserved).

## Layout vs the plan

As per PHASE3_PLAN, plus a few files the code's real shape required: `engine/hrm.js` (leave/attendance/accrual/geofence engine), `pages/teamview.js`, `pages/profile.js`, `pages/notifications.js`, `pages/announcements.js`, `pages/login.js`. Supabase mappers scattered through the HRM block (`_mFlow…_delRow`, `_mSv…_svARow`, `queueEmail`) were gathered into `src/supabase.js` per the plan.

## Verification performed

- `npm run build` clean; built bundle boots to the login screen in jsdom with **zero console errors** (Supabase stubbed).
- Route sweep: all **31 routes** render clean as a seeded Super Admin.
- Tests: perms 26 asserts · OKR 20 · payroll 15 — all green.
- Traps honored: localStorage keys (`shiftly_v3`, `bridge_login_rl`, …) byte-identical; `_seedRoleProfiles` `_v:'5'` untouched; function declarations kept as declarations; no template strings were added or edited (`esc()` coverage unchanged).
- Known pre-existing quirk preserved as-is: `taskName` is read undeclared inside the feedback-push path (original line 8113) — it would throw there in the original too if that path ran with no surrounding declaration.

## Final check against the live database

The one thing the sandbox could not do: click through against real Supabase. After deploying a preview, do one loop — login → clock in → checklist → approvals → payroll page — before promoting.
