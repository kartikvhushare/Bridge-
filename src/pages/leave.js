

/* ════════ LEAVE PAGE ════════ */
function leavePage(){
  // DUP-1 (D-C1): Leave is now MY-LEAVE ONLY. Team/HR leave approvals live solely in the
  // unified Approvals inbox — the old mgr/hr sub-tabs (_leaveApprovalList) are retired here.
  // The decision handlers (decideLeave, _canActOn, _leaveApprovalList) stay defined; the inbox
  // uses them. We show a one-line pointer to Approvals when this user has pending team/HR leave.
  const body=_myLeaveView();
  return `<div class="fade">${hdr('Leave','Apply for leave and track your balances',btnP('Apply for leave','App.applyLeave()','plus'))}${body}</div>`;
}
function _isMgrApprover(r){if(r.userId===S.uid)return false;const emp=uById(r.userId);if(!emp)return false;return isAdmin()||emp.managerId===S.uid||_underOn(r.userId,S.uid,r.start);}

/* ════════ DYNAMIC APPROVAL FLOWS (§2) — frontend-only ════════ */
// A flow is an ordered array of stage objects:
//   {id, type:'manager'}                          → the requester's date-aware manager
//   {id, type:'role', role:'hr'}                  → any active HR user (Super Admin excluded from queue but universal approver)
//   {id, type:'user', userId:'<id>'}             → a specific named approver
// Back-compat: old `prof.approvalChain=['manager','hr']` is migrated on read by _normalizeFlow().
function _stageLabel(stage){
  if(!stage)return '';
  if(stage.type==='manager')return 'Manager';
  if(stage.type==='role')return (stage.role==='hr')?'HR':esc(stage.role||'Role');
  if(stage.type==='user'){const u=uById(stage.userId);return u?fullName(u):'Specific person';}
  return '';
}
// Migrate a profile's legacy approvalChain → approvalFlow shape (idempotent, non-mutating return).
function _normalizeFlow(prof){
  if(prof&&Array.isArray(prof.approvalFlow)&&prof.approvalFlow.length)return prof.approvalFlow;
  const chain=(prof&&Array.isArray(prof.approvalChain)&&prof.approvalChain.length)?prof.approvalChain:['manager','hr'];
  return chain.map((s,i)=>s==='manager'?{id:'st'+i,type:'manager'}:{id:'st'+i,type:'role',role:'hr'});
}
// Resolve the active flow for a request: per-leave-type override (lt.approvalFlow) → profile flow.
function _flowFor(req){
  const lt=req&&req.leaveTypeId?ltById(req.leaveTypeId):null;
  if(lt&&Array.isArray(lt.approvalFlow)&&lt.approvalFlow.length)return lt.approvalFlow;
  const emp=req?uById(req.userId):null;
  const prof=DB.hrmConfig?.profiles?.[userProfileId(emp)]||activeProfile();
  return _normalizeFlow(prof);
}
// The stage object for stage N of a request (uses the snapshot stored at submit time when present).
function _reqFlow(req){return (Array.isArray(req.flow)&&req.flow.length)?req.flow:_flowFor(req);}
function _reqStage(req){const f=_reqFlow(req);const i=(req.stageIndex!=null)?req.stageIndex:0;return f[i]||null;}
// Returns a PURE predicate(userId)=>boolean: "is this user a designated approver for `stage` of `req`?"
// (Data-only — used both for notification fan-out and for action gating. Super Admin's universal
//  approver power is applied separately in _canActOn, never baked into this predicate.)
function _stageApprover(req,stageIndexOrStage){
  let stage=stageIndexOrStage;
  if(typeof stageIndexOrStage==='number'){const f=_reqFlow(req);stage=f[stageIndexOrStage]||null;}
  if(!stage)return ()=>false;
  // C1: manager stage = ANY active manager in the requester's upward chain (restores skip-level/ancestor
  //   approval and avoids stranding when the direct manager is inactive/deleted). Mirrors the old
  //   _isMgrApprover (_underOn). Valid approver ⇔ requester is in the approver's subtree on req.start.
  if(stage.type==='manager')return id=>{const a=uById(id);if(!a||a.status!=='Active')return false;return _underOn(req.userId,id,req.start);};
  if(stage.type==='user')return id=>!!stage.userId&&id===stage.userId;
  if(stage.type==='role'&&stage.role==='hr')return id=>!!(uById(id)?.hrm?.isHR)&&uById(id)?.role!=='Admin';
  return ()=>false;
}
// Can the CURRENT user act on the current stage of req? (permission + stage match; Admin universal; never own request)
function _canActOn(req){
  if(req.userId===S.uid)return false; // M7 self-approval guard
  if(isAdmin())return true; // RESOLVED: Super Admin is a universal approver at every stage
  // H2: a user explicitly named/resolved as THIS stage's approver is authorized for this stage by
  //   definition — evaluate the stage predicate BEFORE the global approve permission so a plain
  //   employee picked as a "Specific person" / manager-chain approver can act (only on this stage).
  if(_stageApprover(req,(req.stageIndex!=null?req.stageIndex:0))(S.uid))return true;
  if(!can('leaveRequests','approve'))return false;
  // LV-3: stranded escalation — when a stage has NO active resolvable approver, let an active HR user
  //   clear it too (Super Admin already can via isAdmin above) so the flow can't permanently strand.
  if(me()?.hrm?.isHR&&_stageStranded(req))return true;
  return false;
}
// Classify a pending request's current stage for the two-tab UI: manager-type → 'manager' tab, else → 'hr' tab.
function _stageTab(req){const st=_reqStage(req);return (st&&st.type==='manager')?'manager':'hr';}
// LV-3: a stage is STRANDED when no ACTIVE, non-Super-Admin user can satisfy its approver predicate
//   (role:'hr' with no active HR; user:'<id>' pointing at a missing/inactive user; a manager stage whose
//   whole upward chain is inactive/deleted). Such requests are invisible to everyone except a Super Admin,
//   so we surface them in the HR/Admin queue with a clear "needs admin" label instead of silently stranding.
function _stageStranded(req){
  if(!req||req.status!=='Pending')return false;
  const pred=_stageApprover(req,(req.stageIndex!=null?req.stageIndex:0));
  return !(DB.users||[]).some(x=>x.status==='Active'&&x.role!=='Admin'&&pred(x.id));
}
// Bug 5 (binding decision #5): terminal escalation fallback. When a stage's approver predicate
//   matches ZERO active users, route the request to all active HR users AND all active Admins
//   (never the submitter), set req.needsAdmin so the UI labels it, and notify them. Returns the
//   number of fallback approvers reached — 0 means NOBODY can act (caller hard-toasts the submitter).
function _escalateStranded(req,msg){
  const submitterId=req.userId;
  const fallback=(DB.users||[]).filter(x=>x.status==='Active'&&x.id!==submitterId&&(x.role==='Admin'||x.hrm?.isHR===true));
  if(fallback.length){
    req.needsAdmin=true;
    if(_hnp('inapp_hrm_leave_submitted'))fallback.forEach(a=>_hrmNotify(a.id,msg,'leave'));
    // C3: email HR/Admin the escalation with structured detail (gated by the approval-routing email toggle).
    if(_hnpEmail('email_hrm_leave_submitted')){const _emp=uById(submitterId),_lt=ltById(req.leaveTypeId);fallback.forEach(a=>queueEmail('hrm_leave_escalated',a.id,null,req.start,{user_name:fullName(_emp),leave_type:_lt?_lt.name:'leave',start_date:fmtD(req.start),end_date:fmtD(req.end),working_days:req.workingDays+(req.workingDays===1?' day':' days')}));}
  }
  return fallback.length;
}

