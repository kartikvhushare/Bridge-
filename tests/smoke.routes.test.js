/* Route sweep + new-feature smoke (Evarca changes) — renders every route as a seeded
   Super Admin (zero throws), then asserts the fingerprints of each change. */
import { describe, it, expect, beforeAll } from 'vitest';

const W = window;
const ROUTES = ['dashboard','users','departments','locations','checklists','allcl','mychecklists',
  'teamview','questions','tickets','documents','analytics','reports','hrmanalytics','okr',
  'announcements','approvals','attendance','leave','myschedule','schedule','shifts','overtime',
  'expenses','lifecycle','sops','discipline','letters','payroll','surveys','reviews','hierarchy',
  'audit','settings','accesscontrol','hrmconfig','notifications','profile','more'];

let sa, emp;
beforeAll(() => {
  sa  = W.__mkUser({ id: 'sa1',  role: 'Admin' });
  emp = W.__mkUser({ id: 'emp1' });
  W.DB.users.push(sa, emp);
  [sa, emp].forEach(u => W._ensureHrm(u));
  W._seedRoleProfiles();
  W._permsV3Migrate();
  W._seedHRMPlan();
  W._ns = W._nsDefault();
  W.log = () => {}; // _env's sb stub can't chain .then().catch() — audit writes are not under test
  W.S.uid = 'sa1';
});

describe('route sweep (Super Admin)', () => {
  for (const r of ROUTES) {
    it('renders ' + r, () => {
      W.S.route = r; W.S.filters = {}; W.S.search = '';
      const html = W.pageContent();
      expect(typeof html).toBe('string');
      expect(html.length).toBeGreaterThan(20);
    });
  }
});

describe('change #1 - rename', () => {
  it('shell brands as Evarca, never Bridge', () => {
    W.S.route = 'dashboard'; W.S.filters = {};
    const html = W.shell(W.pageContent());
    expect(html).toContain('Evarca');
    expect(html.includes('>Bridge<')).toBe(false);
  });
});

describe('change #4 - Workflow tab removed', () => {
  it('settings has no Workflow tab and stale stab falls back', () => {
    W.S.route = 'settings'; W.S.filters = { stab: 'workflow' };
    const html = W.pageContent();
    expect(html.includes('>Workflow<')).toBe(false);
    expect(html).toContain('In-app notifications');
  });
});

describe('changes #5+#6 - WFH toggle & assets on the user editor', () => {
  it('user editor shows the WFH toggle and the assets section', () => {
    W.S.route = 'users'; W.S.filters = {};
    W.App.editUser('emp1');
    const m = document.getElementById('modal');
    expect(m).toBeTruthy();
    expect(m.innerHTML).toContain('Eligible for Work-from-Home');
    expect(m.innerHTML).toContain('Assets assigned');
    W.App.closeModal();
  });
  it('WFH marking is blocked for non-eligible users', () => {
    W.S.uid = 'emp1';
    const before = (W.DB.attendance || []).length;
    W.App._togWFH();
    expect((W.DB.attendance || []).length).toBe(before);
    W.S.uid = 'sa1';
  });
  it('WFH marking works once eligible', () => {
    W.S.uid = 'emp1';
    W._ensureHrm(emp); emp.hrm.wfhEligible = true;
    W.App._togWFH();
    const rec = (W.DB.attendance || []).find(a => a.userId === 'emp1' && a.date === W.todayISO());
    expect(rec && rec.flags.includes('WFH')).toBe(true);
    emp.hrm.wfhEligible = false;
    W.S.uid = 'sa1';
  });
});

