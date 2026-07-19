# Evarca — Security Posture (R24)

Result of applying the **Project Security Checklist v1.0 (July 2026)** to this codebase, the
Supabase project (`emzgwkvkgojcaqngkatw`) and the Vercel deployment. Audited + fixed 19 Jul 2026.
Each checklist section below is marked ✅ done · 🟡 accepted risk (with rationale) · 🔴 action for the owner.

## Section-by-section

**01 Secrets & credentials — ✅**
Repo scanned (source + tests + config): no service_role key, no private keys, no passwords. The only
key in the client is the Supabase **anon (publishable)** key — public by design; RLS is the boundary.
Keys can now also come from env vars (`VITE_SB_URL` / `VITE_SB_ANON`, see `.env.example`) so rotation
needs no code change. SMTP credentials live only in edge-function env vars (server-side).

**02 Git & version control — ✅**
`.gitignore` added (secrets, node_modules, dist, logs, OS/editor junk, dumps) + `.env.example` with
names only. Before making the repo public, run the history scan in "Scan commands" below.

**03 Authentication — ✅**
Supabase Auth (vetted provider; passwords hashed server-side, never stored by the app). Login page
already enforces: input length caps, client rate-limit + 15-min lockout after 5 failures, generic
error messages (no account enumeration).
🔴 **Owner action (1 click):** Supabase Dashboard → Authentication → Passwords → enable
**Leaked-password protection** (HaveIBeenPwned check). The advisor flags it as off.

**04 Sessions & tokens — 🟡**
Supabase JS keeps the session in localStorage — standard for SPAs on this stack; mitigated by the
strict CSP (below) and app-wide output escaping. Tokens are short-lived with auto-refresh;
`detectSessionInUrl` is off. Accepted; revisit only if moving to a server-rendered architecture.

**05 Authorization & RLS — ✅ / 🟡**
RLS enabled on **every** table; roles resolved server-side (R20 `_pid()`/`_can()` helpers).
R24: revoked `EXECUTE` on all 9 SECURITY DEFINER helper functions from `PUBLIC`/`anon`
(they remain callable by `authenticated` — required for policy evaluation; they only return
booleans about the caller). Forensic columns added so the three deliberately-open INSERT tables
(`notifications`, `notif_outbox`, `audit_logs` — open for cross-user delivery per R16) now record
the REAL inserter server-side (`sender_uid` / `created_by_uid` / `actor_uid` default `auth.uid()`).
🟡 Known limitation (pre-existing, README): RLS enforces area+action but not client-side scopes.

**06 Database & SQL injection — ✅**
All queries go through the supabase-js builder (parameterized). No string-built SQL in the app.
SECURITY DEFINER functions all pin `search_path=public`. DB reachable only via PostgREST + RLS.

**07 Input validation & output encoding — ✅**
`esc()` used across all templates for user content; login/OT/discipline/payroll inputs are
length/range-capped; the mailer function now validates recipient format and caps subject/body sizes.

**08 Frontend / client-side — ✅**
No secrets in the client. R24: **supabase-js and chart.js are now exact-pinned npm dependencies
bundled into the app** (were floating `@2`/`@4` CDN tags — auto-upgrading third-party code with no
SRI). Tailwind Play CDN pinned to the exact version `3.4.16`. `eval`/`new Function`: none.
🟡 CSP `script-src` includes `'unsafe-inline'` — the app's classic-script architecture uses inline
`onclick` handlers throughout; external-origin injection is still blocked by the CSP allowlist.
Roadmap: replace Tailwind Play CDN with a build-time Tailwind, then drop the last third-party origin.

**09 API security — ✅**
Edge functions audited:
- `create-user` — ✅ JWT + Access Control (People→Create), orphan rollback.
- `reset-password` — ✅ JWT + Access Control (People→Edit). 🟡 wildcard CORS (harmless with
  bearer-token auth — no ambient cookies — left as-is to avoid churn).
