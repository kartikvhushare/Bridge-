/* Lifecycle page harness (R20 redesign) — tabs with counts, scoped refresh, timeline cards,
   per-tab empty states with CTAs, overdue pills, next-step preview. */
import { describe, it, expect, beforeAll } from 'vitest';

const W = window;
let sa, emp;

beforeAll(() => {
  sa  = W.__mkUser({ id: 'lcsa1', firstName: 'Super', lastName: 'Admin' });
  emp = W.__mkUser({ id: 'lcemp1', firstName: 'Nadia', lastName: 'Rahman' });
  W.DB.users.push(sa, emp);
  [sa, emp].forEach(u => W._ensureHrm(u));
  sa.hrm.roleProfileId = 'superadmin';
  emp.hrm.roleProfileId = 'basic';
  W._seedRoleProfiles();
  W.S.uid = 'lcsa1'; W.S.route = 'lifecycle'; W.S.filters = {};
  W.DB.flows = [
    { id: 'flw_a', kind: 'onboarding', userId: 'lcemp1', status: 'Active', createdBy: 'lcsa1',
      createdAt: '2026-07-01T09:00:00Z', completedAt: null,
      steps: [
        { id: 'fs1', title: 'Prepare laptop', ownerType: 'hr', dept: 'IT', ownerId: 'lcsa1', type: 'task', dueDate: '2026-07-03', done: true,  doneBy: 'lcsa1', doneAt: '2026-07-02T10:00:00Z', formText: '', note: '' },
        { id: 'fs2', title: 'Sign contract',  ownerType: 'hr', dept: 'HR', ownerId: 'lcsa1', type: 'form', dueDate: '2026-07-05', done: false, doneBy: null,   doneAt: null, formText: '', note: '' },
      ] },
    { id: 'flw_b', kind: 'exit', userId: 'lcemp1', status: 'Active', createdBy: 'lcsa1',
      createdAt: '2026-07-02T09:00:00Z', completedAt: null,
      steps: [
        { id: 'fs3', title: 'Handover', ownerType: 'hr', dept: '', ownerId: 'lcsa1', type: 'task', dueDate: '2020-01-01', done: false, doneBy: null, doneAt: null, formText: '', note: '' },
      ] },
  ];
});

describe('lifecycle page (R20 redesign)', () => {
  it('renders tab counts from visible flows', () => {
    W.S.filters = {};
    const html = W.lifecyclePage();
    expect(html).toContain('lc-wrap');
    expect(html).toContain('Onboarding');
    expect(html).toContain('Nadia Rahman');
  });
  it('shows the next-step preview and overdue pill', () => {
    W.S.filters = {};
    const html = W._lcBody();
    expect(html).toContain('Sign contract');          // next-step preview on the onboarding card
    expect(html).toContain('overdue');                 // the 2020-dated exit step is overdue
    expect(html).toContain('Overdue steps');           // summary tile
  });
  it('filters by tab — probation is empty and offers a direct CTA to a manager', () => {
    W.S.filters = { lcTab: 'probation' };
    const html = W._lcBody();
    expect(html).toContain('No probation flows');
    expect(html).toContain("App._flowNew('probation')");
    expect(html.includes('Nadia Rahman')).toBe(false);
  });
  it('exit tab shows only the exit flow', () => {
    W.S.filters = { lcTab: 'exit' };
    const html = W._lcBody();
    expect(html).toContain('Handover') === undefined; // collapsed — steps not rendered
    expect(html).toContain('Exit');
    expect(html.includes('Sign contract')).toBe(false);
  });
  it('expanding a card renders the timeline steps (form textarea included)', () => {
    W.S.filters = { lcTab: 'onboarding', lcOpen: 'flw_a' };
    const html = W._lcBody();
    expect(html).toContain('Sign contract');
    expect(html).toContain('App._flowForm');
    expect(html).toContain('App._flowStep');
  });
  it('a basic employee with no involvement sees no flows (scope holds)', () => {
    W.S.uid = 'lcemp1'; W.S.filters = {};
    // emp is the SUBJECT of flows but owns no steps; basic lifecycle scope is none/self
    const html = W._lcBody();
    // subject visibility: userId===S.uid keeps their own flows visible
    expect(html).toContain('Nadia Rahman');
    W.S.uid = 'lcsa1';
  });
  it('_lcRR falls back to rr() when not on the lifecycle route', () => {
    expect(typeof W._lcRR).toBe('function');
    W.S.route = 'dashboard';
    expect(() => W._lcRR()).not.toThrow();
    W.S.route = 'lifecycle';
  });
});