// ── B3: UNIFIED APPROVALS INBOX (Approach B = view layer) ─────────────────────────────
// Read-only adapter: reads pending/decided items from each EXISTING approval source and
// normalises them to a common shape. Decisions still route back to the NATIVE handlers
// (decideLeave / _decideApprove / _decideReject) so all reservation/notify/escalation
// logic is preserved. NO table migration. Scope mirrors each source's own visibility, so
// the inbox never widens what the user can already see/act on.
// Normalised item: {id,type,requestedBy,assignedTo,subject,payload,status,decidedBy,
//   decidedAt,location,dept,_src:{coll,id}}  where type ∈ leave|submission|edit|document|
//   onboarding. (document/onboarding are wired-but-empty until those flows are built.)
function _approvalInbox(){
  const items=[];
  // (a) LEAVE — same gate the leave manager/HR tabs use (_canActOn, plus stranded for HR/Admin).
  const _canSeeStranded=isAdmin()||(can('leaveRequests','approve')&&!!me()?.hrm?.isHR);
  (DB.leaveRequests||[]).forEach(r=>{
    const pending=r.status==='Pending';
    const actionable=_canActOn(r)||(_canSeeStranded&&_stageStranded(r)&&r.userId!==S.uid);
    // Decided rows: surface the ones this user decided (mgr/hr decision recorded) or, for
    // elevated users, the ones in their scope — keep it conservative: only show decided
    // leave the actor could have acted on (same predicate, status relaxed).
    if(pending){if(!actionable)return;}
    else{ if(!(isAdmin()||((can('leaveRequests','approve'))&&me()?.hrm?.isHR)||(r.mgrAt&&_stageApprover(r,0)(S.uid)) ))return; }
    const emp=uById(r.userId);const lt=ltById(r.leaveTypeId);
    items.push({
      id:'lv-'+r.id, type:'leave', requestedBy:r.userId, assignedTo:null,
      subject:(lt?lt.name:'Leave')+' · '+fmtD(r.start)+'→'+fmtD(r.end)+' ('+r.workingDays+'d)',
      payload:r, status:r.status, decidedBy:null,
      decidedAt:(r.hrAt||r.mgrAt||null),
      location:emp?.location||'', dept:emp?.department||'',
      _src:{coll:'leaveRequests',id:r.id}
    });
  });
  // (b) SUBMISSION + EDIT approvals — same scope as approvalsPage (3661): admin sees all,
  //     others see their subTree + own.
  const _apprScope=isAdmin()?(DB.approvals||[]):(DB.approvals||[]).filter(a=>subTree(S.uid).some(u=>u.id===a.requesterId)||a.requesterId===S.uid);
  _apprScope.forEach(a=>{
    const u=uById(a.requesterId);if(!u)return;
    const c=clById(a.checklistId);
    const isEdit=a.type==='Edit Request';
    // Normalise the native statuses: 'Used' (resubmitted edit) reads as Approved for filtering.
    const st=a.status==='Used'?'Approved':a.status;
    items.push({
      id:'ap-'+a.id, type:isEdit?'edit':'submission', requestedBy:a.requesterId, assignedTo:u.managerId||null,
      subject:(c?.name||'Checklist')+(a.date?' · '+fmtD(a.date):''),
      payload:a, status:st, decidedBy:null, decidedAt:null,
      location:u.location||'', dept:u.department||'',
      _src:{coll:'approvals',id:a.id}
    });
  });
  // (c) DOCUMENT approvals — only flagged org docs (approvalStatus set) enter the inbox. Pending
  //     rows are visible to org-doc approvers (not the uploader); decided rows surface to the same
  //     pool plus the uploader (read-only). Legacy docs (approvalStatus null) never appear.
  const _canApprDoc=can('documentsOrg','approve');
  (DB.documents||[]).forEach(d=>{
    if(!d.approvalStatus)return; // legacy / no-approval docs
    const up=uById(d.uploadedBy);
    const st=d.approvalStatus==='approved'?'Approved':d.approvalStatus==='rejected'?'Rejected':'Pending';
    const isApprover=_canApprDoc&&d.uploadedBy!==S.uid;
    if(st==='Pending'){if(!isApprover)return;}            // pending → approvers only
    else{if(!isApprover&&d.uploadedBy!==S.uid)return;}     // decided → approver pool + the uploader
    items.push({
      id:'doc-'+d.id, type:'document', requestedBy:d.uploadedBy, assignedTo:d.approverId||null,
      subject:d.name+' · '+(up?fullName(up):(d.uploaderName||'Unknown')),
      payload:{...d,createdAt:d.uploadedAt}, status:st,
      decidedBy:d.decidedBy||null, decidedAt:d.decidedAt||null,
      location:up?.hrm?.locationId||'', dept:up?.department||'',
      _src:{coll:'documents',id:d.id}
    });
  });
  // (e) OVERTIME — pending entries for people in my overtime scope (approve = pay by default;
  //     open the Overtime page for the time-in-lieu option).
  if(can('overtime','approve')){
    const fOT=scopeFilter('overtime');
    (DB.overtime||[]).forEach(o=>{
      if(o.userId===S.uid)return;
      const st=o.status==='Approved'?'Approved':o.status==='Rejected'?'Rejected':'Pending';
      if(st==='Pending'&&!fOT(o.userId))return;
      if(st!=='Pending'&&o.decidedBy!==S.uid&&!fOT(o.userId))return;
      const u=uById(o.userId);
      items.push({id:'ot-'+o.id,type:'overtime',requestedBy:o.userId,assignedTo:null,
        subject:(u?fullName(u):'—')+' · '+o.hours+'h on '+fmtS(o.date),
        payload:{...o,createdAt:o.createdAt},status:st,decidedBy:o.decidedBy||null,decidedAt:o.decidedAt||null,
        location:'',dept:u?.department||'',_src:{coll:'overtime',id:o.id}});
    });
  }
    // (SOP and Expense approval mappers removed — those features were retired.)
  return items;
}
// Single number for the nav badge: every pending decision actionable by this user, all types.
function _approvalPendingCount(){return _approvalInbox().filter(x=>x.status==='Pending').length;}

