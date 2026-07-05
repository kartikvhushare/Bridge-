
/* ═══════════════════════════════════════════════════════════════
   PERMISSIONS SYSTEM (frontend-only — NO Supabase, all on DB / u.hrm)
   - PERM_AREAS: single source of truth. Add an area = add one entry.
   - DB.roleProfiles: named permission bundles (object keyed by id).
   - u.hrm.roleProfileId: per-user assignment (null = base-role floor).
   - can()/scopeOf()/scopeFilter(): the resolver every gate calls.
   - _baseCan()/_baseScope(): back-compat shim = TODAY's exact access
     for any user with NO assigned profile. This is the safety net.
   ═══════════════════════════════════════════════════════════════ */
// `group` partitions the Access-Control editor into labelled sections (rendering only — does not
// affect can()/scope resolution). Every `actions` entry below is an action that is actually enforced
// by a can(area,action) gate somewhere in this file (verified by grep — see B2a matrix); the editor
// is fully data-driven from this list so a toggle exists for every gate the app checks.
const PERM_GROUPS=['People & Org','Leave & Attendance','Tasks & Tickets','Content','Insights','System'];
const PERM_AREAS=[
  {key:'dashboard',label:'Dashboard',desc:'The landing overview',actions:['view'],scoped:false,group:'System'},
  {key:'attendance',label:'Attendance',desc:'Clock-in/out records & calendar',actions:['view','edit','download'],scoped:true,group:'Leave & Attendance'},
  {key:'leaveRequests',label:'Leave — requests',desc:'Applying for and acting on leave',actions:['view','create','approve','download'],scoped:true,group:'Leave & Attendance'},
  {key:'leaveBalances',label:'Leave — balances',desc:"People's leave day balances",actions:['view','edit','grant'],scoped:true,group:'Leave & Attendance'},
  {key:'hrSettings',label:'HR settings',desc:'Leave policy, types, holidays, approval flows',actions:['view','edit'],scoped:false,group:'Leave & Attendance'},
  {key:'employees',label:'Users',desc:'The people directory — create, edit, deactivate people, assign managers',actions:['view','create','edit','delete','deactivate','assignManager','assignRole','assign','manage'],scoped:true,group:'People & Org'},
  {key:'hierarchy',label:'Hierarchy / Org chart',desc:'The reporting tree',actions:['view'],scoped:true,group:'People & Org'},
  {key:'teamview',label:'Team view',desc:'The Team page — live checklist status of the team',actions:['view'],scoped:false,group:'People & Org'},
  {key:'checklists',label:'Checklists',desc:'The checklist system',actions:['view','create','edit','assign','approve'],scoped:true,group:'Tasks & Tickets'},
  {key:'allChecklists',label:'All Checklists',desc:'Browse every checklist across the company',actions:['view'],scoped:false,group:'Tasks & Tickets'},
  {key:'questions',label:'Questions',desc:'The questions feature',actions:['view','manage'],scoped:false,group:'Tasks & Tickets'},
  {key:'tickets',label:'Tickets',desc:'Issue tickets',actions:['view','create','manage'],scoped:true,group:'Tasks & Tickets'},
  {key:'documentsOrg',label:'Documents (organization)',desc:'Shared dept/location files',actions:['view','create','delete','download','approve'],scoped:true,group:'Content'},
  {key:'documentsPersonal',label:'Personal documents',desc:'Files on a person\'s profile',actions:['view','create','delete','download'],scoped:true,group:'Content'},
  {key:'analytics',label:'Analytics',desc:'Operational analytics dashboard (checklists, compliance, tickets)',actions:['view'],scoped:false,group:'Insights'},
  {key:'reports',label:'HRM Analytics',desc:'HR analytics dashboard & CSV exports',actions:['view','download'],scoped:true,group:'Insights'},
  {key:'okr',label:'OKRs',desc:'Hierarchical objectives (L0 → L1 → L2) with owners, targets & scheduled check-ins',actions:['view','create','edit','manage'],scoped:false,group:'Insights'},
  {key:'announcements',label:'Announcements',desc:'Company-wide messages',actions:['view','create'],scoped:false,group:'Content'},
  {key:'locations',label:'Locations',desc:'Offices and GPS boundary',actions:['view','create','edit','manage'],scoped:false,group:'System'},
  {key:'departments',label:'Departments',desc:'Department list',actions:['view','create','edit'],scoped:false,group:'System'},
  {key:'approvals',label:'Approvals inbox',desc:'The unified approvals page (what they can act on is still per-area)',actions:['view'],scoped:false,group:'System'},
  {key:'scheduling',label:'Shifts / Roster',desc:'The weekly shift roster',actions:['view','manage'],scoped:true,group:'Leave & Attendance'},
  {key:'overtime',label:'Overtime',desc:'Log extra hours; weekly review, pay or time-in-lieu',actions:['view','submit','approve'],scoped:true,group:'Leave & Attendance'},
  {key:'lifecycle',label:'Lifecycle flows',desc:'Onboarding, probation & exit checklists',actions:['view','manage'],scoped:true,group:'People & Org'},
  {key:'discipline',label:'Discipline',desc:'Warnings on file (12-month retention)',actions:['view','manage'],scoped:true,group:'People & Org'},
  {key:'letters',label:'Letters',desc:'Request, approve & issue HR letters from templates',actions:['view','create','approve','issue'],scoped:true,group:'Content'},
  {key:'payroll',label:'Payroll',desc:'Runs, verification, payslips, WPS export',actions:['view','verify','run','approve','finalize','rollback','download'],scoped:false,group:'Payroll'},
  {key:'surveys',label:'Surveys',desc:'Pulse & performance surveys — answer and (HR) manage',actions:['view','submit','manage'],scoped:false,group:'People & Org'},
  {key:'audit',label:'Audit / Activity log',desc:'History of actions',actions:['view'],scoped:false,group:'System'},
  {key:'settings',label:'Settings',desc:'App settings',actions:['view','edit'],scoped:false,group:'System'},
  {key:'accessControl',label:'Access Control',desc:'The role-profile system itself',actions:['view','manage'],scoped:false,group:'System'},
];
// Plain-language labels used by the Access Control editor + live summary.
const PERM_ACTION_LABEL={view:'View',create:'Create',edit:'Edit',delete:'Delete',deactivate:'Deactivate',approve:'Approve',download:'Download / Export',manage:'Manage',manageSettings:'Manage settings',assign:'Assign',assignRole:'Assign role profile',assignManager:'Assign manager',grant:'Grant / Remove',submit:'Submit',upload:'Upload',manageGeofence:'Manage geofence',issue:'Issue',verify:'Verify',run:'Run',finalize:'Finalize',rollback:'Roll back'};
const SCOPE_ORDER=['none','self','team','department','location','everyone'];
const SCOPE_LABEL={none:'None',self:'Only their own',team:'Their team',department:'Their department',location:'Their office',everyone:'Everyone'};
const _areaByKey=k=>PERM_AREAS.find(a=>a.key===k);

