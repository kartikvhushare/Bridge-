

/* ════════════════════════════════════════════════════════════════════════════
   HRM — ATTENDANCE & LEAVE MODULE  (FRONTEND-ONLY, localStorage via DB/saveDB)
   New DB keys: hrmConfig, attendance, leaveTypes, leaveRequests, leaveBalances,
   holidays, hrmAudit. Per-user fields on u.hrm. NONE of these are ever added to
   _sync()/loadFromSB()/sb.from(...) — purely client-side by construction.
   ════════════════════════════════════════════════════════════════════════════ */

/* ── Policy constants (HR-tunable semantics, documented in HR Config) ── */
const HRM_SIXDAY_PRORATE=6/5;   // 6-day weeks accrue proportionally more than 5-day weeks
const HRM_ANNUAL_MID=2.0;       // UAE annual accrual 6–12 months of service (days/month)

/* ── Audit (local-only; NOT written to audit_logs) ── */
function hlog(action,target){
  if(!DB.hrmAudit)DB.hrmAudit=[];
  DB.hrmAudit.unshift({id:uid('lg'),actor:fullName(me()),action,target:target||'',time:new Date().toISOString()});
  if(DB.hrmAudit.length>200)DB.hrmAudit.length=200;
  saveDB();
}

/* ── In-app notification helper (mirrors existing DB.notifications pattern) ── */
function _hrmNotify(userId,text,kind,targetRoute){
  // Routing keys off n.kind (structured; _notifClick maps kind→route, plan4 §D). An optional
  // targetRoute pins ambiguous kinds (e.g. a DECIDED document/onboarding notif → its page, not
  // the Approvals inbox). _notifClick still has a leave-text fallback for legacy kind-less rows.
  if(!userId||!text)return; // PHASE3-FIX: empty-text guard (matches notify()) — one undefined-text row 400s the batched notifications upsert and blocks ALL notification sync
  const n={id:uid('n'),userId,text,time:new Date().toISOString(),read:false};
  if(kind)n.kind=kind;
  if(targetRoute)n.targetRoute=targetRoute;
  DB.notifications.unshift(n);
  _invalidateNotifCache();
}
/* ════════ §4 — HR EMAIL / NOTIFICATION PREFS (FRONTEND-ONLY) ════════
   Lives ONLY on DB.hrmNotifPrefs (localStorage via saveDB). NEVER written to workspace_settings /
   _nsDefault / any sb.from(...) — distinct from the synced _ns notification settings.
   - hrm_email_enabled: master email switch (default off).
   - inapp_*: in-app notification per event (default on).
   - email_hrm_*: per-event email (default on, but only fires when the master switch is on). */
function _hrmNotifPrefsDefault(){return{
  hrm_email_enabled:false,
  // in-app toggles (default on)
  inapp_hrm_leave_submitted:true,inapp_hrm_leave_approved:true,inapp_hrm_leave_rejected:true,
  inapp_hrm_late:true,inapp_hrm_missed_clockout:true,inapp_announcement:true,inapp_review_opened:true,inapp_review_results:true,inapp_hrm_wfh:true,
  // email toggles (default on, gated by master)
  email_hrm_leave_submitted:true,email_hrm_leave_approved:true,email_hrm_leave_rejected:true,
  email_hrm_late:true,email_hrm_missed_clockout:true,email_announcement:true,email_review_cycle_opened:true,email_review_results_ready:true,
};}
// Getter: raw value of a HRM notif pref (defaults applied). Used by toggle rows + in-app gates.
function _hnp(key){
  const p=DB.hrmNotifPrefs||(DB.hrmNotifPrefs=_hrmNotifPrefsDefault());
  const d=_hrmNotifPrefsDefault();
  return p[key]!==undefined?!!p[key]:!!d[key];
}
// Email gate: an email_* event fires only when its own toggle AND the master switch are on.
function _hnpEmail(key){return _hnp('hrm_email_enabled')&&_hnp(key);}
App._hnpTog=(btn,key)=>{
  if(!DB.hrmNotifPrefs)DB.hrmNotifPrefs=_hrmNotifPrefsDefault();
  const nowOn=btn.classList.contains('off');
  btn.classList.toggle('on',nowOn);btn.classList.toggle('off',!nowOn);
  btn.setAttribute('aria-checked',nowOn?'true':'false');
  DB.hrmNotifPrefs[key]=nowOn;saveDB();
};