describe('change #2 - referential-integrity delete guards', () => {
  it('a department with people is blocked, an empty one passes', () => {
    W.DB.departments.push({ id: 'dX', name: 'GuardDept' }, { id: 'dY', name: 'EmptyDept' });
    emp.department = 'GuardDept';
    expect(W.guardDelete('department', 'dX', 'GuardDept')).toBe(false);
    W.App.closeModal();
    expect(W.guardDelete('department', 'dY', 'EmptyDept')).toBe(true);
    emp.department = '';
  });
  it('a user with an unreturned asset is blocked; returned frees them', () => {
    W._ensureHrm(emp);
    emp.hrm.assets = [{ id: 'a1', name: 'MacBook', status: 'Assigned' }];
    expect(W._refLinks('user', 'emp1').some(l => l.label.includes('Assets'))).toBe(true);
    emp.hrm.assets[0].status = 'Returned';
    expect(W._refLinks('user', 'emp1').some(l => l.label.includes('Assets'))).toBe(false);
    emp.hrm.assets = [];
  });
  it('a checklist with assignees is blocked', () => {
    W.DB.checklists.push({ id: 'clX', name: 'Guarded CL', assignees: ['emp1'], tasks: [], questionIds: [] });
    expect(W.guardDelete('checklist', 'clX', 'Guarded CL')).toBe(false);
    W.App.closeModal();
    W.DB.checklists = W.DB.checklists.filter(c => c.id !== 'clX');
  });
});

describe('change #3 - per-feature in-app switches', () => {
  it('notify() honors inappKinds', () => {
    const n0 = W.DB.notifications.length;
    W.DB.hrmConfig.inappKinds = { okr: false };
    W.notify('emp1', 'okr off test', 'okr');
    expect(W.DB.notifications.length).toBe(n0);
    W.DB.hrmConfig.inappKinds = {};
    W.notify('emp1', 'okr on test', 'okr');
    expect(W.DB.notifications.length).toBe(n0 + 1);
  });
  it('_hrmNotify honors the feature switch too', () => {
    const n0 = W.DB.notifications.length;
    W.DB.hrmConfig.inappKinds = { leave: false };
    W._hrmNotify('emp1', 'leave off test', 'leave');
    expect(W.DB.notifications.length).toBe(n0);
    W.DB.hrmConfig.inappKinds = {};
    W._hrmNotify('emp1', 'leave on test', 'leave');
    expect(W.DB.notifications.length).toBe(n0 + 1);
  });
  it('unknown kinds map to the general switch', () => {
    const n0 = W.DB.notifications.length;
    W.DB.hrmConfig.inappKinds = { general: false };
    W.notify('emp1', 'ticket kind test', 'ticket');
    expect(W.DB.notifications.length).toBe(n0);
    W.DB.hrmConfig.inappKinds = {};
  });
});

/* ── Round 2 changes ── */
describe('r2 #1 - clock-out enforces geofence like clock-in', () => {
  it('clock-out is blocked when no working geofence confirms location', () => {
    W.S.uid = 'emp1';
    const d = W.todayISO();
    let rec = (W.DB.attendance || []).find(a => a.userId === 'emp1' && a.date === d);
    if (!rec) { rec = { id: 'att_emp1_' + d, userId: 'emp1', date: d, clockIn: new Date().toISOString(), clockOut: null, inMin: 540, outMin: null, hours: null, status: 'Present', flags: [], createdAt: new Date().toISOString() }; W.DB.attendance.push(rec); }
    else { rec.clockIn = new Date().toISOString(); rec.inMin = 540; rec.clockOut = null; rec.outMin = null; }
    W.App.clockOut(); // jsdom: no geofence candidates + strict mode → must NOT punch out
    expect(rec.clockOut).toBe(null);
    W.S.uid = 'sa1';
  });
});

describe('r2 #2 - hours render as Xh Ym', () => {
  it('fmtH formats decimals into hours + minutes', () => {
    expect(W.fmtH(7.86)).toBe('7h 52m');
    expect(W.fmtH(8)).toBe('8h');
    expect(W.fmtH(0.5)).toBe('0h 30m');
  });
});

