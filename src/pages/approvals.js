


// DUP-2 (D-C2): the legacy approvalsPage list UI is RETIRED. The unified inbox
// (unifiedApprovalsPage) is the SOLE approvals surface; the `approvals` route points
// straight at it. This shim is kept only so any stray caller / the USE_UNIFIED_APPROVALS
// kill-switch still resolves to a valid page. The decision handlers (_decide*, etc.) live
// elsewhere and are untouched — the inbox depends on them.
function approvalsPage(){return unifiedApprovalsPage();}

// ── B3: UNIFIED APPROVALS INBOX UI ───────────────────────────────────────────────────
// One screen listing EVERY pending decision (leave + submission + edit, and ready for
// document/onboarding). Filter chips by type, status sub-tabs, inline Approve/Reject that
// route back to the NATIVE handlers. Replaces the `approvals` route (old approvalsPage kept
// callable during transition — see USE_UNIFIED_APPROVALS flag).
// D4 transition flag: unified inbox is the primary view. Set false to revert the `approvals`
// route to the legacy approvalsPage() (which is kept intact, still callable). Once the inbox
// is verified, the legacy approvalsPage + the leave manager/HR approval tabs can be retired.
const USE_UNIFIED_APPROVALS=true;
const _APPR_META={
  leave:      {icon:'calendar', label:'Leave',       chip:'Leave'},
  submission: {icon:'check',    label:'Submissions', chip:'Submissions'},
  edit:       {icon:'edit',     label:'Edits',       chip:'Edits'},
  document:   {icon:'doc',      label:'Documents',   chip:'Documents'},
  overtime:   {icon:'clock',    label:'Overtime',    chip:'Overtime'},
};
const _APPR_ORDER=['leave','submission','edit','document','overtime'];
function unifiedApprovalsPage(){
  const all=_approvalInbox();
  // Status sub-tabs: Pending / Approved / Rejected. Default Pending (the actionable view).
  // Notification deep-links set S.filters.atab to land the user on the right sub-tab.
  const statusTab=S.filters.atab||'Pending';
  const typeF=S.filters.inboxType||'all';
  // Count per status (independent of the active type filter) for the sub-tab badges.
  const _byStatus=s=>all.filter(x=>x.status===s).length;
  const STAT=['Pending','Approved','Rejected'];
  const statBadge=(n,on)=>n?(' <span style="display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;padding:1px 6px;min-width:16px;border-radius:99px;margin-left:6px;background:'+(on?'rgba(255,255,255,.22)':'var(--c-border)')+';color:'+(on?'#fff':'var(--c-text-2)')+'">'+n+'</span>'):'';
  const statusBar='<div class="ui-tabs" style="margin-bottom:16px">'
    +STAT.map(t=>{const on=statusTab===t;return '<button class="ui-tab'+(on?' on':'')+'" onclick="App._setApprTab(this.dataset.t)" data-t="'+t+'">'+t+statBadge(_byStatus(t),on)+'</button>';}).join('')
    +'</div>';
  // Rows for the active status tab.
  let rows=all.filter(x=>x.status===statusTab);
  // Type filter chips — only the types present WITHIN the active status tab.
  const presentTypes=new Set(rows.map(x=>x.type));
  if(typeF!=='all')rows=rows.filter(x=>x.type===typeF);
  rows.sort((a,b)=>{const ta=a.payload?.createdAt||'';const tb=b.payload?.createdAt||'';return tb.localeCompare(ta);});
  const chips=(presentTypes.size>1)?('<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;overflow-x:auto">'
    +[['all','All']].concat(_APPR_ORDER.filter(t=>presentTypes.has(t)).map(t=>[t,_APPR_META[t].label]))
      .map(([k,l])=>{const a=typeF===k;return '<button class="ui-tab-pill'+(a?' on':'')+'" onclick="App._setInboxType(this.dataset.k)" data-k="'+k+'">'+esc(l)+'</button>';}).join('')
    +'</div>'):'';
  // Bulk-approve bar: only on the Pending tab, when a single type is filtered.
  const bulkable=statusTab==='Pending'&&typeF!=='all'&&rows.length;
  const bulkBar=bulkable?'<div style="margin-bottom:12px"><button class="ui-btn ui-btn-brand ui-btn-sm" onclick="App._bulkApproveInbox(this.dataset.t)" data-t="'+esc(typeF)+'">'+ic('approve','w-4 h-4')+'Approve all '+esc(_APPR_META[typeF].label.toLowerCase())+' ('+rows.length+')</button></div>':'';
  const emptyMsg=statusTab==='Pending'?['approve','Nothing pending','You\'re all caught up.']
    :statusTab==='Approved'?['approve','No approved items','Approved requests will appear here.']
    :['x','No rejected items','Rejected requests will appear here.'];
  // Never gate the whole page behind a blocking skeleton — leave requests are already loaded at boot,
  //   and submission/edit approvals stream in via the lazy load (which re-renders on completion). This
  //   guarantees the page can never get visually stuck on "Loading…" if a background fetch is slow.
  const body=rows.length?rows.map(_inboxRow).join('')
    :empty(emptyMsg[0],emptyMsg[1],emptyMsg[2]);
  return '<div class="fade">'+hdr('Approvals','Everything waiting for your decision — submissions, edits, leave and more')
    +statusBar+chips+bulkBar
    +'<div class="space-y-3">'+body+'</div></div>';
}
// One normalised inbox row. Tapping the body opens type-specific detail; Approve/Reject route
// to native handlers. Only Pending rows the user can act on show buttons.
function _inboxRow(x){
  const u=uById(x.requestedBy);const meta=_APPR_META[x.type]||{icon:'doc',label:x.type};
  const when=x.payload?.createdAt?new Date(x.payload.createdAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
  const canAct=x.status==='Pending';
  // native decision routing keyed off _src.coll
  const approveCall=x._src.coll==='leaveRequests'
    ? "App._inboxDecide('"+esc(x.id)+"','approve')"
    : x._src.coll==='documents'
    ? "App._decideDoc('"+esc(x._src.id)+"','approve')"
    : x._src.coll==='overtime'
    ? "App._otDecide('"+esc(x._src.id)+"','approve','pay')"
    : "App._decideApprove('"+esc(x._src.id)+"')";
  const rejectCall=x._src.coll==='leaveRequests'
    ? "App._inboxDecide('"+esc(x.id)+"','reject')"
    : x._src.coll==='documents'
    ? "App._decideDoc('"+esc(x._src.id)+"','reject')"
    : x._src.coll==='overtime'
    ? "App._otDecide('"+esc(x._src.id)+"','reject')"
    : "App._decideReject('"+esc(x._src.id)+"')";
  // Owner request: delete/cancel controls on inbox records. Matrix (safety first):
  //  · submission/edit approvals — DECIDED records deletable (requester / approver / admin);
  //  · leave — Pending → Cancel (existing handler releases the reserved balance);
  //            Rejected/Cancelled → delete the record; Approved never (balances already applied);
  //  · overtime — Rejected → remove (existing handler, stays in DB log);
  //  · documents — decided in Documents (deleting the doc lives there).
  const _del=(()=>{
    const c=x._src.coll;
    if(c==='approvals'&&x.status!=='Pending'&&(x.requestedBy===S.uid||isAdmin()||can('checklists','approve')))
      return{call:"App._delApprovalRec('"+esc(x._src.id)+"')",label:'Delete record'};
    if(c==='leaveRequests'){
      if(x.status==='Pending'&&x.requestedBy===S.uid)return{call:"App.cancelLeave('"+esc(x._src.id)+"')",label:'Cancel request'};
      if((x.status==='Rejected'||x.status==='Cancelled')&&(x.requestedBy===S.uid||can('leaveRequests','approve')))
        return{call:"App._delLeaveRec('"+esc(x._src.id)+"')",label:'Delete record'};
      // R8 (owner request): APPROVED leave is deletable too — approvers only; the delete fully
      // reverses the approval (restores the balance days + clears the written leave days).
      if(x.status==='Approved'&&can('leaveRequests','approve'))
        return{call:"App._delLeaveRec('"+esc(x._src.id)+"')",label:'Delete & reverse'};
    }
    if(c==='overtime'&&x.status==='Rejected')return{call:"App._otDel('"+esc(x._src.id)+"')",label:'Remove'};
    return null;
  })();
  return '<div class="ui-card" style="padding:16px;position:relative">'
    +(_del?'<button onclick="'+_del.call+'" title="'+_del.label+'" aria-label="'+_del.label+'" style="position:absolute;top:10px;right:10px;width:28px;height:28px;display:grid;place-items:center;border-radius:8px;border:none;background:transparent;color:var(--c-text-3);cursor:pointer;z-index:2" onmouseover="this.style.color=\'var(--c-danger-ink)\';this.style.background=\'var(--c-danger-soft)\'" onmouseout="this.style.color=\'var(--c-text-3)\';this.style.background=\'transparent\'">'+ic('trash','w-4 h-4')+'</button>':'')
    +'<div onclick="App._inboxOpen(\''+esc(x.id)+'\')" style="display:flex;align-items:flex-start;gap:12px;cursor:pointer;'+(_del?'padding-right:30px':'')+'">'
    +'<span style="width:40px;height:40px;border-radius:11px;background:var(--c-surface-2);color:var(--c-text-2);display:grid;place-items:center;flex-shrink:0">'+ic(meta.icon,'w-5 h-5')+'</span>'
    +'<div style="flex:1;min-width:0">'
    +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-size:14.5px;font-weight:700">'+esc(x.subject)+'</span>'
    +badge(meta.label,'neutral')
    +(x.status!=='Pending'?chip(x.status):'')+'</div>'
    +'<div style="font-size:12.5px;color:var(--c-text-2);margin-top:3px">'+esc(u?fullName(u):'Unknown')+(x.dept?' · '+esc(x.dept):'')+(when?' · '+when:'')+'</div>'
    +'</div></div>'
    +(canAct
      ?'<div style="display:flex;gap:8px;margin-top:14px">'
        +'<button class="ui-btn ui-btn-brand ui-btn-sm" style="flex:1" onclick="'+approveCall+'">'+ic('approve','w-4 h-4')+'Approve</button>'
        +'<button class="ui-btn ui-btn-ghost ui-btn-sm" style="flex:1;color:var(--c-danger-ink)" onclick="'+rejectCall+'">Reject</button>'
        +'</div>'
      :'')
    +'</div>';
}
/* Delete a DECIDED submission/edit approval record (history cleanup — logged). */
App._delApprovalRec=(id)=>{
  const a=(DB.approvals||[]).find(x=>x.id===id);if(!a)return;
  if(a.status==='Pending'){toast('Decide it first — pending approvals can\'t be deleted','err');return;}
  if(!(a.requesterId===S.uid||isAdmin()||can('checklists','approve'))){toast('Not allowed','err');return;}
  if(!confirm('Delete this '+(a.status||'').toLowerCase()+' approval record? This cannot be undone.'))return;
  DB.approvals=DB.approvals.filter(x=>x.id!==id);
  DB.approvals_deleted=DB.approvals_deleted||[];if(!DB.approvals_deleted.includes(id))DB.approvals_deleted.push(id);if(DB.approvals_deleted.length>800)DB.approvals_deleted=DB.approvals_deleted.slice(-800); // R7
  log(fullName(me()),'Deleted approval record',(a.type||'Approval')+(a.date?' · '+a.date:''));
  saveDB();toast('Record deleted','warn');rr();
  sb.from('approvals').delete().eq('id',id).then(()=>{}).catch(()=>{});
};
/* Delete a leave record. Rejected/Cancelled: plain history cleanup (requester or approver).
   R8 — APPROVED: approvers only; the delete REVERSES the approval — the used balance days are
   restored and the leave days written into attendance are cleared. Fully logged. */
App._delLeaveRec=(id)=>{
  const r=(DB.leaveRequests||[]).find(x=>x.id===id);if(!r)return;
  const emp=uById(r.userId);
  if(r.status==='Approved'){
    if(!can('leaveRequests','approve')){toast('Only an approver can delete an approved leave','err');return;}
    if(!emp){toast('Employee no longer exists','err');return;}
    if(!confirm('Delete this APPROVED leave?\n\nThis reverses the approval: '+(r.unpaid?'':(r.workingDays||0)+' day(s) go back to '+fullName(emp)+'\'s balance and ')+'the leave days are cleared from attendance.\n\nThis is logged and cannot be undone.'))return;
    // 1) restore the balance the approval consumed (paid types only — unpaid never touched it)
    if(!r.unpaid){const b=_balanceFor(r.userId,r.leaveTypeId,r.leaveYear||_leaveYearOf(emp,r.start));
      b.used=_r2(Math.max(0,(b.used||0)-(r.workingDays||0)));}
    // 2) clear the leave days _writeLeaveAttendance stamped (only pure leave rows — a day with a real
    //    clock-in keeps its worked record and just loses the leave marking)
    const _gone=[];let d=r.start,g=0;
    while(d<=r.end&&g++<400){
      const rec=(DB.attendance||[]).find(a=>a.userId===r.userId&&a.date===d);
      if(rec&&(rec.status==='Leave'||rec.status==='HalfDay')){
        if(rec.clockIn){rec.status='Present';rec.leaveType=null;}
        else{_gone.push(rec.id);DB.attendance=DB.attendance.filter(a=>a.id!==rec.id);}
      }
      d=_isoAdd(d,1);
    }
    if(_gone.length)sb.from('attendance').delete().in('id',_gone).then(()=>{}).catch(()=>{});
    hlog('Approved leave deleted & reversed',fullName(emp)+' · '+r.start+' → '+r.end);
  }else if(r.status==='Rejected'||r.status==='Cancelled'){
    if(!(r.userId===S.uid||can('leaveRequests','approve'))){toast('Not allowed','err');return;}
    if(!confirm('Delete this '+r.status.toLowerCase()+' leave record? This cannot be undone.'))return;
  }else{toast('Pending requests are cancelled, not deleted','err');return;}
  DB.leaveRequests=DB.leaveRequests.filter(x=>x.id!==id);
  DB.leaveRequests_deleted=DB.leaveRequests_deleted||[];if(!DB.leaveRequests_deleted.includes(id))DB.leaveRequests_deleted.push(id);if(DB.leaveRequests_deleted.length>800)DB.leaveRequests_deleted=DB.leaveRequests_deleted.slice(-800); // R7
  log(fullName(me()),'Deleted leave record',(emp?fullName(emp):'')+' · '+r.start+' → '+r.end);
  saveDB();toast(r.status==='Approved'?'Approved leave deleted — balance restored':'Record deleted','warn');rr();
  sb.from('leave_requests').delete().eq('id',id).then(()=>{}).catch(()=>{});
};
App._setInboxType=(k)=>{S.filters.inboxType=k;rr();};
// Approvals status sub-tab (Pending / Approved / Rejected). Reset the type filter so switching
// status never leaves a stale type chip selected for a type that has no items in the new tab.
App._setApprTab=(t)=>{S.filters.atab=t;S.filters.inboxType='all';rr();};
// Open type-specific detail reusing existing renderers.
App._inboxOpen=(iid)=>{
  const x=_approvalInbox().find(i=>i.id===iid);if(!x)return;
  if(x.type==='overtime'){App.closeModal&&App.closeModal();App.go('overtime');return;}
  if(x.type==='leave'){
    const r=x.payload;const emp=uById(r.userId);const lt=ltById(r.leaveTypeId);
    const b=_balanceReadonly(r.userId,r.leaveTypeId,_leaveYearOf(emp,r.start));
    modalShell({title:(lt?lt.name:'Leave'),sub:fullName(emp)+(emp?.department?' · '+emp.department:''),size:'max-w-md',
      body:'<div style="font-size:14px;font-weight:700;color:var(--c-text)">'+fmtD(r.start)+' → '+fmtD(r.end)+' · '+r.workingDays+' day'+(r.workingDays===1?'':'s')+(r.halfDay?' (half-day)':'')+'</div>'
      +'<div style="font-size:12px;color:var(--c-text-2);margin-top:4px">Balance remaining: <strong>'+_balRemaining(b)+'</strong></div>'
      +(r.reason?'<div style="font-size:12px;color:var(--c-text-2);margin-top:8px;background:var(--c-surface-2);border-radius:8px;padding:8px">'+esc(r.reason)+'</div>':'')
      +_leaveChainView(r),
      footer:x.status==='Pending'?btn('Approve','App.closeModal();App._inboxDecide(\''+esc(x.id)+'\',\'approve\')',{variant:'brand'})+btnDanger('Reject','App.closeModal();App._inboxDecide(\''+esc(x.id)+'\',\'reject\')'):''});
    return;
  }
  if(x.type==='document'){
    const d=x.payload;const up=uById(d.uploadedBy);
    modalShell({title:d.name,sub:'Uploaded by '+(up?fullName(up):(d.uploaderName||'Unknown'))+(d.uploadedAt?' · '+fmtD(d.uploadedAt.slice(0,10)):''),size:'max-w-md',
      body:(d.fileSize?'<div style="font-size:12px;color:var(--c-text-3);margin-bottom:8px">'+_fmtSize(d.fileSize)+'</div>':'')
      +btn('View file','App._previewDoc(\''+esc(d.id)+'\')',{variant:'ghost',attrs:'style="width:100%"'})
      +(x.status!=='Pending'?'<div style="font-size:12px;color:var(--c-text-2);margin-top:8px">'+esc(x.status)+(d.decisionNote?' · '+esc(d.decisionNote):'')+'</div>':''),
      footer:x.status==='Pending'?btn('Approve','App.closeModal();App._decideDoc(\''+esc(d.id)+'\',\'approve\')',{variant:'brand'})+btnDanger('Reject','App.closeModal();App._decideDoc(\''+esc(d.id)+'\',\'reject\')'):''});
    return;
  }
  if(x.type==='submission'||x.type==='edit'){
    const a=x.payload;
    // reuse the existing submission viewer (checklist + photos)
    let s=DB.submissions.find(z=>z.checklistId===a.checklistId&&z.userId===a.requesterId&&z.date===a.date);
    // N5: for "any-one" group checklists the submitter may differ from the approval's requester —
    // fall back to any submission matching the checklist + date before the async loader.
    if(!s)s=DB.submissions.find(z=>z.checklistId===a.checklistId&&z.date===a.date);
    if(s){App.viewSub(s.id);return;}
    // fall back to the async loader used by the old page
    const btn={dataset:{cl:a.checklistId,uid:a.requesterId,dt:a.date}};
    App._viewSubFor(btn);
    return;
  }
};
// Leave decision from the inbox → native App.decideLeave at the current stage. The id is the
// normalised 'lv-<reqId>'. We resolve the live stage so a stale row can't skip a stage.
App._inboxDecide=(iid,action)=>{
  const reqId=iid.replace(/^lv-/,'');
  const r=(DB.leaveRequests||[]).find(z=>z.id===reqId);
  if(!r){toast('Request not found','err');return;}
  const si=(r.stageIndex!=null?r.stageIndex:0);
  App.decideLeave(reqId,action,si);
};
// Bulk-approve every actionable Pending row of ONE type by looping the native handler. No new
// decision path — each call carries all the native logic (reservation/notify/escalation).
App._bulkApproveInbox=(type)=>{
  const rows=_approvalInbox().filter(x=>x.type===type&&x.status==='Pending');
  if(!rows.length){toast('Nothing to approve','warn');return;}
  let n=0;
  rows.forEach(x=>{
    if(x._src.coll==='leaveRequests'){const r=(DB.leaveRequests||[]).find(z=>z.id===x._src.id);if(r&&r.status==='Pending'&&_canActOn(r)){App.decideLeave(r.id,'approve',(r.stageIndex!=null?r.stageIndex:0));n++;}}
    else if(x._src.coll==='documents'){const d=(DB.documents||[]).find(z=>z.id===x._src.id);if(d&&d.approvalStatus==='pending'&&d.uploadedBy!==S.uid&&can('documentsOrg','approve')){App._doDecideDoc(d.id,'approve');n++;}}
    else{const a=DB.approvals.find(z=>z.id===x._src.id);if(a&&a.status==='Pending'&&a.requesterId!==S.uid){App._decideApprove(a.id);n++;}}
  });
  toast(n+' approved');
  // native handlers each render; ensure a final fresh render from the inbox model
  rr();
};

App._decide=async(id,status)=>{
  // Guard: cannot approve your own submission
  const _appr=DB.approvals.find(x=>x.id===id);
  if(_appr&&_appr.requesterId===S.uid&&status==='Approved'){toast('Cannot approve your own submission','err');return;}
  const a=DB.approvals.find(x=>x.id===id);if(!a)return;
  if(a.status!=='Pending'){toast('Already '+a.status.toLowerCase(),'warn');return;}
  // Immediately disable buttons to prevent double-click
  document.querySelectorAll(`[data-id="${id}"]`).forEach(b=>{b.disabled=true;b.style.opacity='0.5';});
  a.status=status;
  const u=uById(a.requesterId),c=clById(a.checklistId);
  if(typeof queueEmail==='function')queueEmail(status==='Approved'?'submission_approved':'submission_rejected',a.requesterId,a.checklistId,a.date,{checklist_name:(c&&c.name)||'checklist'}); // FINAL-FIX: decision emails
  const s=DB.submissions.find(x=>x.checklistId===a.checklistId&&x.userId===a.requesterId&&x.date===a.date);
  if(s&&a.type==='Submission'){
    if(status==='Approved'){
      s.status=s.status==='Late'?'Late':'On Time';
    } else {
      s.status='Rejected';
    }
  }
  if(s&&a.type==='Edit Request'){
    s.editRequestStatus=status;
    if(status==='Rejected')s.editRequestStatus='Rejected';
  }
  const msg=a.type==='Edit Request'
    ?(status==='Approved'?'✅ Edit approved for "'+c?.name+'" — you can now resubmit':'❌ Edit request rejected for "'+c?.name+'"')
    :(status==='Approved'
      ?'✅ Submission approved — '+c?.name+' on '+fmtD(a.date)
      :'❌ Submission rejected — '+c?.name+'. '+(a.date?fmtD(a.date):''));
  // Gated: feature-level chip (HR Config → Alerts) + the matching event toggle (Settings → In-App).
  const _evKey=a.type==='Edit Request'?'inapp_approval_decided':(status==='Approved'?'inapp_submission_approved':'inapp_submission_rejected');
  if(_inappOn('checklist')&&(!_ns||_ns[_evKey]!==false))DB.notifications.unshift({id:uid('n'),userId:a.requesterId,text:msg,time:new Date().toISOString(),read:false,kind:'submission'});
  if(a.type==='Submission'){
    queueEmail(status==='Approved'?'submission_approved':'submission_rejected', a.requesterId, null, null, {checklist_name:c?.name||''});
  } else if(a.type==='Edit Request'){
    queueEmail('approval_decided', a.requesterId, null, null, {checklist_name:c?.name||''});
  }
  log(fullName(me()),status+' '+a.type,fullName(u));
  _invalidateNotifCache();
  saveDB();
  toast(status==='Approved'?'Approved':'Rejected',status==='Approved'?'ok':'warn');
  _touchAction();render();
  // Targeted Supabase save — only affected rows, not full 11-table sync
  Promise.allSettled([
    sb.from('approvals').update({status:a.status}).eq('id',a.id),
    s ? sb.from('submissions').update({status:s.status,question_responses:s.questionResponses||[]}).eq('id',s.id) : Promise.resolve(),
    sb.from('notifications').upsert(DB.notifications.slice(0,20).map(n=>({id:n.id,user_id:n.userId,text:n.text,read:n.read||false,created_at:n.time||new Date().toISOString(),kind:n.kind||null,target_route:n.targetRoute||null})),{onConflict:'id'}),
  ]).catch(()=>{});
};

App.viewSub=(subId)=>{
  if(!subId){toast('No submission found','warn');return;}
  const s=DB.submissions.find(x=>x.id===subId);
  if(!s){toast('Submission not found','warn');return;}
  const u=uById(s.userId);
  const c=clById(s.checklistId);
  const clName=c?esc(c.name):'<em style="color:#9CA3AF">Deleted checklist</em>';
  const qResps=s.questionResponses||[];
  // If checklist deleted, reconstruct question list from saved responses
  let qs=c?(c.questionIds||[]).map(qid=>(DB.questions||[]).find(x=>x.id===qid)).filter(Boolean):[];
  if(!qs.length&&qResps.length){
    // Hydrate from DB.questions using the response questionIds
    qs=qResps.map(r=>(DB.questions||[]).find(x=>x.id===r.questionId)).filter(Boolean);
  }
  const TYPE_LABELS={answer:'Answer',number:'Number',passfail:'Pass/Fail',yesno:'Yes/No',tick:'Tick/Cross'};
  const qRows=qs.map(q=>{
    const qr=qResps.find(r=>r.questionId===q.id)||{};
    const resp=qr.response;
    const hasResp=resp!==null&&resp!==undefined&&resp!=='';
    const typeBg=Q_TYPE_BG[q.type]||'#F6F7F8';
    const typeClr=Q_TYPE_CLR[q.type]||'#6B7280';
    const typeLabel=TYPE_LABELS[q.type]||q.type;
    return'<div style="border-radius:10px;border:1px solid '+(hasResp?'var(--c-brand)':'var(--c-border)')+';padding:10px 12px;background:'+(hasResp?'var(--c-brand-soft)':'var(--c-surface-2)')+'">'
      +'<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">'
      +'<span style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:5px;background:'+typeBg+';color:'+typeClr+'">'+typeLabel+'</span>'
      +'<span style="font-size:13px;font-weight:600;color:var(--c-text)">'+esc(q.text)+'</span>'
      +'</div>'
      +(hasResp?'<div style="font-size:13px;font-weight:700;color:var(--c-brand-ink)">'+esc(String(resp))+'</div>':'<div style="font-size:12px;color:var(--c-text-3);font-style:italic">Not answered</div>')
      +(qr.comment?'<div style="font-size:12px;color:var(--c-text-2);margin-top:4px;font-style:italic">"'+esc(qr.comment)+'"</div>':'')
      +(()=>{const pl=_qrPhotoList(qr);return pl.length?'<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">'+pl.map(ph=>'<img src="'+esc(ph)+'" loading="lazy" decoding="async" alt="Task response photo" onclick="App._bigImg(this.src)" style="max-width:120px;max-height:80px;border-radius:8px;object-fit:cover;border:1px solid #E5E7EB;cursor:pointer"/>').join('')+'</div>':'';})()
      +'</div>';
  }).join('');
  openModal('<div style="padding:16px 20px;border-bottom:1px solid var(--c-border);display:flex;justify-content:space-between;align-items:flex-start;gap:12px;position:sticky;top:0;background:var(--c-surface);z-index:2;border-radius:20px 20px 0 0">'
    +'<div style="min-width:0"><h2 class="fd" style="font-size:18px;font-weight:800;color:var(--c-text)">'+clName+'</h2>'
    +'<div style="font-size:12px;color:var(--c-text-3);margin-top:2px">'+(u?esc(fullName(u)):'Unknown user')+' · '+fmtD(s.date)+' · '+chip(s.status)+'</div>'
    +(c&&(c.questionIds||[]).length?'<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">'+_subBadges(c,s)+'</div>':'')
    +'</div>'
    +'<button onclick="App.closeModal()" aria-label="Close" style="flex-shrink:0;width:34px;height:34px;border-radius:10px;border:none;background:var(--c-surface-2);color:var(--c-text-2);cursor:pointer;display:grid;place-items:center">'+ic('x','w-4 h-4')+'</button>'
    +'</div>'
    +'<div style="padding:20px">'
    +'<div style="display:flex;flex-direction:column;gap:8px">'
    +(qRows||'<div style="text-align:center;padding:20px;color:var(--c-text-3);font-size:13px">No questions in this submission</div>')
    +'</div>'
    +'<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--c-border);font-size:12px;color:var(--c-text-3)">'
    +'Submitted '+(s.submittedAt?new Date(s.submittedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'-')
    +(s.editCount?' · Edited '+s.editCount+'×':'')
    +'</div></div>','max-w-lg');
};
App._decideApprove=(id)=>App._decide(id,'Approved');
App._decideReject=(id)=>App._decide(id,'Rejected');
App._viewSubFor=async(btn)=>{
  let s=DB.submissions.find(x=>x.checklistId===btn.dataset.cl&&x.userId===btn.dataset.uid&&x.date===btn.dataset.dt);
  if(!s){
    // Try loading from Supabase
    const{data}=await sb.from('submissions').select('*').eq('checklist_id',btn.dataset.cl).eq('user_id',btn.dataset.uid).eq('date',btn.dataset.dt).single();
    if(data){
      s={id:data.id,checklistId:data.checklist_id,userId:data.user_id,date:data.date,status:data.status||'Pending',submittedAt:data.submitted_at||null,tasks:data.tasks||[],questionResponses:data.question_responses||[],editCount:data.edit_count||0,editHistory:data.edit_history||[]};
      DB.submissions.push(s);
    }
  }
  if(s){if(DB.submissions.findIndex(x=>x.id===s.id)<0){DB.submissions.push(s);saveDB();}App.viewSub(s.id);}
  else toast('No submission found for this date','warn');
};

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.approvalsPage=approvalsPage;window.USE_UNIFIED_APPROVALS=USE_UNIFIED_APPROVALS;window._APPR_META=_APPR_META;window._APPR_ORDER=_APPR_ORDER;window.unifiedApprovalsPage=unifiedApprovalsPage;window._inboxRow=_inboxRow;
