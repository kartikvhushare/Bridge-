/* MOBILE AUDIT (R26) — loads each dumped route in real Chromium at phone width and reports
   measured layout defects. Run: node work/mobile-audit/audit.mjs [--w 390] [--json out.json]
   Findings are geometric facts, not guesses:
     OVERFLOW_X  — the page scrolls sideways (documentElement.scrollWidth > viewport)
     ESCAPES     — an element's box extends past the right edge of the viewport
     CLIPPED     — text is cut off by its own box (scrollWidth > clientWidth on a leaf with text)
     OVERLAP     — two sibling boxes visually intersect (misalignment / collision)
     TINY_TAP    — an interactive control smaller than 32px in either axis
     SQUEEZED    — a table cell rendered narrower than 44px (column crushed to 1 char/line)
     SPILLS      — a child's box extends past its own parent's padding box (text out of the box)
     WIDE_SCROLL — a horizontal scroller whose content is >1.6x the viewport (most data unreachable)
     RAGGED      — a short label wrapping onto 3+ lines inside a narrow box
*/
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const W = Number((args.find(a => a.startsWith('--w=')) || '--w=390').split('=')[1]);
const H = Number((args.find(a => a.startsWith('--h=')) || '--h=844').split('=')[1]);
const JSON_OUT = (args.find(a => a.startsWith('--json=')) || '').split('=')[1] || '';
const ONLY = (args.find(a => a.startsWith('--only=')) || '').split('=')[1] || '';

const PAGES = path.resolve('work/mobile-audit/pages');
const SHOT = args.includes('--shots');
const SHOTS = path.resolve('work/mobile-audit/shots');
if (SHOT) fs.mkdirSync(SHOTS, { recursive: true });
const TWCSS = fs.readFileSync(path.resolve('work/mobile-audit/tw.css'), 'utf8');
const CSS = fs.readFileSync(path.resolve('src/styles.css'), 'utf8');
const TW_CFG = `tailwind.config={theme:{extend:{fontFamily:{display:['"Schibsted Grotesk"'],sans:['"Hanken Grotesk"']},colors:{ink:{DEFAULT:'#15171C',50:'#F6F7F8',100:'#ECEDF0',200:'#D6D8DE',300:'#A9ADB8',400:'#6B7280',500:'#3A3E48',600:'#262A33',700:'#1C1F26',800:'#15171C'},brand:{DEFAULT:'#0E9F6E',50:'#ECFDF5',100:'#D1FAE5',400:'#34D399',500:'#10B981',600:'#0E9F6E',700:'#0B7A55'},paper:'#F7F6F2'},boxShadow:{soft:'0 1px 2px rgba(16,24,40,.04),0 4px 16px -6px rgba(16,24,40,.10)',pop:'0 8px 40px -8px rgba(16,24,40,.28)'}}}}`;

