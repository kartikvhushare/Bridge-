/* Payroll compliance harness — UAE-only (R26), fully editable tiers, display-only guarantee.
   Before R26 this file pinned the multi-country model (AE/SA/XX + per-office mapping); the owner
   asked for UAE only with every rule dynamic, so those assertions were replaced, not deleted. */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

const W = window;
const Y = 365.25 * 24 * 3600 * 1000;
const iso = (msAgoYears) => new Date(Date.now() - msAgoYears * Y).toISOString().slice(0, 10);
let u;

beforeAll(() => {
  W.DB.hrmConfig = W.DB.hrmConfig || {};
  W.DB.hrmConfig.compliance = undefined; // force defaults
  u = W.__mkUser({ id: 'cmp1' });
  W.DB.users.push(u); W._ensureHrm(u);
  u.hrm.salary = { basic: 9000, housing: 800, transport: 200, allow: 1000 }; // gratuity uses BASIC by default
});

describe('config defaults — UAE only', () => {
  beforeEach(() => { W.DB.hrmConfig.compliance = undefined; });

  it('seeds exactly one country: AE', () => {
    const c = W._compCfg();
    expect(Object.keys(c.countries)).toEqual(['AE']);                                  // 1
    expect(W.COMP_KEY).toBe('AE');                                                     // 2
  });
  it('defaults to the statutory 21/30-day tiers on basic salary', () => {
    const g = W._compCfg().countries.AE.gratuity;
    expect(g.tiers).toEqual([{ uptoYears: 5, daysPerYear: 21 }, { uptoYears: null, daysPerYear: 30 }]); // 3
    expect(g.basis).toBe('basic');                                                     // 4
    expect(g.dailyDivisor).toBe(30);                                                   // 5
  });
  it('every user resolves to UAE regardless of which office they sit in', () => {
    expect(W._countryKeyForUser(u)).toBe('AE');                                        // 6
    u.hrm.locationId = 'locX';
    expect(W._countryKeyForUser(u)).toBe('AE');                                        // 7
    u.hrm.locationId = null;
  });
  it('migrates an old multi-country config: drops SA/XX, KEEPS the saved AE values', () => {
    W.DB.hrmConfig.compliance = {
      countries: {
        AE: { label: 'UAE', currency: 'AED', wps: { employerId: 'EMP-9', bankCode: 'BR-1' },
              gratuity: { basis: 'basic', dailyDivisor: 30, tiers: [{ uptoYears: 5, daysPerYear: 25 }, { uptoYears: null, daysPerYear: 30 }] } },
        SA: { label: 'Saudi Arabia', currency: 'SAR', gratuity: { tiers: [{ uptoYears: null, daysPerYear: 15 }] } },
        XX: { label: 'Custom country', currency: '' },
      },
      locationCountry: { locKSA: 'SA' },
    };
    const c = W._compCfg();
    expect(Object.keys(c.countries)).toEqual(['AE']);                                  // 8
    expect(c.countries.AE.wps.employerId).toBe('EMP-9');                               // 9 — not clobbered
    expect(c.countries.AE.gratuity.tiers[0].daysPerYear).toBe(25);                     // 10 — custom tier survives
    u.hrm.locationId = 'locKSA';
    expect(W._countryKeyForUser(u)).toBe('AE');                                        // 11 — stale mapping ignored
    u.hrm.locationId = null;
  });
});

describe('gratuity math (daily = basic/30)', () => {
  beforeEach(() => { W.DB.hrmConfig.compliance = undefined; });

  it('3 years service → 3 × 21 × 300 = 18,900', () => {
    u.hrm.joiningDate = iso(3);
    expect(W._gratuityAccrued(u).amount).toBeCloseTo(18900, -2);                       // 12
  });
  it('7 years → 5×21 + 2×30 days = 165 → 49,500', () => {
    u.hrm.joiningDate = iso(7);
    expect(W._gratuityAccrued(u).amount).toBeCloseTo(49500, -2);                       // 13
    expect(W._gratuityAccrued(u).currency).toBe('AED');                                // 14
  });
  it('no joining date → 0 years, 0 amount (never NaN)', () => {
    u.hrm.joiningDate = null;
    const g = W._gratuityAccrued(u);
    expect(g.years).toBe(0); expect(g.amount).toBe(0);                                 // 15,16
  });
});

