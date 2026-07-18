/* R22 — UAE compliance layer. Overtime legal rates + caps, disciplinary fines in payroll
   (Art 25/39), WPS due date, and the disciplinary due-process helpers. Month 2026-06 (30 days,
   Sundays 7/14/21/28). ~22 assertions. */
import { describe, it, expect, beforeAll } from 'vitest';

const W = window;
const M = '2026-06';

beforeAll(() => {
  W.DB.hrmConfig = W.DB.hrmConfig || {};
  W._seedHRMPlan();
  W.DB.holidays = [];
});

describe('overtime rate floors (UAE Art 19)', () => {
  beforeAll(() => {
    // deliberately configure BELOW the legal floor — code must clamp up
    W.DB.hrmConfig.alerts.otMultiplier = 1.0;
    W.DB.hrmConfig.alerts.otNightMultiplier = 1.0;
    W.DB.hrmConfig.alerts.otRestMultiplier = 1.0;
  });
  it('normal never below ×1.25', () => { expect(W._otMults().normal).toBe(1.25); });      // 1
  it('night never below ×1.5', () => { expect(W._otMults().night).toBe(1.5); });           // 2
  it('rest-day never below ×1.5', () => { expect(W._otMults().rest).toBe(1.5); });         // 3
  it('config ABOVE the floor is honoured', () => {
    W.DB.hrmConfig.alerts.otNightMultiplier = 1.75;
    expect(W._otMults().night).toBe(1.75);
    W.DB.hrmConfig.alerts.otNightMultiplier = 1.0;
  });                                                                                        // 4
  it('_otRateOf picks the kind rate', () => {
    expect(W._otRateOf({ kind: 'night' })).toBe(1.5);
    expect(W._otRateOf({ kind: 'rest' })).toBe(1.5);
    expect(W._otRateOf({ kind: 'normal' })).toBe(1.25);
  });                                                                                        // 5
  it('a FROZEN rate on the entry wins over config', () => {
    expect(W._otRateOf({ kind: 'normal', rate: 2 })).toBe(2);                                // 6
  });
});

describe('_otKindFor auto-classifies the day', () => {
  let u;
  beforeAll(() => { u = W.__mkUser({ id: 'otk' }); W._ensureHrm(u); u.hrm.schedule = { offDays: ['Sun'] }; });
  it('a working weekday is normal', () => { expect(W._otKindFor(u, '2026-06-08')).toBe('normal'); }); // 7 (Mon)
  it('the off-day is rest', () => { expect(W._otKindFor(u, '2026-06-14')).toBe('rest'); });            // 8 (Sun)
  it('a public holiday is rest', () => {
    W.DB.holidays = [{ id: 'h', date: '2026-06-08' }];
    expect(W._otKindFor(u, '2026-06-08')).toBe('rest');
    W.DB.holidays = [];
  });                                                                                        // 9
});

describe('_payCompute pays each OT entry at its own rate', () => {
  let u, r, hourly, working;
  beforeAll(() => {
    u = W.__mkUser({ id: 'otpay' }); W.DB.users.push(u); W._ensureHrm(u);
    u.hrm.salary = { basic: 8000, allow: 0 }; u.hrm.schedule = { offDays: ['Sun'] };
    W.DB.attendance = []; W.DB.leaveRequests = []; W.DB.discipline = [];
    W.DB.overtime = [
      { id: 'x1', userId: 'otpay', status: 'Approved', comp: 'pay', date: '2026-06-09', hours: 2, kind: 'normal', rate: 1.25 },
      { id: 'x2', userId: 'otpay', status: 'Approved', comp: 'pay', date: '2026-06-10', hours: 2, kind: 'night', rate: 1.5 },
      { id: 'x3', userId: 'otpay', status: 'Approved', comp: 'pay', date: '2026-06-14', hours: 2, kind: 'rest', rate: 1.5 },
    ];
    working = W._workingDaysIn(u, M).working;
    hourly = 8000 / (working * 8);
    r = W._payCompute(u, M);
  });
  it('sums hours across kinds', () => { expect(r.detail.otHours).toBe(6); });                // 10
  it('splits hours by kind', () => { expect(r.detail.otSplit).toEqual({ normal: 2, night: 2, rest: 2 }); }); // 11
  it('amount = Σ hours × hourly × own rate', () => {
    const exp = Math.round((2 * hourly * 1.25 + 2 * hourly * 1.5 + 2 * hourly * 1.5) * 100) / 100;
    expect(r.otAmount).toBe(exp);                                                             // 12
  });
});