const wrap = (body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<style>${TWCSS}</style>
<style>${CSS}</style></head><body><div id="app">${body}</div></body></html>`;

const MEASURE = (VW) => {
  const out = [];
  const seen = new Set();
  const desc = (el) => {
    const id = el.id ? '#' + el.id : '';
    const cls = (typeof el.className === 'string' && el.className) ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
    let t = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    return el.tagName.toLowerCase() + id + cls + (t ? ' — "' + t + '"' : '');
  };
  const push = (kind, el, detail) => {
    const k = kind + '|' + desc(el) + '|' + detail;
    if (seen.has(k)) return; seen.add(k);
    out.push({ kind, el: desc(el), detail });
  };
  const clipped = (el) => { let q = el.parentElement; while (q && q !== document.body) { const qs = getComputedStyle(q); if (qs.overflow !== 'visible' || qs.overflowX !== 'visible' || qs.overflowY !== 'visible') return true; q = q.parentElement; } return false; };
  const posOut = (el) => { const ps = getComputedStyle(el).position; return ps === 'absolute' || ps === 'fixed' || ps === 'sticky'; };
  const vis = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  // ── page-level sideways scroll
  const de = document.documentElement;
  if (de.scrollWidth > VW + 1) out.push({ kind: 'OVERFLOW_X', el: 'document', detail: de.scrollWidth + 'px wide vs ' + VW + 'px viewport' });

  const all = Array.from(document.querySelectorAll('#app *')).filter(e => !e.closest('svg'));
  for (const el of all) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    // scroll containers are allowed to be wider than the viewport internally
    const inScroller = (() => { let p = el.parentElement; while (p) { const ps = getComputedStyle(p); if (ps.overflowX === 'auto' || ps.overflowX === 'scroll') return true; p = p.parentElement; } return false; })();

    // ── escapes the viewport
    if (!inScroller && !clipped(el) && !posOut(el) && r.right > VW + 1 && r.width <= VW * 3) push('ESCAPES', el, Math.round(r.right - VW) + 'px past the right edge (w=' + Math.round(r.width) + ')');
    if (!inScroller && !clipped(el) && !posOut(el) && r.left < -1) push('ESCAPES', el, Math.round(-r.left) + 'px past the left edge');

    // ── text clipped by its own box (leaf-ish nodes only)
    const leafText = el.children.length === 0 && (el.textContent || '').trim().length > 0;
    if (leafText && s.overflow !== 'visible' && s.overflowX !== 'auto' && s.overflowX !== 'scroll' && s.textOverflow !== 'ellipsis') {
      if (el.scrollWidth > el.clientWidth + 1) push('CLIPPED', el, 'text ' + el.scrollWidth + 'px inside a ' + el.clientWidth + 'px box');
    }

    // ── crushed table cells
    if ((el.tagName === 'TD' || el.tagName === 'TH') && r.width > 0 && r.width < 44 && (el.textContent || '').trim().length > 3) {
      push('SQUEEZED', el, Math.round(r.width) + 'px wide for ' + (el.textContent || '').trim().length + ' chars');
    }

    // ── child spills out of its own parent (the literal "text goes out of the box")
    const par = el.parentElement;
    if (par && par.id !== 'app' && !par.closest('svg')) {
      const ps = getComputedStyle(par);
      const scrolls = ps.overflowX !== 'visible' || ps.overflowY !== 'visible';
      const pr = par.getBoundingClientRect();
      const padR = parseFloat(ps.paddingRight) || 0, padL = parseFloat(ps.paddingLeft) || 0;
      const inner = { l: pr.left + padL, r: pr.right - padR };
      const ms = getComputedStyle(el);
      const negM = (parseFloat(ms.marginLeft) < 0) || (parseFloat(ms.marginRight) < 0);
      if (!scrolls && !negM && !posOut(el) && !clipped(el) && r.width > 0 && pr.width > 0) {
        if (r.right > inner.r + 2 || r.left < inner.l - 2) {
          const over = Math.round(Math.max(r.right - inner.r, inner.l - r.left));
          if (over > 2 && r.width < VW * 2) push('SPILLS', el, over + 'px outside ' + par.tagName.toLowerCase() + (par.id ? '#' + par.id : '') + ' (child ' + Math.round(r.width) + 'px in ' + Math.round(inner.r - inner.l) + 'px)');
        }
      }
    }

    // ── horizontal scrollers that hide most of their content
    if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && el.scrollWidth > VW * 1.6 && r.width > VW * 0.5) {
      push('WIDE_SCROLL', el, el.scrollWidth + 'px of content in a ' + Math.round(r.width) + 'px window (' + Math.round(el.scrollWidth / r.width * 10) / 10 + 'x)');
    }

    // ── a short label ragged over 3+ lines (exact: count the text's own client rects)
    if (leafText) {
      const txt = (el.textContent || '').trim();
      if (txt.length <= 30 && r.width < 150) {
        const rng = document.createRange();
        rng.selectNodeContents(el);
        const lines = Array.from(rng.getClientRects()).filter(q => q.height > 1).length;
        if (lines >= 3) push('RAGGED', el, '"' + txt + '" over ' + lines + ' lines in ' + Math.round(r.width) + 'px');
      }
    }

    // ── tap targets
    if (/^(BUTTON|A|SELECT|INPUT)$/.test(el.tagName) && s.pointerEvents !== 'none') {
      if ((r.height > 0 && r.height < 32) || (r.width > 0 && r.width < 24)) push('TINY_TAP', el, Math.round(r.width) + '×' + Math.round(r.height) + 'px');
    }
  }

  // ── sibling collisions (misalignment you can see)
  const parents = new Set(all.filter(e => e.children.length > 1 && e.children.length < 40).slice(0, 4000));
  for (const p of parents) {
    const kids = Array.from(p.children).filter(vis).filter(k => { const cs = getComputedStyle(k); return cs.position !== 'absolute' && cs.position !== 'fixed' && cs.display !== 'inline'; });
    for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
      const a = kids[i].getBoundingClientRect(), b = kids[j].getBoundingClientRect();
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      const neg = (n) => { const cs = getComputedStyle(n); return parseFloat(cs.marginLeft) < 0 || parseFloat(cs.marginRight) < 0 || parseFloat(cs.marginTop) < 0; };
      if (ox > 2 && oy > 2 && !neg(kids[i]) && !neg(kids[j])) { push('OVERLAP', kids[i], 'overlaps sibling ' + desc(kids[j]).slice(0, 50) + ' by ' + Math.round(ox) + '×' + Math.round(oy) + 'px'); }
    }
  }
  return out;
};

const files = fs.readdirSync(PAGES).filter(f => f.endsWith('.html')).filter(f => !ONLY || f.startsWith(ONLY));
// pinned container chromium (the installed playwright build expects a newer revision dir)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', () => {});

const report = {};
for (const f of files) {
  const route = f.replace(/\.html$/, '');
  await page.setContent(wrap(fs.readFileSync(path.join(PAGES, f), 'utf8')), { waitUntil: 'networkidle' });
  await page.waitForTimeout(250); // let Tailwind Play CDN finish generating
  const found = await page.evaluate(MEASURE, W);
  report[route] = found;
  if (SHOT) {
    // body has overflow-x:hidden (styles.css) which makes IT the scroll container, so a fullPage
    // screenshot would stop at viewport height. Neutralise it AFTER measuring, for the image only.
    await page.addStyleTag({ content: 'html,body{overflow:visible!important}' });
    await page.waitForTimeout(60);
    await page.screenshot({ path: path.join(SHOTS, route + '.png'), fullPage: true });
  }
}
await browser.close();

const order = ['OVERFLOW_X', 'ESCAPES', 'SPILLS', 'CLIPPED', 'WIDE_SCROLL', 'SQUEEZED', 'RAGGED', 'OVERLAP', 'TINY_TAP'];
const totals = {};
let grand = 0;
for (const [route, found] of Object.entries(report)) {
  for (const f of found) { totals[f.kind] = (totals[f.kind] || 0) + 1; grand++; }
}
console.log('\n════ MOBILE AUDIT @ ' + W + '×' + H + ' ════');
console.log('total findings: ' + grand + '  ' + order.filter(k => totals[k]).map(k => k + '=' + totals[k]).join('  ') + '\n');

const routesRanked = Object.entries(report).sort((a, b) => b[1].length - a[1].length);
for (const [route, found] of routesRanked) {
  if (!found.length) continue;
  const byKind = {};
  found.forEach(f => { (byKind[f.kind] = byKind[f.kind] || []).push(f); });
  console.log('── ' + route + '  (' + found.length + ')  ' + order.filter(k => byKind[k]).map(k => k + ':' + byKind[k].length).join(' '));
  for (const k of order) {
    if (!byKind[k]) continue;
    byKind[k].slice(0, 6).forEach(f => console.log('   [' + k + '] ' + f.el + '  ⟶ ' + f.detail));
    if (byKind[k].length > 6) console.log('   [' + k + '] … +' + (byKind[k].length - 6) + ' more');
  }
  console.log('');
}
const clean = Object.entries(report).filter(([, v]) => !v.length).map(([k]) => k);
if (clean.length) console.log('clean: ' + clean.join(', '));
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));
