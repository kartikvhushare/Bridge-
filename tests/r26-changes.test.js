/* R26 — attendance log range filter, leave-type add/guarded-delete, and the mobile-layout
   regressions that the headless-Chrome audit (work/mobile-audit) found. */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const W = window;
let sa, mate;

beforeAll(() => {
  W.log = () => {};
  sa = W.__mkUser({ id: 'r26sa', firstName: 'Kartiksingh', lastName: 'Hushare' });
  mate = W.__mkUser({ id: 'r26u2', firstName: 'Abdulrahman', lastName: 'Balasubramanian' });
  W.DB.users.push(sa, mate);
  [sa, mate].forEach(u => W._ensureHrm(u));
  sa.hrm.roleProfileId = 'superadmin';
  W._seedRoleProfiles(); W._permsV3Migrate(); W._seedHRMPlan();
  W._seedProfiles();
  Object.keys(W.DB.hrmConfig.profiles || {}).forEach(W._seedLeaveTypes);
  W.S.uid = 'r26sa';
});

/* ════════════════ 1. ATTENDANCE LOG — date range ════════════════ */
describe('R26 · attendance log range', () => {
  beforeEach(() => { W.S.filters = {}; });

  it('presets resolve to the right windows', () => {
    expect(W._attPresetRange('month', '2026-07-25')).toEqual({ from: '2026-07-01', to: '2026-07-25' });   // 1
    expect(W._attPresetRange('d30', '2026-07-25')).toEqual({ from: '2026-06-26', to: '2026-07-25' });     // 2
    expect(W._attPresetRange('year', '2026-07-25')).toEqual({ from: '2026-01-01', to: '2026-07-25' });    // 3
    expect(W._attPresetRange('m3', '2026-07-25').from).toBe('2026-04-26');                                // 4
  });
  it('an unknown preset falls back to this month rather than showing nothing', () => {
    expect(W._attPresetRange('nonsense', '2026-07-25')).toEqual({ from: '2026-07-01', to: '2026-07-25' }); // 5
  });
  it('defaults to this month when nothing is chosen', () => {
    const r = W._attRange();
    expect(r.from).toBe(W.todayISO().slice(0, 7) + '-01');                                                 // 6
    expect(r.custom).toBe(false);                                                                          // 7
  });
  it('an explicit From/To beats the preset and marks the range custom', () => {
    W.S.filters = { attPreset: 'year', attFrom: '2026-03-01', attTo: '2026-03-31' };
    const r = W._attRange();
    expect(r).toMatchObject({ from: '2026-03-01', to: '2026-03-31', custom: true });                       // 8
  });
  it('a backwards range is swapped, not silently emptied', () => {
    W.S.filters = { attFrom: '2026-05-30', attTo: '2026-05-01' };
    expect(W._attRange()).toMatchObject({ from: '2026-05-01', to: '2026-05-30' });                         // 9
  });
  it('only one half of the range given → the other half comes from this month', () => {
    W.S.filters = { attFrom: '2026-01-15' };
    const r = W._attRange();
    expect(r.from).toBe('2026-01-15');                                                                     // 10
    expect(r.to).toBe(W.todayISO());                                                                       // 11
  });

  it('_attRowsIn filters by user AND range, inclusive of both ends', () => {
    W.DB.attendance = (W.DB.attendance || []).filter(a => a.userId !== 'r26sa' && a.userId !== 'r26u2');
    ['2026-02-28', '2026-03-01', '2026-03-15', '2026-03-31', '2026-04-01'].forEach((d, i) =>
      W.DB.attendance.push({ id: 'a' + i, userId: 'r26sa', date: d, hours: 8 + i, status: 'Present', flags: [] }));
    W.DB.attendance.push({ id: 'other', userId: 'r26u2', date: '2026-03-10', hours: 99, status: 'Present', flags: [] });
    const rows = W._attRowsIn('r26sa', { from: '2026-03-01', to: '2026-03-31' }, 'date');
    expect(rows.map(r => r.date)).toEqual(['2026-03-31', '2026-03-15', '2026-03-01']);                      // 12 (inclusive + newest first)
    expect(rows.some(r => r.userId === 'r26u2')).toBe(false);                                               // 13
  });
  it('sorting by hours reorders without changing the set', () => {
    const byHours = W._attRowsIn('r26sa', { from: '2026-03-01', to: '2026-03-31' }, 'hours');
    expect(byHours.map(r => r.hours)).toEqual([...byHours.map(r => r.hours)].sort((a, b) => b - a));        // 14
    expect(byHours.length).toBe(3);                                                                         // 15
  });
  it('the page renders the range bar and no longer caps at 60 records', () => {
    W.S.route = 'attendance'; W.S.filters = {};
    for (let i = 0; i < 70; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      if (!W.DB.attendance.some(a => a.userId === 'r26sa' && a.date === iso))
        W.DB.attendance.push({ id: 'bulk' + i, userId: 'r26sa', date: iso, hours: 8, status: 'Present', flags: [] });
    }
    W.S.filters = { attFrom: '2020-01-01', attTo: W.todayISO() };
    const html = W.attendancePage();
    expect(html).toContain('Attendance log');                                                               // 16
    expect(html).toContain('This month');                                                                   // 17
    expect(html).toContain('Last 3 months');                                                                // 18
    const shown = W._attRowsIn('r26sa', W._attRange(), 'date').length;
    expect(shown).toBeGreaterThan(60);                                                                      // 19 — the old hard cap is gone
  });
  it('the log is no longer nested in the 2-column grid beside the calendar', () => {
    W.S.route = 'attendance'; W.S.filters = {};
    const html = W.attendancePage();
    expect(html.includes('grid md:grid-cols-2 gap-4 items-start')).toBe(false);                             // 20
    expect(html).toContain('att-log');                                                                      // 21
  });
});