/* ── Date helpers ── */
function _isoAdd(iso,days){const d=new Date(iso+'T00:00:00');d.setDate(d.getDate()+days);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function _addMonths(iso,n){const d=new Date(iso+'T00:00:00');d.setMonth(d.getMonth()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function _monthsBetween(a,b){if(!a||!b)return 0;const d1=new Date(a+'T00:00:00'),d2=new Date(b+'T00:00:00');let m=(d2.getFullYear()-d1.getFullYear())*12+(d2.getMonth()-d1.getMonth());if(d2.getDate()<d1.getDate())m--;return Math.max(0,m);}
function _r2(n){return Math.round(n*100)/100;}

/* ── Leave-year id for a user (calendar | anniversary) ── */
function _leaveYearOf(u,iso){
  iso=iso||todayISO();
  // H1: derive basis from the USER'S OWN profile, not the globally active profile.
  const basis=(DB.hrmConfig?.profiles?.[userProfileId(u)]?.leaveYearBasis)||'calendar';
  if(basis==='anniversary'&&u?.hrm?.joiningDate){
    const j=new Date(u.hrm.joiningDate+'T00:00:00');const d=new Date(iso+'T00:00:00');
    let y=d.getFullYear();const annThis=new Date(y,j.getMonth(),j.getDate());
    if(d<annThis)y--;
    return y+'-anniv';
  }
  return iso.slice(0,4);
}
/* ── First calendar date of the user's current leave year (L7: carry-over expiry anchor). ── */
function _leaveYearStart(u,iso){
  iso=iso||todayISO();
  const basis=(DB.hrmConfig?.profiles?.[userProfileId(u)]?.leaveYearBasis)||'calendar';
  if(basis==='anniversary'&&u?.hrm?.joiningDate){
    const j=new Date(u.hrm.joiningDate+'T00:00:00');const d=new Date(iso+'T00:00:00');
    let y=d.getFullYear();const annThis=new Date(y,j.getMonth(),j.getDate());
    if(d<annThis)y--;
    return y+'-'+String(j.getMonth()+1).padStart(2,'0')+'-'+String(j.getDate()).padStart(2,'0');
  }
  return iso.slice(0,4)+'-01-01';
}

/* ── Profile/config seeding ── */
function _seedProfiles(){
  if(DB.hrmConfig&&DB.hrmConfig.profiles&&Object.keys(DB.hrmConfig.profiles).length)return;
  DB.hrmConfig={activeProfile:'UAE',profiles:{
    'UAE':{id:'UAE',label:'UAE',country:'UAE',grace:15,autoCloseAt:'00:00',leaveYearBasis:'calendar',workWeekDefault:5,office:{lat:null,lng:null,radius:200,enabled:false},approvalChain:['manager','hr']},
    'India':{id:'India',label:'India',country:'India',grace:15,autoCloseAt:'00:00',leaveYearBasis:'calendar',workWeekDefault:6,office:{lat:null,lng:null,radius:200,enabled:false},approvalChain:['manager','hr']}
  }};
}
function _seedLeaveTypes(profileId){
  if((DB.leaveTypes||[]).some(t=>t.profileId===profileId))return;
  const mk=o=>Object.assign({id:uid('lt'),profileId,enabled:true,unit:'calendar',entitlement:0,accrualPerMonth:0,eligibilityMonths:0,paidTiers:null,unpaid:false,halfDayAllowed:true,carryOver:{enabled:false,maxDays:0,expiryMonths:0},oncePerEmployment:false,birthdayMonthOnly:false,maxPerYear:null,nursingBreaks:false,notes:''},o);
  let set;
  if(profileId==='UAE'){
    set=[
      mk({key:'annual',name:'Annual Leave',unit:'calendar',entitlement:30,accrualPerMonth:2.5,carryOver:{enabled:true,maxDays:15,expiryMonths:12},notes:'2.0/mo for 6–12 months service, 2.5/mo after 12 months.'}),
      mk({key:'sick',name:'Sick Leave',unit:'working',entitlement:90,accrualPerMonth:0,maxPerYear:90,paidTiers:{full:15,half:30,unpaid:45},notes:'First 15 days full pay, next 30 half pay, remaining unpaid (per 90-day year).'}),
      mk({key:'maternity',name:'Maternity Leave',unit:'calendar',entitlement:60,accrualPerMonth:0,paidTiers:{full:45,half:15},nursingBreaks:true,notes:'45 days full pay, 15 days half pay. Nursing breaks apply.'}),
      mk({key:'parental',name:'Parental Leave',unit:'working',entitlement:5,accrualPerMonth:0}),
      mk({key:'bereavement_spouse',name:'Bereavement (Spouse)',unit:'calendar',entitlement:5,accrualPerMonth:0}),
      mk({key:'bereavement_other',name:'Bereavement (Other)',unit:'calendar',entitlement:3,accrualPerMonth:0}),
      mk({key:'hajj',name:'Hajj Leave',unit:'calendar',entitlement:30,accrualPerMonth:0,oncePerEmployment:true,unpaid:true,notes:'Unpaid, once per employment.'}),
      mk({key:'birthday',name:'Birthday Leave',unit:'calendar',entitlement:1,accrualPerMonth:0,birthdayMonthOnly:true,halfDayAllowed:false}),
      mk({key:'compoff',name:'Comp-off',unit:'working',entitlement:0,accrualPerMonth:0,notes:'Added by HR per employee with reason + expiry.'}),
      mk({key:'study',name:'Study Leave',unit:'working',entitlement:10,accrualPerMonth:0,enabled:false})
    ];
  }else{
    // India: enabled set with placeholder entitlements (HR fills) — do NOT copy UAE numbers
    set=[
      mk({key:'annual',name:'Earned/Privilege Leave',unit:'working',entitlement:0,accrualPerMonth:0,carryOver:{enabled:true,maxDays:0,expiryMonths:0},notes:'HR to set entitlement & accrual per company policy.'}),
      mk({key:'sick',name:'Sick Leave',unit:'working',entitlement:0,accrualPerMonth:0,notes:'HR to set.'}),
      mk({key:'casual',name:'Casual Leave',unit:'working',entitlement:0,accrualPerMonth:0,notes:'HR to set.'}),
      mk({key:'maternity',name:'Maternity Leave',unit:'calendar',entitlement:0,accrualPerMonth:0,nursingBreaks:true,notes:'HR to set per Maternity Benefit Act.'}),
      mk({key:'paternity',name:'Paternity Leave',unit:'working',entitlement:0,accrualPerMonth:0,notes:'HR to set.'}),
      mk({key:'bereavement_other',name:'Bereavement Leave',unit:'calendar',entitlement:0,accrualPerMonth:0,notes:'HR to set.'}),
      mk({key:'birthday',name:'Birthday Leave',unit:'calendar',entitlement:0,accrualPerMonth:0,birthdayMonthOnly:true,halfDayAllowed:false,enabled:false}),
      mk({key:'compoff',name:'Comp-off',unit:'working',entitlement:0,accrualPerMonth:0,notes:'Added by HR per employee.'})
    ];
  }
  DB.leaveTypes.push(...set);
}

/* ── Lookups ── */
const ltById=id=>(DB.leaveTypes||[]).find(t=>t.id===id);
function _typesFor(profileId){return (DB.leaveTypes||[]).filter(t=>t.profileId===profileId);}

/* ── Balance ledger (create-if-missing) ── */
function _balanceFor(userId,leaveTypeId,leaveYear){
  const u=uById(userId);
  leaveYear=leaveYear||_leaveYearOf(u,todayISO());
  let b=(DB.leaveBalances||[]).find(x=>x.userId===userId&&x.leaveTypeId===leaveTypeId&&x.leaveYear===leaveYear);
  if(!b){
    // LV-8: fixed-entitlement (non-accruing) PAID types — birthday/parental/bereavement/study, etc. — carry
    //   their whole allowance in lt.entitlement with accrualPerMonth:0. Seed the new row's `entitled` from it so
    //   they are usable; accruing types (accrualPerMonth>0) still start at 0 and grow via _runMonthlyAccrual.
    //   Comp-off is HR-ledger only (never balance-row based). Unpaid types stay 0 (they bypass the ledger anyway).
    const lt=ltById(leaveTypeId);
    const seedEnt=(lt&&!_isCompOffLt(lt)&&lt.unpaid!==true&&(lt.accrualPerMonth||0)<=0&&(lt.entitlement||0)>0)?_r2(lt.entitlement):0;
    b={id:uid('lb'),userId,leaveTypeId,leaveYear,entitled:seedEnt,accrued:0,carriedIn:0,carriedExpiry:null,used:0,pending:0,lastAccruedMonth:null};DB.leaveBalances.push(b);
  }
  return b;
}
/* L8: read-only balance lookup — never pushes a row into DB.leaveBalances (use on render/analytics paths). */
function _balanceReadonly(userId,leaveTypeId,leaveYear){
  const u=uById(userId);
  leaveYear=leaveYear||_leaveYearOf(u,todayISO());
  const found=(DB.leaveBalances||[]).find(x=>x.userId===userId&&x.leaveTypeId===leaveTypeId&&x.leaveYear===leaveYear);
  if(found)return found;
  // LV-8: mirror _balanceFor's fixed-entitlement seeding in the read-only default so preview/render show the
  //   real usable balance for non-accruing paid types BEFORE the first row is materialized. Never pushes a row.
  const lt=ltById(leaveTypeId);
  const seedEnt=(lt&&!_isCompOffLt(lt)&&lt.unpaid!==true&&(lt.accrualPerMonth||0)<=0&&(lt.entitlement||0)>0)?_r2(lt.entitlement):0;
  return {id:null,userId,leaveTypeId,leaveYear,entitled:seedEnt,accrued:0,carriedIn:0,carriedExpiry:null,used:0,pending:0,lastAccruedMonth:null};
}
function _balRemaining(b){
  if(!b)return 0;
  let carried=b.carriedIn||0;
  if(b.carriedExpiry&&todayISO()>b.carriedExpiry)carried=0;
  return _r2((b.entitled||0)+carried-(b.used||0)-(b.pending||0));
}
/* §3a: comp-off REMAINING from the dedicated ledger (u.hrm.compOff).
   Each positive grant honors its OWN expiry (expired grants drop out); negative removals always apply.
   Independent of carry-over's carriedExpiry. */
function _compOffRemaining(userId){
  const u=uById(userId);const led=u?.hrm?.compOff;if(!Array.isArray(led))return 0;
  const today=todayISO();
  let total=0;
  led.forEach(e=>{
    const d=Number(e.days)||0;
    if(d>=0){ if(e.expiry&&today>e.expiry)return; total+=d; }   // grant expired → drops out
    else total+=d;                                              // removal always applies
  });
  return _r2(Math.max(0,total));
}
const _isCompOffLt=lt=>!!lt&&lt.key==='compoff';
/* Remaining days for a user+leaveType — comp-off reads the dedicated ledger; everything else the balance row. */
function _ltRemaining(userId,lt,leaveYear){
  if(_isCompOffLt(lt))return _compOffRemaining(userId);
  return _balRemaining(_balanceReadonly(userId,lt.id,leaveYear));
}

/* ── Working-day deduction (exclude off-days + public holidays) ── */
function _workingDaysBetween(userId,start,end,halfDay){
  const u=uById(userId);if(!u)return 0;
  const off=new Set(u.hrm?.schedule?.offDays||[]);
  const prof=userProfileId(u);
  const hols=new Set((DB.holidays||[]).filter(h=>h.profileId===prof).map(h=>h.date));
  let count=0,d=start;
  let guard=0;
  while(d<=end&&guard++<1000){
    const dow=DAYS3[new Date(d+'T00:00:00').getDay()];
    if(!off.has(dow)&&!hols.has(d))count++;
    d=_isoAdd(d,1);
  }
  if(halfDay&&count>0)count-=0.5;
  return _r2(count);
}

/* ── Worked-hours / late / early computation ── */
function computeHours(rec){
  if(rec.inMin==null)return 0;
  // L3: an auto-closed (forgotten clock-out) record must NOT book a full ~15h day into payroll.
  // Cap worked hours at the user's scheduled shift length instead of running to midnight.
  if(rec.autoClosed){
    const u=uById(rec.userId);const sh=Number(u?.hrm?.schedule?.hours);
    return _r2(sh>0?sh:0);
  }
  let out=rec.outMin;
  if(out==null)return 0;
  // LV-5: a genuine clock-out earlier than clock-in is an OVERNIGHT shift (e.g. 22:00→06:00).
  //   Add a full day so it books (out+1440)-in (=8h), instead of clamping to midnight (=2h).
  //   Auto-closed records never reach here (they return the capped scheduled hours above).
  if(out<rec.inMin)out+=1440;
  return _r2((out-rec.inMin)/60);
}
function _applyFlags(rec){
  const u=uById(rec.userId);if(!u)return;
  _ensureHrm(u); // L2: guard against an unmigrated user with no u.hrm.schedule
  const s=u.hrm?.schedule||{in:'09:00',out:'18:00'};const grace=userProfile(u).grace??15; // LV-6: user's profile, not global
  const flags=new Set((rec.flags||[]).filter(f=>f==='auto-closed'||f==='forgot-clockout'||f==='outside-geofence'||f==='fence-changed')); // H4: preserve fence-changed
  const sIn=hm2m(s.in),sOut=hm2m(s.out),overnight=sOut<sIn; // H3: 22:00→06:00 crosses midnight
  // H3: mirror computeHours' overnight handling — measure late/early INSIDE the actual shift window.
  //   For an overnight shift, a clock-in in the small hours (well below sIn) and a clock-out after
  //   midnight (below sOut at face value) are normalized by +1440 so the comparison stays in-window.
  let inM=rec.inMin,outM=rec.outMin;
  if(overnight){
    if(inM!=null&&inM<sOut)inM+=1440;   // in punched after midnight → next-day minute
    const sOutAdj=sOut+1440;            // shift end is on the following day
    if(outM!=null&&outM<sIn)outM+=1440; // out punched after midnight → next-day minute
    if(inM!=null&&inM>sIn+grace)flags.add('late');
    if(outM!=null&&!rec.autoClosed&&outM<sOutAdj-grace)flags.add('early');
  }else{
    if(inM!=null&&inM>sIn+grace)flags.add('late');
    if(outM!=null&&!rec.autoClosed&&outM<sOut-grace)flags.add('early');
  }
  rec.flags=[...flags];
}
function attFor(userId,date){return (DB.attendance||[]).find(a=>a.userId===userId&&a.date===date);}

/* ── Geofence (Haversine, meters) ── */
function _distM(lat1,lng1,lat2,lng2){
  const R=6371000,toR=x=>x*Math.PI/180;
  const dLat=toR(lat2-lat1),dLng=toR(lng2-lng1);
  const a=Math.sin(dLat/2)**2+Math.cos(toR(lat1))*Math.cos(toR(lat2))*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

/* ── Auto clock-out (lazy: boot + visibility regain). True midnight close needs a backend cron — deferred. ── */
function _runAutoClose(){
  const today=todayISO();let changed=false;
  (DB.attendance||[]).forEach(rec=>{
    if(rec.clockIn&&!rec.clockOut&&rec.date<today){
      const at=userProfile(uById(rec.userId)).autoCloseAt||'00:00'; // LV-6: user's profile, not global
      rec.clockOut=rec.date+'T'+at+':00';
      rec.outMin=hm2m(at);
      rec.autoClosed=true;rec.status='AutoClosed';
      rec.hours=computeHours(rec);
      const fl=new Set(rec.flags||[]);fl.add('auto-closed');fl.add('forgot-clockout');rec.flags=[...fl];
      if(_hnp('inapp_hrm_missed_clockout'))_hrmNotify(rec.userId,'⏱ Your '+fmtD(rec.date)+' clock-out was auto-closed at midnight (you forgot to clock out).','attendance');
      if(_hnpEmail('email_hrm_missed_clockout'))queueEmail('hrm_auto_closed',rec.userId,null,rec.date,{user_name:fullName(uById(rec.userId)),date:fmtD(rec.date)});
      changed=true;
    }
  });
  if(changed)saveDB();
}

/* ── Monthly pro-rated accrual (guarded by lastAccruedMonth) ── */
function _runMonthlyAccrual(){
  const ym=todayISO().slice(0,7);let changed=false;
  DB.users.filter(u=>u.status==='Active'&&u.hrm?.joiningDate).forEach(u=>{
    const serviceMonths=_monthsBetween(u.hrm.joiningDate,todayISO());
    const prof=userProfileId(u);
    _ensureHrm(u);const marks=u.hrm.accrualMarks;
    _typesFor(prof).filter(lt=>lt.enabled&&(lt.accrualPerMonth||0)>0).forEach(lt=>{
      // LV-7: idempotency is keyed per (user,leaveType,calendar month) GLOBALLY via u.hrm.accrualMarks,
      //   so an anniversary leave-year rollover (which creates a fresh row with lastAccruedMonth:null)
      //   can no longer make the rollover month accrue twice.
      if(marks[lt.id]===ym)return;
      const b=_balanceFor(u.id,lt.id,_leaveYearOf(u,todayISO()));
      if(lt.eligibilityMonths&&serviceMonths<lt.eligibilityMonths){marks[lt.id]=ym;b.lastAccruedMonth=ym;changed=true;return;}
      let base=lt.accrualPerMonth;
      if(lt.key==='annual'){if(serviceMonths<6)base=0;else if(serviceMonths<12)base=HRM_ANNUAL_MID;else base=lt.accrualPerMonth;}
      const ww=u.hrm.schedule?.workWeek||5;
      const prorate=ww===6?HRM_SIXDAY_PRORATE:1;
      let add=_r2(base*prorate);
      // M3: track the ACCRUED portion separately so maxPerYear caps only accruals,
      // never manual grants / comp-off that also live in b.entitled.
      const prevAccrued=b.accrued||0;
      let nextAccrued=_r2(prevAccrued+add);
      if(lt.maxPerYear&&nextAccrued>lt.maxPerYear){nextAccrued=lt.maxPerYear;add=_r2(nextAccrued-prevAccrued);}
      if(add>0){b.accrued=nextAccrued;b.entitled=_r2((b.entitled||0)+add);}
      marks[lt.id]=ym;b.lastAccruedMonth=ym;changed=true;
    });
  });
  if(changed)saveDB();
}

/* ── Carry-over + expiry (lazy at year rollover) ── */
function _runCarryOver(){
  const today=todayISO();let changed=false;
  DB.users.filter(u=>u.hrm).forEach(u=>{
    const curYear=_leaveYearOf(u,today);
    _typesFor(userProfileId(u)).forEach(lt=>{
      // find prior-year balances for this user/type that haven't been carried yet
      (DB.leaveBalances||[]).filter(b=>b.userId===u.id&&b.leaveTypeId===lt.id&&b.leaveYear!==curYear&&!b._carried).forEach(prev=>{
        if(!lt.carryOver?.enabled)return; // leave unmarked → enabling carry-over later retro-applies
        prev._carried=true;changed=true;
        const carry=Math.min(_balRemaining(prev),lt.carryOver.maxDays||0);
        if(carry<=0)return;
        const nb=_balanceFor(u.id,lt.id,curYear);
        nb.carriedIn=_r2((nb.carriedIn||0)+carry);
        if(lt.carryOver.expiryMonths)nb.carriedExpiry=_addMonths(_leaveYearStart(u,today),lt.carryOver.expiryMonths); // L7: anchor to leave-year start, not Jan-1
      });
    });
  });
  if(changed)saveDB();
}

/* ── Birthday gating ── */
function _birthdayOk(u,startISO){
  if(!u?.hrm?.dob)return false;
  return new Date(u.hrm.dob+'T00:00:00').getMonth()===new Date(startISO+'T00:00:00').getMonth();
}

/* ── Boot init (idempotent) ── */
function _hrmInit(){
  // PHASE3-FIX (self-heal): drop malformed empty-text notifications left in any device's local
  // cache by the pre-fix build — one such row 400s the whole batched notifications upsert and
  // keeps every later notification from syncing (endless "didn't save" toasts on that device).
  DB.notifications=(DB.notifications||[]).filter(n=>n&&n.text&&String(n.text).trim());
  // PHASE3-FIX (self-heal 2): drop duplicate-id notifications (deterministic deadline-checker ids can
  // double-add) — two rows with one id in a batched upsert = Postgres 21000 = whole batch fails.
  {const _seen=new Set();DB.notifications=DB.notifications.filter(n=>_seen.has(n.id)?false:(_seen.add(n.id),true));}
  // PHASE4: backfill new notification-pref keys on caches that predate them (undefined would read as OFF)
  if(DB.hrmNotifPrefs){const _d=_hrmNotifPrefsDefault();['inapp_review_opened','inapp_review_results','email_review_cycle_opened','email_review_results_ready','inapp_hrm_wfh'].forEach(k=>{if(DB.hrmNotifPrefs[k]===undefined)DB.hrmNotifPrefs[k]=_d[k];});}
  _seedProfiles();
  _seedRoleProfiles();
  DB.hrmConfig.locationGeo=DB.hrmConfig.locationGeo||{}; // per-location geofence store; synced via hrm_config.location_geo
  Object.keys(DB.hrmConfig.profiles||{}).forEach(_seedLeaveTypes);
  DB.users.forEach(_ensureHrm);
  _runAutoClose();
  _runMonthlyAccrual();
  _runCarryOver();
  saveDB();
}

/* ── Attendance status colors ── */
const ATT_COLOR={Present:'#10B981',Absent:'#F43F5E',Leave:'#8B5CF6',HalfDay:'#F59E0B',OffDay:'#9CA3AF',Holiday:'#0EA5E9',AutoClosed:'#EAB308',LeavePending:'#FBBF24'};
const ATT_LABEL={Present:'Present',Absent:'Absent',Leave:'On leave',HalfDay:'Half-day',OffDay:'Off-day',Holiday:'Public holiday',AutoClosed:'Auto-closed',LeavePending:'Leave (pending)'};
// Soft tint + readable ink per status — gives the attendance calendar a calm heatmap look
// instead of a wall of saturated colour. Present stays solid (it's the positive signal).
const ATT_SOFT={Present:'#10B981',Absent:'#FDECEC',Leave:'#F1ECFE',HalfDay:'#FEF4E5',OffDay:'#F1F3F6',Holiday:'#E7F5FC',AutoClosed:'#FEF8E6',LeavePending:'#FEF6E0'};
const ATT_INK={Present:'#FFFFFF',Absent:'#C1362B',Leave:'#5B2DBE',HalfDay:'#92560A',OffDay:'#7A8395',Holiday:'#075985',AutoClosed:'#866207',LeavePending:'#946112'};
function _m2hm(m){if(m==null)return'—';m=((m%1440)+1440)%1440;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');}

/* Compute the display status for a user on a date (no record = derive off/holiday/absent/leave) */
function _dayStatus(userId,date){
  const rec=attFor(userId,date);
  if(rec)return rec;
  const u=uById(userId);if(!u)return null;
  const off=new Set(u.hrm?.schedule?.offDays||[]);
  const dow=DAYS3[new Date(date+'T00:00:00').getDay()];
  const prof=userProfileId(u);
  const hol=(DB.holidays||[]).find(h=>h.profileId===prof&&h.date===date);
  // leave approved covering this date?
  const lv=(DB.leaveRequests||[]).find(r=>r.userId===userId&&r.status==='Approved'&&r.start<=date&&r.end>=date);
  // Bug 6: also surface PENDING (applied, not-yet-approved) leaves in a distinct amber state so the
  //   employee sees their applied leave on the calendar before it is approved.
  const pend=lv?null:(DB.leaveRequests||[]).find(r=>r.userId===userId&&r.status==='Pending'&&r.start<=date&&r.end>=date);
  if(hol)return{virtual:true,status:'Holiday',date,note:hol.name};
  if(off.has(dow))return{virtual:true,status:'OffDay',date};
  if(lv){const lt=ltById(lv.leaveTypeId);return{virtual:true,status:lv.halfDay?'HalfDay':'Leave',date,leaveType:lv.leaveTypeId,note:lt?lt.name:''};}
  if(pend){const lt=ltById(pend.leaveTypeId);return{virtual:true,status:'LeavePending',date,leaveType:pend.leaveTypeId,note:(lt?lt.name:'Leave')+' — pending approval'};}
  if(date<todayISO())return{virtual:true,status:'Absent',date};
  return null;
}

/* ── Resolve the geofence a user must satisfy to clock in.
   The fence lives ONLY on the user's assigned Location (DB.hrmConfig.locationGeo[locId]).
   Returns:
     {lat,lng,radius}  → an ACTIVE fence the GPS must satisfy.
     {misconfigured:true,reason} → assigned location exists but its geo is off/missing lat-lng.
     null              → user has no assigned location at all.
   Bug 1: the legacy profile-office fallback (activeProfile().office) is REMOVED — it was dead
   (seeded enabled:false and never written by saveHrmConfig) and silently bypassed the fence. ── */
function _activeGeofence(u){
  if(!u)return null;
  const locId=u.hrm?.locationId;
  if(locId){
    const g=(DB.hrmConfig?.locationGeo||{})[locId];
    if(g&&g.enabled&&g.lat!=null&&g.lng!=null)return{lat:g.lat,lng:g.lng,radius:g.radius||200};
    // Assigned to a location whose fence is disabled or missing coordinates → misconfigured,
    // NOT "no fence". Fail-closed treats this as a block (HR thinks it's enforced).
    return{misconfigured:true,reason:locId};
  }
  return null;
}

/* ════════ CLOCK IN / OUT ════════ */
// Shared FAIL-CLOSED geofence gate for clock-in AND clock-out (Bug 1, binding decision #3).
// Resolves the active geofence from the user's assigned Location. Behaviour:
//   • no assigned location            → BLOCK ("No office location configured — contact HR")
//   • assigned but fence misconfigured → BLOCK ("No office location configured — contact HR")
//   • fence active, GPS unavailable/denied/timeout → BLOCK (can't confirm location)
//   • GPS accuracy worse than the radius → BLOCK (a low-accuracy fix can falsely fall inside)
//   • GPS inside the radius           → onPass(geo)
// `verb` ('in'/'out') only swaps the wording.
// H4: `lenient` (clock-OUT after a real clock-in) NEVER traps the user. A mid-shift geofence change
//   (HR disables/blanks/deletes the location after clock-in) must not block the out-punch and force a
//   corrupted auto-close. In lenient mode a null/misconfigured fence is allowed (geo:null), and any GPS
//   failure/timeout is allowed too; the fence is still enforced only when it IS active AND GPS resolves
//   to a trustworthy in/outside answer. Clock-IN stays strictly fail-closed (lenient=false).
function _withGeofence(verb,onPass,lenient,retryFn){
  const gf=_activeGeofence(me());
  const word='clock '+verb;
  // W1.6: a non-lenient (clock-in) geofence failure should offer a Retry affordance that re-runs the
  // punch, instead of being a dead-end. `retryFn` is a JS string (e.g. "App.clockIn()") rendered into
  // a toast-with-action button. Falls back to a plain toast when no retry was provided.
  const _fail=(m)=>{if(retryFn&&!lenient)toastAction(m,'err',{label:'Retry',fn:retryFn,ms:8000});else toast(m,'err');};
  // Fail-closed (clock-in): no fence at all, or a misconfigured one, blocks the punch.
  if(!gf||gf.misconfigured){
    if(lenient){onPass(null);return;} // H4: fence changed mid-shift — let the user clock out
    toast('No office location configured — contact HR','err');return;
  }
  if(!navigator.geolocation){
    if(lenient){onPass(null);return;}
    _fail('Can\'t confirm your location to '+word+' — enable location access');return;
  }
  toast('Checking location…');
  navigator.geolocation.getCurrentPosition(
    pos=>{
      const radius=gf.radius||200;
      // Accuracy floor: a fix whose ± error exceeds the fence radius can't be trusted to be inside.
      if(pos.coords.accuracy!=null&&pos.coords.accuracy>radius){
        if(lenient){onPass(null);return;} // H4: don't trap a legitimate clock-out on a poor fix
        _fail('Can\'t confirm your location accurately enough to '+word+' (±'+Math.round(pos.coords.accuracy)+'m) — try again outdoors');return;
      }
      const d=_distM(pos.coords.latitude,pos.coords.longitude,gf.lat,gf.lng);
      if(d<=radius){onPass({lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:pos.coords.accuracy});}
      else{_fail('You must be inside the office area to '+word+' ('+Math.round(d)+'m away)');}
    },
    ()=>{
      if(lenient){onPass(null);return;} // H4: GPS denied/unavailable on clock-out — never trap
      _fail('Can\'t confirm your location to '+word+' — enable location access');
    },
    {enableHighAccuracy:true,timeout:8000,maximumAge:0}
  );
}

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.HRM_SIXDAY_PRORATE=HRM_SIXDAY_PRORATE;window.HRM_ANNUAL_MID=HRM_ANNUAL_MID;window.hlog=hlog;window._hrmNotify=_hrmNotify;window._hrmNotifPrefsDefault=_hrmNotifPrefsDefault;window._hnp=_hnp;window._hnpEmail=_hnpEmail;window._isoAdd=_isoAdd;window._addMonths=_addMonths;window._monthsBetween=_monthsBetween;window._r2=_r2;window._leaveYearOf=_leaveYearOf;window._leaveYearStart=_leaveYearStart;window._seedProfiles=_seedProfiles;window._seedLeaveTypes=_seedLeaveTypes;window.ltById=ltById;window._typesFor=_typesFor;window._balanceFor=_balanceFor;window._balanceReadonly=_balanceReadonly;window._balRemaining=_balRemaining;window._compOffRemaining=_compOffRemaining;window._isCompOffLt=_isCompOffLt;window._ltRemaining=_ltRemaining;window._workingDaysBetween=_workingDaysBetween;window.computeHours=computeHours;window._applyFlags=_applyFlags;window.attFor=attFor;window._distM=_distM;window._runAutoClose=_runAutoClose;window._runMonthlyAccrual=_runMonthlyAccrual;window._runCarryOver=_runCarryOver;window._birthdayOk=_birthdayOk;window._hrmInit=_hrmInit;window.ATT_COLOR=ATT_COLOR;window.ATT_LABEL=ATT_LABEL;window.ATT_SOFT=ATT_SOFT;window.ATT_INK=ATT_INK;window._m2hm=_m2hm;window._dayStatus=_dayStatus;window._activeGeofence=_activeGeofence;window._withGeofence=_withGeofence;
