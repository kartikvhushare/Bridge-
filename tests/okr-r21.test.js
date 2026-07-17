/* R21 harness — the four OKR upgrades.
   Covers: (1) big-value abbreviation in _okrFmtVal, (2) auto roll-up from the DIRECT level
   below (sum/avg/max/min, one-level rule, cycle safety, no manual check-ins), (3) target
   revisions (originals untouched, one input stream → dual progress, status vs revised,
   remove-by-original), and (4) the quarter overlap filter (6-month OKR in two quarters,
   cross-year windows, dateless hidden, subtree-span fallback). */
import { describe, it, expect, beforeAll } from 'vitest';

const W = window;
const okr = (o) => Object.assign({ id: 'r21' + Math.random().toString(36).slice(2, 8), parentId: null, ownerId: 'u1', metricType: 'number', startValue: 0, targetValue: 100, frequency: {}, createdAt: '2026-01-01' }, o);
const ci = (okrId, value, date = '2026-06-01') => ({ id: 'c' + Math.random().toString(36).slice(2, 8), okrId, userId: 'u1', value, date, createdAt: date + 'T00:00:00Z' });

describe('R21 · value abbreviation', () => {
  const cur = { metricType: 'currency', unit: 'AED' };
  const num = { metricType: 'number', unit: 'orders' };
  it('abbreviates thousands and millions', () => {
    expect(W._okrFmtVal(cur, 1000)).toBe('AED 1k');                              // 1
    expect(W._okrFmtVal(cur, 10000)).toBe('AED 10k');                            // 2
    expect(W._okrFmtVal(cur, 1000000)).toBe('AED 1M');                           // 3
    expect(W._okrFmtVal(cur, 10000000)).toBe('AED 10M');                         // 4
    expect(W._okrFmtVal(cur, 1250000)).toBe('AED 1.25M');                        // 5
  });
  it('leaves small numbers, percent and yes/no alone', () => {
    expect(W._okrFmtVal(cur, 850)).toBe('AED 850');                              // 6
    expect(W._okrFmtVal(num, 12500)).toBe('12.5k orders');                       // 7
    expect(W._okrFmtVal({ metricType: 'percent' }, 98)).toBe('98%');             // 8
    expect(W._okrFmtVal({ metricType: 'yesno' }, 1)).toBe('Yes');                // 9
  });
});

describe('R21 · auto roll-up (one level below)', () => {
  let L0, L1a, L1b, L2;
  beforeAll(() => {
    L0 = okr({ id: 'rup0', targetValue: 3000, rollup: true, rollupMode: 'sum' });
    L1a = okr({ id: 'rup1a', parentId: 'rup0', targetValue: 2000 });
    L1b = okr({ id: 'rup1b', parentId: 'rup0', targetValue: 1000 });
    L2 = okr({ id: 'rup2', parentId: 'rup1a', targetValue: 500 });
    W.DB.okrs = [L0, L1a, L1b, L2];
    W.DB.okrCheckins = [ci('rup1a', 1500, '2026-06-10'), ci('rup1b', 250, '2026-06-05'), ci('rup2', 999999, '2026-06-10')];
  });
  it('sums DIRECT children only — L2 never leaks into L0', () => {
    expect(W.okrCurrentOf(L0)).toBe(1750);                                       // 10
  });
  it('supports avg / max / min', () => {
    L0.rollupMode = 'avg'; expect(W.okrCurrentOf(L0)).toBe(875);                 // 11
    L0.rollupMode = 'max'; expect(W.okrCurrentOf(L0)).toBe(1500);                // 12
    L0.rollupMode = 'min'; expect(W.okrCurrentOf(L0)).toBe(250);                 // 13
    L0.rollupMode = 'sum';
  });
  it('cascades one level at a time when L1 also rolls up', () => {
    L1a.rollup = true; L1a.rollupMode = 'sum';
    expect(W.okrCurrentOf(L1a)).toBe(999999);        // L1a now = its L2          // 14
    expect(W.okrCurrentOf(L0)).toBe(999999 + 250);   // L0 = L1a(rolled) + L1b    // 15
    L1a.rollup = false;
  });
  it('drives okrProgress and blocks manual check-ins', () => {
    expect(W.okrProgress(L0)).toBeCloseTo(58.3, 1);  // 1750 of 3000              // 16
    expect(W.okrDueOn(L0, '2026-06-15')).toBe(false);                            // 17
    expect(W._okrCanCheckin(L0)).toBe(false);                                    // 18
    expect(W._okrFreqLabel(L0)).toMatch(/^Auto/);                                // 19
  });
  it('is cycle-safe', () => {
    const x = okr({ id: 'cyc1', parentId: 'cyc2', rollup: true });
    const y = okr({ id: 'cyc2', parentId: 'cyc1', rollup: true });
    W.DB.okrs.push(x, y);
    expect(W.okrCurrentOf(x)).toBe(null);                                        // 20
    W.DB.okrs = W.DB.okrs.filter(o => !['cyc1', 'cyc2'].includes(o.id));
  });
});