- `send-notification` — 🔴→✅ **was an open relay** (no auth at all: anyone with the URL could send
  arbitrary email through company SMTP). Redeployed v2: gateway JWT verification ON + in-function
  session check, CORS origin allowlist, recipient/subject/body validation and caps, generic errors.

**10 Transport security — ✅** Vercel + Supabase are HTTPS-only; HSTS (2y, includeSubDomains);
`upgrade-insecure-requests` in CSP; WSS for realtime.

**11 Security headers — ✅**
`vercel.json` now ships a full **Content-Security-Policy** (default-src 'self'; script/style/font/
img/connect allowlists incl. the Supabase origin + WSS; object-src 'none'; base-uri; form-action;
frame-ancestors 'none') plus X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy,
HSTS, and Cross-Origin-Opener-Policy. Verify after deploy at securityheaders.com.

**12 URLs, redirects, CSRF & SSRF — ✅**
No tokens in URLs (`detectSessionInUrl:false`); auth is bearer-token (not cookie) → CSRF n/a;
no user-supplied URL fetching server-side → SSRF n/a; no open redirects.

**13 Dependencies & supply chain — ✅**
`npm audit`: **0 vulnerabilities**. Lockfile committed; runtime deps exact-pinned
(`@supabase/supabase-js 2.110.7`, `chart.js 4.5.1`). Edge functions pin their imports by version.

**14 File uploads & storage — ✅ / 🟡**
`hr-docs` bucket: **private**, 5-minute signed URLs, authenticated-only read/write ✅.
`documents` bucket (checklist answer photos only): authenticated-only upload/delete, but **public
read** — URLs are practically unguessable (UUID + ms-timestamp paths) and previously-saved
submissions store absolute public URLs. 🟡 Accepted for photos; roadmap: flip private + sign on
render (needs a submissions data migration).

**15 Errors, logging & monitoring — ✅**
Generic client errors ("you may not have permission"); details logged server-side; `audit_logs`
records every action, now with a server-stamped `actor_uid`; deletions are tombstoned.

**16 Configuration & hosting — ✅**
No debug mode, no default/demo accounts (checked: 0), Supabase daily backups, deploy is
build-from-source on Vercel. Prod access = your Vercel/Supabase accounts — enable MFA on both. 🔴

**17 CI/CD — 🟡**
Deploy is manual (GitHub → Vercel). Recommended when convenient: enable Dependabot + a gitleaks
pre-commit hook (commands below).

**18 Data privacy — ✅**
PDPL layer from R22/R23: consent notices, confidential surveys, retention window, minimal payslip
exposure. 🟡 Auto-purge job for expired survey/review data still on the roadmap.

**19 Pre-launch review — ✅ done in R24**: secret scan, dependency audit, Supabase security
advisors (all actionable findings fixed), RLS/storage/edge-function review, headers rewritten,
256 tests + build green.

**20 Incident response (keep this)**
If a key/credential leaks: 1) rotate it immediately (Supabase → Settings → API for anon/service;
SMTP at the provider) — assume compromised; 2) sign out all sessions (Dashboard → Auth); 3) check
`audit_logs`/`auth.audit_log_entries` for what it touched; 4) if it was committed, scrub git history
(`git filter-repo`) AFTER rotating; 5) if personal data was exposed, PDPL notification duties apply.

## Scan commands (run before going public, then wire into a pre-commit hook)

```bash
gitleaks detect --source . -v          # whole history secret scan
trufflehog git file://. --only-verified
npm audit --audit-level=high
git ls-files | grep -E '\.env$'        # should print nothing
```

## Owner to-dos (can't be done from code)

1. Supabase Dashboard → Auth → Passwords → **enable leaked-password protection**.
2. Enable **MFA** on your Supabase, Vercel and GitHub accounts.
3. After the next deploy, spot-check headers at securityheaders.com and confirm the app still
   loads charts, fonts and realtime (CSP is strict now — anything blocked shows in the console).
