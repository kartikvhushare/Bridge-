/* ── OKR port (from Bridge): annual → quarterly, Close, quarterly hierarchy, levels, revisions ── */
import { describe, it, expect, beforeAll } from 'vitest';
import './_env.js';

const W = window;

beforeAll(() => {
  W.DB.okrs = W.DB.okrs || [];
  W.DB.okrCheckins = W.DB.okrCheckins || [];
  W.DB.okrs.push(
    { id: 'pA', parentId: null, title: 'Domestic Growth', metricType: 'currency', startValue: 32, targetValue: 40, isAnnual: true, rollup: false, periodStart: '2026-01-01', periodEnd: '2026-12-31', statusMode: 'auto', ownerId: 'sa1', sort: 90, createdAt: '2026-01-01T00:00:00Z' },
    { id: 'pAQ1', parentId: 'pA', quarterLabel: 'Q1', title: 'Domestic Growth — Q1', metricType: 'currency', startValue: 0, targetValue: 10, periodStart: '2026-01-01', periodEnd: '2026-03-31', statusMode: 'auto', ownerId: 'sa1', sort: 0, createdAt: '2026-01-01T00:00:01Z' },
    { id: 'pAQ2', parentId: 'pA', quarterLabel: 'Q2', title: 'Domestic Growth — Q2', metricType: 'currency', startValue: 0, targetValue: 10, periodStart: '2026-04-01', periodEnd: '2026-06-30', statusMode: 'auto', ownerId: 'sa1', sort: 1, createdAt: '2026-01-01T00:00:02Z' },
    { id: 'pB', parentId: 'pA', title: 'B2C', metricType: 'currency', startValue: 27, targetValue: 34, isAnnual: true, rollup: false, periodStart: '2026-01-01', periodEnd: '2026-12-31', statusMode: 'auto', ownerId: 'sa1', sort: 5, createdAt: '2026-01-01T00:00:03Z' },
    { id: 'pBQ1', parentId: 'pB', quarterLabel: 'Q1', title: 'B2C — Q1', metricType: 'currency', startValue: 0, targetValue: 8, periodStart: '2026-01-01', periodEnd: '2026-03-31', statusMode: 'auto', ownerId: 'sa1', sort: 0, createdAt: '2026-01-01T00:00:04Z' },
    { id: 'pREG', parentId: 'pA', title: 'Regular child', metricType: 'currency', startValue: 0, targetValue: 100, statusMode: 'auto', ownerId: 'sa1', sort: 3, createdAt: '2026-01-01T00:00:05Z' },
  );
});

describe('okr port — levels', () => {
  it('a quarterly split sits AT its annual level (L0 Q1, not L1)', () => {
    expect(W.okrLevel(W.okrById('pA'))).toBe(0);
    expect(W.okrLevel(W.okrById('pAQ1'))).toBe(0);
    expect(W.okrLevel(W.okrById('pBQ1'))).toBe(1); // quarter of the L1 annual
    expect(W.okrLevel(W.okrById('pREG'))).toBe(1);
  });
  it('quarters group FIRST among children, in date order', () => {
    const ids = W.okrChildren('pA').map(o => o.id);
    expect(ids.slice(0, 2)).toEqual(['pAQ1', 'pAQ2']);
    expect(ids.indexOf('pREG')).toBeGreaterThan(ids.indexOf('pAQ2'));
  });
});

describe('okr port — annual progress = combined quarter progress', () => {
  it('untouched quarters → No data; L1 quarter updates never move the L0 annual', () => {
    expect(W.okrProgress(W.okrById('pA'))).toBe(null);
    W.DB.okrCheckins.push({ id: 'pc1', okrId: 'pBQ1', userId: 'sa1', value: 8, date: '2026-02-01', createdAt: '1' });
    expect(W.okrProgress(W.okrById('pA'))).toBe(null);      // L0 untouched
    expect(W.okrProgress(W.okrById('pB'))).toBe(100);       // L1 annual: its only quarter is 100%
  });
  it('L0 Q1 at 10% → annual 5% (2 quarters, equal shares); value maps onto its own scale', () => {
    W.DB.okrCheckins.push({ id: 'pc2', okrId: 'pAQ1', userId: 'sa1', value: 1, date: '2026-02-10', createdAt: '2' });
    expect(W.okrProgress(W.okrById('pA'))).toBe(5);         // 10% / 2 quarters
    expect(W.okrCurrentOf(W.okrById('pA'))).toBe(32.4);     // 32 + 5% of 8
  });
  it('manual roll-up override wins when both toggles are on', () => {
    const a = W.okrById('pA');
    a.rollup = true; a.rollupMode = 'sum';
    expect(W.okrCurrentOf(a)).not.toBe(32.4);               // level-below aggregation takes over
    a.rollup = false;
    expect(W.okrCurrentOf(a)).toBe(32.4);                   // quarters rule returns
  });
});

describe('okr port — Close status', () => {
  it('closed beats every status, blocks check-ins and reminders, stays in the average', () => {
    const q = W.okrById('pAQ2');
    q.closed = true; q.closedReason = 'Deprioritised'; q.closedAt = '2026-07-01T00:00:00Z'; q.closedBy = 'sa1';
    expect(W.okrStatusOf(q)).toBe('Closed');
    expect(W.okrDueOn(Object.assign(q, { frequency: { type: 'weekly', day: 'Mon' } }), '2026-08-03')).toBe(false);
    expect(W._okrCanCheckin(q)).toBe(false);
    expect(W.okrProgress(W.okrById('pA'))).toBe(5);         // frozen at 0, still one of the 2 shares
    q.closed = false; q.frequency = {};
  });
});

describe('okr port — quarterly hierarchy view parents', () => {
  it("an L1 annual's Q1 nests under the L0's Q1; L0 quarters are roots", () => {
    expect((W._okrQParent(W.okrById('pBQ1')) || {}).id).toBe('pAQ1');
    expect(W._okrQParent(W.okrById('pAQ1'))).toBe(null);
  });
});

describe('okr port — revisions', () => {
  it('revised target drives progress; original stays for comparison', () => {
    const q = W.okrById('pAQ1');
    q.revisedTarget = 2; q.revisedNote = 'H1 slowdown'; q.revisedAt = '2026-07-01T00:00:00Z'; q.revisedBy = 'sa1';
    expect(W.okrHasRevision(q)).toBe(true);
    expect(W.okrProgress(q)).toBe(50);                      // 1 of 0→2 (revised)
    expect(W.okrProgressOrig(q)).toBe(10);                  // 1 of 0→10 (original)
    q.revisedTarget = null; q.revisedNote = '';
  });
});