describe('r2 #3 - persistence wiring', () => {
  it('announcement row mappers round-trip', () => {
    const a = { id: 'annX', title: 'Hello', body: 'World', deptTarget: 'Ops', locTarget: null, createdBy: 'sa1', createdAt: '2026-07-12T00:00:00Z' };
    const back = W._mAnn([W._annRow(a)])[0];
    expect(back.title).toBe('Hello');
    expect(back.deptTarget).toBe('Ops');
  });
  it('hrm_config extras merge applies switch + template blobs', () => {
    W.S.route = 'dashboard'; // not the hrmconfig editor → merge allowed
    W._applyHrmConfig({ extras: { inappKinds: { okr: false }, letterTemplates: { tplX: { name: 'X', body: 'B' } }, branding: { header: 'Evarca HQ' } } });
    expect(W.DB.hrmConfig.inappKinds.okr).toBe(false);
    expect(W.DB.hrmConfig.letterTemplates.tplX.name).toBe('X');
    expect(W.DB.hrmConfig.branding.header).toBe('Evarca HQ');
    W.DB.hrmConfig.inappKinds = {};
  });
});

describe('r2 #4 - drafts (server-backed)', () => {
  it('save → find → delete round-trip with photo stripping', () => {
    const payload = { questionResponses: [{ questionId: 'q1', response: 'Yes', photo: 'data:image/png;base64,AAA', photos: ['data:image/png;base64,BBB', 'https://x/y.png'] }] };
    W._draftSave('checklist', 'clDr', '2026-07-12', payload);
    const d = W._draftFor('checklist', 'clDr', '2026-07-12');
    expect(d).toBeTruthy();
    expect(d.payload.questionResponses[0].photo).toBe('[photo]');
    expect(d.payload.questionResponses[0].photos[0]).toBe('[photo]');
    expect(d.payload.questionResponses[0].photos[1]).toBe('https://x/y.png');
    W._draftDelete('checklist', 'clDr', '2026-07-12');
    expect(W._draftFor('checklist', 'clDr', '2026-07-12')).toBeFalsy();
  });
  it('OKR check-in modal offers Save draft and restores one', () => {
    W.DB.okrs = W.DB.okrs || [];
    W.DB.okrs.push({ id: 'okDr', title: 'Test OKR', metricType: 'number', targetValue: 10, ownerId: 'sa1', createdAt: new Date().toISOString() });
    W._draftSave('okr', 'okDr', null, { date: W.todayISO(), value: 7, comment: 'draft note', statusMark: null });
    W.App._okrCheckin('okDr');
    const m = document.getElementById('modal');
    expect(m.innerHTML).toContain('Save draft');
    expect(m.innerHTML).toContain('Draft restored');
    expect(m.innerHTML).toContain('draft note');
    W.App.closeModal();
    W._draftDelete('okr', 'okDr', null);
    W.DB.okrs = W.DB.okrs.filter(o => o.id !== 'okDr');
  });
});

describe('r2 #5 - hierarchy profile popup', () => {
  it('shows directory info, never salary/assets/bank', () => {
    W._ensureHrm(emp);
    emp.hrm.joiningDate = '2024-03-01'; emp.hrm.dob = '1998-05-10';
    emp.hrm.salary = { basic: 9999, allow: 500, currency: 'AED' }; emp.hrm.iban = 'AE070331234567890123456';
    emp.hrm.assets = [{ id: 'aZ', name: 'SecretLaptop', status: 'Assigned' }];
    W.App._orgProfile('emp1');
    const m = document.getElementById('modal');
    expect(m).toBeTruthy();
    const html = m.innerHTML;
    expect(html).toContain('Birthday');
    expect(html).toContain('With the company');
    expect(html.includes('9999')).toBe(false);
    expect(html.includes('AE070331234567890123456')).toBe(false);
    expect(html.includes('SecretLaptop')).toBe(false);
    W.App.closeModal();
    emp.hrm.assets = [];
  });
  it('org chart collapses deep levels by default', () => {
    // sa1 ← mgrX ← subX : depth-1 manager (mgrX) must start collapsed (its report hidden)
    const mgrX = W.__mkUser({ id: 'mgrX', managerId: 'sa1' });
    const subX = W.__mkUser({ id: 'subX', managerId: 'mgrX', firstName: 'Deep', lastName: 'Report' });
    W.DB.users.push(mgrX, subX); [mgrX, subX].forEach(u => W._ensureHrm(u));
    const html = W._orgNode(W.uById('sa1'), new Set(), 0);
    expect(html).toContain('node-mgrX');       // direct report of root visible
    expect(html.includes('node-subX')).toBe(false); // depth-2 hidden until expanded
    W.DB.users = W.DB.users.filter(u => u.id !== 'mgrX' && u.id !== 'subX');
  });
});

