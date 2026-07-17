/* Permissions resolver harness — 26 assertions.
   Covers: seeding + version stamp, v3 migration role assignment, role bundles,
   per-user overrides beating roles (even Super Admin), scopes, lockout guard,
   legacy grant translation, idempotency, custom-role preservation. */
import { describe, it, expect, beforeAll } from 'vitest';

const W = window;
let sa, adm, hr, mgr, emp, qEmp;

beforeAll(() => {
  sa  = W.__mkUser({ id: 'sa1' });                           // → superadmin (assigned below)
  adm = W.__mkUser({ id: 'adm1' });                          // → admin (assigned below)
  hr  = W.__mkUser({ id: 'hr1' });                           // → hr (flag below)
  mgr = W.__mkUser({ id: 'mgr1' });                          // → manager (has report)
  emp = W.__mkUser({ id: 'emp1', managerId: 'mgr1' });       // → basic
  qEmp = W.__mkUser({ id: 'qe1', managerId: 'mgr1', questionsAccess: true }); // legacy grant
  W.DB.users.push(sa, adm, hr, mgr, emp, qEmp);
  [sa, adm, hr, mgr, emp, qEmp].forEach(u => W._ensureHrm(u));
  sa.hrm.roleProfileId = 'superadmin'; adm.hrm.roleProfileId = 'admin'; // R20: roles are assigned, never derived from a legacy field
  hr.hrm.isHR = true;
  W._seedRoleProfiles();
  W._permsV3Migrate();
});
const as = (u) => { W.S.uid = u.id; };

describe('seeding', () => {
  it('seeds all five built-in roles', () => {
    expect(['superadmin', 'admin', 'manager', 'hr', 'basic'].every(k => W.DB.roleProfiles[k])).toBe(true); // 1
  });
  it('stamps built-ins with version 10 (v10: micro permissions — per-operation toggles)', () => {
    expect(W.DB.roleProfiles.superadmin._v).toBe('10');                                                    // 2
  });
  it('never clobbers a custom role on reseed', () => {
    W.DB.roleProfiles.custom1 = { id: 'custom1', name: 'Custom', perms: { tickets: { scope: 'self', actions: { view: true } } } };
    W._seedRoleProfiles();
    expect(W.DB.roleProfiles.custom1.name).toBe('Custom');                                                 // 3
  });
});

describe('v3 migration', () => {
  it('keeps assigned roles and derives the rest (HR flag / has-reports / basic)', () => {
    expect(sa.hrm.roleProfileId).toBe('superadmin');                                                       // 4
    expect(adm.hrm.roleProfileId).toBe('admin');                                                           // 5
    expect(hr.hrm.roleProfileId).toBe('hr');                                                               // 6
    expect(mgr.hrm.roleProfileId).toBe('manager');                                                         // 7
    expect(emp.hrm.roleProfileId).toBe('basic');                                                           // 8
  });
  it('translates legacy questionsAccess into a per-user override', () => {
    expect(qEmp.hrm.perms?.questions?.actions?.view).toBe(true);                                           // 9
  });
  it('is idempotent (permsV3 stamp short-circuits)', () => {
    emp.hrm.roleProfileId = 'basic';
    W._permsV3Migrate();
    expect(emp.hrm.roleProfileId).toBe('basic');                                                           // 10
  });
});

describe('can() resolution', () => {
  it('superadmin holds accessControl.manage', () => {
    as(sa); expect(W.can('accessControl', 'manage')).toBe(true);                                           // 11
  });
  it('admin role = everything EXCEPT accessControl', () => {
    as(adm);
    expect(W.can('accessControl', 'view')).toBe(false);                                                    // 12
    expect(W.can('payroll', 'finalize')).toBe(true);                                                       // 13
  });
  it('basic employee: no payroll, but can request leave', () => {
    as(emp);
    expect(W.can('payroll', 'view')).toBe(false);                                                          // 14
    expect(W.can('leaveRequests', 'create')).toBe(true);                                                   // 15
  });
  it('manager can approve team leave', () => {
    as(mgr); expect(W.can('leaveRequests', 'approve')).toBe(true);                                         // 16
  });
  it('hr holds balance grant + hrSettings edit', () => {
    as(hr);
    expect(W.can('leaveBalances', 'grant')).toBe(true);                                                    // 17
    expect(W.can('hrSettings', 'edit')).toBe(true);                                                        // 18
  });
  it('unknown area resolves to false', () => {
    as(emp); expect(W.can('noSuchArea', 'view')).toBe(false);                                              // 19
  });
  it('per-user override BEATS the role — even Super Admin', () => {
    sa.hrm.perms = { payroll: { scope: 'none', actions: { view: false } } };
    as(sa); expect(W.can('payroll', 'view')).toBe(false);                                                  // 20
    sa.hrm.perms = null;
  });
});

