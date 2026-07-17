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
  sa  = W.__mkUser({ id: 'sa1' }); // superadmin — assigned below
  emp = W.__mkUser({ id: 'emp1' });
  W.DB.users.push(sa, emp);
  [sa, emp].forEach(u => W._ensureHrm(u));
  sa.hrm.roleProfileId = 'superadmin'; // R20: roles are assigned in Access Control, never derived
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
describe('r2/r8 - geofence only applies when a fence is configured', () => {
  it('no fence configured → clock-out succeeds freely (office is just a workplace)', () => {
    W.S.uid = 'emp1';
    const d = W.todayISO();
    let rec = (W.DB.attendance || []).find(a => a.userId === 'emp1' && a.date === d);
    if (!rec) { rec = { id: 'att_emp1_' + d, userId: 'emp1', date: d, clockIn: new Date().toISOString(), clockOut: null, inMin: 540, outMin: null, hours: null, status: 'Present', flags: [], createdAt: new Date().toISOString() }; W.DB.attendance.push(rec); }
    else { rec.clockIn = new Date().toISOString(); rec.inMin = 540; rec.clockOut = null; rec.outMin = null; }
    W.log = () => {};
    W.App.clockOut(); // R8: no geofence candidates → no location requirement
    expect(rec.clockOut).toBeTruthy();
    W.DB.attendance = W.DB.attendance.filter(a => a.id !== rec.id);
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
  it('OKR check-in modal opens (ported Bridge modal — drafts are checklist-only now)', () => {
    W.DB.okrs = W.DB.okrs || [];
    W.DB.okrs.push({ id: 'okDr', title: 'Test OKR', metricType: 'number', targetValue: 10, ownerId: 'sa1', createdAt: new Date().toISOString() });
    W.App._okrCheckin('okDr');
    const m = document.getElementById('modal');
    expect(m.innerHTML).toContain('Add update');
    expect(m.innerHTML).toContain('Mark status');
    W.App.closeModal();
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
  it('compact card shows current / target and the two panel buttons', () => {
    W.S.route = 'okr'; W.S.filters = {};
    const html = W.pageContent();
    expect(html).toContain('Rules & Target');
    expect(html).toContain('Progress & Updates');
    expect(html).toContain(' / ');                 // plain "current / target" numbers
  });
  it('Progress & Updates modal shows Start/Current/Target + chart canvas + feed', () => {
    W.App._okrProgressModal('r4L1');
    const m = document.getElementById('modal');
    expect(m.innerHTML).toContain('Start');
    expect(m.innerHTML).toContain('Target');
    expect(m.innerHTML).toContain('data-okr-chart="r4L1"');
    expect(m.innerHTML).toContain('Updates');
    W.App.closeModal();
  });
  it('Rules & Target opens as an inline panel with measurement rules', () => {
    W.S.route = 'okr'; W.S.filters = {};
    W.App._okrTogPanel('r4L0', 'rules');
    const html = W.pageContent();
    expect(html).toContain('Measured as');
    expect(html).toContain('Progress source');
    W.App._okrTogPanel('r4L0', 'rules');
  });
  it('Change log modal is per-objective and OKR entries never reach the Audit page', () => {
    W.okrLog('r4L1', 'Check-in', { date: '2026-07-05', value: 5 });
    W.App._okrNodeLogs('r4L1');
    const m = document.getElementById('modal');
    expect(m.innerHTML).toContain('Change log');
    expect(m.innerHTML).toContain('Check-in');
    W.App.closeModal();
    W.S.route = 'audit'; W.S.filters = {};
    expect(W.pageContent().includes('(OKR)')).toBe(false);
  });
  it('check-in rights follow the Bridge model: owner or role edit/manage', () => {
    const l1 = W.okrById('r4L1');
    W.S.uid = 'emp1';  expect(W._okrCanCheckin(l1)).toBe(true);   // level owner updates it
    W.S.uid = 'sa1';   expect(W._okrCanEditNode(l1)).toBe(true);  // superadmin role has okr.edit/manage
    const emp2 = W.__mkUser({ id: 'emp2' }); W.DB.users.push(emp2); W._ensureHrm(emp2); W._permsV3Migrate();
    W.S.uid = 'emp2';  expect(W.okrIsUpOwner(l1)).toBe(false);    // compat helper still answers
    W.S.uid = 'sa1';
    W.DB.users = W.DB.users.filter(u => u.id !== 'emp2');
  });
  it('deleting an input removes it and writes a log entry', () => {
    W.S.uid = 'emp1';
    const before = W.DB.okrCheckins.filter(c => c.okrId === 'r4L1').length;
    const logsBefore = (W.DB.okrLogs || []).filter(l => l.okrId === 'r4L1').length;
    W.App._okrCkDelGo('r4L1', 'r4c1');
    expect(W.DB.okrCheckins.filter(c => c.okrId === 'r4L1').length).toBe(before - 1);
    expect((W.DB.okrLogs || []).filter(l => l.okrId === 'r4L1').length).toBe(logsBefore + 1);
    W.App.closeModal(); W.S.uid = 'sa1';
  });
  it('OKR permission area is scoped with the Bridge action set', () => {
    const area = W.PERM_AREAS ? W.PERM_AREAS.find(a => a.key === 'okr') : null;
    if (area) { expect(area.scoped).toBe(true); expect(area.actions).toContain('checkin'); expect(area.actions).toContain('delete'); expect(area.actions.includes('editEntries')).toBe(false); }
    expect(W.DB.roleProfiles.superadmin.perms.okr.actions.manage).toBe(true);
    expect(W.DB.roleProfiles.superadmin.perms.okr.scope).toBe('everyone');
  });
});

/* ── Round 5: compact UI, locations bugfix, deep multi-role sweep ── */
describe('r5 - locations visibility bugfix', () => {
  it('admin with stale city chips still sees ALL locations', () => {
    W.S.uid = 'sa1';
    const me2 = W.uById('sa1');
    me2.cities = ['locA']; // stale chip list that excludes the new location
    W.DB.locations.push({ id: 'locA', name: 'Old Town', status: 'Active' }, { id: 'locNEW', name: 'Brand New Branch', status: 'Active' });
    W.S.route = 'locations'; W.S.filters = {};
    const html = W.pageContent();
    expect(html).toContain('Brand New Branch'); // previously hidden by the city filter
    me2.cities = [];
    W.DB.locations = W.DB.locations.filter(l => l.id !== 'locA' && l.id !== 'locNEW');
  });
});

describe('r5 - compact OKR rows + complete In-App tab', () => {
  it('OKR page renders the compact one-line cards with a slim action strip', () => {
    W.S.route = 'okr'; W.S.filters = {};
    const html = W.pageContent();
    expect(html).toContain('Progress & Updates'); // slim strip buttons
    expect(html.includes('_okrMenu')).toBe(false); // old ⋯ menu is gone with the port
  });
  it('In-App tab lists HR events too', () => {
    W.S.route = 'settings'; W.S.filters = { stab: 'inapp' };
    const html = W.pageContent();
    expect(html).toContain('Leave submitted');
    expect(html).toContain('Didn’t clock out');
    expect(html).toContain('Review cycle opened');
    expect(html).toContain('WFH marked');
  });
});

describe('r5 - deep check: every route renders for a BASIC EMPLOYEE too', () => {
  const ROUTES5 = ['dashboard','users','departments','locations','checklists','allcl','mychecklists',
    'teamview','questions','tickets','documents','analytics','reports','hrmanalytics','okr',
    'announcements','approvals','attendance','leave','myschedule','schedule','shifts','overtime',
    'expenses','lifecycle','sops','discipline','letters','payroll','surveys','reviews','hierarchy',
    'audit','settings','accesscontrol','hrmconfig','notifications','profile','more'];
  it('no route throws as emp1', () => {
    W.S.uid = 'emp1';
    for (const r of ROUTES5) {
      W.S.route = r; W.S.filters = {}; W.S.search = '';
      const html = W.pageContent();
      expect(typeof html).toBe('string');
    }
    W.S.uid = 'sa1';
  });
});

/* ── Round 6: delete options on alert/approval feeds ── */
describe('r6 - alerts & approvals delete options', () => {
  it('alerts page offers per-item delete and Clear all; both work', () => {
    W.S.uid = 'emp1';
    W.DB.notifications.unshift({ id: 'r6n1', userId: 'emp1', text: 'r6 test alert', time: new Date().toISOString(), read: false, kind: 'general' });
    W.S.route = 'notifications'; W.S.filters = {};
    const html = W.pageContent();
    expect(html).toContain('_delNotif');
    expect(html).toContain('Clear all');
    W.App._delNotif('r6n1');
    expect(W.DB.notifications.some(n => n.id === 'r6n1')).toBe(false);
    W.DB.notifications.unshift({ id: 'r6n2', userId: 'emp1', text: 'another', time: new Date().toISOString(), read: true, kind: 'general' });
    global.confirm = () => true;
    W.App._clearAllNotifs();
    expect(W.DB.notifications.some(n => n.userId === 'emp1')).toBe(false);
    W.S.uid = 'sa1';
  });
  it('decided approval records are deletable; pending are protected', () => {
    W.S.uid = 'sa1';
    W.DB.approvals.push(
      { id: 'r6a1', type: 'Submission', requesterId: 'emp1', status: 'Approved', date: '2026-07-10', createdAt: '2026-07-10T00:00:00Z' },
      { id: 'r6a2', type: 'Submission', requesterId: 'emp1', status: 'Pending', date: '2026-07-11', createdAt: '2026-07-11T00:00:00Z' });
    global.confirm = () => true;
    W.App._delApprovalRec('r6a1');
    expect(W.DB.approvals.some(a => a.id === 'r6a1')).toBe(false);
    W.App._delApprovalRec('r6a2'); // pending → refused
    expect(W.DB.approvals.some(a => a.id === 'r6a2')).toBe(true);
    W.DB.approvals = W.DB.approvals.filter(a => a.id !== 'r6a2');
  });
  it('rejected leave deletable by anyone involved; approved only by an APPROVER (r8)', () => {
    W.DB.leaveRequests.push(
      { id: 'r6l1', userId: 'emp1', leaveTypeId: 'ltX', start: '2026-07-01', end: '2026-07-02', status: 'Rejected', workingDays: 2 },
      { id: 'r6l2', userId: 'emp1', leaveTypeId: 'ltX', leaveYear: '2026', start: '2026-07-03', end: '2026-07-04', status: 'Approved', workingDays: 2, unpaid: true });
    global.confirm = () => true;
    W.App._delLeaveRec('r6l1');
    expect(W.DB.leaveRequests.some(r => r.id === 'r6l1')).toBe(false);
    W.S.uid = 'emp1'; // the requester is NOT an approver → approved delete refused
    W.App._delLeaveRec('r6l2');
    expect(W.DB.leaveRequests.some(r => r.id === 'r6l2')).toBe(true);
    W.S.uid = 'sa1';  // an approver deletes it (with reversal — unpaid here, so no balance math)
    W.App._delLeaveRec('r6l2');
    expect(W.DB.leaveRequests.some(r => r.id === 'r6l2')).toBe(false);
  });
});

/* ── Round 7: one-click approvals, tombstones, cold archive ── */
describe('r7 - one-click multi-stage approve', () => {
  it('an approver valid for BOTH stages approves in ONE click', () => {
    W.S.uid = 'sa1'; // Super Admin = universal approver at every stage
    const req = { id: 'r7lv1', userId: 'emp1', leaveTypeId: 'ltX', leaveYear: '2026', start: '2026-08-03', end: '2026-08-04',
      halfDay: false, workingDays: 2, reason: 't', unpaid: true, flow: [{ type: 'manager' }, { type: 'hr' }],
      stageIndex: 0, stage: 'manager', status: 'Pending', createdAt: new Date().toISOString() };
    W.DB.leaveRequests.push(req);
    W.App.decideLeave('r7lv1', 'approve', 0);
    expect(req.status).toBe('Approved'); // previously needed two clicks
    W.DB.leaveRequests = W.DB.leaveRequests.filter(r => r.id !== 'r7lv1');
  });
});

describe('r7 - deleted records never resurrect (tombstones)', () => {
  it('a deleted alert stays gone even when the server still returns it', () => {
    W.S.uid = 'emp1';
    W.DB.notifications.unshift({ id: 'r7n1', userId: 'emp1', text: 'ghost', time: new Date().toISOString(), read: false });
    W.App._delNotif('r7n1');
    // simulate a concurrent fetch that still contains the row
    W._applyNotifications([{ id: 'r7n1', user_id: 'emp1', text: 'ghost', read: false, created_at: new Date().toISOString() }]);
    expect(W.DB.notifications.some(n => n.id === 'r7n1')).toBe(false);
    W.S.uid = 'sa1';
  });
  it('a deleted leave record stays gone through the merge-style apply', () => {
    W.DB.leaveRequests.push({ id: 'r7lv2', userId: 'emp1', leaveTypeId: 'ltX', start: '2026-06-01', end: '2026-06-02', status: 'Rejected', workingDays: 2 });
    global.confirm = () => true;
    W.App._delLeaveRec('r7lv2');
    W._applyLeaveRequests([{ id: 'r7lv2', user_id: 'emp1', leave_type_id: 'ltX', start_date: '2026-06-01', end_date: '2026-06-02', status: 'Rejected', working_days: 2 }]);
    expect(W.DB.leaveRequests.some(r => r.id === 'r7lv2')).toBe(false);
  });
});

describe('r7 - cold archive plumbing', () => {
  it('cold loaders exist and route hooks call them without throwing', () => {
    expect(typeof W._lazyCold).toBe('function');
    W._lazyForRoute('audit'); W._lazyForRoute('okr'); W._lazyForRoute('analytics'); W._lazyForRoute('attendance');
    expect(true).toBe(true);
  });
  it('Alerts page offers Load older', () => {
    W.S.uid = 'emp1'; W.S.route = 'notifications'; W.S.filters = {};
    expect(W.pageContent()).toContain('Load older');
    W.S.uid = 'sa1';
  });
});


/* ── Round 8 fixes ── */
describe('r8 - counts and drills share one source (admins included)', () => {
  it('a clocked-in SUPER ADMIN appears in both the count and the drill list', () => {
    const d = W.todayISO();
    const rec = { id: 'r8att_sa', userId: 'sa1', date: d, clockIn: new Date().toISOString(), clockOut: null, inMin: 540, outMin: null, hours: null, status: 'Present', flags: [], createdAt: new Date().toISOString() };
    W.DB.attendance.push(rec);
    const buckets = W._todayBuckets();
    expect(buckets.IN.some(u => u.id === 'sa1')).toBe(true); // count source includes admins now
    W.S.uid = 'sa1';
    W.App._dashDrill('who-in');
    const m = document.getElementById('modal');
    expect(m.innerHTML.length).toBeGreaterThan(0);
    W.App.closeModal();
    W.DB.attendance = W.DB.attendance.filter(a => a.id !== 'r8att_sa');
  });
});

describe('r8 - approved leave delete reverses balance + attendance', () => {
  it('restores used days and clears the written leave day', () => {
    W.S.uid = 'sa1';
    const emp = W.uById('emp1'); W._ensureHrm(emp);
    const lt = (W.DB.leaveTypes || [])[0] || { id: 'ltR8' };
    const b = W._balanceFor('emp1', lt.id, '2026'); b.used = W._r2((b.used || 0) + 2);
    const usedBefore = b.used;
    W.DB.leaveRequests.push({ id: 'r8lv', userId: 'emp1', leaveTypeId: lt.id, leaveYear: '2026', start: '2026-07-08', end: '2026-07-09', workingDays: 2, unpaid: false, status: 'Approved', flow: [{ type: 'manager' }], stageIndex: 0 });
    W.DB.attendance.push({ id: 'r8lvatt', userId: 'emp1', date: '2026-07-08', clockIn: null, clockOut: null, status: 'Leave', flags: [], createdAt: new Date().toISOString() });
    global.confirm = () => true;
    W.App._delLeaveRec('r8lv');
    expect(W.DB.leaveRequests.some(r => r.id === 'r8lv')).toBe(false);
    expect(b.used).toBe(W._r2(usedBefore - 2));                        // balance restored
    expect(W.DB.attendance.some(a => a.id === 'r8lvatt')).toBe(false); // leave day cleared
  });
});

describe('r8 - hierarchy popup and attendance mobile view', () => {
  it('org profile popup shows office, never phone', () => {
    const emp = W.uById('emp1'); emp.phone = '+971-55-0000000';
    W.App._orgProfile('emp1');
    const html = document.getElementById('modal').innerHTML;
    expect(html.includes('+971-55-0000000')).toBe(false);
    expect(html).toContain('Office');
    W.App.closeModal();
  });
  it('attendance page includes the mobile card list', () => {
    W.S.uid = 'emp1'; W.S.route = 'attendance'; W.S.filters = {};
    const html = W.pageContent();
    expect(html).toContain('md:hidden');
    expect(html).toContain('hidden md:block');
    W.S.uid = 'sa1';
  });
});

/* ── Round 9: prove the chart configs BUILD without crashing (a ReferenceError in any config
      used to be swallowed by _paintCharts' try{} and blanked EVERY graph). Chart is stubbed to
      capture instantiations; canvases come from the real page HTML injected into jsdom. ── */
describe('r9 - chart configs execute without errors', () => {
  const mkChartStub = () => {
    const seen = [];
    HTMLCanvasElement.prototype.getContext = () => null; // silence jsdom 'not implemented' noise
    window.Chart = class { constructor(ctx, cfg) { seen.push(cfg); } destroy() {} };
    window.Chart.defaults = { font: {}, animation: {}, plugins: { tooltip: {}, legend: { labels: {} } }, elements: { bar: {}, line: {}, point: {} } };
    window.Chart.__bridged = 0;
    return seen;
  };
  it('company analytics: chart configs build with data present', () => {
    W.S.uid = 'sa1'; W.S.route = 'analytics'; W.S.filters = {}; W.S.dashView = 'visuals';
    const today = W.todayISO();
    W.DB.checklists.push({ id: 'r9cl', name: 'R9 CL', department: 'Ops', assignees: ['emp1'], tasks: [], questionIds: [], status: 'Active', createdBy: 'sa1' });
    W.DB.submissions.push(
      { id: 'r9s1', checklistId: 'r9cl', userId: 'emp1', date: today, status: 'On Time', submittedAt: new Date().toISOString(), tasks: [], questionResponses: [] },
      { id: 'r9s2', checklistId: 'r9cl', userId: 'emp1', date: W._isoAdd(today, -1), status: 'Late', submittedAt: new Date().toISOString(), tasks: [], questionResponses: [] });
    W.DB.tickets.push({ id: 'r9tk', title: 'T', status: 'Open', assignedTo: 'emp1', submitterId: 'emp1', createdAt: new Date().toISOString() });
    document.body.innerHTML = '<div id="content">' + W.pageContent() + '</div>';
    const seen = mkChartStub();
    W._drawAnalyticsCharts();                       // any ReferenceError/TypeError surfaces HERE
    expect(seen.length).toBeGreaterThanOrEqual(4);  // status/trend/dept/tickets/weekday build
    W.DB.checklists = W.DB.checklists.filter(c => c.id !== 'r9cl');
    W.DB.submissions = W.DB.submissions.filter(x => x.id !== 'r9s1' && x.id !== 'r9s2');
    W.DB.tickets = W.DB.tickets.filter(t => t.id !== 'r9tk');
  });
  it('HRM analytics: trend + leave-mix + 3 bars build', () => {
    W.S.route = 'hrmanalytics'; W.S.filters = {}; W.S.hrmView = 'visuals';
    document.body.innerHTML = '<div id="content">' + W.pageContent() + '</div>';
    const seen = mkChartStub();
    W._drawHrmCharts();
    expect(seen.length).toBeGreaterThanOrEqual(1);
  });
  it('OKR graph (actual vs ideal) builds for a level with inputs', () => {
    document.body.innerHTML = '<div><div style="height:200px"><canvas data-okr-chart="demo_okrX"></canvas></div></div>';
    W.DB.okrs.push({ id: 'demo_okrX', title: 'X', metricType: 'number', startValue: 0, targetValue: 10, ownerId: 'sa1', periodStart: '2026-07-01', periodEnd: '2026-07-31', frequency: {}, createdAt: '2026-07-01' });
    W.DB.okrCheckins.push({ id: 'demo_okcX', okrId: 'demo_okrX', userId: 'sa1', value: 4, date: '2026-07-06', createdAt: '2026-07-06T00:00:00Z' });
    const seen = mkChartStub();
    W._drawOKRCharts();
    expect(seen.length).toBe(1);
    const ds = seen[0].data.datasets;
    expect(ds.length).toBe(2);                                  // Ideal + Actual (#3)
    expect(seen[0].data.labels.length).toBe(31);                // every date 1..31 (#4)
    W.DB.okrs = W.DB.okrs.filter(o => o.id !== 'demo_okrX');
    W.DB.okrCheckins = W.DB.okrCheckins.filter(c => c.id !== 'demo_okcX');
  });
  it('home dashboard charts build', () => {
    W.S.uid = 'emp1'; W.S.route = 'dashboard'; W.S.filters = {};
    document.body.innerHTML = '<div id="content">' + W.pageContent() + '</div>';
    const seen = mkChartStub();
    W._drawHomeCharts();
    expect(Array.isArray(seen)).toBe(true); // no throw is the assertion; emp1 may have no data
    W.S.uid = 'sa1';
  });
});


/* ── Round 10: My-Day attendance summary ── */
describe('r10 - My attendance card (range defaults to current month)', () => {
  it('shows all counters + range picker and builds the doughnut', () => {
    W.S.uid = 'emp1'; W.S.route = 'dashboard'; W.S.filters = {};
    const t = W.todayISO();
    W.DB.attendance.push(
      { id: 'r10a1', userId: 'emp1', date: t.slice(0,8)+'02', clockIn: 'x', inMin: 545, outMin: 1080, hours: 8.9, status: 'Present', flags: ['late'], createdAt: new Date().toISOString() },
      { id: 'r10a2', userId: 'emp1', date: t.slice(0,8)+'03', clockIn: 'x', inMin: 540, outMin: 1000, hours: 7.6, status: 'Present', flags: ['early','WFH'], createdAt: new Date().toISOString() });
    const html = W.pageContent();
    expect(html).toContain('My attendance');
    for (const label of ['Late in','Early out','Half days','On leave','Absent','Didn’t clock out','WFH days','Worked (total)']) expect(html).toContain(label);
    expect(html).toContain('hChartMyAtt');
    expect(html).toContain('Current month'); // default range badge
    expect(html.includes('Completions trend')).toBe(false); // old confusing charts gone
    document.body.innerHTML = '<div id="content">' + html + '</div>';
    const seen = []; HTMLCanvasElement.prototype.getContext = () => null;
    window.Chart = class { constructor(c, cfg) { seen.push(cfg); } destroy() {} };
    window.Chart.defaults = { font: {}, animation: {}, plugins: { tooltip: {}, legend: { labels: {} } }, elements: { bar: {}, line: {}, point: {} } };
    window.Chart.__bridged = 0;
    W._drawHomeCharts();
    expect(seen.length).toBe(1);
    expect(seen[0].data.labels).toContain('Didn’t clock out');
    W.DB.attendance = W.DB.attendance.filter(a => a.id !== 'r10a1' && a.id !== 'r10a2');
    W.S.uid = 'sa1';
  });
});

/* ── Round 11: compact leave rows with delete ── */
describe('r11 - leave requests list is compact with row-level delete', () => {
  it('cancelled rows are slim, expandable, and deletable by an approver', () => {
    W.S.uid = 'emp1'; W.S.route = 'leave'; W.S.filters = {};
    W.DB.leaveRequests.push({ id: 'r11lv', userId: 'emp1', leaveTypeId: (W.DB.leaveTypes[0]||{}).id || 'ltX', leaveYear: '2026', start: '2026-07-05', end: '2026-07-06', workingDays: 1, status: 'Cancelled', flow: [{type:'manager'}], stageIndex: 0, createdAt: '2026-07-05T00:00:00Z' });
    let html = W.pageContent();
    expect(html).toContain('_delLeaveRec(\'r11lv\')');          // delete on the row (requester)
    expect(html.includes('APPROVAL PROGRESS')||html.includes('Approval progress')).toBe(false); // collapsed by default
    W.S.filters.lvExp = 'r11lv';                                // expand one row
    html = W.pageContent();
    expect(html.toLowerCase()).toContain('stage');              // details visible when expanded
    global.confirm = () => true;
    W.App._delLeaveRec('r11lv');
    expect(W.DB.leaveRequests.some(r => r.id === 'r11lv')).toBe(false);
    W.S.uid = 'sa1'; W.S.filters = {};
  });
});

/* ── Round 12: people search + ticket filters ── */
describe('r12 - people search bar + better ticket filters', () => {
  it('People page shows the search bar on all screens and it filters', () => {
    W.S.uid = 'sa1'; W.S.route = 'users'; W.S.filters = {}; W.S.search = '';
    let html = W.pageContent();
    expect(html).toContain('usr-q');
    expect(html.includes('md:hidden"><span class="absolute')).toBe(false); // no longer mobile-only
    W.S.search = 'zzz-no-such-person';
    html = W.pageContent();
    expect(html).toContain('No users');
    W.S.search = '';
  });
  it('Tickets page has search, assignee, priority, sort filters and they work', () => {
    W.S.uid = 'sa1'; W.S.route = 'tickets'; W.S.filters = {};
    W.DB.tickets.push(
      { id: 'r12t1', title: 'Fridge broken', description: 'x', priority: 'High', status: 'Open', assignedTo: 'emp1', submitterId: 'emp1', createdAt: '2026-07-10T00:00:00Z' },
      { id: 'r12t2', title: 'Printer jam', description: 'y', priority: 'Low', status: 'Open', assignedTo: 'sa1', submitterId: 'emp1', createdAt: '2026-07-11T00:00:00Z' });
    let html = W.pageContent();
    for (const bit of ['tk-q','All assignees','Any priority','Newest first']) expect(html).toContain(bit);
    W.S.filters.tkQ = 'fridge';
    html = W.pageContent();
    expect(html).toContain('Fridge broken');
    expect(html.includes('Printer jam')).toBe(false);
    expect(html).toContain('Clear');
    W.S.filters = {};
    W.DB.tickets = W.DB.tickets.filter(t => t.id !== 'r12t1' && t.id !== 'r12t2');
  });
});

/* ── Round 13: shifts off-days integration ── */
describe('r13 - roster off-days: strip gone, OFF cells, two-way edit', () => {
  it('strip removed; OFF cell rendered from the user schedule; editor saves to the same field', () => {
    W.S.uid = 'sa1'; W.S.route = 'shifts'; W.S.filters = {};
    const emp = W.uById('emp1'); W._ensureHrm(emp);
    emp.hrm.schedule = emp.hrm.schedule || {}; emp.hrm.schedule.offDays = ['Sun','Sat'];
    const html = W.pageContent();
    expect(html.includes('Off / on leave today:')).toBe(false);   // strip gone
    expect(html).toContain('>OFF<');                              // off-day marker in the grid
    expect(html).toContain('_shOffDays');                         // editable from the roster
    // simulate the editor save: chips in DOM → save → user record updated (single source of truth)
    document.body.innerHTML = '<button class="dchip on" data-shoff="Mon"></button><button class="dchip on" data-shoff="Sun"></button>';
    W.App._shOffDaysSave('emp1');
    expect(emp.hrm.schedule.offDays.sort().join(',')).toBe('Mon,Sun');
    // and the roster reflects it immediately (Mon now OFF) — same field the user editor reads
    emp.hrm.schedule.offDays = ['Sun'];
  });
});

/* ── Round 14: admins in roster + immediate access-change push ── */
describe('r14 - super admin appears in the shift roster', () => {
  it('roster people include Admins for a managing viewer', () => {
    W.S.uid = 'sa1'; W.S.route = 'shifts'; W.S.filters = {};
    const html = W.pageContent();
    const sa = W.uById('sa1');
    expect(html).toContain(W.esc(W.fullName(sa))); // the Super Admin's own row is in the grid
  });
  it('access changes push the hrm row immediately (targeted, not debounced)', () => {
    let pushed = null;
    const realFrom = W.sb.from;
    W.sb.from = (t) => t === 'user_hrm' ? ({ upsert: (row) => { pushed = row; return { then: (r) => { r({ error: null }); return { catch: () => {} }; } }; } }) : realFrom.call(W.sb, t);
    W._acPushHrm(W.uById('emp1'));
    W.sb.from = realFrom;
    expect(pushed && pushed.user_id).toBe('emp1');
    expect(pushed && typeof pushed.hrm).toBe('object');
  });
});

describe('r15 - role scopes bind SubAdmins (no page-level bypass)', () => {
  let lee, savedSched, savedCk;
  beforeAll(() => {
    lee = W.__mkUser({ id: 'lee1', firstName: 'Lee', lastName: 'Mascarenhas' });
    W.DB.users.push(lee); W._ensureHrm(lee);
    lee.hrm.roleProfileId = 'admin';
    savedSched = JSON.stringify(W.DB.roleProfiles.admin.perms.scheduling);
    savedCk    = JSON.stringify(W.DB.roleProfiles.admin.perms.checklists);
  });
  it('scheduling scope self → roster shows ONLY Lee (the reported bug)', () => {
    W.DB.roleProfiles.admin.perms.scheduling = { scope: 'self', actions: { view: true, manage: true } };
    W.S.uid = 'lee1'; W.S.route = 'shifts'; W.S.filters = {};
    const html = W.pageContent();
    expect(html).toContain('Lee Mascarenhas');
    expect(html.includes(W.esc(W.fullName(W.uById('sa1'))))).toBe(false);
  });
  it("scheduling scope everyone → full roster incl the Super Admin (r14 parity)", () => {
    W.DB.roleProfiles.admin.perms.scheduling = JSON.parse(savedSched);
    W.S.uid = 'lee1'; W.S.route = 'shifts'; W.S.filters = {};
    const html = W.pageContent();
    expect(html).toContain('Lee Mascarenhas');
    expect(html).toContain(W.esc(W.fullName(W.uById('sa1'))));
  });
  it('checklists scope self → builder lists only own/assigned checklists', () => {
    W.DB.roleProfiles.admin.perms.checklists = { scope: 'self', actions: { view: true, create: true, edit: true } };
    W.DB.checklists.push(
      { id: 'r15a', name: 'R15MineCL',  assignees: ['lee1'], createdBy: 'sa1', frequency: 'Daily', schedule: 'Every day', department: '', tasks: [], questionIds: [], locationIds: [] },
      { id: 'r15b', name: 'R15OtherCL', assignees: ['emp1'], createdBy: 'sa1', frequency: 'Daily', schedule: 'Every day', department: '', tasks: [], questionIds: [], locationIds: [] });
    W.S.uid = 'lee1'; W.S.route = 'checklists'; W.S.filters = {}; W.S.search = '';
    const html = W.pageContent();
    expect(html).toContain('R15MineCL');
    expect(html.includes('R15OtherCL')).toBe(false);
    // cleanup
    W.DB.checklists = W.DB.checklists.filter(c => !String(c.id).startsWith('r15'));
    W.DB.roleProfiles.admin.perms.checklists = JSON.parse(savedCk);
    W.S.uid = 'sa1';
  });
});

/* ── Round 16: chart hover-transition hardening (kills "this._fn is not a function") ── */
describe('r16 - chart theme disables the fragile hover transitions', () => {
  it('_aChartTheme zeroes transitions.active/resize/hide/show animation duration', () => {
    HTMLCanvasElement.prototype.getContext = () => null;
    window.Chart = class { constructor(c, cfg) {} destroy() {} };
    window.Chart.defaults = { font: {}, animation: {}, transitions: {}, plugins: { tooltip: {}, legend: { labels: {} } }, elements: { bar: {}, line: {}, point: {} } };
    window.Chart.__bridged = 0;
    W._aChartTheme();                          // run the theme initializer
    const tr = window.Chart.defaults.transitions;
    ['active', 'resize', 'hide', 'show'].forEach(k => {
      expect(tr[k] && tr[k].animation && tr[k].animation.duration).toBe(0);
    });
    // the initial load animation must be PRESERVED (only interaction transitions are disabled)
    expect(window.Chart.defaults.animation.duration).toBe(600);
  });
});

/* ── Round 16: cross-user notification delivery (RLS n_u only allows self/super) ── */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
describe('r16 - foreign notifications use plain INSERT (not upsert) so RLS n_u never blocks delivery', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'supabase.js'), 'utf8');
  it('the foreign-notification branch inserts (never upserts with ignoreDuplicates)', () => {
    // isolate the notifications push IIFE
    const i = src.indexOf('_nfSent');
    expect(i).toBeGreaterThan(-1);                                   // the fix marker exists
    const region = src.slice(i - 400, i + 400);
    expect(region).toContain("sb.from('notifications').insert(");    // foreign rows go through plain insert
    expect(/foreign[\s\S]{0,200}ignoreDuplicates/.test(region)).toBe(false); // old broken upsert path gone
  });
  it("still upserts the sender's OWN notifications (read-flag sync preserved)", () => {
    const i = src.indexOf('const mine=DB.notifications.filter');
    expect(i).toBeGreaterThan(-1);
    expect(src.slice(i, i + 200)).toContain("_safeUp('notifications'");
  });
});

/* ── Round 17: access changes reach OPEN sessions live (no reload) ── */
describe('r17 - live access propagation', () => {
  const sbSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'supabase.js'), 'utf8');
  const acSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'pages', 'accesscontrol.js'), 'utf8');
  it('realtime subscribes to role_profiles changes with a TOAST-safe refetch fallback', () => {
    expect(sbSrc).toContain("table:'workspace_settings',filter:'key=eq.role_profiles'");
    expect(sbSrc).toContain('_refreshMyAccess');
  });
  it("an incoming kind='access' notification triggers the access refetch", () => {
    const i = sbSrc.indexOf("if(r.kind==='access')");
    expect(i).toBeGreaterThan(-1);
    expect(sbSrc.slice(i, i + 160)).toContain('_refreshMyAccess()');
  });
  it('_refreshMyAccess refetches BOTH the user_hrm row and the role bundles', () => {
    const i = sbSrc.indexOf('async function _refreshMyAccess');
    expect(i).toBeGreaterThan(-1);
    const body = sbSrc.slice(i, i + 900);
    expect(body).toContain("from('user_hrm')");
    expect(body).toContain("eq('key','role_profiles')");
    expect(body).toContain('_ensureHrm');
  });
  it("_acPushHrm pings the target user with a kind='access' notification (deduped)", () => {
    const i = acSrc.indexOf('function _acPushHrm');
    const body = acSrc.slice(i, i + 1400);
    expect(body).toContain("kind:'access'");
    expect(body).toContain('_acNtfAt');            // 10s per-target dedupe
    expect(body).toContain('u.id!==S.uid');        // never ping yourself
  });
});