describe('R21 · target revisions', () => {
  let annual, q1;
  beforeAll(() => {
    annual = okr({ id: 'rvY', targetValue: 1000000, metricType: 'currency', unit: 'AED', periodStart: '2026-01-01', periodEnd: '2026-12-31' });
    q1 = okr({ id: 'rvQ1', parentId: 'rvY', targetValue: 250000, metricType: 'currency', unit: 'AED' });
    W.DB.okrs = [annual, q1];
    W.DB.okrCheckins = [ci('rvY', 500000, '2026-06-30')];
  });
  it('no revision → progress vs original', () => {
    expect(W.okrHasRevision(annual)).toBe(false);                                // 21
    expect(W.okrProgress(annual)).toBe(50);                                      // 22
  });
  it('a revision overlays the node — original stays, both progress numbers live', () => {
    annual.revisedTarget = 750000; annual.revisedNote = 'Market slowdown'; annual.revisedAt = '2026-07-01T00:00:00Z'; annual.revisedBy = 'u1';
    expect(W.okrHasRevision(annual)).toBe(true);                                 // 23
    expect(annual.targetValue).toBe(1000000);                                    // 24
    expect(W.okrProgress(annual)).toBeCloseTo(66.7, 1);   // vs revised          // 25
    expect(W.okrProgressOrig(annual)).toBe(50);           // vs original         // 26
  });
  it('status tracks the revised goal', () => {
    W.DB.okrCheckins.push(ci('rvY', 760000, '2026-07-02'));
    expect(W.okrProgress(annual)).toBeGreaterThanOrEqual(100);                   // 27
    expect(W.okrStatusOf(annual)).toBe('Achieved');                              // 28
    expect(W.okrProgressOrig(annual)).toBeLessThan(100);                         // 29
  });
  it('yes/no objectives never count as revised', () => {
    const yn = okr({ metricType: 'yesno', revisedTarget: 5 });
    expect(W.okrHasRevision(yn)).toBe(false);                                    // 30
  });
});

describe('R21 · quarter overlap filter', () => {
  let half, q3only, dateless, spanNY, parentNoDates;
  beforeAll(() => {
    half = okr({ id: 'qtH', periodStart: '2026-01-15', periodEnd: '2026-06-15' });
    q3only = okr({ id: 'qtQ3', periodStart: '2026-07-01', periodEnd: '2026-09-15' });
    dateless = okr({ id: 'qtND' });
    spanNY = okr({ id: 'qtNY', periodStart: '2025-12-01', periodEnd: '2026-02-10' });
    parentNoDates = okr({ id: 'qtP' });
    const kid = okr({ id: 'qtPk', parentId: 'qtP', periodStart: '2026-04-01', periodEnd: '2026-04-30' });
    W.DB.okrs = [half, q3only, dateless, spanNY, parentNoDates, kid];
  });
  it('a 6-month OKR falls under BOTH quarters', () => {
    expect(W._okrInQuarters(half, ['Q1'], 2026)).toBe(true);                     // 31
    expect(W._okrInQuarters(half, ['Q2'], 2026)).toBe(true);                     // 32
    expect(W._okrInQuarters(half, ['Q3'], 2026)).toBe(false);                    // 33
  });
  it('multi-select is an OR; empty selection matches everything', () => {
    expect(W._okrInQuarters(q3only, ['Q2', 'Q3'], 2026)).toBe(true);             // 34
    expect(W._okrInQuarters(q3only, ['Q1'], 2026)).toBe(false);                  // 35
    expect(W._okrInQuarters(dateless, [], 2026)).toBe(true);                     // 36
  });
  it('dateless hidden while filtering; parents fall back to subtree span; years respected', () => {
    expect(W._okrInQuarters(dateless, ['Q1'], 2026)).toBe(false);                // 37
    expect(W._okrInQuarters(parentNoDates, ['Q2'], 2026)).toBe(true);            // 38
    expect(W._okrInQuarters(spanNY, ['Q1'], 2026)).toBe(true);                   // 39
    expect(W._okrInQuarters(spanNY, ['Q4'], 2025)).toBe(true);                   // 40
    expect(W._okrInQuarters(spanNY, ['Q3'], 2026)).toBe(false);                  // 41
  });
});