describe('every rule is editable (R26)', () => {
  beforeEach(() => { W.DB.hrmConfig.compliance = undefined; u.hrm.joiningDate = iso(7); });

  it('a THIRD tier is honoured — 7 yrs at 21/25/30 = 5×21 + 2×25 = 155 days → 46,500', () => {
    W._compCfg().countries.AE.gratuity.tiers = [
      { uptoYears: 5, daysPerYear: 21 }, { uptoYears: 10, daysPerYear: 25 }, { uptoYears: null, daysPerYear: 30 },
    ];
    expect(W._gratuityAccrued(u).amount).toBeCloseTo(46500, -2);                       // 17
  });
  it('the daily divisor is a rule, not a constant (÷26 raises the accrual)', () => {
    const at30 = W._gratuityAccrued(u).amount;
    W._compCfg().countries.AE.gratuity.dailyDivisor = 26;
    expect(W._gratuityAccrued(u).amount).toBeCloseTo(at30 * 30 / 26, -2);              // 18
  });
  it('basis "gross" pays on basic+allowances instead of basic', () => {
    const onBasic = W._gratuityAccrued(u).amount;
    W._compCfg().countries.AE.gratuity.basis = 'gross';
    const onGross = W._gratuityAccrued(u).amount;
    // seeded gross = 9000 basic + 800 housing + 200 transport + 1000 other = 11,000
    expect(onGross).toBeCloseTo(onBasic * 11000 / 9000, -2);                           // 19
  });
  it('a single open-ended tier works (flat rate, no first period)', () => {
    W._compCfg().countries.AE.gratuity.tiers = [{ uptoYears: null, daysPerYear: 30 }];
    expect(W._gratuityAccrued(u).amount).toBeCloseTo(7 * 30 * 300, -2);                // 20
  });
});

describe('_compNormalizeTiers — user-entered tiers can be messy', () => {
  it('sorts by boundary and keeps exactly one open-ended tier, last', () => {
    const out = W._compNormalizeTiers([
      { uptoYears: null, daysPerYear: 30 }, { uptoYears: 10, daysPerYear: 25 }, { uptoYears: 5, daysPerYear: 21 },
    ]);
    expect(out).toEqual([
      { uptoYears: 5, daysPerYear: 21 }, { uptoYears: 10, daysPerYear: 25 }, { uptoYears: null, daysPerYear: 30 },
    ]);                                                                                // 21
  });
  it('coerces blanks/rubbish to numbers and never returns an empty list', () => {
    expect(W._compNormalizeTiers([{ uptoYears: '', daysPerYear: 'x' }])).toEqual([{ uptoYears: null, daysPerYear: 0 }]); // 22
    expect(W._compNormalizeTiers([])).toEqual([{ uptoYears: null, daysPerYear: 0 }]);  // 23
  });
  it('when the user leaves no open tier, the last capped one becomes open (no silent lost years)', () => {
    const out = W._compNormalizeTiers([{ uptoYears: 5, daysPerYear: 21 }, { uptoYears: 10, daysPerYear: 30 }]);
    expect(out[out.length - 1].uptoYears).toBe(null);                                  // 24
    expect(out[out.length - 1].daysPerYear).toBe(30);                                  // 25
  });
});

describe('display-only guarantee', () => {
  it('_payCompute output is untouched by compliance config (net formula unchanged)', () => {
    W.DB.hrmConfig.compliance = undefined;
    u.hrm.joiningDate = iso(5);
    u.hrm.schedule = { offDays: ['Sun'] };
    const before = W._payCompute(u, '2026-06');
    W._compCfg().countries.AE.gratuity.tiers[0].daysPerYear = 999; // absurd config
    W._compCfg().countries.AE.gratuity.basis = 'gross';
    const after = W._payCompute(u, '2026-06');
    expect(after.net).toBe(before.net);                                                // 26
    expect(after.deductions).toBe(before.deductions);                                  // 27
    W.DB.hrmConfig.compliance = undefined; // restore defaults for other files
  });
});