describe('disciplinary fines in payroll (Art 25/39)', () => {
  it('caps at 5 days per month and flags it', () => {
    const u = W.__mkUser({ id: 'fin5' }); W.DB.users.push(u); W._ensureHrm(u);
    u.hrm.salary = { basic: 6000, allow: 0 }; u.hrm.schedule = { offDays: ['Sun'] };
    W.DB.attendance = []; W.DB.leaveRequests = [];
    W.DB.discipline = [{ id: 'd1', userId: 'fin5', penalty: { type: 'fine', days: 7 }, decidedAt: '2026-06-15T09:00:00' }];
    const r = W._payCompute(u, M);
    expect(r.detail.fineDays).toBe(5);                                                        // 13
    expect(r.detail.fineCapped).toBe(true);                                                   // 14
  });
  it('never exceeds 50% of the wage (Art 25 guard)', () => {
    const u = W.__mkUser({ id: 'fin50' }); W.DB.users.push(u); W._ensureHrm(u);
    u.hrm.salary = { basic: 1000, allow: 0 };
    u.hrm.schedule = { offDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Sat', 'Sun'] }; // only Fri works → ~4 days, high perDay
    W.DB.attendance = []; W.DB.leaveRequests = [];
    W.DB.discipline = [{ id: 'd2', userId: 'fin50', penalty: { type: 'fine', days: 5 }, decidedAt: '2026-06-12T09:00:00' }];
    const r = W._payCompute(u, M);
    expect(r.detail.fineAmount).toBe(500); // 50% of 1000                                     // 15
    expect(r.detail.fineCapped).toBe(true);                                                   // 16
  });
  it('no discipline → no fine, net untouched by the new path', () => {
    const u = W.__mkUser({ id: 'fin0' }); W.DB.users.push(u); W._ensureHrm(u);
    u.hrm.salary = { basic: 5000, allow: 500 }; u.hrm.schedule = { offDays: ['Sun'] };
    W.DB.attendance = []; W.DB.leaveRequests = []; W.DB.discipline = [];
    const r = W._payCompute(u, M);
    expect(r.detail.fineAmount).toBe(0);                                                      // 17
    expect(r.detail.absenceDed).toBe(r.deductions); // deductions == absence only when no fine // 18
  });
});

describe('WPS due date (Res 340/2026 — 1st of next month)', () => {
  it('mid-year rolls to next month', () => { expect(W._wpsDueDate('2026-06')).toBe('2026-07-01'); }); // 19
  it('December rolls to next year', () => { expect(W._wpsDueDate('2026-12')).toBe('2027-01-01'); });   // 20
});

describe('disciplinary due-process helpers (Art 39)', () => {
  it('status: no penalty & no level = open Charge', () => {
    expect(W._dcStatus({})).toBe('Charge');
    expect(W._dcStatus({ penalty: { type: 'fine' } })).toBe('Decided');
    expect(W._dcStatus({ level: 'First' })).toBe('Decided'); // legacy record
    expect(W._dcStatus({ status: 'Dropped' })).toBe('Dropped');
  });                                                                                          // 21
  it('decision deadline = statement + 60 days (else charge + 60)', () => {
    expect(W._dcDeadline({ createdAt: '2026-06-01T00:00:00' })).toBe(W._isoAdd('2026-06-01', 60));
    expect(W._dcDeadline({ createdAt: '2026-06-01', defenceAt: '2026-06-10T00:00:00' })).toBe(W._isoAdd('2026-06-10', 60));
  });                                                                                          // 22
});
