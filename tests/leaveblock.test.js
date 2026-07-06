/* Leave-day lock: full-day approved leave blocks clock-in/WFH; half-day + pending don't. */
import { describe, it, expect, beforeAll } from 'vitest';
const W = window;
const T = () => W.todayISO();
let u;
beforeAll(() => {
  u = W.__mkUser({ id: 'lvb1' });
  W.DB.users.push(u); W._ensureHrm(u);
});
describe('_onFullLeaveToday', () => {
  it('approved full-day leave covering today → blocked', () => {
    W.DB.leaveRequests = [{ id:'r1', userId:'lvb1', status:'Approved', halfDay:false, start:T(), end:T() }];
    expect(W._onFullLeaveToday('lvb1')).toBe(true);                                 // 1
  });
  it('half-day leave → NOT blocked (worked half is still clocked)', () => {
    W.DB.leaveRequests = [{ id:'r2', userId:'lvb1', status:'Approved', halfDay:true, start:T(), end:T() }];
    expect(W._onFullLeaveToday('lvb1')).toBe(false);                                // 2
  });
  it('pending / rejected / cancelled → NOT blocked', () => {
    for (const st of ['Pending','Rejected','Cancelled']) {
      W.DB.leaveRequests = [{ id:'r3', userId:'lvb1', status:st, halfDay:false, start:T(), end:T() }];
      expect(W._onFullLeaveToday('lvb1')).toBe(false);                              // 3,4,5
    }
  });
  it('range covering today blocks; range ending yesterday does not', () => {
    W.DB.leaveRequests = [{ id:'r4', userId:'lvb1', status:'Approved', halfDay:false, start:W._isoAdd(T(),-2), end:W._isoAdd(T(),2) }];
    expect(W._onFullLeaveToday('lvb1')).toBe(true);                                 // 6
    W.DB.leaveRequests = [{ id:'r5', userId:'lvb1', status:'Approved', halfDay:false, start:W._isoAdd(T(),-3), end:W._isoAdd(T(),-1) }];
    expect(W._onFullLeaveToday('lvb1')).toBe(false);                                // 7
    W.DB.leaveRequests = [];
  });
});