// ── Seed built-in roles (idempotent; version-stamped so v3 upgrades older seeds in place) ──
// ROLES-FIRST MODEL (v3): Access Control creates ROLES (full toggle bundles); every user is
// ASSIGNED one role (u.hrm.roleProfileId) and sees only what it grants. Per-user AREA OVERRIDES
// (u.hrm.perms) sit on top for individual exceptions and beat the role — even for a Super Admin.
function _seedRoleProfiles(){
  if(!DB.roleProfiles||typeof DB.roleProfiles!=='object')DB.roleProfiles={};
  const A=(scope,...acts)=>({scope,actions:acts.reduce((o,a)=>(o[a]=true,o),{})});
  const allOf=(exceptAC)=>{const p={};PERM_AREAS.forEach(a=>{if(exceptAC&&a.key==='accessControl')return;p[a.key]={scope:a.scoped?'everyone':'none',actions:a.actions.reduce((o,act)=>(o[act]=true,o),{})};});return p;};
  const presets={
    superadmin:{id:'superadmin',name:'Super Admin',description:'Everything, including Access Control itself.',builtin:true,perms:allOf(false)},
    admin:{id:'admin',name:'Administrator',description:'Full operational access across the whole organization — everything except Access Control.',builtin:true,perms:allOf(true)},
    manager:{id:'manager',name:'Team Lead / Manager',description:'Sees and acts on their team: approvals, checklists, tickets, team OKRs, reports.',builtin:true,perms:{
      dashboard:A('none','view'),
      attendance:A('team','view','download'),
      leaveRequests:A('team','view','create','approve','download'),
      leaveBalances:A('team','view'),
      employees:A('team','view'),
      teamview:A('none','view'),
      hierarchy:A('team','view'),
      checklists:A('team','view','create','edit','assign','approve'),
      questions:A('none','view','manage'),
      tickets:A('team','view','create','manage'),
      documentsPersonal:A('self','view','create','download'),
      reports:A('team','view'),
      announcements:A('none','view'),
      approvals:A('none','view'),
      okr:A('none','view','create','edit','manage'),
      analytics:A('none','view'),
      scheduling:A('team','view','manage'),
      overtime:A('team','view','submit','approve'),
      lifecycle:A('team','view'),
      discipline:A('team','view'),
      letters:A('self','view','create'),
      surveys:A('none','view','submit'),
    }},
    hr:{id:'hr',name:'HR',description:'The HR modules: attendance, leave & balances, HR settings, HRM analytics, document approvals.',builtin:true,perms:{
      dashboard:A('none','view'),
      attendance:A('everyone','view','edit','download'),
      leaveRequests:A('everyone','view','create','approve','download'),
      leaveBalances:A('everyone','view','edit','grant'),
      hrSettings:A('none','view','edit'),
      employees:A('everyone','view'),
      hierarchy:A('everyone','view'),
      checklists:A('self','view'),
      tickets:A('self','view','create'),
      documentsOrg:A('everyone','view','approve'),
      documentsPersonal:A('self','view','create','download'),
      reports:A('everyone','view','download'),
      announcements:A('none','view','create'),
      approvals:A('none','view'),
      okr:A('none','view'),
      scheduling:A('everyone','view','manage'),
      overtime:A('everyone','view','submit','approve'),
      lifecycle:A('everyone','view','manage'),
      discipline:A('everyone','view','manage'),
      letters:A('everyone','view','create','approve','issue'),
      payroll:{scope:'none',actions:{view:true,verify:true,run:true,download:true}},
      surveys:A('none','view','submit','manage'),
    }},
    basic:{id:'basic',name:'Basic Employee',description:'A standard employee — their own checklists, attendance, leave and tickets.',builtin:true,perms:{
      dashboard:A('none','view'),
      attendance:A('self','view'),
      leaveRequests:A('self','view','create'),
      leaveBalances:A('self','view'),
      hierarchy:A('self','view'),
      checklists:A('self','view'),
      tickets:A('self','view','create'),
      documentsPersonal:A('self','view','create','download'),
      announcements:A('none','view'),
      okr:A('none','view'),
      scheduling:A('self','view'),
      overtime:A('self','view','submit'),
      letters:A('self','view','create'),
      surveys:A('none','view','submit'),
    }},
  };
  const V='5'; // v5: reports scoped (HRM analytics shows team/everyone), surveys
  Object.values(presets).forEach(p=>{
    const cur=DB.roleProfiles[p.id];
    if(!cur||(cur.builtin&&cur._v!==V)){p._v=V;DB.roleProfiles[p.id]=p;} // upgrade built-ins once; never touch custom roles
  });
}