/* ════════════════ 2. LEAVE TYPES — add + guarded delete ════════════════ */
describe('R26 · leave types can be added and deleted', () => {
  beforeEach(() => {
    W.S.filters = {}; W.App.closeModal();
    W.DB.leaveRequests = (W.DB.leaveRequests || []).filter(r => !String(r.id).startsWith('r26'));
    W.DB.leaveBalances = (W.DB.leaveBalances || []).filter(b => !String(b.id).startsWith('r26'));
  });

  it('the Leave Types tab now offers Add and a per-row Delete', () => {
    W.S.route = 'hrmconfig'; W.S.filters = { cfgtab: 'types' };
    const html = W.pageContent();
    expect(html).toContain('App.addLeaveType');                                                             // 22
    expect(html).toContain('App.delLeaveType');                                                             // 23
  });
  it('addLeaveType appends to the active profile and opens the editor', () => {
    const before = (W.DB.leaveTypes || []).length;
    W.App.addLeaveType('UAE');
    expect(W.DB.leaveTypes.length).toBe(before + 1);                                                        // 24
    const made = W.DB.leaveTypes[W.DB.leaveTypes.length - 1];
    expect(made.profileId).toBe('UAE');                                                                     // 25
    expect(made.key).toBe('');                                                                              // 26 — never claims a statutory key
    expect(made.enabled).toBe(true);                                                                        // 27
    expect(document.getElementById('modal')).toBeTruthy();                                                  // 28
    W.App.closeModal();
    W.DB.leaveTypes = W.DB.leaveTypes.filter(t => t.id !== made.id);
  });
  it('an unused type deletes, and is tombstoned so the server copy cannot resurrect it', () => {
    W.App.addLeaveType('UAE');
    const made = W.DB.leaveTypes[W.DB.leaveTypes.length - 1];
    W.App.closeModal();
    W.App._ltDelGo(made.id);
    expect(W.DB.leaveTypes.some(t => t.id === made.id)).toBe(false);                                        // 29
    expect((W.DB.leaveTypes_deleted || []).includes(made.id)).toBe(true);                                   // 30
    // a fresh server payload containing the deleted row must NOT bring it back
    W._applyLeaveTypes([{ id: made.id, profile_id: 'UAE', name: 'New leave type', enabled: true }]);
    expect(W.DB.leaveTypes.some(t => t.id === made.id)).toBe(false);                                        // 31
  });
  it('a type with leave history is BLOCKED, and says what still points at it', () => {
    W.App.addLeaveType('UAE');
    const made = W.DB.leaveTypes[W.DB.leaveTypes.length - 1];
    W.App.closeModal();
    W.DB.leaveRequests.push({ id: 'r26lr1', userId: 'r26u2', leaveTypeId: made.id, start: '2026-03-01',
      end: '2026-03-03', status: 'Approved', workingDays: 3, flow: [], stageIndex: 0 });
    W.App.delLeaveType(made.id);
    const m = document.getElementById('modal');
    expect(m).toBeTruthy();                                                                                 // 32
    expect(m.innerHTML).toContain('Leave requests using it');                                               // 33
    expect(m.innerHTML).toContain('Abdulrahman');                                                           // 34 — names the holder
    expect(W.DB.leaveTypes.some(t => t.id === made.id)).toBe(true);                                         // 35 — still there
    // the low-level remover refuses too, so no path can orphan the history
    W.App._ltDelGo(made.id);
    expect(W.DB.leaveTypes.some(t => t.id === made.id)).toBe(true);                                         // 36
    W.App.closeModal();
    W.DB.leaveRequests = W.DB.leaveRequests.filter(r => r.id !== 'r26lr1');
    W.App._ltDelGo(made.id);
    expect(W.DB.leaveTypes.some(t => t.id === made.id)).toBe(false);                                        // 37 — deletable once clear
  });
  it('a non-zero balance also blocks the delete', () => {
    W.App.addLeaveType('UAE');
    const made = W.DB.leaveTypes[W.DB.leaveTypes.length - 1];
    W.App.closeModal();
    W.DB.leaveBalances.push({ id: 'r26lb1', userId: 'r26u2', leaveTypeId: made.id, leaveYear: '2026-01-01',
      entitled: 12, accrued: 0, taken: 0, adjustments: 0 });
    W.App._ltDelGo(made.id);
    expect(W.DB.leaveTypes.some(t => t.id === made.id)).toBe(true);                                         // 38
    W.App.closeModal();
    W.DB.leaveBalances = W.DB.leaveBalances.filter(b => b.id !== 'r26lb1');
    W.App._ltDelGo(made.id);
    expect(W.DB.leaveTypes.some(t => t.id === made.id)).toBe(false);                                        // 39
  });
  it('deleting a STATUTORY type (sick/maternity/comp-off) is blocked — the engine keys off it', () => {
    const sick = (W.DB.leaveTypes || []).find(t => t.profileId === 'UAE' && t.key === 'sick');
    expect(sick).toBeTruthy();                                                                              // 40
    W.App._ltDelGo(sick.id);
    expect(W.DB.leaveTypes.some(t => t.id === sick.id)).toBe(true);                                         // 41
    W.App.closeModal();
  });
});