// B1: resolve the DISPLAY NAMES of the active users who can approve stage `i` of `req` (reuses the
//   same _stageApprover predicate so the names can never drift from who can actually act). Excludes the
//   requester and inactive/Super-Admin users; returns a short, human label like "Priya" / "HR team".
function _stageApproverNames(req,i){
  const f=_reqFlow(req);const stage=f[i]||null;if(!stage)return '';
  if(stage.type==='user'){const u=uById(stage.userId);return u?fullName(u):'(unassigned)';}
  const pred=_stageApprover(req,i);
  const names=(DB.users||[]).filter(x=>x.status==='Active'&&x.role!=='Admin'&&x.id!==req.userId&&pred(x.id)).map(fullName);
  if(!names.length)return stage.type==='role'?'HR team':'no approver';
  if(names.length<=2)return names.join(' or ');
  return names.slice(0,2).join(', ')+' +'+(names.length-2)+' more';
}
// B1: compact approval-progress strip shown to the APPLICANT on their own leave card. Walks the request's
//   snapshot flow and classifies each stage as done / current / upcoming / rejected, naming the approver(s).
function _leaveChainView(r){
  const flow=_reqFlow(r);if(!Array.isArray(flow)||!flow.length)return '';
  const curIdx=(r.stageIndex!=null?r.stageIndex:0);
  const rejected=r.status==='Rejected', approved=r.status==='Approved';
  const rows=flow.map((stage,i)=>{
    const label=_stageLabel(stage)||'Stage';
    let state,icon,col,note='';
    if(rejected&&i===curIdx){state='rejected';icon=ic('x','w-3.5 h-3.5');col='#DC2626';}
    else if(approved||i<curIdx){state='done';icon=ic('check','w-3.5 h-3.5');col='#059669';}
    else if(i===curIdx&&r.status==='Pending'){state='current';icon='●';col='#D97706';}
    else{state='upcoming';icon='○';col='#9CA3AF';}
    // Per-stage note (manager note on the manager-type stage, HR note otherwise) for done/rejected stages.
    const sNote=(stage.type==='manager')?r.mgrNote:r.hrNote;
    if((state==='done'||state==='rejected')&&sNote)note=`<div style="font-size:11px;color:#6B7280;margin-top:1px">“${esc(sNote)}”</div>`;
    const names=_stageApproverNames(r,i);
    const suffix=state==='current'?` — pending on ${esc(names)}`
      :state==='upcoming'?` — upcoming${r.needsAdmin&&i===curIdx?'':''}`
      :state==='rejected'?` — rejected`
      :` — approved`;
    return `<div style="display:flex;gap:8px;align-items:flex-start;padding:3px 0">
      <span style="color:${col};font-weight:800;line-height:1.5;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;width:16px;height:21px">${icon}</span>
      <div style="min-width:0"><span style="font-size:12px;font-weight:700;color:#374151">Stage ${i+1} · ${esc(label)}${names&&state!=='current'?` (${esc(names)})`:''}</span><span style="font-size:12px;color:${col};font-weight:600">${suffix}</span>${note}</div>
    </div>`;
  }).join('');
  // Escalation banner: a pending request with no resolvable approver was routed to HR/Admins.
  const escal=(r.status==='Pending'&&r.needsAdmin)?`<div style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:#B45309;background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:5px 8px;margin-top:6px">${ic('alert','w-3.5 h-3.5')}Escalated to HR / Admin — no designated approver for this stage.</div>`:'';
  // Final summary line.
  let fin='';
  if(approved){const last=flow[flow.length-1];const who=_stageApproverNames(r,flow.length-1);const at=r.hrAt||r.mgrAt;
    fin=`<div style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:#059669;margin-top:6px">${ic('check','w-3.5 h-3.5')}Approved${who?(' by '+esc(who)):''}${at?(' on '+fmtD(at.slice(0,10))):''}</div>`;}
  else if(rejected){const who=_stageApproverNames(r,curIdx);const at=r.hrAt||r.mgrAt;
    fin=`<div style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:#DC2626;margin-top:6px">${ic('x','w-3.5 h-3.5')}Rejected${who?(' by '+esc(who)):''}${at?(' on '+fmtD(at.slice(0,10))):''}</div>`;}
  return `<div style="margin-top:8px;border-top:1px solid #F3F4F6;padding-top:8px"><div style="font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--c-text-3);margin-bottom:4px">Approval progress</div>${rows}${escal}${fin}</div>`;
}

