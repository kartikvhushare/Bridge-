# Evarca — Phase 3 (Vite project split) + Phase 4 (product changes)

Source of truth for this split: `bridge-latest.html`, md5 `a9e5b9b6…`, 11,781 lines. Identical behavior, zero visual change.

## Phase 4 changes (July 2026)

1. **Rename Bridge → Evarca** — every user-visible string, logo letter, email template, CSV filename prefix, page title, package name. Internal localStorage keys (`shiftly_v3`, `bridge_login_rl`, `bridge_how_*`, `bridge_setup_dismissed`, `bridge_triggers_*`) are intentionally UNCHANGED so existing sessions/data survive.
2. **Referential-integrity delete guards** — `guardDelete(type,id,label)` + `_refLinks` in `src/ui/helpers.js`. Deleting a user / department / location / checklist / question / folder / OKR / role / letter template is blocked while live records still point at it; a modal names each link and how to clear it. History (past submissions, decided approvals) never blocks — Disable retires a person.
3. **Per-feature in-app notification switches** — `hrmConfig.inappKinds` mirrors `emailKinds`; chips in HR Config → Alerts. Gated in `notify()`, `_hrmNotify()` and every direct `DB.notifications.unshift` page site via `_inappOn(kind)` (`src/engine/triggers.js`).
4. **Settings → Workflow tab removed** — its 4 toggles were written but never read anywhere (verified by grep); approval/edit behavior is governed per-checklist and by Access Control. Stale `S.filters.stab==='workflow'` falls back to In-App.
5. **WFH eligibility toggle** — `u.hrm.wfhEligible` (default: NOT eligible), set in the user editor. Gates the "Mark today WFH" button (mychecklists) and `App._togWFH` (dashboard).
6. **Assets on the user record** — `u.hrm.assets[]` (name, category, serial, assigned date, notes, status Assigned/Returned + return date), managed in the user editor (`_assetsSection`, users.js), read-only "Assets assigned to me" card on Profile. Rides the existing `user_hrm` sync; an unreturned asset blocks user deletion.
7. **Mobile Wave 2** (styles.css) — 16px form controls on ≤767px (kills iOS focus-zoom), modal 3-column field grids collapse to 2, canvas/img overflow guard, ≥44px modal buttons, review-table scroll wrapper.

Verified: all previous tests green (72) + new `tests/smoke.routes.test.js` (50: renders all 39 routes as Super Admin + fingerprints each change) = **122 tests**, `vite build` clean, built bundle carries zero "Bridge" strings.

## Phase 4 — round 2 (July 2026)

1. **Clock-out enforces the geofence** exactly like clock-in (strict + Retry). The old lenient H4 gate is gone; a genuinely stranded shift still auto-closes at midnight with capped, flagged hours.
2. **Worked hours display as "7h 52m"** (`fmtH`) on the attendance table, HRM analytics stat + table, and overtime rows. Raw decimals stay in payroll math, chart data and CSV exports.
3. **Full persistence** — nothing user-editable lives only in localStorage anymore. Migration `phase4_full_persistence_and_drafts` added `hrm_config.extras` (jsonb: emailKinds, inappKinds, branding, alerts, flowTemplates, letterTemplates — pushed in `_sync`, merged in `_applyHrmConfig`), an `announcements` table (targeted writes at post/delete, read-all RLS), and HR notif prefs now ride `workspace_settings` (key `hrm_notif_prefs`). All were previously local-only and reverted on cache clear.
4. **Server-backed drafts** — new `drafts` table (RLS: owner only). Checklist runs get a "Save draft" button (per checklist+date, auto-restores into RUN on any device, "Draft" badge on the card); OKR check-in modal gets "Save draft" (per OKR, restores with a hint). Submitting deletes the draft row. Photos never ride drafts (same stripping rule as saveDB).
5. **Hierarchy** — compact by default (depth ≥1 collapsed; Expand-all / Collapse-all / Center-on-me in the header). Clicking a card opens a directory-safe profile popup: email, phone, department, manager, direct reports, office, joined + tenure, birthday, work week — deliberately excludes salary, IBAN, assets, documents and permissions.

Also: `tests/_env.js` chain stub now returns chainable thenables (`.then().catch()` paths like `_pushRow`/`log` no longer throw in tests). Suite: **130 tests green**, build clean.

## Phase 4 — round 3 (July 2026)

1. **Midnight auto clock-out** — a forgotten clock-out now closes AT midnight from any open tab (self-arming timer in main.js), not only on the next login; no geofence involved. Status label is now **“Didn’t clock out”** (ATT_LABEL.AutoClosed) with friendly flag chips (FLAG_LABEL). `_runAutoClose` only touches rows the session can persist (own rows / attendance-edit) so cross-device state can’t flip-flop.
2. **Dashboard drill-downs** — `App._dashDrill(kind)` (dashboard.js): every count card opens the LIST behind its number (pulse strip, admin tiles, stat cards, who’s-in cells, Company-analytics hero cards). Lists are permission-scoped via the same resolver the target page uses; each modal links to the full page.
3. **Professional charts** — global Chart.js theme (dark rounded tooltips, circular legend markers, ease-out animation, consistent palette, gradient line fills, capped bar thickness). New visuals: Company analytics gains *Submissions by weekday* (gradient vertical bars) and Tickets became a classic pie; HRM analytics gains *Attendance trend* (3-series line) and *Leave mix* (doughnut). All charts respect the existing filter bars (status/dept/member/location + date range on Company; user/dept/location/type + range on HRM).

Suite: **134 tests green**, build clean.

## Phase 4 — round 4: OKR rework (July 2026, final)

1. **Independent levels** — `okrProgress()` no longer rolls children up: every node (L0/L1/L2) is measured ONLY from its own check-ins vs its own start→target. Sub-objectives render underneath as structure/information only. A parent with no own inputs shows "No data" until its owner checks in.
2. **The graph** (in the Progress & Updates popup) shows **Actual** (the recorded inputs, connected, with visible points) vs **Ideal** (straight start-value → target pace across the window). Window = periodStart→periodEnd (else first input→today); every single date of the window is a label — a 1st→31st period shows 1,2,3…31. Stats above the chart: Start · Current · Target · Status, with a **Progress %** chip pinned to the chart's top-right.
3. **Popups everywhere** — Rules & Target (#8), Progress & Updates (#9) and the per-level **Logs** (#6) each open in a modal from buttons on the card. OKR activity no longer appears on the Audit page. The card itself shows **Current → Target** (#7).
4. **Inputs are editable & deletable** (#5) — edit/trash buttons on every feed row; deletes are logged. Rights: **level owner + upper-level owner + roles granted `okr.editEntries`** (same rule enforced in RLS via the new `_okr_owner_or_up()` SQL helper, migration `okr_independent_levels_permissions`).
5. **Granular permissions** (#10) — the OKR area in Access Control gains `editEntries` ("Edit / delete inputs"), `changeOwner`, `deleteLogs` toggles (seed version bumped to v7). Relationship rights always apply on top: level owner / upper-level owner. Owner reassignment on an existing node is gated in the editor AND in `_okrSave` AND in RLS.

Suite: **144 tests green**, build clean, fresh dist.

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
