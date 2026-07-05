/* Payroll / HRM compute harness — 15 assertions.
   Fixed month 2026-06 (30 days; the 1st is a Monday; Sundays = 7/14/21/28).
   Covers: working-day math (off-days, holidays, combined), salary passthrough,
   presence/WFH counting, paid vs unpaid leave, absence, deduction, overtime
   (pay vs time-in-lieu, default 1.25×), and the net formula. */
import { describe, it, expect, beforeAll } from 'vitest';

const W = window;
const M = '2026-06';
let u, r;

beforeAll(() => {
  u = W.__mkUser({ id: 'pe1' });
  W.DB.users.push(u);
  W._ensureHrm(u);
  u.hrm.salary = { basic: 5000, allow: 500 };
  u.hrm.schedule = { offDays: ['Sun'] };

  W.DB.holidays = [];
  W.DB.attendance = [
    { id: 'a1', userId: 'pe1', date: '2026-06-01', clockIn: '09:00', clockOut: '17:00' },
    { id: 'a2', userId: 'pe1', date: '2026-06-02', clockIn: '09:00', clockOut: '17:00' },
    { id: 'a3', userId: 'pe1', date: '2026-06-04', clockIn: '09:00', clockOut: '17:00', flags: ['WFH'] },
  ];
  W.DB.leaveTypes = [
    { id: 'lt1', name: 'Annual', unpaid: false },
    { id: 'lt2', name: 'Unpaid Leave', unpaid: true },
  ];
  W.DB.leaveRequests = [
    { id: 'l1', userId: 'pe1', status: 'Approved', start: '2026-06-05', end: '2026-06-05', leaveTypeId: 'lt1' }, // paid Fri
    { id: 'l2', userId: 'pe1', status: 'Approved', start: '2026-06-08', end: '2026-06-09', leaveTypeId: 'lt2' }, // unpaid Mon–Tue
  ];
  W.DB.overtime = [
    { id: 'o1', userId: 'pe1', status: 'Approved', comp: 'pay',  date: '2026-06-10', hours: 4 },
    { id: 'o2', userId: 'pe1', status: 'Approved', comp: 'lieu', date: '2026-06-11', hours: 3 }, // time-in-lieu: NOT paid
    { id: 'o3', userId: 'pe1', status: 'Pending',  comp: 'pay',  date: '2026-06-12', hours: 9 }, // not approved
  ];
});

describe('_workingDaysIn', () => {
  it('June 2026 has 30 calendar days', () => {
    expect(W._workingDaysIn(u, M).total).toBe(30);                                   // 1
  });
  it('Sundays off → 26 working days', () => {
    expect(W._workingDaysIn(u, M).working).toBe(26);                                 // 2
  });
  it('a public holiday removes one more (25)', () => {
    W.DB.holidays = [{ id: 'h1', date: '2026-06-03', name: 'Founders Day' }];
    expect(W._workingDaysIn(u, M).working).toBe(25);                                 // 3
  });
  it('off-day set is respected (Sat+Sun + holiday → 21)', () => {
    const u2 = W.__mkUser({ id: 'pe2' }); W._ensureHrm(u2);
    u2.hrm.schedule = { offDays: ['Sat', 'Sun'] };
    expect(W._workingDaysIn(u2, M).working).toBe(21);                                // 4
  });
});

describe('_payCompute (working=25, perDay=220, hourly=27.5)', () => {
  beforeAll(() => { r = W._payCompute(u, M); });

  it('passes salary through', () => {
    expect({ basic: r.basic, allowances: r.allowances }).toEqual({ basic: 5000, allowances: 500 }); // 5
  });
  it('counts presence from clock-ins', () => {
    expect(r.detail.present).toBe(3);                                                // 6
  });
  it('counts the WFH flag', () => {
    expect(r.detail.wfh).toBe(1);                                                    // 7
  });
  it('counts approved leave days (paid + unpaid)', () => {
    expect(r.detail.leaveDays).toBe(3);                                              // 8
  });
  it('flags only the unpaid-type days as unpaid', () => {
    expect(r.detail.unpaid).toBe(2);                                                 // 9
  });
  it('derives absences for the rest of the month (25 − 3 present − 3 leave = 19)', () => {
    expect(r.detail.absent).toBe(19);                                                // 10
  });
  it('unpaidDays = unpaid leave + absences', () => {
    expect(r.unpaidDays).toBe(21);                                                   // 11
  });
  it('deducts unpaidDays × perDay (21 × 220 = 4620)', () => {
    expect(r.deductions).toBe(4620);                                                 // 12
  });
  it('only APPROVED overtime with comp=pay counts (4h)', () => {
    expect(r.detail.otHours).toBe(4);                                                // 13
  });
  it('OT paid at hourly × default 1.25 multiplier (4 × 27.5 × 1.25 = 137.5)', () => {
    expect(r.otAmount).toBe(137.5);                                                  // 14
  });
  it('net = basic + allowances + OT − deductions (1017.5)', () => {
    expect(r.net).toBe(1017.5);                                                      // 15
  });
});
