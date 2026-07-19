/* R23 — UAE payroll engine. Law-default policy (MOHRE ÷30, basic OT base), salary structure,
   Art 31/30 sick & maternity tiers, GPSSA pension, adjustments ledger, SIF rows.
   Month 2026-06 (30 days; Sundays 7/14/21/28 → 26 working days with Sun off). */
import { describe, it, expect, beforeAll } from 'vitest';

const W = window;
const M = '2026-06';
const mk = (id, sal) => { const u = W.__mkUser({ id }); W.DB.users.push(u); W._ensureHrm(u); u.hrm.salary = Object.assign({ currency: 'AED' }, sal); u.hrm.schedule = { offDays: ['Sun'] }; return u; };

beforeAll(() => {
  W.DB.hrmConfig = {};            // fresh → seeds fill the law defaults
  W._seedHRMPlan();
  W.DB.holidays = []; W.DB.attendance = []; W.DB.leaveRequests = []; W.DB.overtime = []; W.DB.discipline = [];
  W.DB.leaveTypes = [
    { id: 'lt-sick', key: 'sick', name: 'Sick Leave', paidTiers: { full: 15, half: 30, unpaid: 45 } },
    { id: 'lt-mat', key: 'maternity', name: 'Maternity Leave', paidTiers: { full: 45, half: 15 } },
    { id: 'lt-unp', key: 'unpaid', name: 'Unpaid Leave', unpaid: true },
  ];
});

describe('law-default policy & salary structure', () => {
  it('defaults: ÷30 day basis, basic OT base, GPSSA 5/11/15', () => {
    const P = W._payCfg();
    expect(P.dayDivisor).toBe('fixed30'); expect(P.otBase).toBe('basic');
    expect(P.pensionEmpOld).toBe(5); expect(P.pensionEmpNew).toBe(11); expect(P.pensionEr).toBe(15);
  });                                                                                   // 1
  it('_salParts: structure + back-compat (allow = Other)', () => {
    const u = mk('s1', { basic: 6000, housing: 2000, transport: 1000, allow: 500 });
    expect(W._salParts(u)).toEqual({ basic: 6000, housing: 2000, transport: 1000, other: 500, gross: 9500 });
    const legacy = mk('s2', { basic: 5000, allow: 500 });
    expect(W._salParts(legacy).gross).toBe(5500);
  });                                                                                   // 2
  it('perDay = gross ÷ 30 · OT hourly = basic ÷ 240 (MOHRE)', () => {
    const u = mk('s3', { basic: 6000, housing: 3000 });
    const r = W._payCompute(u, M);
    expect(r.detail.perDay).toBe(300);   // 9000/30
    expect(r.detail.hourly).toBe(25);    // 6000/240 — basic base
  });                                                                                   // 3
  it('full attendance → net = gross (no phantom deductions)', () => {
    const u = mk('s4', { basic: 6000, housing: 3000 });
    for (let d = 1; d <= 30; d++) { const iso = '2026-06-' + String(d).padStart(2, '0');
      W.DB.attendance.push({ id: 'a4' + d, userId: 's4', date: iso, clockIn: '09:00' }); }
    const r = W._payCompute(u, M);
    expect(r.net).toBe(9000);
  });                                                                                   // 4
});

describe('sick pay tiers (Art 31: 15 full · 30 half · rest unpaid)', () => {
  it('20 sick working days → 15 full + 5 half', () => {
    const u = mk('sk1', { basic: 9000 });
    // 1–23 Jun minus Sundays 7/14/21 = 20 working days
    W.DB.leaveRequests.push({ id: 'lsk1', userId: 'sk1', status: 'Approved', start: '2026-06-01', end: '2026-06-23', leaveTypeId: 'lt-sick' });
    const r = W.__payFor ? null : W._payCompute(u, M);
    expect(r.detail.halfDays).toBe(5);
    expect(r.detail.unpaid).toBe(0);
    expect(r.detail.leaveDays).toBe(20);
    // deduction = 5 half days × 150 (perDay 300)
    expect(r.detail.absenceDed).toBe(5 * 0.5 * 300 + r.detail.absent * 300);
  });                                                                                   // 5
  it('prior sick days this year push the month into half/unpaid tiers', () => {
    const u = mk('sk2', { basic: 9000 });
    // 40 sick working days Jan–Feb (Jan 1–Feb 21 minus Sundays ≈ 40+) — count precisely below
    W.DB.leaveRequests.push({ id: 'lsk2a', userId: 'sk2', status: 'Approved', start: '2026-01-01', end: '2026-02-25', leaveTypeId: 'lt-sick' });
    W.DB.leaveRequests.push({ id: 'lsk2b', userId: 'sk2', status: 'Approved', start: '2026-06-01', end: '2026-06-06', leaveTypeId: 'lt-sick' }); // Mon–Sat = 6 working days (Sunday is the 7th)
    const r = W._payCompute(u, M);
    // whatever the YTD count, none of June's sick days can be FULL pay (YTD ≥ 40 > 15)
    expect(r.detail.halfDays + r.detail.unpaid).toBe(6);
    expect(r.detail.sickYTD).toBeGreaterThan(40);
  });                                                                                   // 6
});