// ── Resolver v3 (roles-first, fully toggle-driven) ──
// Priority: 1) per-user AREA OVERRIDE (u.hrm.perms — beats everything, even Super Admin)
//           2) ASSIGNED ROLE (u.hrm.roleProfileId → DB.roleProfiles)
//           3) legacy fallbacks for anyone not yet migrated (Admin default-all, HR floor, base shim).
function _myProfile(){const u=me();if(!u)return null;const id=u.hrm?.roleProfileId;return id?(DB.roleProfiles?.[id]||null):null;}
function _roleOf(u){const id=u&&u.hrm&&u.hrm.roleProfileId;return id?(DB.roleProfiles?.[id]||null):null;}
function _userPermArea(u,area){const p=u&&u.hrm&&u.hrm.perms;return(p&&typeof p==='object'&&p[area]&&typeof p[area]==='object')?p[area]:null;}
function can(area,action){
  const u=me();if(!u)return false;
  const o=_userPermArea(u,area);
  if(o)return !!(o.actions&&o.actions[action]);
  const rp=_roleOf(u);
  if(rp)return !!(rp.perms&&rp.perms[area]&&rp.perms[area].actions&&rp.perms[area].actions[action]);
  if(isAdmin())return true;
  if(_hrFloor(area,action))return true;
  return _baseCan(area,action);
}
// Evaluate for ANOTHER user (Access Control editor + lockout guard).
function canUser(u,area,action){
  if(!u)return false;
  const o=_userPermArea(u,area);
  if(o)return !!(o.actions&&o.actions[action]);
  const rp=_roleOf(u);
  if(rp)return !!(rp.perms&&rp.perms[area]&&rp.perms[area].actions&&rp.perms[area].actions[action]);
  return u.role==='Admin';
}
// Lockout guard: would ANY other active user still hold accessControl.<action> if `uid2` loses it?
function _acLockoutSafe(uid2,action){
  return (DB.users||[]).some(x=>x.id!==uid2&&x.status==='Active'&&canUser(x,'accessControl',action));
}
// Which built-in role matches a user's legacy standing? (migration + base-role changes)
function _roleIdForUser(u){
  if(u.role==='Admin')return 'superadmin';
  if(u.role==='SubAdmin')return 'admin';
  if(u.hrm&&u.hrm.isHR===true)return 'hr';
  if((DB.users||[]).some(x=>x.managerId===u.id&&x.id!==u.id))return 'manager';
  return 'basic';
}
/* ── One-time v3 migration: assign everyone a ROLE from their current standing, translate the old
   personal grants (questionsAccess / docAccess) into small per-user overrides, and clear the v2
   full baked maps so the ROLE is what drives access from now on. Idempotent via u.hrm.permsV3. ── */
