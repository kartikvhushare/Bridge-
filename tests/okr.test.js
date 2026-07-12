/* OKR hierarchy engine harness.
   Covers: leaf % (caps, yes/no, direction down, no-data), INDEPENDENT levels (each node
   measured on its own inputs — no roll-up), upper-owner chain detection, cycle safety,
   level/descendants/root walks, due-date scheduling, and status resolution. */
import { describe, it, expect, beforeAll } from 'vitest';

const W = window;
const okr = (o) => Object.assign({ id: 'o' + Math.random().toString(36).slice(2, 8), parentId: null, ownerId: 'u1', metricType: 'number', startValue: 0, targetValue: 100, frequency: {}, createdAt: '2026-01-01' }, o);
const ci = (okrId, value, date = '2026-06-01') => ({ id: 'c' + Math.random().toString(36).slice(2, 8), okrId, userId: 'u1', value, date, createdAt: date + 'T00:00:00Z' });

let root, a, b, a1;
beforeAll(() => {
  root = okr({ id: 'root' });
  a = okr({ id: 'a', parentId: 'root' });
  b = okr({ id: 'b', parentId: 'root' });
  a1 = okr({ id: 'a1', parentId: 'a' });          // grandchild — a rolls up from a1
  W.DB.okrs = [root, a, b, a1];
  W.DB.okrCheckins = [ci('a1', 50), ci('b', 30)];
});

describe('leaf progress', () => {
  it('measures latest check-in against start→target', () => {
    expect(W._okrLeafPct(a1)).toBe(50);                                          // 1
  });
  it('caps at 150 and floors at 0', () => {
    W.DB.okrCheckins.push(ci('b', 400, '2026-06-02'));
    expect(W._okrLeafPct(b)).toBe(150);                                          // 2
    W.DB.okrCheckins.push(ci('b', -20, '2026-06-03'));
    expect(W._okrLeafPct(b)).toBe(0);                                            // 3
    W.DB.okrCheckins = W.DB.okrCheckins.filter(c => !(c.okrId === 'b' && c.date > '2026-06-01'));
  });
  it('yes/no metric maps 1→100, 0→0', () => {
    const y = okr({ id: 'y', metricType: 'yesno' });
    W.DB.okrs.push(y);
    W.DB.okrCheckins.push(ci('y', 1));
    expect(W._okrLeafPct(y)).toBe(100);                                          // 4
    W.DB.okrCheckins = W.DB.okrCheckins.filter(c => c.okrId !== 'y');
    W.DB.okrCheckins.push(ci('y', 0));
    expect(W._okrLeafPct(y)).toBe(0);                                            // 5
  });
  it("direction 'down' flips naturally (100→50, at 75 = 50%)", () => {
    const d = okr({ id: 'd', startValue: 100, targetValue: 50, direction: 'down' });
    W.DB.okrs.push(d); W.DB.okrCheckins.push(ci('d', 75));
    expect(W._okrLeafPct(d)).toBe(50);                                           // 6
  });
  it('no check-in / no target → null (No data)', () => {
    const n1 = okr({ id: 'n1' }); const n2 = okr({ id: 'n2', targetValue: null });
    W.DB.okrs.push(n1, n2); W.DB.okrCheckins.push(ci('n2', 10));
    expect(W._okrLeafPct(n1)).toBe(null);                                        // 7
    expect(W._okrLeafPct(n2)).toBe(null);                                        // 8
  });
});

describe('independent levels (no roll-up — owner request)', () => {
  it('a parent is measured ONLY on its own inputs: a & root have none → null; b=30; a1=50', () => {
    expect(W.okrProgress(a)).toBe(null);      // a1's 50% does NOT roll up       // 9
    expect(W.okrProgress(root)).toBe(null);   // root has no own inputs          // 10
    expect(W.okrProgress(b)).toBe(30);
    expect(W.okrProgress(a1)).toBe(50);
  });
  it('a parent with its OWN input measures itself, ignoring children', () => {
    W.DB.okrCheckins.push(ci('a', 80, '2026-06-05'));
    expect(W.okrProgress(a)).toBe(80);        // own input wins; a1 irrelevant
    W.DB.okrCheckins = W.DB.okrCheckins.filter(c => c.okrId !== 'a');
  });
  it('is cycle-safe (self-referencing tree returns, no hang)', () => {
    const c1 = okr({ id: 'c1', parentId: 'c2' }); const c2 = okr({ id: 'c2', parentId: 'c1' });
    W.DB.okrs.push(c1, c2);
    expect(W.okrProgress(c1)).toBe(null);                                        // 11
  });
  it('upper-level owner detection walks the parent chain', () => {
    expect(W.okrIsUpOwner(a1, 'u1')).toBe(true);   // u1 owns root & a above a1
    expect(W.okrIsUpOwner(root, 'u1')).toBe(false); // nothing above the root
  });
});

describe('tree walks', () => {
  it('levels: root=0, child=1, grandchild=2', () => {
    expect([W.okrLevel(root), W.okrLevel(a), W.okrLevel(a1)]).toEqual([0, 1, 2]); // 12
  });
  it('descendants of root include the grandchild', () => {
    expect(W.okrDescendants('root').map(o => o.id)).toContain('a1');             // 13
  });
  it('root of a grandchild is the L0 node', () => {
    expect(W.okrRootOf(a1).id).toBe('root');                                     // 14
  });
});

describe('check-in scheduling', () => {
  it('weekly fires on the configured weekday', () => {
    const w = okr({ id: 'w', frequency: { type: 'weekly', day: 'Mon' } });
    expect(W.okrDueOn(w, '2026-06-01')).toBe(true);   // Monday                  // 15
    expect(W.okrDueOn(w, '2026-06-02')).toBe(false);  // Tuesday                 // 16
  });
  it('monthly day-31 clamps to the last day of short months', () => {
    const m = okr({ id: 'm', frequency: { type: 'monthly', day: 31 } });
    expect(W.okrDueOn(m, '2026-02-28')).toBe(true);                              // 17
  });
  it('period window suppresses due dates outside it', () => {
    const p = okr({ id: 'p', frequency: { type: 'weekly', day: 'Mon' }, periodStart: '2026-06-15', periodEnd: '2026-06-30' });
    expect(W.okrDueOn(p, '2026-06-01')).toBe(false);                             // 18
  });
});

describe('status', () => {
  it('manual mark wins over derivation', () => {
    const s = okr({ id: 's', statusMode: 'manual', statusManual: 'Off track' });
    expect(W.okrStatusOf(s)).toBe('Off track');                                  // 19
  });
  it('≥100% → Achieved', () => {
    const g = okr({ id: 'g' }); W.DB.okrs.push(g); W.DB.okrCheckins.push(ci('g', 100));
    expect(W.okrStatusOf(g)).toBe('Achieved');                                   // 20
  });
});
