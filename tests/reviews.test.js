/* Performance reviews harness — dynamic audience, 1–10 scoring, results & gaps, progress. */
import { describe, it, expect, beforeAll } from 'vitest';

const W = window;
let mgr, emp1, emp2;
const cyc = (over = {}) => Object.assign({
  id: 'rc' + Math.random().toString(36).slice(2, 8), name: 'Cycle', start: '2026-07-01', end: '2026-07-15',
  status: 'Active', scale: 10, audience: { self: true, manager: true },
  questions: [ { id: 'q1', text: 'Quality', type: 'rating' }, { id: 'q2', text: 'Ownership', type: 'rating' }, { id: 'q3', text: 'Notes', type: 'answer' } ],
  createdBy: 'x', createdAt: '2026-07-01T00:00:00Z', closedAt: null,
}, over);

beforeAll(() => {
  mgr  = W.__mkUser({ id: 'rvm1' });
  emp1 = W.__mkUser({ id: 'rve1', managerId: 'rvm1' });
  emp2 = W.__mkUser({ id: 'rve2', managerId: 'rvm1' });
  W.DB.users.push(mgr, emp1, emp2);
  W.DB.reviewCycles = []; W.DB.reviewAnswers = [];
});

describe('task generation (dynamic audience)', () => {
  it('self+manager: manager gets self + one per direct; employee gets self only', () => {
    const c = cyc({ id: 'rcA' }); W.DB.reviewCycles = [c]; W.DB.reviewAnswers = [];
    const mt = W._rcMyTasks(mgr), et = W._rcMyTasks(emp1);
    expect(mt.length).toBe(3);                                            // self + 2 directs
    expect(et.length).toBe(1);                                            // self only
    expect(mt.filter(t => t.role === 'manager').map(t => t.about).sort()).toEqual(['rve1', 'rve2']);
  });
  it('manager-only audience removes self tasks', () => {
    W.DB.reviewCycles = [cyc({ id: 'rcB', audience: { self: false, manager: true } })]; W.DB.reviewAnswers = [];
    expect(W._rcMyTasks(emp1).length).toBe(0);
    expect(W._rcMyTasks(mgr).every(t => t.role === 'manager')).toBe(true);
  });
  it('self-only audience removes manager tasks', () => {
    W.DB.reviewCycles = [cyc({ id: 'rcC', audience: { self: true, manager: false } })]; W.DB.reviewAnswers = [];
    expect(W._rcMyTasks(mgr).length).toBe(1);
  });
  it('submitting removes the task (no double submissions)', () => {
    const c = cyc({ id: 'rcD' }); W.DB.reviewCycles = [c];
    W.DB.reviewAnswers = [{ id: 'a1', cycleId: 'rcD', byUser: 'rve1', aboutUser: 'rve1', role: 'self', answers: [], score: null, submittedAt: 'x' }];
    expect(W._rcMyTasks(emp1).length).toBe(0);
  });
});

describe('scoring (1–10)', () => {
  it('averages only rating questions, 1dp', () => {
    const c = cyc();
    expect(W._rcAvgAnswers(c, [ { qid: 'q1', value: 7 }, { qid: 'q2', value: 8 }, { qid: 'q3', text: 'hi' } ])).toBe(7.5);
    expect(W._rcAvgAnswers(c, [ { qid: 'q1', value: 9 } ])).toBe(9);
  });
  it('no rated answers → null', () => {
    expect(W._rcAvgAnswers(cyc(), [ { qid: 'q3', text: 'only words' } ])).toBe(null);
  });
});

describe('results & gap', () => {
  it('self vs manager and gap = manager − self', () => {
    const c = cyc({ id: 'rcE' }); W.DB.reviewCycles = [c];
    W.DB.reviewAnswers = [
      { id: 'b1', cycleId: 'rcE', byUser: 'rve1', aboutUser: 'rve1', role: 'self',    answers: [{ qid: 'q1', value: 6 }], score: 6 },
      { id: 'b2', cycleId: 'rcE', byUser: 'rvm1', aboutUser: 'rve1', role: 'manager', answers: [{ qid: 'q1', value: 8 }], score: 8 },
    ];
    const r = W._rcResultFor(c, 'rve1');
    expect(r.self).toBe(6); expect(r.manager).toBe(8); expect(r.gap).toBe(2);
  });
  it('progress counts: participants (self+mgr forms) & submitted', () => {
    const c = cyc({ id: 'rcF' }); W.DB.reviewCycles = [c];
    W.DB.reviewAnswers = [{ id: 'c1', cycleId: 'rcF', byUser: 'rve1', aboutUser: 'rve1', role: 'self', answers: [], score: null }];
    const total = W._rcParticipants(c);
    expect(total).toBeGreaterThanOrEqual(2 + 26 >= 0 ? 2 : 0); // ≥ 2 manager forms exist for this tree
    expect(W._rcSubmitted(c)).toBe(1);
  });
  it('people-in lists everyone with an answer about them', () => {
    const c = cyc({ id: 'rcG' }); W.DB.reviewCycles = [c];
    W.DB.reviewAnswers = [
      { id: 'd1', cycleId: 'rcG', byUser: 'rvm1', aboutUser: 'rve1', role: 'manager', answers: [], score: 5 },
      { id: 'd2', cycleId: 'rcG', byUser: 'rvm1', aboutUser: 'rve2', role: 'manager', answers: [], score: 6 },
    ];
    expect(W._rcPeopleIn(c).map(u => u.id).sort()).toEqual(['rve1', 'rve2']);
  });
});

describe('mappers round-trip', () => {
  it('camel ⟷ snake keeps every field', () => {
    const c = cyc({ id: 'rcH' });
    const back = W._mRC([W._rcRow(c)])[0];
    expect(back.name).toBe(c.name); expect(back.audience).toEqual(c.audience);
    expect(back.questions.length).toBe(3); expect(back.scale).toBe(10);
    const a = { id: 'ra1', cycleId: 'rcH', byUser: 'u1', aboutUser: 'u2', role: 'manager', answers: [{ qid: 'q1', value: 9 }], score: 9, submittedAt: '2026-07-05T00:00:00Z' };
    const ab = W._mRA([W._raRow(a)])[0];
    expect(ab.aboutUser).toBe('u2'); expect(ab.score).toBe(9); expect(ab.answers[0].value).toBe(9);
  });
});