/* ════════════════ 3. MOBILE LAYOUT — the measured regressions ════════════════ */
describe('R26 · mobile layout guards', () => {
  const css = fs.readFileSync(path.resolve('src/styles.css'), 'utf8');

  it('table cells do not use overflow-wrap:anywhere (it collapsed columns to one character)', () => {
    // the exact defect: Access Control rendered every name vertically and ran 21,662px tall.
    // (the string may appear in the explanatory comment — assert on the DECLARATION, not the file)
    const decls = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(decls.includes('overflow-wrap:anywhere')).toBe(false);                                           // 42
    expect(decls).toContain('#content td,#content th{word-break:normal;overflow-wrap:break-word}');         // 43
  });
  it('the attendance log keeps its date/time columns on one line', () => {
    expect(css).toContain('.att-log td,.att-log th{white-space:nowrap}');                                   // 44
  });
  it('tap-target fixes are present for the tip bar, announcement strip and flow reorder', () => {
    ['.how-x', '.how-chip', '.ann-x', '.af-ico', '.help-q'].forEach(sel => expect(css).toContain(sel));     // 45
  });
  it('the tip bar and announcement dismiss carry the classes those rules target', () => {
    W.S.route = 'payroll'; W.S.filters = {};
    const html = W.pageContent();
    expect(html).toContain('how-x');                                                                        // 46
    expect(html).toContain('how-chip');                                                                     // 47
  });
});
