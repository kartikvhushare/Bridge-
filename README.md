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

## Phase 4 — round 5: polish & fixes (July 2026)

1. **Compact mobile pass (Wave 3)** — `.hscroll` one-line scrolling strips for every tab bar (hub strip, Visuals/Details, ui-tabs never stack); ≤767px: smaller h1, tighter card padding, compact table cells (7px/12px), 36px buttons.
2. **Compact OKR page** — bulky cards → slim one-line rows (chevron · L-chip · title · bar · % · current→target · status · ⋯). Row click opens Progress & Updates; ⋯ opens the action menu (update / rules / progress / logs / add sub / edit / delete). Children collapsed by default; hundreds of OKRs now fit.
3. **Demo data seeded** (owner request — graphs were empty from sparse data): ~200 attendance rows, ~200 submissions (mixed statuses over 30 days), 6 leave requests, 6 tickets, 2 demo OKRs with 8 check-ins. ALL tagged: ids `demo…` / attendance `note='demo'`. Wipe with: `DELETE FROM attendance WHERE note='demo'; DELETE FROM submissions WHERE id LIKE 'demo_%'; DELETE FROM leave_requests WHERE id LIKE 'demo_%'; DELETE FROM tickets WHERE id LIKE 'demo_%'; DELETE FROM okr_checkins WHERE id LIKE 'demo_%'; DELETE FROM okrs WHERE id LIKE 'demo_%';`
4. **In-App tab = every event** — the HR in-app switches (leave ×3, late, didn't-clock-out, WFH, announcements, review opened/results) moved from the HR Email tab into Settings → In-App; HR Email tab is email-only now.
5. **BUGFIX: invisible locations** — the city-scope filter was applied to admins, so an admin with old city chips couldn't see locations created afterwards (including their own). Admins now always see all locations; non-admin creators auto-gain their new location in their city scope.
6. **Deep check** — new smoke section renders every route as a basic employee (catches role-scoped crashes).

Suite: **148 tests green**, build clean, fresh dist.

## Phase 4 — round 6: delete options on every feed (July 2026)

- **Alerts (notifications)** — ✕ on every row + a confirmed **Clear all** (own rows only; server rows deleted too — RLS `n_d` already allowed it).
- **Approvals inbox** — trash button per record: decided submission/edit approvals deletable (requester / approver / admin, logged); leave: Pending → **Cancel request** (existing `cancelLeave` releases the reserved balance), Rejected/Cancelled → delete record, **Approved never** (balances already applied); overtime: Rejected → remove (existing handler). Documents decide/delete in Documents.
- **Feedback** — Delete on each card (sender / HR / admin, logged, removes for both sides).
- Deliberately NOT deletable: the Audit log (tamper evidence) and approved leave/overtime records (payroll/balance integrity).

Suite: **151 tests green**, build clean, fresh dist.

## Phase 4 — round 7: sync integrity, one-click approvals, egress & security (July 2026)

1. **One-click approvals** — `decideLeave` now loops consecutive stages when the SAME decider is valid for the next stage (Super Admin covering manager+HR no longer clicks Approve twice). Different-person stages still hand off with notifications. (Root cause of the owner's report: demo leave rows had `flow:[]` → fell back to the 2-stage chain; pending demo leave was also removed from the DB and remaining demo rows got a proper 1-stage flow.)
2. **Resurrection tombstones (R7)** — deleted alerts / approval records / leave records can no longer come back after logout/login: `notifications_deleted` / `approvals_deleted` / `leaveRequests_deleted` tombstones (capped 800) filter every `_apply*` AND every `_sync` re-push.
3. **Egress "cold archive"** — boot now fetches only a **7-day hot window** for the heavy tables (submissions, notifications, attendance); audit_logs and okr_logs don't load at boot at all. Opening the tab that needs more triggers `_lazyCold` (once per session, sync bar shown, merge-safe): Audit → 300 audit rows, OKR → 400 logs, Dashboard/Analytics → 30-day submissions, Attendance/HRM-Analytics/Payroll → 90-day attendance, Alerts → "Load older" button (90-day notifications).
4. **Security headers** (vercel.json): X-Frame-Options DENY + CSP frame-ancestors 'none' (no clickjacking), nosniff, strict Referrer-Policy, HSTS, Permissions-Policy (geolocation/camera self-only — needed for geofence + check-in photos). No script CSP (Tailwind CDN + inline handlers are load-bearing).

Suite: **156 tests green**, build clean, fresh dist.

## Phase 4 — round 8: small-bug sweep (July 2026)

1. **Office ≠ geofence** — a person's office is just their workplace. Clock-in/out only checks location when that office actually has an ENABLED fence; no fence configured → free clocking (geo:null). Field renamed "Office location (where they work)" with a hint.
2. **Approved leave deletable** — approvers see "Delete & reverse" on Approved leave in the inbox: restores the used balance days, clears the written leave days from attendance (a day with a real clock-in just loses its leave marking), tombstoned + fully logged. Rejected/Cancelled stay deletable by requester/approver; Pending still cancels.
3. **Attendance log mobile view** — table is desktop-only; phones get a card list (date + status chip, in→out · hours, flag chips).
4. **Hierarchy popup** — phone removed; Office always shown ('—' when unset).
5. **Super admins count like everyone in reporting** — new `_todayBuckets()` is the single source for the who's-in widget AND its drill lists (fixes "In office 0 but the drill shows people"); admin-exclusion removed from: who's-in, dashboard drills, Company-analytics hero, absentee report, event triggers, org-wide team snapshot. (Deliberately still excluded from payroll runs / roster people pickers — those aren't reports.)
6. **Toasts wrap on mobile** — max-width 92vw, multi-line safe.

Suite: **160 tests green**, build clean, fresh dist.

## Phase 4 — round 9: clock-out & empty-graphs investigation (July 2026)

1. **Dashboard vs Attendance clock-out** — verified both tabs embed the SAME `_clockWidget()` → same `App.clockOut` → same geofence rule (fence checked only when an enabled fence exists — round 8). The reported difference came from running an older deployed build.
2. **Empty graphs** — proved the chart layer is sound: new `r9` smoke tests inject real page HTML into jsdom, stub `Chart`, and EXECUTE `_drawAnalyticsCharts/_drawHrmCharts/_drawOKRCharts/_drawHomeCharts` — any ReferenceError/TypeError in a config now fails CI instead of being swallowed by `_paintCharts`'s try{} (which used to blank every canvas silently). The OKR test asserts 2 datasets (Ideal+Actual) and 31 day labels.
3. **Visible CDN failure** — if Chart.js never arrives from cdn.jsdelivr.net (network/ad-blocker), every chart box now shows "Charts library didn't load — check the connection/ad-blocker, then refresh" instead of silent blank space. `_paintCharts` retries ~3s first and logs to console instead of swallowing errors.

Suite: **164 tests green**, build clean, fresh dist.

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
