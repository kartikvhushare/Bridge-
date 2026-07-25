# Mobile / responsive layout audit (added R26)

Measures the app's real layout in headless Chrome instead of eyeballing it. Every finding is a
geometric fact taken from `getBoundingClientRect()`, not a guess.

## Run it

```bash
npm install                                   # once
npm install --no-save playwright tailwindcss@3.4.16   # audit-only deps, kept out of package.json

# 1. build the SAME css the app ships (Tailwind + the inline config from index.html)
npx tailwindcss -c work/mobile-audit/tailwind.config.cjs \
  -i work/mobile-audit/tw-in.css -o work/mobile-audit/tw.css --minify

# 2. render every route to work/mobile-audit/pages/ with a realistic seeded dataset
npx vitest run -c work/mobile-audit/vitest.dump.config.js

# 3. measure
node work/mobile-audit/audit.mjs                     # 390×844 (iPhone)
node work/mobile-audit/audit.mjs --w=768 --h=1024    # the tablet band — sidebar is on, only ~490px left
node work/mobile-audit/audit.mjs --w=1280 --h=900    # desktop
node work/mobile-audit/audit.mjs --shots             # also write PNGs to work/mobile-audit/shots/
node work/mobile-audit/audit.mjs --json=out.json     # machine-readable

# drill into one finding: prints the offending element's outerHTML + its parent
VW=768 node work/mobile-audit/locate.mjs analytics SPILLS
```

`pages/`, `shots/`, `tw.css` and any `*.json` are generated — they are not checked in.

## What it detects

| kind | meaning |
|---|---|
| `OVERFLOW_X` | the document scrolls sideways |
| `ESCAPES` | an element's box sits outside the viewport (and nothing clips it) |
| `SPILLS` | a child sits outside its own parent's padding box — literally "text out of the box" |
| `CLIPPED` | text cut off by its own box, with no ellipsis |
| `WIDE_SCROLL` | a horizontal scroller holding >1.6× the viewport (most content unreachable) |
| `SQUEEZED` | a table cell under 44px wide still holding text |
| `RAGGED` | a short label broken over 3+ lines (exact — counts the text's own client rects) |
| `OVERLAP` | two block-level siblings visually intersecting |
| `TINY_TAP` | an interactive control under ~32px |

Deliberately ignored, because they are not defects: elements clipped by an ancestor's `overflow`,
`position:absolute/fixed/sticky` decoration, negative-margin avatar stacks, inline elements that
wrap (their union rect legitimately overlaps a sibling's), and content inside a scroller.

## Two traps that cost real time — do not repeat them

1. **Tailwind's CDN is blocked in some sandboxes.** The first run measured a page with no Tailwind
   at all (no preflight → `box-sizing:content-box` everywhere) and reported 39/39 routes overflowing.
   All of it was fiction. That is why step 1 generates the CSS locally. If a run suddenly shows every
   route broken, check that `tw.css` exists and is non-empty before believing it.
2. **`html,body{overflow-x:hidden}` makes BODY the scroll container**, so a `fullPage` screenshot
   stops at viewport height. `--shots` neutralises that *after* measuring, for the image only.

## R26 baseline (what "clean" looks like)

| width | ESCAPES | SPILLS | CLIPPED | SQUEEZED | RAGGED | OVERLAP | WIDE_SCROLL |
|---|---|---|---|---|---|---|---|
| 390 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| 430 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| 768 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| 1024 | 0 | 6 | 0 | 0 | 1 | 0 | 0 |
| 1440 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

Known and accepted:

- **WIDE_SCROLL ×3 on phones** — the org chart, the HR Config tab strip and the 7-day shift roster
  are meant to scroll sideways. Making the roster readable on a phone is a redesign, not a CSS fix.
- **SPILLS ×6 at 1024** — the `+N` label after an avatar stack. Verified pre-existing (identical
  count against the pre-R26 `styles.css`); it extends into its card's own padding and is not visible.
- **RAGGED ×1** — a long job title wrapping to 3 lines in the People directory. It wraps, it is not
  cut off.
- **TINY_TAP** — the OKR compact-row icons (22px) and `.tog` switches are left alone on purpose:
  they were made compact in R5 and enlarging them would undo that layout. Desktop widths report
  TINY_TAP too; a 44px touch target is a phone guideline, so ignore it above 767px.