/* ── Round 3 changes ── */
describe('r3 #1 - midnight auto clock-out', () => {
  it('closes a forgotten clock-out with the Didn’t-clock-out label', () => {
    expect(W.ATT_LABEL.AutoClosed).toContain('clock out');
    W.S.uid = 'emp1';
    const y = W._isoAdd(W.todayISO(), -1);
    const rec = { id: 'att_emp1_' + y, userId: 'emp1', date: y, clockIn: y + 'T09:00:00', clockOut: null, inMin: 540, outMin: null, hours: null, status: 'Present', flags: [], createdAt: new Date().toISOString() };
    W.DB.attendance.push(rec);
    W._runAutoClose();
    expect(rec.clockOut).toBeTruthy();
    expect(rec.status).toBe('AutoClosed');
    expect(rec.flags).toContain('forgot-clockout');
    expect(W.FLAG_LABEL['forgot-clockout']).toContain('clock out');
    W.DB.attendance = W.DB.attendance.filter(a => a.id !== rec.id);
    W.S.uid = 'sa1';
  });
});

describe('r3 #2 - dashboard drill-downs + chart datasets', () => {
  it('stat-card drill opens a detail modal with people', () => {
    W.App._dashDrill('activeusers');
    const m = document.getElementById('modal');
    expect(m).toBeTruthy();
    expect(m.innerHTML).toContain('Active people');
    expect(m.innerHTML).toContain('Open Users');
    W.App.closeModal();
  });
  it('company analytics builds the weekday dataset', () => {
    W.S.route = 'analytics'; W.S.filters = {}; W.pageContent();
    expect(W._AData && W._AData.weekday && W._AData.weekday.labels.length).toBe(7);
  });
  it('HRM analytics builds trend + leave-mix datasets', () => {
    W.S.route = 'hrmanalytics'; W.S.filters = {}; W.pageContent();
    expect(W._HRMData && Array.isArray(W._HRMData.trend.labels)).toBe(true);
    expect(W._HRMData && Array.isArray(W._HRMData.leaveMix.labels)).toBe(true);
  });
});

