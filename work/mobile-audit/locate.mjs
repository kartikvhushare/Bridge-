/* locate.mjs <route> <kind> — print outerHTML of offending elements + their parent, to grep the source */
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';
const [route, kind] = process.argv.slice(2);
const TWCSS = fs.readFileSync(path.resolve('work/mobile-audit/tw.css'), 'utf8');
const CSS = fs.readFileSync('src/styles.css', 'utf8');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await (await b.newContext({ viewport: { width: Number(process.env.VW||390), height: 844 }, isMobile: true, hasTouch: true })).newPage();
const body = fs.readFileSync(path.join('work/mobile-audit/pages', route + '.html'), 'utf8');
await p.setContent(`<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${TWCSS}</style><style>${CSS}</style></head><body><div id="app">${body}</div></body></html>`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(200);
console.log(await p.evaluate(([kind, VW]) => {
  const hits = [];
  document.querySelectorAll('#app *').forEach(el => {
    if (el.closest('svg')) return;
    const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    if (s.display === 'none' || r.width <= 0) return;
    const inScroller = (() => { let q = el.parentElement; while (q) { const qs = getComputedStyle(q); if (qs.overflowX === 'auto' || qs.overflowX === 'scroll') return true; q = q.parentElement; } return false; })();
    let hit = false;
    if (kind === 'ESCAPES' && !inScroller && (r.right > VW + 1 || r.left < -1)) hit = true;
    if (kind === 'SPILLS') {
      const par = el.parentElement; if (!par || par.id === 'app') return;
      const ps = getComputedStyle(par); const pr = par.getBoundingClientRect();
      const scr = ps.overflowX === 'auto' || ps.overflowX === 'scroll' || ps.overflowY === 'auto' || ps.overflowY === 'scroll';
      const innerR = pr.right - (parseFloat(ps.paddingRight) || 0), innerL = pr.left + (parseFloat(ps.paddingLeft) || 0);
      const ms = getComputedStyle(el); const negM = parseFloat(ms.marginLeft) < 0 || parseFloat(ms.marginRight) < 0;
      if (!scr && !negM && ps.position !== 'relative' && (r.right > innerR + 2 || r.left < innerL - 2)) hit = true;
    }
    if (kind === 'TINY' && /^(BUTTON|A|SELECT|INPUT)$/.test(el.tagName) && ((r.height > 0 && r.height < 32) || (r.width > 0 && r.width < 24))) hit = true;
    if (!hit) return;
    hits.push({
      self: el.outerHTML.slice(0, 300),
      parent: (el.parentElement ? el.parentElement.outerHTML.slice(0, 400) : ''),
      box: Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + '×' + Math.round(r.height),
    });
  });
  const uniq = []; const seen = new Set();
  for (const h of hits) { const k = h.self.slice(0, 120); if (seen.has(k)) continue; seen.add(k); uniq.push(h); }
  return uniq.slice(0, 6).map((h, i) => '── #' + (i + 1) + '  box=' + h.box + '\nSELF:   ' + h.self + '\nPARENT: ' + h.parent).join('\n\n');
}, [kind || 'ESCAPES', Number(process.env.VW||390)]));
await b.close();