describe('maternity tiers (Art 30: 45 full + 15 half by calendar offset)', () => {
  it('days 45–59 of the leave pay half', () => {
    const u = mk('mt1', { basic: 9000 });
    // 60-day leave 1 May → 29 Jun. June working days: offsets 31..59 → 15 Jun (off 45) onward = half
    W.DB.leaveRequests.push({ id: 'lmt1', userId: 'mt1', status: 'Approved', start: '2026-05-01', end: '2026-06-29', leaveTypeId: 'lt-mat' });
    const r = W._payCompute(u, M);
    // 15–29 Jun minus Sundays (21, 28) = 13 working half-pay days; 1–14 Jun full
    expect(r.detail.halfDays).toBe(13);
    expect(r.detail.unpaid).toBe(0);
  });                                                                                   // 7
});

describe('adjustments ledger + GPSSA pension', () => {
  it('one-off & recurring additions and capped deductions', () => {
    const u = mk('ad1', { basic: 9000 });
    for (let d = 1; d <= 30; d++) W.DB.attendance.push({ id: 'ad1' + d, userId: 'ad1', date: '2026-06-' + String(d).padStart(2, '0'), clockIn: '09:00' });
    u.hrm.payAdjust = [
      { id: 'p1', kind: 'earn', label: 'Commission', amount: 700, month: M },
      { id: 'p2', kind: 'earn', label: 'Phone', amount: 200, recurring: true, month: null },
      { id: 'p3', kind: 'deduct', label: 'Advance', amount: 300, month: M },
      { id: 'p4', kind: 'earn', label: 'Old bonus', amount: 999, month: '2026-05' }, // other month — ignored
    ];
    const r = W._payCompute(u, M);
    expect(r.detail.adjAdds).toBe(900);
    expect(r.detail.adjDed).toBe(300);
    expect(r.net).toBe(9000 + 900 - 300);
  });                                                                                   // 8
  it('deductions (fines + adjustments) never pass 50% of the wage', () => {
    const u = mk('ad2', { basic: 3000 });
    for (let d = 1; d <= 30; d++) W.DB.attendance.push({ id: 'ad2' + d, userId: 'ad2', date: '2026-06-' + String(d).padStart(2, '0'), clockIn: '09:00' });
    u.hrm.payAdjust = [{ id: 'p5', kind: 'deduct', label: 'Advance', amount: 2500, month: M }];
    W.DB.discipline.push({ id: 'dd2', userId: 'ad2', penalty: { type: 'fine', days: 5 }, decidedAt: '2026-06-10T00:00:00' });
    const r = W._payCompute(u, M);
    const fine = 5 * 100; // perDay 100
    expect(r.detail.fineAmount).toBe(fine);
    expect(r.detail.adjDed).toBe(1500 - fine); // remaining room under the 50% cap (1500)
    expect(r.detail.adjCapped).toBe(true);
  });                                                                                   // 9
  it('GPSSA: old-law joiner 5%, new-law 11%, band caps at 70k', () => {
    const a = mk('pn1', { basic: 10000 }); a.hrm.pensionOn = true; a.hrm.joiningDate = '2022-05-01';
    const b = mk('pn2', { basic: 10000 }); b.hrm.pensionOn = true; b.hrm.joiningDate = '2024-02-01';
    const c = mk('pn3', { basic: 90000 }); c.hrm.pensionOn = true; c.hrm.joiningDate = '2024-02-01';
    expect(W._payCompute(a, M).detail.pensionEmp).toBe(500);   // 5% of 10k
    expect(W._payCompute(b, M).detail.pensionEmp).toBe(1100);  // 11% of 10k
    expect(W._payCompute(c, M).detail.pensionEmp).toBe(7700);  // 11% of capped 70k
    expect(W._payCompute(a, M).detail.pensionEr).toBe(1500);   // employer 15%
  });                                                                                   // 10
  it('pension is statutory — outside the 50% discretionary cap', () => {
    const u = mk('pn4', { basic: 10000 }); u.hrm.pensionOn = true; u.hrm.joiningDate = '2024-01-01';
    u.hrm.payAdjust = [{ id: 'p6', kind: 'deduct', label: 'Advance', amount: 5000, month: M }];
    const r = W._payCompute(u, M);
    expect(r.detail.adjDed).toBe(5000);      // full 50% room available to the advance
    expect(r.detail.pensionEmp).toBe(1100);  // pension still deducted on top
  });                                                                                   // 11
});

describe('WPS SIF rows', () => {
  it('EDR per employee + SCR control with totals', () => {
    const u = mk('sif1', { basic: 9000 });
    u.hrm.molId = '12345678901234'; u.hrm.iban = 'AE070331234567890123456'; u.hrm.bankRouting = '033123456';
    for (let d = 1; d <= 30; d++) W.DB.attendance.push({ id: 'sf' + d, userId: 'sif1', date: '2026-06-' + String(d).padStart(2, '0'), clockIn: '09:00' });
    const run = { id: 'r1', month: M };
    const item = Object.assign({ id: 'i1', runId: 'r1', userId: 'sif1' }, W._payCompute(u, M));
    const rows = W._sifRows(run, [item]);
    expect(rows.length).toBe(2);
    expect(rows[0][0]).toBe('EDR');
    expect(rows[0][1]).toBe('12345678901234');
    expect(rows[1][0]).toBe('SCR');
    expect(rows[1][6]).toBe('1');                       // EDR record count
    expect(rows[1][7]).toBe(item.net.toFixed(2));       // total
  });                                                                                   // 12
});