/* ── Round 4: OKR rework ── */
describe('r4 - OKR independent levels + popups + permissions', () => {
  let L0, L1;
  beforeAll(() => {
    L0 = { id: 'r4L0', parentId: null, title: 'Grow revenue', ownerId: 'sa1', departmentId: null, metricType: 'number', startValue: 0, targetValue: 100, unit: 'k', direction: 'up', frequency: {}, periodStart: '2026-07-01', periodEnd: '2026-07-31', createdBy: 'sa1', createdAt: '2026-07-01T00:00:00Z' };
    L1 = { id: 'r4L1', parentId: 'r4L0', title: 'Close deals', ownerId: 'emp1', metricType: 'number', startValue: 0, targetValue: 10, frequency: {}, createdBy: 'sa1', createdAt: '2026-07-01T00:00:00Z' };
    W.DB.okrs.push(L0, L1);
    W.DB.okrCheckins.push({ id: 'r4c1', okrId: 'r4L1', userId: 'emp1', value: 5, date: '2026-07-05', createdAt: '2026-07-05T00:00:00Z' });
  });
  it('L1 progress does not roll up to L0', () => {
    expect(W.okrProgress(W.okrById('r4L1'))).toBe(50);
    expect(W.okrProgress(W.okrById('r4L0'))).toBe(null);
  });
  it('card shows Current → Target on the level page', () => {
    W.S.route = 'okr'; W.S.filters = {};
    const html = W.pageContent();
    expect(html).toContain('Current → Target');
    expect(html).toContain('Rules & Target');
    expect(html).toContain('Logs');
  });
  it('Progress popup shows Start/Current/Target + Progress chip + chart canvas', () => {
    W.App._okrPop('r4L1', 'progress');
    const m = document.getElementById('modal');
    expect(m.innerHTML).toContain('Start');
    expect(m.innerHTML).toContain('Target');
    expect(m.innerHTML).toContain('Progress 50%');
    expect(m.innerHTML).toContain('data-okr-chart="r4L1"');
    expect(m.innerHTML).toContain('Actual vs ideal');
    W.App.closeModal();
  });
  it('Rules popup opens with measurement rules', () => {
    W.App._okrPop('r4L0', 'rules');
    const m = document.getElementById('modal');
    expect(m.innerHTML).toContain('Measured as');
    expect(m.innerHTML).toContain('levels are independent');
    W.App.closeModal();
  });
  it('Logs popup is per-level and OKR entries no longer reach the Audit page', () => {
    W.okrLog('r4L1', 'Check-in', { date: '2026-07-05', value: 5 });
    W.App._okrPop('r4L1', 'logs');
    const m = document.getElementById('modal');
    expect(m.innerHTML).toContain('this level only');
    expect(m.innerHTML).toContain('Check-in');
    W.App.closeModal();
    W.S.route = 'audit'; W.S.filters = {};
    expect(W.pageContent().includes('(OKR)')).toBe(false);
  });
  it('input edit/delete rights: owner + upper-level owner + permission', () => {
    const l1 = W.okrById('r4L1');
    W.S.uid = 'emp1';  expect(W._okrCanEditEntry(l1)).toBe(true);  // level owner
    W.S.uid = 'sa1';   expect(W._okrCanEditEntry(l1)).toBe(true);  // owns L0 above it
    const emp2 = W.__mkUser({ id: 'emp2' }); W.DB.users.push(emp2); W._ensureHrm(emp2); W._permsV3Migrate();
    W.S.uid = 'emp2';  expect(W.okrIsUpOwner(l1)).toBe(false);     // unrelated: no relationship right
    W.S.uid = 'sa1';
    W.DB.users = W.DB.users.filter(u => u.id !== 'emp2');
  });
  it('deleting an input removes it and writes a log entry', () => {
    W.S.uid = 'emp1';
    const before = W.DB.okrCheckins.filter(c => c.okrId === 'r4L1').length;
    const logsBefore = (W.DB.okrLogs || []).filter(l => l.okrId === 'r4L1').length;
    global.confirm = () => true;
    W.App._okrCkDelete('r4L1', 'r4c1');
    expect(W.DB.okrCheckins.filter(c => c.okrId === 'r4L1').length).toBe(before - 1);
    expect((W.DB.okrLogs || []).filter(l => l.okrId === 'r4L1').length).toBe(logsBefore + 1);
    W.App.closeModal(); W.S.uid = 'sa1';
  });
  it('new OKR permission actions exist in the permission matrix', () => {
    const area = W.PERM_AREAS ? W.PERM_AREAS.find(a => a.key === 'okr') : null;
    if (area) { expect(area.actions).toContain('editEntries'); expect(area.actions).toContain('deleteLogs'); expect(area.actions).toContain('changeOwner'); }
    expect(W.DB.roleProfiles.superadmin.perms.okr.actions.editEntries).toBe(true);
  });
});