function _permsV3Migrate(){
  let n=0;
  (DB.users||[]).forEach(u=>{
    if(!u)return;_ensureHrm(u);
    if(u.hrm.permsV3)return;
    if(!u.hrm.roleProfileId||!DB.roleProfiles[u.hrm.roleProfileId])u.hrm.roleProfileId=_roleIdForUser(u);
    const ov={};
    if(u.questionsAccess&&u.hrm.roleProfileId==='basic')ov.questions={scope:'none',actions:{view:true,manage:false}};
    const da=u.docAccess||{};
    const anyDept=Object.values(da.departments||{}).some(p=>p&&p.view);
    const anyLoc=Object.values(da.locations||{}).some(p=>p&&p.view);
    if((anyDept||anyLoc)&&['basic','manager','hr'].includes(u.hrm.roleProfileId)){
      ov.documentsOrg={scope:'everyone',actions:{view:true,create:true,download:true,delete:false,approve:u.hrm.roleProfileId==='hr'}};
      if(anyDept)ov.departments={scope:'none',actions:{view:true,create:false,edit:false}};
      if(anyLoc)ov.locations={scope:'none',actions:{view:true,create:false,edit:false,manage:false}};
    }
    u.hrm.perms=Object.keys(ov).length?ov:null; // clear v2 baked map — the role drives now
    u.hrm.permsBaked=1;u.hrm.permsV3=1;n++;
  });
  if(n){console.log('[perms] v3 roles assigned to',n,'user(s)');saveDB();}
}
// HR-role floor — legacy fallback for users with NO assigned role (pre-migration edge only).
function _hrFloor(area,action){
  if(!isHR())return false;
  if(area==='leaveBalances')return action==='view'||action==='edit'||action==='grant';
  if(area==='hrSettings')return action==='view'||action==='edit';
  if(area==='leaveRequests')return action==='view'||action==='approve';
  if(area==='attendance')return action==='view'||action==='edit';
  if(area==='documentsOrg')return action==='approve';
  return false;
}
// scopeOf(area) → 'none'|'self'|'team'|'department'|'location'|'everyone'
function scopeOf(area){
  const u=me();if(!u)return 'none';
  const o=_userPermArea(u,area);
  if(o)return o.scope||'none';
  const rp=_roleOf(u);
  if(rp){const a=rp.perms&&rp.perms[area];return a?(a.scope||'none'):'none';}
  if(isAdmin())return 'everyone';
  return _baseScope(area);
}
// scopeFilter(area) → predicate(userId)=>bool ("can I see this person under <area>'s scope").
function scopeFilter(area){
  const sc=scopeOf(area),myId=S.uid,u=me();
  if(sc==='none')return ()=>false;
  if(sc==='everyone')return id=>{const t=uById(id);return !!t&&(t.role!=='Admin'||isAdmin());};
  if(sc==='self')return id=>id===myId;
  if(sc==='team'){const set=new Set([myId,...subTree(myId).map(x=>x.id)]);return id=>set.has(id);}
  if(sc==='department'){const d=u?.department;return id=>!!d&&uById(id)?.department===d;}
  if(sc==='location'){const l=u?.hrm?.locationId;return id=>!!l&&uById(id)?.hrm?.locationId===l;}
  return ()=>false;
}
function scopedUsers(area){const f=scopeFilter(area);return DB.users.filter(u=>f(u.id));}