function _myLeaveView(){
  const u=me();const prof=userProfileId(u);
  const types=_typesFor(prof).filter(t=>t.enabled);
  const yr=_leaveYearOf(u,todayISO());
  const cards=types
    // Bug 2: comp-off is HR-managed only (granted/removed in HR Config → Comp-off) and is never
    //   applied-for in the employee flow — so its balance card is removed from the employee view.
    .filter(lt=>!_isCompOffLt(lt))
    .map(lt=>{
    const b=_balanceReadonly(u.id,lt.id,yr);
    const rem=_balRemaining(b);const ent=_r2((b.entitled||0)+(b.carriedIn||0));
    const pct=ent>0?Math.min(100,Math.round((rem/ent)*100)):0;
    const _acc=pct>50?'var(--c-brand)':pct>20?'var(--c-warn)':'var(--c-danger)';
    return `<div class="ui-card" style="padding:16px;border-top:3px solid ${_acc}">
      <div style="font-size:12.5px;font-weight:700;margin-bottom:8px;color:var(--c-text-2)">${esc(lt.name)}</div>
      <div class="fd" style="font-size:28px;font-weight:800;color:var(--c-text);line-height:1">${rem}<span style="font-size:13px;color:var(--c-text-3);font-weight:600"> / ${ent} days</span></div>
      <div style="height:6px;background:var(--c-border);border-radius:3px;overflow:hidden;margin-top:10px"><div style="height:100%;width:${pct}%;background:${_acc};border-radius:3px;transition:width .4s"></div></div>
      <div style="font-size:11.5px;color:var(--c-text-3);margin-top:8px">Used ${b.used||0} · Pending ${b.pending||0}${b.carriedIn?(' · Carried '+b.carriedIn):''}</div>
    </div>`;
  }).join('');
  const mine=(DB.leaveRequests||[]).filter(r=>r.userId===u.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const _reqCard=r=>{const lt=ltById(r.leaveTypeId);const tone=r.status==='Approved'?'success':r.status==='Rejected'?'danger':r.status==='Cancelled'?'neutral':'warn';
    return `<div class="ui-card" style="padding:16px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:10px"><div><div style="font-size:14.5px;font-weight:700">${esc(lt?lt.name:'Leave')}${r.halfDay?' <span style="font-size:11px;color:var(--c-warn)">(half-day)</span>':''}</div><div style="font-size:12.5px;color:var(--c-text-2);margin-top:3px">${fmtD(r.start)} → ${fmtD(r.end)} · ${r.workingDays} day${r.workingDays===1?'':'s'}</div></div>${badge(r.status==='Pending'?('Pending — '+(r.stage==='manager'?'Manager':'HR')):r.status,tone)}</div>
      ${r.reason?`<div style="font-size:12.5px;color:var(--c-text-2);margin-top:8px">${esc(r.reason)}</div>`:''}
      ${_leaveChainView(r)}
      ${r.status==='Pending'?`<button onclick="App.cancelLeave('${r.id}')" class="ui-btn ui-btn-subtle ui-btn-sm" style="margin-top:10px;color:var(--c-danger-ink)">Cancel request</button>`:''}
    </div>`;};
  // Segregated + collapsible: requests still in flight stay visible; decided ones fold away per year.
  let list;
  if(!mine.length){list=emptyCTA('approve','No leave requests','Apply for leave and track its approval here.','Apply for leave','App.applyLeave()');}
  else{
    const pend=mine.filter(r=>r.status==='Pending');
    const hist=mine.filter(r=>r.status!=='Pending');
    const byYear={};hist.forEach(r=>{const y=(r.start||r.createdAt||'').slice(0,4)||'Earlier';(byYear[y]=byYear[y]||[]).push(r);});
    const years=Object.keys(byYear).sort().reverse();
    const pendBlock=pend.length
      ?`<div style="font-size:11px;font-weight:800;color:var(--c-warn-ink,#B45309);margin-bottom:8px">IN PROGRESS · ${pend.length}</div>${pend.map(_reqCard).join('')}`
      :`<div style="font-size:12.5px;color:var(--c-text-3);background:var(--c-surface);border:1px dashed var(--c-border);border-radius:12px;padding:12px 14px;margin-bottom:10px">Nothing waiting for approval right now.</div>`;
    const histBlock=years.map((y,i)=>{const rs=byYear[y];
      const a=rs.filter(r=>r.status==='Approved').length,x=rs.filter(r=>r.status==='Rejected').length,c=rs.filter(r=>r.status==='Cancelled').length;
      const mini=[a?`<span style="color:var(--c-success-ink);font-weight:700">${a} approved</span>`:'',x?`<span style="color:var(--c-danger-ink);font-weight:700">${x} rejected</span>`:'',c?`<span style="color:var(--c-text-3)">${c} cancelled</span>`:''].filter(Boolean).join(' · ');
      return `<details ${i===0&&!pend.length?'open':''} style="margin-top:10px">
        <summary style="list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:12px;padding:12px 16px">
          <span style="font-size:13px;font-weight:800;color:var(--c-text)">${y} <span style="font-weight:600;color:var(--c-text-3)">· ${rs.length} request${rs.length===1?'':'s'}</span></span>
          <span style="display:flex;align-items:center;gap:10px;font-size:11.5px">${mini}<span style="color:var(--c-text-3)">${ic('chevD','w-4 h-4')}</span></span>
        </summary>
        <div style="margin-top:10px">${rs.map(_reqCard).join('')}</div>
      </details>`;}).join('');
    list=pendBlock+histBlock;
  }
  return `<div style="margin-bottom:10px;font-size:11px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.06em">Balances · ${yr}</div>
    <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">${cards||('<div style="grid-column:1/-1">'+empty('approve','No leave types configured','HR can configure leave types in HR Config.')+'</div>')}</div>
    <div style="font-size:11px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">My requests</div>${list}`;
}

App.applyLeave=()=>{
  const u=me();const prof=userProfileId(u);
  // §3a: comp-off is HR-controlled (granted/removed by HR only) — never employee-applicable.
  const types=_typesFor(prof).filter(t=>t.enabled).filter(t=>!_isCompOffLt(t)).filter(t=>!t.birthdayMonthOnly||u.hrm?.dob);
  if(!types.length){toast('No leave types available','warn');return;}
  openModal(`<div style="padding:20px"><div class="flex justify-between items-start mb-5"><h2 class="fd" style="font-size:18px;font-weight:800">Apply for leave</h2><button onclick="App.closeModal()" aria-label="Close" style="width:34px;height:34px;border-radius:10px;border:none;background:var(--c-surface-2);color:var(--c-text-2);cursor:pointer;display:grid;place-items:center">${ic('x','w-4 h-4')}</button></div>
    <div class="space-y-3">
      ${selF('Leave type','lv-type',types.map(t=>[t.id,t.name]),types[0].id)}
      <div class="grid grid-cols-2 gap-3">${fld('Start date','lv-start',todayISO(),'date')}${fld('End date','lv-end',todayISO(),'date')}</div>
      <div id="lv-half-wrap">${mkTog('lv-half',false,'Half-day (single day only)')}</div>
      <div><label for="lv-reason" class="ui-label">Reason</label><textarea id="lv-reason" rows="3" class="ui-input rf" placeholder="Reason for leave"></textarea></div>
      <div id="lv-preview" style="font-size:12.5px;color:var(--c-text-2)"></div>\n      <div id="lv-flow"></div>
    </div>
    <div class="flex gap-2 mt-6"><button onclick="App.closeModal()" class="ui-btn ui-btn-ghost ui-btn-md" style="flex:1">Cancel</button><button onclick="App.submitLeave()" class="ui-btn ui-btn-brand ui-btn-md" style="flex:1">Submit</button></div>
  </div>`);
  // Bug 4 (binding decision #2): the leave START date must be TODAY — no backdating, no future
  //   start. Lock the start input to today; the end input may not start before today (multi-day
  //   leave that STARTS today is still allowed: end >= start).
  const _t=todayISO();
  const _se=$('#lv-start');if(_se){_se.min=_t;_se.max=_t;_se.value=_t;}
  const _ee=$('#lv-end');if(_ee){_ee.min=_t;}
  const upd=()=>{const tId=$('#lv-type').value,lt=ltById(tId);const start=$('#lv-start').value,end=$('#lv-end').value;
    // Show the approval path BEFORE submitting — who signs off, in order, with live names.
    try{const _fw=$('#lv-flow');if(_fw){const _fq={userId:u.id,leaveTypeId:tId,start:start||todayISO()};const _fl=_flowFor(_fq);
      _fw.innerHTML='<div style="background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:10px;padding:9px 11px"><div style="font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--c-text-3);margin-bottom:6px">Approval path — in order</div><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">'
        +_fl.map((sg,i)=>{let nm='';try{nm=_stageApproverNames(_fq,i)||'';}catch(e){}
          return '<span style="display:inline-flex;align-items:center;gap:5px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:99px;padding:4px 11px;font-size:11.5px;font-weight:700;color:var(--c-text)">'+(i+1)+'. '+_stageLabel(sg)+(nm?' <span style="font-weight:600;color:var(--c-text-3)">'+esc(nm)+'</span>':'')+'</span>';})
        .join('<span style="color:var(--c-text-3);font-weight:800">→</span>')+'</div></div>';}}catch(e){}
    // M6: hide the half-day toggle (and force it off) for types HR marked half-day-disallowed.
    const halfOk=!lt||lt.halfDayAllowed!==false;const hw=$('#lv-half-wrap');if(hw)hw.style.display=halfOk?'':'none';
    const hb=$('#lv-half');if(hb&&!halfOk&&hb.classList.contains('on')){hb.classList.remove('on');hb.classList.add('off');hb.setAttribute('aria-checked','false');}
    const half=halfOk&&togV('lv-half');
    if(start!==_t){$('#lv-preview').textContent='Leave must start today — the start date cannot be in the past or future.';return;}
    if(!start||!end||end<start){$('#lv-preview').textContent='Select a valid date range.';return;}
    const wd=_workingDaysBetween(u.id,start,end,half&&start===end);
    const b=_balanceReadonly(u.id,tId,_leaveYearOf(u,start));const rem=_balRemaining(b);
    let msg=wd+' working day'+(wd===1?'':'s')+' (off-days & holidays excluded) · '+rem+' remaining';
    if(lt?.birthdayMonthOnly&&!_birthdayOk(u,start))msg+=' · Birthday leave only valid in your birthday month';
    $('#lv-preview').textContent=msg;};
  ['lv-type','lv-start','lv-end'].forEach(id=>{const e=$('#'+id);if(e)e.addEventListener('change',upd);});
  const ht=$('#lv-half');if(ht)ht.addEventListener('click',()=>setTimeout(upd,0));
  upd();
};
App.submitLeave=()=>{
  const u=me();const tId=$('#lv-type')?.value;const lt=ltById(tId);if(!lt){toast('Pick a type','err');return;}
  if(_isCompOffLt(lt)){toast('Comp-off is granted by HR and cannot be applied for','err');return;} // §3a defense-in-depth
  const start=$('#lv-start')?.value,end=$('#lv-end')?.value;const half=togV('lv-half');const reason=($('#lv-reason')?.value||'').trim();
  if(!start||!end||end<start){toast('Invalid date range','err');return;}
  // Bug 4 (binding decision #2): leave START must be today — block backdated and future starts.
  //   Multi-day leave starting today is still allowed (end >= start, enforced above).
  const _today=todayISO();
  if(start<_today){toast('You cannot apply for leave that started in the past','err');return;}
  if(start>_today){toast('Leave must start today — future start dates are not allowed','err');return;}
  // O8: a leave longer than the attendance/working-day guard (400 days) would write only partially.
  if(_isoAdd(start,400)<=end){toast('Leave range is too long — please split it into shorter requests','err');return;}
  if(lt.birthdayMonthOnly&&!_birthdayOk(u,start)){toast('Birthday leave only valid in your birthday month','err');return;}
  // M1: half-day applies to a single date only — never silently drop the toggle on a range.
  if(half&&start!==end){toast('Half-day only for a single date','err');return;}
  // M6: enforce HR's per-type half-day toggle — reject a half-day on a type HR marked half-day-disallowed.
  if(half&&lt.halfDayAllowed===false){toast('Half-day is not allowed for '+lt.name,'err');return;}
  const halfDay=half&&start===end;
  // M4: a range that crosses a leave-year boundary mis-allocates the balance charge → reject with a clear message.
  if(_leaveYearOf(u,start)!==_leaveYearOf(u,end)){toast('Leave cannot span two leave-years — split into separate requests','err');return;}
  const wd=_workingDaysBetween(u.id,start,end,halfDay);
  if(wd<=0){toast('Selected range has no working days','err');return;}
  // M6: block overlap with any existing non-Rejected request for the same user.
  if((DB.leaveRequests||[]).some(r=>r.userId===u.id&&r.status!=='Rejected'&&r.status!=='Cancelled'&&!(r.end<start||r.start>end))){toast('You already have a leave request overlapping these dates','err');return;}
  // LV-1: "unpaid" is an explicit TYPE property (lt.unpaid===true), NOT the presence of an unpaid PAY-TIER.
  //   paidTiers.unpaid describes a pay tier within an otherwise-tracked entitlement (e.g. sick 15/30/45),
  //   so keying off it made every sick request bypass the ledger. Only genuinely-unpaid types skip the balance.
  const isUnpaid=lt.unpaid===true||lt.key==='hajj';
  // M2: use the READ-ONLY balance for the sufficiency check so no orphan DB.leaveBalances row is
  //   persisted when a later validation (oncePerEmployment / no-approver) aborts. The row is only
  //   materialized via _balanceFor right before the reservation, after ALL validation passes.
  const bRO=_balanceReadonly(u.id,tId,_leaveYearOf(u,start));
  if(wd>_balRemaining(bRO)&&!isUnpaid){toast('Not enough balance ('+_balRemaining(bRO)+' remaining)','err');return;}
  // M6: enforce HR's per-year cap for this type. used+pending+this request must not exceed maxPerYear.
  if(lt.maxPerYear!=null&&((bRO.used||0)+(bRO.pending||0)+wd>lt.maxPerYear)){
    toast(lt.name+' is capped at '+lt.maxPerYear+' day'+(lt.maxPerYear===1?'':'s')+' per year','err');return;}
  // M5: once-per-employment keyed on the semantic leave key (e.g. 'hajj'), not a single type-row id.
  if(lt.oncePerEmployment&&(DB.leaveRequests||[]).some(r=>{const rl=ltById(r.leaveTypeId);return r.userId===u.id&&r.status!=='Rejected'&&r.status!=='Cancelled'&&rl&&rl.key===lt.key;})){toast('This leave can only be taken once per employment','err');return;}
  // §2: snapshot the active flow at submit so later edits to the flow can't strand in-flight requests.
  const flow=_flowFor({userId:u.id,leaveTypeId:tId,start});
  const firstStage=flow[0]||{type:'manager'};
  // DATA-2: persist the resolved leave-year ON the request so the SAME balance row is always
  // touched across the request's lifecycle, even if joiningDate / leaveYearBasis changes later.
  const reqLeaveYear=_leaveYearOf(u,start);
  const req={id:uid('lv'),userId:u.id,leaveTypeId:tId,leaveYear:reqLeaveYear,start,end,halfDay,halfDaySession:null,workingDays:wd,reason,unpaid:isUnpaid,
    flow,stageIndex:0,stage:firstStage.type, // `stage` kept (=stage type) for UI/data back-compat
    status:'Pending',needsAdmin:false,mgrDecision:null,mgrNote:'',mgrAt:null,hrDecision:null,hrNote:'',hrAt:null,createdAt:new Date().toISOString()};
  // Bug 5 (binding decision #5): does ANY active user (other than the submitter) approve the first stage?
  const pred=_stageApprover(req,0);
  const directApprovers=DB.users.filter(x=>x.status==='Active'&&x.id!==u.id&&pred(x.id));
  if(!directApprovers.length){
    // No designated approver for the opening stage → escalate to HR + Admins (terminal fallback).
    const reached=_escalateStranded(req,'⚠️ '+fullName(u)+'\'s '+lt.name+' ('+fmtD(start)+'→'+fmtD(end)+') has no approver for its first stage — please review.');
    if(!reached){
      // Nobody at all can act — refuse to strand the request silently.
      toast('No approver configured — contact admin','err');return;
    }
  }
  DB.leaveRequests.unshift(req);
  // M2: NOW all validation has passed — materialize the persisted balance row and place the reservation.
  if(!isUnpaid){const b=_balanceFor(u.id,tId,reqLeaveYear);b.pending=_r2((b.pending||0)+wd);} // unpaid types never touch the ledger
  hlog('Leave requested',fullName(u)+': '+lt.name+' '+start+'→'+end+' ('+wd+'d)');
  saveDB();closeModal();toast('Leave request submitted');
  // notify the first stage's approver(s) resolved via _stageApprover (gated by §4 in-app toggle)
  if(_hnp('inapp_hrm_leave_submitted'))directApprovers.forEach(a=>_hrmNotify(a.id,'📝 '+fullName(u)+' requested '+lt.name+' ('+fmtD(start)+'→'+fmtD(end)+') — your approval needed','leave'));
  // C3: email the APPROVER(s) (not the requester) with the full structured leave detail.
  if(_hnpEmail('email_hrm_leave_submitted'))directApprovers.forEach(a=>queueEmail('hrm_leave_submitted',a.id,null,start,{approver_name:fullName(a),user_name:fullName(u),leave_type:lt.name,start_date:fmtD(start),end_date:fmtD(end),working_days:wd+(wd===1?' day':' days')+(halfDay?' (half-day)':''),reason:reason||'—'}));
  rr();
};
App.cancelLeave=(id)=>{
  const r=(DB.leaveRequests||[]).find(x=>x.id===id);if(!r||r.userId!==S.uid||r.status!=='Pending')return;
  // DATA-2: release against the SAME balance row the reservation was placed on (persisted at submit).
  if(!r.unpaid){const b=_balanceFor(r.userId,r.leaveTypeId,r.leaveYear||_leaveYearOf(uById(r.userId),r.start));
    b.pending=_r2(Math.max(0,(b.pending||0)-r.workingDays));}
  // N6: distinct 'Cancelled' status so a self-cancel isn't recorded/treated as a manager rejection.
  r.status='Cancelled';r.hrNote='Cancelled by employee';
  hlog('Leave cancelled',fullName(me()));saveDB();toast('Request cancelled');rr();
};

function _leaveApprovalList(stage){
  // §2: `stage` is now a TAB classifier ('manager' | 'hr'). A request lands in a tab based on its
  // CURRENT flow stage (manager-type → manager tab, role/user-type → hr tab). Visibility & actions
  // are gated by _canActOn (current-stage approver, permission, self-guard; Admin universal).
  // LV-3: surface STRANDED requests (no resolvable approver) to HR/Admin so they aren't invisible.
  //   They land in whichever tab their current stage maps to; an HR user or Super Admin can clear them.
  const _canSeeStranded=isAdmin()||(can('leaveRequests','approve')&&!!me()?.hrm?.isHR);
  let reqs=(DB.leaveRequests||[]).filter(r=>r.status==='Pending'&&_stageTab(r)===stage&&(_canActOn(r)||(_canSeeStranded&&_stageStranded(r)&&r.userId!==S.uid)));
  reqs.sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  if(!reqs.length)return empty('approve','No pending requests','You\'re all caught up.');
  return reqs.map(r=>{const emp=uById(r.userId);const lt=ltById(r.leaveTypeId);const b=_balanceReadonly(r.userId,r.leaveTypeId,_leaveYearOf(emp,r.start));
    const flow=_reqFlow(r);const si=(r.stageIndex!=null?r.stageIndex:0);
    const stranded=_stageStranded(r);
    const stageChip=flow.length>1?`<span style="font-size:10px;font-weight:700;background:#EEF2FF;color:#4338CA;padding:2px 7px;border-radius:99px">Stage ${si+1} of ${flow.length} · ${esc(_stageLabel(flow[si]))}</span>`:'';
    const strandChip=stranded?`<span style="font-size:10px;font-weight:700;background:#FEF2F2;color:#B91C1C;padding:2px 7px;border-radius:99px">No approver — needs admin</span>`:'';
    return `<div style="background:#fff;border-radius:16px;border:1px solid #ECEDF0;padding:16px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">${avatar(emp,'w-9 h-9','text-xs')}<div style="flex:1"><div style="font-size:14px;font-weight:700">${esc(fullName(emp))}</div><div style="font-size:12px;color:#9CA3AF">${esc(emp?.department||'')} · ${esc(lt?lt.name:'Leave')}</div></div><div style="display:flex;flex-direction:column;gap:3px;align-items:flex-end">${stageChip}${strandChip}</div></div>
      <div style="font-size:13px;color:#374151">${fmtD(r.start)} → ${fmtD(r.end)} · <strong>${r.workingDays} day${r.workingDays===1?'':'s'}</strong>${r.halfDay?' (half-day)':''} · ${_balRemaining(b)} remaining</div>
      ${r.reason?`<div style="font-size:12px;color:#6B7280;margin-top:6px;background:#F9FAFB;border-radius:8px;padding:8px">${esc(r.reason)}</div>`:''}
      ${stage==='hr'&&r.mgrNote?`<div style="font-size:12px;color:#6B7280;margin-top:4px"><strong>Manager note:</strong> ${esc(r.mgrNote)}</div>`:''}
      <div style="display:flex;gap:8px;margin-top:12px"><button onclick="App.decideLeave('${r.id}','approve',${si})" style="flex:1;padding:9px;border-radius:10px;background:#10B981;color:#fff;font-weight:700;font-size:13px;border:none;cursor:pointer">Approve</button><button onclick="App.decideLeave('${r.id}','reject',${si})" style="flex:1;padding:9px;border-radius:10px;background:#fff;color:#B91C1C;font-weight:700;font-size:13px;border:1px solid #FECACA;cursor:pointer">Reject</button></div>
    </div>`;}).join('');
}
App.decideLeave=(id,action,expectedStageIndex)=>{
  // LV-4: re-read the request and verify it is still Pending AT THE STAGE the click was rendered for.
  //   A fast double-click (or an approver valid for consecutive stages) must NOT skip a stage: each call
  //   advances exactly one stage and is a no-op once the request has already advanced/finalized.
  const r=(DB.leaveRequests||[]).find(x=>x.id===id);
  if(!r){toast('Request not found','err');return;}
  if(r.status!=='Pending'){toast('This request was already '+(r.status==='Approved'?'approved':r.status==='Rejected'?'decided':'finalized'),'warn');return;}
  const curIdx=(r.stageIndex!=null?r.stageIndex:0);
  if(expectedStageIndex!=null&&Number(expectedStageIndex)!==curIdx){toast('This request already moved to the next stage — refreshing','warn');rr();return;}
  if(r.userId===S.uid){toast('You cannot approve your own leave request','err');return;} // M7
  if(!_canActOn(r)){toast('You are not the approver for this stage','err');return;}
  const emp=uById(r.userId);const lt=ltById(r.leaveTypeId);
  // C1: requester deleted (tombstone, no cascade) → abort cleanly BEFORE any decision field is set.
  if(!emp){toast('Employee no longer exists','err');return;}
  if(action==='reject'){
    modalShell({title:'Reject leave',size:'max-w-md',
      body:`<textarea id="lv-rnote" rows="3" class="ui-input rf" placeholder="Reason for rejection (sent to employee)"></textarea>`,
      footer:btnG('Cancel','App.closeModal()')+btnDanger('Reject',`App._doReject('${id}',${curIdx})`)});
    return;
  }
  // approve — §2: advance through the snapshot flow by stageIndex.
  // ONE-CLICK FIX (owner report: "I need to click twice to approve"): when the SAME decider is
  // also a valid approver for the following stage(s) — e.g. a Super Admin covering both the
  // manager and the HR stage — all their consecutive stages approve in THIS single click.
  // A stage owned by a DIFFERENT person still hands off with the usual notifications.
  const flow=_reqFlow(r);
  let _hop=0;
  while(r.status==='Pending'&&_hop++<10){
  const si=(r.stageIndex!=null?r.stageIndex:0);const curStage=flow[si];
  const nextStage=flow[si+1];
  // Keep legacy mgr/hr decision fields populated for back-compat display.
  if(curStage&&curStage.type==='manager'){r.mgrDecision='Approved';r.mgrAt=new Date().toISOString();}
  else{r.hrDecision='Approved';r.hrAt=new Date().toISOString();}
  if(nextStage){
    r.stageIndex=si+1;r.stage=nextStage.type;
    hlog('Leave approved (stage '+(si+1)+': '+_stageLabel(curStage)+')',fullName(emp)+': '+(lt?lt.name:''));
    if(_canActOn(r))continue; // same decider is valid for the next stage too → approve it in this click
    const pred=_stageApprover(r,si+1);
    const nextApprovers=DB.users.filter(x=>x.status==='Active'&&x.id!==emp.id&&pred(x.id));
    // Bug 5 (binding decision #5): if the NEXT stage has no designated approver, escalate to HR +
    //   Admins (terminal fallback) instead of stranding the request unseen.
    if(!nextApprovers.length){
      _escalateStranded(r,'⚠️ '+fullName(emp)+'\'s '+(lt?lt.name:'leave')+' reached a stage with no approver — please review.');
    }else{r.needsAdmin=false;}
    // next-stage approvers = same "approval needed" event as submission (gated by §4)
    if(_hnp('inapp_hrm_leave_submitted'))nextApprovers.forEach(a=>_hrmNotify(a.id,'📝 '+fullName(emp)+'\'s '+(lt?lt.name:'leave')+' needs your approval (stage '+(si+2)+')','leave'));
    // C3: email the NEXT-stage approver(s) with structured detail (mirrors submit-stage email).
    if(_hnpEmail('email_hrm_leave_submitted'))nextApprovers.forEach(a=>queueEmail('hrm_leave_submitted',a.id,null,r.start,{approver_name:fullName(a),user_name:fullName(emp),leave_type:lt?lt.name:'leave',start_date:fmtD(r.start),end_date:fmtD(r.end),working_days:r.workingDays+(r.workingDays===1?' day':' days'),reason:r.reason||'—'}));
    _hrmNotify(emp.id,'✓ Your '+(lt?lt.name:'leave')+' passed '+_stageLabel(curStage)+' — pending '+_stageLabel(nextStage)+'.','leave'); // progress note (informational)
    break; // handed off to a different approver — this click is done
  }else{
    r.stage='done';r.status='Approved';
    // DATA-2: touch the SAME balance row the reservation was placed on (persisted at submit).
    if(!r.unpaid){const b=_balanceFor(r.userId,r.leaveTypeId,r.leaveYear||_leaveYearOf(emp,r.start)); // C1: r.leaveYear persisted at submit, no emp deref needed
      b.pending=_r2(Math.max(0,(b.pending||0)-r.workingDays));
      b.used=_r2((b.used||0)+r.workingDays);}
    _writeLeaveAttendance(r); // mark attendance Leave/HalfDay (history written for unpaid too)
    hlog('Leave approved',fullName(emp)+': '+(lt?lt.name:''));
    if(_hnp('inapp_hrm_leave_approved'))_hrmNotify(emp.id,'✅ Your '+(lt?lt.name:'leave')+' ('+fmtD(r.start)+'→'+fmtD(r.end)+') was approved.','leave');
    // C3: email the employee with structured detail incl. approver + remaining balance.
    if(_hnpEmail('email_hrm_leave_approved')){const _bal=r.unpaid?'—':(_balRemaining(_balanceReadonly(emp.id,r.leaveTypeId,r.leaveYear||_leaveYearOf(emp,r.start)))+' day(s)');queueEmail('hrm_leave_approved',emp.id,null,r.start,{user_name:fullName(emp),leave_type:lt?lt.name:'leave',start_date:fmtD(r.start),end_date:fmtD(r.end),working_days:r.workingDays+(r.workingDays===1?' day':' days'),approver_name:fullName(me()),balance:_bal});}
  }
  } // end one-click multi-stage loop
  saveDB();toast('Approved');rr();
};
App._doReject=(id,expectedStageIndex)=>{
  // LV-4: idempotent reject — re-read, confirm still Pending at the rendered stage.
  const r=(DB.leaveRequests||[]).find(x=>x.id===id);
  if(!r){toast('Request not found','err');return;}
  if(r.status!=='Pending'){toast('This request was already decided','warn');closeModal();rr();return;}
  const curIdx=(r.stageIndex!=null?r.stageIndex:0);
  if(expectedStageIndex!=null&&Number(expectedStageIndex)!==curIdx){toast('This request already moved to the next stage — refreshing','warn');closeModal();rr();return;}
  if(r.userId===S.uid){toast('You cannot decide your own leave request','err');return;} // M7
  if(!_canActOn(r)){toast('You are not the approver for this stage','err');return;}
  const note=($('#lv-rnote')?.value||'').trim();const emp=uById(r.userId);const lt=ltById(r.leaveTypeId);
  // C1: requester deleted → abort cleanly BEFORE any decision field is set.
  if(!emp){toast('Employee no longer exists','err');closeModal();return;}
  // §2: reject at ANY stage stops the flow and releases the reservation (unpaid-skip below unchanged).
  const curStage=_reqStage(r);
  if(curStage&&curStage.type==='manager'){r.mgrDecision='Rejected';r.mgrNote=note;r.mgrAt=new Date().toISOString();}
  else{r.hrDecision='Rejected';r.hrNote=note;r.hrAt=new Date().toISOString();}
  r.status='Rejected';
  // DATA-2: release against the SAME balance row the reservation was placed on (persisted at submit).
  if(!r.unpaid){const b=_balanceFor(r.userId,r.leaveTypeId,r.leaveYear||_leaveYearOf(emp,r.start));
    b.pending=_r2(Math.max(0,(b.pending||0)-r.workingDays));} // release reservation (skip for unpaid)
  hlog('Leave rejected',fullName(emp)+': '+(lt?lt.name:'')+(note?(' — '+note):''));
  if(_hnp('inapp_hrm_leave_rejected'))_hrmNotify(emp.id,'❌ Your '+(lt?lt.name:'leave')+' was rejected'+(note?': '+note:'.'),'leave');
  // C3: email the employee with structured detail incl. approver + rejection reason.
  if(_hnpEmail('email_hrm_leave_rejected'))queueEmail('hrm_leave_rejected',emp.id,null,r.start,{user_name:fullName(emp),leave_type:lt?lt.name:'leave',start_date:fmtD(r.start),end_date:fmtD(r.end),approver_name:fullName(me()),reason:note||'No reason provided'});
  saveDB();closeModal();toast('Rejected');rr();
};
function _writeLeaveAttendance(r){
  let d=r.start,guard=0;
  while(d<=r.end&&guard++<400){
    const u=uById(r.userId);const off=new Set(u.hrm?.schedule?.offDays||[]);
    const dow=DAYS3[new Date(d+'T00:00:00').getDay()];
    const prof=userProfileId(u);const isHol=(DB.holidays||[]).some(h=>h.profileId===prof&&h.date===d);
    if(!off.has(dow)&&!isHol){
      let rec=attFor(r.userId,d);
      if(!rec){
        // No prior record → write a pure leave day.
        rec={id:_attId(r.userId,d),userId:r.userId,date:d,clockIn:null,clockOut:null,inMin:null,outMin:null,hours:null,status:r.halfDay?'HalfDay':'Leave',leaveType:r.leaveTypeId,flags:[],inGeo:null,autoClosed:false,note:'',createdAt:new Date().toISOString()}; // M5: deterministic id
        DB.attendance.push(rec);
      }else if(rec.clockIn||rec.inMin!=null||(rec.hours||0)>0){
        // M2: the employee already WORKED this day. Don't blow away worked hours.
        rec.leaveType=r.leaveTypeId;
        const fl=new Set(rec.flags||[]);
        if(r.halfDay){
          // Half-day leave on a worked day → keep hours, mark HalfDay + which session is leave.
          rec.status='HalfDay';rec.halfDaySession=rec.halfDaySession||'PM';fl.add('half-day-worked');
        }else{
          // Full-day leave on an already-worked day → keep the worked record (Present + hours),
          // just tag the overlap. Payroll excludes this date from leavesTaken (see _leaveDaysInRange).
          fl.add('leave-overlap');
        }
        rec.flags=[...fl];
      }else{
        // Existing non-worked record (e.g. a previously-written leave/off day) → set leave status.
        rec.status=r.halfDay?'HalfDay':'Leave';rec.leaveType=r.leaveTypeId;
      }
    }
    d=_isoAdd(d,1);
  }
}
/* L5/M2: working leave-days for `r` that fall inside [d1,d2] AND were not already worked.
   Clips to the overlap window and excludes full-day-on-worked overlaps from the payroll leave count. */
function _leaveDaysInRange(r,d1,d2){
  const u=uById(r.userId);if(!u)return 0;
  const off=new Set(u.hrm?.schedule?.offDays||[]);const prof=userProfileId(u);
  const hols=new Set((DB.holidays||[]).filter(h=>h.profileId===prof).map(h=>h.date));
  let d=r.start>d1?r.start:d1;const end=r.end<d2?r.end:d2;let n=0,guard=0;
  while(d<=end&&guard++<400){
    const dow=DAYS3[new Date(d+'T00:00:00').getDay()];
    if(!off.has(dow)&&!hols.has(d)){
      const rec=attFor(r.userId,d);
      const worked=rec&&(rec.clockIn||rec.inMin!=null||(rec.hours||0)>0);
      if(r.halfDay)n+=0.5; // half-day always counts 0.5 (hours kept separately)
      else if(!worked)n+=1; // full-day leave on a worked day is NOT counted (no double pay)
    }
    d=_isoAdd(d,1);
  }
  return _r2(n);
}

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.leavePage=leavePage;window._isMgrApprover=_isMgrApprover;window._stageLabel=_stageLabel;window._normalizeFlow=_normalizeFlow;window._flowFor=_flowFor;window._reqFlow=_reqFlow;window._reqStage=_reqStage;window._stageApprover=_stageApprover;window._canActOn=_canActOn;window._stageTab=_stageTab;window._stageStranded=_stageStranded;window._escalateStranded=_escalateStranded;window._approvalInbox=_approvalInbox;window._approvalPendingCount=_approvalPendingCount;window._stageApproverNames=_stageApproverNames;window._leaveChainView=_leaveChainView;window._myLeaveView=_myLeaveView;window._leaveApprovalList=_leaveApprovalList;window._writeLeaveAttendance=_writeLeaveAttendance;window._leaveDaysInRange=_leaveDaysInRange;