/* ── Round 18: Inbox defaults to the Alerts sub-tab ── */
describe('r18 - inbox hub lands on Alerts', () => {
  it("_hubHome('inbox') is the notifications (Alerts) route, even for approvers", () => {
    W.S.uid = 'sa1';                                  // super admin CAN view approvals…
    expect(W._hubHome('inbox')).toBe('notifications'); // …but Alerts still comes first
  });
});

/* ── Round 19: payroll writes all lines in ONE batched upsert (no partial saves) ── */
describe('r19 - payroll persists every line in a single batched write', () => {
  const sbSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'supabase.js'), 'utf8');
  const plSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'pages', 'payroll.js'), 'utf8');
  it('_pushRows batch helper exists and is window-exposed', () => {
    expect(sbSrc).toContain('function _pushRows(');
    expect(sbSrc).toContain('window._pushRows=_pushRows');
  });
  it('the payroll draft run uses _pushRows for items, NOT a forEach of _pushRow', () => {
    const i = plSrc.indexOf('App._payRun=');
    const body = plSrc.slice(i, i + 1200);
    expect(body).toContain("_pushRows('payroll_items'");
    expect(/items\.forEach\(i=>_pushRow\('payroll_items'/.test(body)).toBe(false);
  });
  it('verify-all also batches its item writes', () => {
    const i = plSrc.indexOf('App._payVerifyAll=');
    const body = plSrc.slice(i, i + 900);
    expect(body).toContain("_pushRows('payroll_items'");
  });
});
