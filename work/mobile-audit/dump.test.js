/* MOBILE AUDIT (R26) — not a test of behaviour: renders every route with a realistic seeded
   dataset and writes the HTML to work/mobile-audit/pages/ so the Playwright pass can measure
   real layout at phone width. Excluded from the normal suite (see vite.config test.exclude). */
import { describe, it, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const W = window;
const OUT = path.resolve('work/mobile-audit/pages');

const ROUTES = ['dashboard','users','departments','locations','checklists','allcl','mychecklists',
  'teamview','questions','tickets','documents','analytics','reports','hrmanalytics','okr',
  'announcements','approvals','attendance','leave','myschedule','schedule','shifts','overtime',
  'expenses','lifecycle','sops','discipline','letters','payroll','surveys','reviews','hierarchy',
  'audit','settings','accesscontrol','hrmconfig','notifications','profile','more'];

// Long-ish but plausible strings — the real cause of "text goes out of the box".
const FIRST = ['Kartiksingh','Abdulrahman','Mohammed','Priyadarshini','Christopher','Lee','Aisha','Venkatanarayanan','Fatima','Jean-Baptiste'];
const LAST  = ['Hushare','Al Maktoum','Bin Rashid','Balasubramanian','Papadopoulos','Chen','Al-Farsi','Krishnamurthy','Nakamura','Van Der Berg'];
const DEPTS = ['Operations','Facilities Management','Human Resources','Finance & Accounting'];
const POS   = ['Senior Facilities Maintenance Technician','Operations Manager','HR Business Partner','Accounts Payable Specialist'];

const iso = (d) => d.toISOString().slice(0, 10);
const shift = (days) => { const d = new Date('2026-07-25T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return iso(d); };

beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true });
  W.log = () => {};

  const sa = W.__mkUser({ id: 'sa1', firstName: 'Kartiksingh', lastName: 'Hushare',
    email: 'kartiksinghushare@gmail.com', phone: '+971 50 123 4567',
    department: 'Operations', position: 'Managing Director' });
  W.DB.users.push(sa);

  const people = [sa];
  for (let i = 0; i < 24; i++) {
    const u = W.__mkUser({
      id: 'u' + i,
      firstName: FIRST[i % FIRST.length],
      lastName: LAST[(i * 3) % LAST.length],
      email: (FIRST[i % FIRST.length] + '.' + LAST[(i * 3) % LAST.length]).toLowerCase().replace(/[^a-z.]/g, '') + '@evarcafacilities.ae',
      phone: '+971 5' + (i % 10) + ' ' + (100 + i) + ' ' + (4000 + i),
      department: DEPTS[i % DEPTS.length],
      position: POS[i % POS.length],
      managerId: i > 4 ? 'u' + (i % 4) : 'sa1',
    });
    W.DB.users.push(u); people.push(u);
  }
  people.forEach(u => W._ensureHrm(u));
  sa.hrm.roleProfileId = 'superadmin';
  W._seedRoleProfiles(); W._permsV3Migrate(); W._seedHRMPlan();
  W._ns = W._nsDefault();
  W.S.uid = 'sa1';

  DEPTS.forEach((name, i) => W.DB.departments.push({ id: 'd' + i, name, parentId: null }));
  ['Dubai Marina Tower — Facilities Office', 'Jebel Ali Industrial Site 3', 'Abu Dhabi Corniche Branch']
    .forEach((name, i) => W.DB.locations.push({ id: 'loc' + i, name, city: 'Dubai', lat: 25.07, lng: 55.13, radius: 200, geofenceEnabled: i === 0 }));

  people.forEach((u, i) => {
    u.hrm.locationId = 'loc' + (i % 3);
    u.hrm.joiningDate = '202' + (i % 5) + '-0' + ((i % 8) + 1) + '-15';
    u.hrm.salary = { basic: 6000 + i * 250, housing: 2000, transport: 800, other: 0 };
    u.hrm.molId = 'MOL' + (100000 + i);
    u.hrm.iban = 'AE07033123456789012345' + i;
  });

  W._seedProfiles();
  Object.keys(W.DB.hrmConfig.profiles || {}).forEach(W._seedLeaveTypes);

  // attendance: 90 days x everyone, mixed statuses/flags
  const STAT = ['Present', 'HalfDay', 'Absent', 'Leave', 'AutoClosed', 'OffDay'];
  for (let d = 0; d < 90; d++) {
    const date = shift(-d);
    people.forEach((u, i) => {
      if ((i + d) % 7 === 0) return;
      const st = STAT[(i + d) % STAT.length];
      W.DB.attendance.push({
        id: 'att_' + u.id + '_' + date, userId: u.id, date,
        inMin: 8 * 60 + ((i + d) % 40), outMin: 17 * 60 + ((i * d) % 50),
        hours: 8 + ((i + d) % 3) * 0.4, status: st,
        flags: st === 'AutoClosed' ? ['forgot-clockout'] : ((i + d) % 5 === 0 ? ['late'] : ((i + d) % 11 === 0 ? ['WFH', 'fence-changed'] : [])),
        note: '',
      });
    });
  }

  const lts = W.DB.leaveTypes.filter(t => t.profileId === 'UAE');
  people.forEach((u, i) => {
    for (let k = 0; k < 3; k++) {
      const lt = lts[(i + k) % lts.length];
      W.DB.leaveRequests.push({
        id: 'lr' + i + '_' + k, userId: u.id, leaveTypeId: lt.id, leaveYear: '2026-01-01',
        start: shift(-30 + i), end: shift(-28 + i), halfDay: false, workingDays: 3,
        reason: 'Family commitment out of the country — flights already booked and confirmed',
        status: ['Pending', 'Approved', 'Rejected'][k % 3], flow: [{ id: 's1', type: 'manager' }, { id: 's2', type: 'role', role: 'hr' }],
        stageIndex: 0, stage: 'manager', createdAt: new Date('2026-06-01T09:00:00Z').toISOString(),
      });
      W.DB.leaveBalances.push({ id: 'lb' + i + '_' + k, userId: u.id, leaveTypeId: lt.id, leaveYear: '2026-01-01', entitled: 30, accrued: 12.5, taken: 4, adjustments: 0 });
    }
  });

  W.DB.holidays.push({ id: 'h1', profileId: 'UAE', date: '2026-12-02', name: 'UAE National Day (Spirit of the Union)', locationId: null });

  people.slice(0, 12).forEach((u, i) => {
    W.DB.tickets.push({ id: 'tk' + i, title: 'Chiller unit 3 in the Marina tower is cycling on and off every few minutes',
      description: 'Reported by the night shift supervisor; needs a technician with refrigerant certification.',
      createdBy: u.id, assignedTo: people[(i + 2) % people.length].id, status: ['Open', 'In Progress', 'Resolved'][i % 3],
      priority: ['Low', 'Medium', 'High', 'Critical'][i % 4], createdAt: new Date('2026-07-0' + ((i % 8) + 1) + 'T10:00:00Z').toISOString() });
    W.DB.shifts.push({ id: 'sh' + i, userId: u.id, date: shift(i % 7), start: '08:00', end: '17:00', locationId: 'loc' + (i % 3), published: i % 2 === 0, note: '' });
    W.DB.overtime.push({ id: 'ot' + i, userId: u.id, date: shift(-i), hours: 2 + (i % 3), kind: ['normal', 'night', 'restday'][i % 3],
      rate: 1.25, status: ['Pending', 'Approved'][i % 2], reason: 'Emergency generator servicing after the power outage', createdAt: new Date().toISOString() });
    W.DB.letters.push({ id: 'lt' + i, userId: u.id, type: 'salary_certificate', title: 'Salary Certificate for Bank Loan Application', status: ['Requested', 'Issued'][i % 2], createdAt: new Date().toISOString() });
    W.DB.announcements.push({ id: 'an' + i, title: 'Scheduled maintenance of the building management system this weekend',
      body: 'Access to the operations dashboard will be intermittent between 22:00 Friday and 06:00 Saturday.',
      authorId: 'sa1', createdAt: new Date().toISOString(), deptTarget: null, locTarget: null });
  });

  W.DB.payrollRuns.push({ id: 'pr1', month: '2026-06', status: 'Finalized', createdAt: new Date().toISOString(), createdBy: 'sa1', paidAt: '2026-07-01' });
  people.forEach((u, i) => W.DB.payrollItems.push({ id: 'pi' + i, runId: 'pr1', userId: u.id,
    gross: 8800 + i * 250, basic: 6000 + i * 250, housing: 2000, transport: 800, other: 0,
    unpaidDays: i % 3, deductions: (i % 4) * 120, otPay: (i % 5) * 90, net: 8500 + i * 240, adjustments: [] }));

  W.DB.checklists.push({ id: 'cl1', name: 'Daily Opening Checklist — Marina Tower Facilities Team',
    department: 'Operations', assignees: people.slice(0, 8).map(u => u.id), questionIds: [], locationIds: ['loc0'], frequency: 'daily' });

  W.DB.okrs.push({ id: 'ok1', title: 'Reduce unplanned facilities downtime across all managed properties',
    ownerId: 'sa1', level: 0, parentId: null, isAnnual: true, unit: 'percent', start: 0, target: 95, current: 62,
    periodStart: '2026-01-01', periodEnd: '2026-12-31', status: 'On track' });

  W.DB.flows.push({ id: 'fl1', userId: 'u1', kind: 'onboarding', status: 'Active',
    steps: [{ id: 's1', title: 'Collect signed offer letter and passport copy', ownerId: 'sa1', due: shift(3), done: false }] });

  W.DB.discipline.push({ id: 'dc1', userId: 'u2', status: 'charged', discoveredAt: shift(-10),
    charge: 'Repeated late arrival without prior notice over a two-week period', createdAt: new Date().toISOString() });

  W.DB.notifications.push({ id: 'nt1', userId: 'sa1', kind: 'leave', title: 'Leave request awaiting your approval',
    body: 'Priyadarshini Balasubramanian requested Annual Leave from 25 Jul to 28 Jul 2026', read: false, createdAt: new Date().toISOString() });
});

describe('mobile audit dump', () => {
  for (const r of ROUTES) {
    it('dumps ' + r, () => {
      W.S.route = r; W.S.filters = {}; W.S.search = '';
      let inner = '';
      try { inner = W.pageContent(); } catch (e) { inner = '<pre>THREW: ' + String(e && e.message) + '</pre>'; }
      let html = '';
      try { html = W.shell(inner); } catch (e) { html = inner; }
      fs.writeFileSync(path.join(OUT, r + '.html'), html);
    });
  }
});
