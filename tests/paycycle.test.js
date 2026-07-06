/* Salary-month cycle: default = calendar month (unchanged); cycleStartDay 21 → 21st→20th window. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
const W = window;
let u;
beforeAll(() => {
  u = W.__mkUser({ id: 'pc1' });
  W.DB.users.push(u); W._ensureHrm(u);
  u.hrm.salary = { basic: 3000, allow: 0 };
});
afterAll(() => { if (W.DB.hrmConfig) delete W.DB.hrmConfig.payroll; });
describe('payroll cycle window', () => {
  it('default (no config) = plain calendar month', () => {
    if (W.DB.hrmConfig) delete W.DB.hrmConfig.payroll;
    expect(W._payCycleStartDay()).toBe(1);                                          // 1
    expect(W._payPeriod('2026-07')).toEqual({ start: '2026-07-01', end: '2026-07-31' }); // 2
  });
  it('cycleStartDay 21: "July" = 21 Jun → 20 Jul', () => {
    W.DB.hrmConfig = W.DB.hrmConfig || {};
    W.DB.hrmConfig.payroll = { cycleStartDay: 21 };
    expect(W._payPeriod('2026-07')).toEqual({ start: '2026-06-21', end: '2026-07-20' }); // 3
    expect(W._payPeriod('2026-03')).toEqual({ start: '2026-02-21', end: '2026-03-20' }); // 4 (Feb boundary)
  });
  it('working/total days + compute follow the window', () => {
    W.DB.hrmConfig.payroll = { cycleStartDay: 21 };
    const wd = W._workingDaysIn(u, '2026-07');
    expect(wd.total).toBe(30);                                                      // 5 (21 Jun–20 Jul = 30 days)
    const r = W._payCompute(u, '2026-07');
    expect(r.detail.period).toEqual({ start: '2026-06-21', end: '2026-07-20' });    // 6
  });
  it('invalid config values fall back to calendar', () => {
    W.DB.hrmConfig.payroll = { cycleStartDay: 99 };
    expect(W._payCycleStartDay()).toBe(1);                                          // 7
  });
});