// ── Legacy base-role shim (only reachable for users with NO role assigned — pre-migration) ──
const _canReportLegacy=()=>{const p=me()?.hrm?.reportPerms||{};return Object.values(p).some(Boolean);};
function _baseCan(area,action){
  const sub=isSubAdmin(),mgr=isMgr(),hr=isHR(),q=!!me()?.questionsAccess,doc=hasDocAccess();
  switch(area){
    case 'dashboard':return true;
    case 'attendance':return action==='view'?true:(sub||hr);
    case 'leaveRequests':return action==='approve'?(sub||mgr||hr):(action==='download'?(sub||hr):true);
    case 'leaveBalances':return action==='view'?(sub||mgr||hr):((action==='grant'||action==='edit')?hr:false);
    case 'hrSettings':return hr;
    case 'employees':
      if(action==='deactivate'||action==='assignManager')return sub;
      if(action==='assignRole')return false;
      return action==='view'?(sub||mgr):sub;
    case 'hierarchy':return true;
    case 'scheduling':return action==='view'?true:(sub||mgr||hr);
    case 'checklists':return action==='view'?true:(sub||mgr);
    case 'analytics':return (sub||mgr||hr);
    case 'questions':return q||sub;
    case 'tickets':return action==='manage'?(sub||mgr):true;
    case 'documentsOrg':return action==='approve'?hr:doc;
    case 'documentsPersonal':return true;
    case 'reports':return (action==='download')?(hr||_canReportLegacy()):(hr||mgr||_canReportLegacy());
    case 'announcements':return action==='view'?true:hr;
    case 'locations':return action==='view'?doc:false;
    case 'departments':return doc;
    case 'teamview':return sub||mgr;
    case 'allChecklists':return sub;
    case 'approvals':return sub||mgr||hr;
    case 'audit':return false;
    case 'settings':return false;
    case 'accessControl':return false;
    case 'okr':
      if(action==='view')return sub||mgr||(DB.okrs||[]).some(o=>o.ownerId===S.uid);
      return sub||mgr;
  }
  return false;
}
function _baseScope(area){
  if(area==='employees')return 'team';
  if(isSubAdmin())return 'everyone';
  if(isHR()&&['attendance','leaveRequests','leaveBalances','reports','scheduling','expenses'].includes(area))return 'everyone';
  if(isMgr())return 'team';
  return 'self';
}

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.PERM_GROUPS=PERM_GROUPS;window.PERM_AREAS=PERM_AREAS;window.PERM_ACTION_LABEL=PERM_ACTION_LABEL;window.SCOPE_ORDER=SCOPE_ORDER;window.SCOPE_LABEL=SCOPE_LABEL;window._areaByKey=_areaByKey;window._seedRoleProfiles=_seedRoleProfiles;window._myProfile=_myProfile;window._roleOf=_roleOf;window._userPermArea=_userPermArea;window.can=can;window.canUser=canUser;window._acLockoutSafe=_acLockoutSafe;window._roleIdForUser=_roleIdForUser;window._permsV3Migrate=_permsV3Migrate;window._hrFloor=_hrFloor;window.scopeOf=scopeOf;window.scopeFilter=scopeFilter;window.scopedUsers=scopedUsers;window._canReportLegacy=_canReportLegacy;window._baseCan=_baseCan;window._baseScope=_baseScope;