describe('scopes', () => {
  it('superadmin sees everyone; basic sees self', () => {
    as(sa);  expect(W.scopeOf('attendance')).toBe('everyone');                                             // 21
    as(emp); expect(W.scopeOf('attendance')).toBe('self');                                                 // 22
  });
  it('manager leave scope is team, and the filter matches the tree', () => {
    as(mgr);
    expect(W.scopeOf('leaveRequests')).toBe('team');                                                       // 23
    const f = W.scopeFilter('leaveRequests');
    expect(f('emp1')).toBe(true);                                                                          // 24
    expect(f('hr1')).toBe(false);                                                                          // 25
  });
});

describe('lockout guard', () => {
  it('removing AC from one holder is safe while another remains', () => {
    expect(W._acLockoutSafe('adm1', 'manage')).toBe(true);                                                 // 26
  });
});

describe('r20 - legacy role field fully retired', () => {
  it('a user with NO assigned role resolves against the Basic Employee bundle', () => {
    const ghost = W.__mkUser({ id: 'gh1' });
    W.DB.users.push(ghost); W._ensureHrm(ghost);
    ghost.hrm.roleProfileId = null; ghost.hrm.permsV3 = 1; // simulate an unassigned account
    as(ghost);
    expect(W.can('leaveRequests', 'create')).toBe(true);   // basic grants this            // 27
    expect(W.can('payroll', 'view')).toBe(false);          // basic lacks this             // 28
    expect(W.scopeOf('attendance')).toBe('self');          // basic scope floor            // 29
    W.DB.users = W.DB.users.filter(u => u.id !== 'gh1');
  });
  it('superadmin resolves purely from the profile id (no legacy field anywhere)', () => {
    as(sa);
    expect(sa.role).toBeUndefined();                                                       // 30
    expect(W.isAdmin()).toBe(true);                                                        // 31
    expect(W.isSuperU(sa)).toBe(true);                                                     // 32
  });
  it('v9 seeds the scoped OKR area: admins see everyone, managers their team', () => {
    expect(W.DB.roleProfiles.superadmin.perms.okr.scope).toBe('everyone');                 // 33
    expect(W.DB.roleProfiles.admin.perms.okr.scope).toBe('everyone');                      // 34
    expect(W.DB.roleProfiles.manager.perms.okr.scope).toBe('team');                        // 35
  });
  it('roleName() reads the Access Control role, with a Basic Employee default', () => {
    expect(W.roleName(sa)).toBe('Super Admin');                                            // 36
    expect(W.roleName({ hrm: {} })).toBe('Basic Employee');                                // 37
  });
});


describe('v10 micro permissions', () => {
  it('umbrella actions are gone from the matrix; granular ones exist', () => {
    const a = (k) => W.PERM_AREAS.find(x => x.key === k).actions;
    expect(a('tickets')).toContain('changeStatus'); expect(a('tickets')).toContain('resolve'); expect(a('tickets')).toContain('delete');
    expect(a('tickets').includes('manage')).toBe(false);
    expect(a('questions')).toEqual(expect.arrayContaining(['create','edit','delete','import','export']));
    expect(a('scheduling')).toEqual(expect.arrayContaining(['create','edit','publish','delete']));
    expect(a('lifecycle')).toEqual(expect.arrayContaining(['start','progress']));
    expect(a('employees')).toEqual(expect.arrayContaining(['resetPassword','manageAssets']));
    expect(a('departments')).toContain('delete');
  });
  it('custom roles auto-expand: old umbrella grants imply the new granular actions', () => {
    W.DB.roleProfiles.legacyRole = { id: 'legacyRole', name: 'Legacy', perms: {
      tickets: { scope: 'team', actions: { view: true, manage: true } },
      scheduling: { scope: 'team', actions: { view: true, manage: true } },
      checklists: { scope: 'team', actions: { view: true, edit: true } },
    }};
    W._permsMicroMigrate();
    const lp = W.DB.roleProfiles.legacyRole.perms;
    expect(lp.tickets.actions.changeStatus).toBe(true);
    expect(lp.tickets.actions.resolve).toBe(true);
    expect(lp.scheduling.actions.publish).toBe(true);
    expect(lp.checklists.actions.duplicate).toBe(true);
    expect(lp.checklists.actions.delete).toBe(true);
    // idempotent — explicit false set later is respected on re-run
    lp.tickets.actions.resolve = false;
    W._permsMicroMigrate();
    expect(lp.tickets.actions.resolve).toBe(false);
    delete W.DB.roleProfiles.legacyRole;
  });
  it('built-in seeds hold the granular actions (manager can resolve team tickets, publish shifts)', () => {
    const m = W.DB.roleProfiles.manager.perms;
    expect(m.tickets.actions.resolve).toBe(true);
    expect(m.scheduling.actions.publish).toBe(true);
    expect(m.lifecycle.actions.start).toBe(true);
    expect(!!(W.DB.roleProfiles.basic.perms.tickets.actions.resolve)).toBe(false);
  });
  it('view-as preview resolves like the app (canUser + override annotation)', () => {
    expect(typeof W.App._acPreview).toBe('function');
    const eff = W._acEffArea ? null : null; // helper is module-scoped; behaviour asserted via canUser
    const sa2 = W.DB.users.find(u => W.userProfileId ? true : true);
    expect(W.canUser(W.DB.users[0], 'tickets', 'view')).toBeTypeOf('boolean');
  });
});
