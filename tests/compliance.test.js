/* Payroll compliance harness — tiered gratuity/EOSB math, country mapping, display-only guarantee. */
import { describe, it, expect, beforeAll } from 'vitest';

const W = window;
const Y = 365.25 * 24 * 3600 * 1000;
const iso = (msAgoYears) => new Date(Date.now() - msAgoYears * Y).toISOString().slice(0, 10);
let u;

beforeAll(() => {
  W.DB.hrmConfig = W.DB.hrmConfig || {};
  W.DB.hrmConfig.compliance = undefined; // force defaults
  u = W.__mkUser({ id: 'cmp1' });
  W.DB.users.push(u); W._ensureHrm(u);
  u.hrm.salary = { basic: 9000, allow: 1000 };   // gratuity uses BASIC only
});

describe('config defaults', () => {
  it('seeds UAE + KSA + custom template', () => {
    const c = W._compCfg();
    expect(Object.keys(c.countries).sort()).toEqual(['AE', 'SA', 'XX']);           // 1
    expect(c.countries.AE.gratuity.tiers[0]).toEqual({ uptoYears: 5, daysPerYear: 21 }); // 2
  });
  it('users default to UAE unless their office is mapped', () => {
    expect(W._countryKeyForUser(u)).toBe('AE');                                    // 3
    u.hrm.locationId = 'locX';
    W._compCfg().locationCountry.locX = 'SA';
    expect(W._countryKeyForUser(u)).toBe('SA');                                    // 4
    delete W._compCfg().locationCountry.locX; u.hrm.locationId = null;
  });
});

describe('gratuity math (daily = basic/30)', () => {
  it('UAE, 3 years service → 3 × 21 × 300 = 18,900', () => {
    u.hrm.joiningDate = iso(3);
    const g = W._gratuityAccrued(u);
    expect(g.amount).toBeCloseTo(18900, -2);                                      // 5
  });
  it('UAE, 7 years → 5×21 + 2×30 days = 105+60 → 49,500', () => {
    u.hrm.joiningDate = iso(7);
    expect(W._gratuityAccrued(u).amount).toBeCloseTo(49500, -2);                  // 6
  });
  it('KSA rules differ: 7 years → 5×15 + 2×30 = 135 days → 40,500', () => {
    u.hrm.locationId = 'locKSA'; W._compCfg().locationCountry.locKSA = 'SA';
    expect(W._gratuityAccrued(u).amount).toBeCloseTo(40500, -2);                  // 7
    expect(W._gratuityAccrued(u).currency).toBe('SAR');                            // 8
    delete W._compCfg().locationCountry.locKSA; u.hrm.locationId = null;
  });
  it('no joining date → 0 years, 0 amount (never NaN)', () => {
    u.hrm.joiningDate = null;
    const g = W._gratuityAccrued(u);
    expect(g.years).toBe(0); expect(g.amount).toBe(0);                             // 9,10
  });
  it('custom template with 0 days/yr yields 0 (accountant must fill it)', () => {
    u.hrm.joiningDate = iso(4); u.hrm.locationId = 'locZ';
    W._compCfg().locationCountry.locZ = 'XX';
    expect(W._gratuityAccrued(u).amount).toBe(0);                                  // 11
    delete W._compCfg().locationCountry.locZ; u.hrm.locationId = null;
  });
});

describe('display-only guarantee', () => {
  it('_payCompute output is untouched by compliance config (net formula unchanged)', () => {
    u.hrm.joiningDate = iso(5);
    u.hrm.schedule = { offDays: ['Sun'] };
    const before = W._payCompute(u, '2026-06');
    W._compCfg().countries.AE.gratuity.tiers[0].daysPerYear = 999; // absurd config
    const after = W._payCompute(u, '2026-06');
    expect(after.net).toBe(before.net);                                            // 12
    expect(after.deductions).toBe(before.deductions);                              // 13
    W.DB.hrmConfig.compliance = undefined; // restore defaults for other files
  });
});
