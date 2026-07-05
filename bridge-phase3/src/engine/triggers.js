

/* ── unified notify: in-app always + email queued to notif_outbox (drained by an edge function
      once an email provider is connected — the queue itself is fully self-contained) ── */
function notify(userId,text,kind,route){
  if(!userId||!text)return;
  text=String(text).slice(0,500); // oversized-input guard
  DB.notifications.unshift({id:uid('n'),userId:userId,text:text,time:new Date().toISOString(),read:false,kind:kind||'hrm',targetRoute:route||null});
  const u=uById(userId);
  const EK=(DB.hrmConfig&&DB.hrmConfig.emailKinds)||{};
  if(EK[kind||'general']===false)return; // feature-level email switch (HR Config → Alerts)
  if(u&&u.email&&u.emailEnabled!==false){
    sb.from('notif_outbox').insert({id:uid('ob'),to_user:userId,to_email:u.email,subject:text.replace(/[\u{1F300}-\u{1FAFF}]/gu,'').trim().slice(0,140),body:text,kind:kind||'general',status:'queued',created_at:new Date().toISOString()}).then(()=>{}).catch(()=>{});
  }
}
function _notifyOnce(userId,text,kind,route){
  const dup=(DB.notifications||[]).some(n=>n.userId===userId&&n.text===text&&String(n.time||'').slice(0,10)===todayISO());
  if(!dup)notify(userId,text,kind,route);
}
const _hrUsers=()=>DB.users.filter(u=>u.status==='Active'&&(u.hrm?.isHR===true||u.hrm?.roleProfileId==='hr'));
const _mgrOf=u=>u&&u.managerId?uById(u.managerId):null;

/* ── HRM-plan config seeds (flow + letter templates, alert settings — live in hrm_config, synced) ── */
function _seedHRMPlan(){
  const C=DB.hrmConfig=DB.hrmConfig||{};
  if(!C.emailKinds||typeof C.emailKinds!=='object')C.emailKinds={};
  if(!C.branding||typeof C.branding!=='object')C.branding={header:'BloomingBox',sub:'',footer:'This is a system-generated document.',headerImg:null,footerImg:null,payslipNote:''};
  if(C.branding.headerImg===undefined)C.branding.headerImg=null;
  if(C.branding.footerImg===undefined)C.branding.footerImg=null;
  if(C.branding.payslipNote===undefined)C.branding.payslipNote='';
  if(C.branding.payslipHeaderImg===undefined)C.branding.payslipHeaderImg=null;
  if(C.branding.payslipFooterImg===undefined)C.branding.payslipFooterImg=null;
  if(!C.branding.payslipTpl)C.branding.payslipTpl='{name} · {position} · {department}\nMonth: {month}\n\nBasic salary\t{currency} {basic}\nAllowances\t{currency} {allowances}\nOvertime ({ot_hours}h)\t+ {currency} {ot_amount}\nUnpaid days ({unpaid_days} × {currency} {per_day})\t− {currency} {deductions}\n──────────────────────────────\nNET PAY\t{currency} {net}\n\nDays: {present} present ({wfh} WFH) · {leave} on leave · {absent} absent · {working} working days\nLeave balance remaining: {leave_balance} day(s)\n\n{note}\nStatus: {status} · Generated {date}';
  if(!C.alerts||typeof C.alerts!=='object')C.alerts={late:true,missedClockIn:true,leaveSLA:true,slaDays:3,docExpiry:true,docExpiryDays:30,probation:true,probationDays:7,benefits:true,benefitMonths:24,otWeeklyCap:10,otMultiplier:1.25,payrollCutoff:23};
  if(!C.flowTemplates||typeof C.flowTemplates!=='object'){
    const s=(title,ownerType,type,offsetDays,dept)=>({title,ownerType,type:type||'task',offsetDays:offsetDays||0,dept:dept||''});
    C.flowTemplates={
      onboarding:[s('Prepare & issue offer letter','hr','letter',0),s('IT setup — laptop, email & accounts','dept','task',1,'IT'),s('Design intro & brand walkthrough','dept','task',2,'Design'),s('Desk, supplies & access card','dept','task',1,'Procurement'),s('Collect documents (passport, visa, contracts)','hr','task',3),s('Probation plan agreed with colleague','manager','task',5)],
      probation:[s('Probation evaluation form','manager','form',0),s('Head of People review','hr','form',2),s('Confirmation / fail decision letter','hr','letter',4)],
      exit:[s('Resignation acknowledged in writing','hr','task',0),s('Exit interview','hr','form',3),s('Handover of work & assets','manager','task',7),s('IT deactivation — accounts & devices','dept','task',10,'IT'),s('Visa cancellation','hr','task',12),s('Payroll suspension','hr','payrollHold',12)],
    };
  }
  if(!C.letterTemplates||typeof C.letterTemplates!=='object'){
    C.letterTemplates={
      salary_cert:{name:'Salary Certificate',body:'To whom it may concern,\n\nThis is to certify that {name} (employee of {company}) holds the position of {position} in our {department} department since {joined}, drawing a monthly salary of {salary}.\n\nThis certificate is issued upon the employee\'s request.\n\nHR Department\n{company} · {date}'},
      noc:{name:'No Objection Certificate (NOC)',body:'To whom it may concern,\n\nWe have no objection to {name}, employed as {position}, for the purpose stated in their request.\n\nHR Department\n{company} · {date}'},
      confirmation:{name:'Probation Confirmation',body:'Dear {name},\n\nWe are pleased to confirm your employment as {position} following the successful completion of your probation period.\n\nHR Department\n{company} · {date}'},
      probation_fail:{name:'Probation Not Confirmed',body:'Dear {name},\n\nFollowing the review of your probation period as {position}, we regret to inform you that your employment will not be confirmed.\n\nHR Department\n{company} · {date}'},
      offer:{name:'Offer Letter',body:'Dear {name},\n\nWe are delighted to offer you the position of {position} in our {department} department with a monthly salary of {salary}, starting {joined}.\n\nHR Department\n{company} · {date}'},
      warning:{name:'Warning Letter',body:'Dear {name},\n\nThis letter serves as a formal warning regarding your conduct/performance. Please treat this with utmost seriousness.\n\nHR Department\n{company} · {date}'},
    };
  }
}

/* ── EVENT TRIGGER ENGINE (Phase 0) — runs once per device per day after data loads. In-app
      notifications always; emails ride the outbox. Configure in HR Config → Alerts. ── */
function _runEventTriggers(){
  try{
    const A=(DB.hrmConfig||{}).alerts||{};const d=todayISO();
    const stampKey='bridge_triggers_'+d;
    if(localStorage.getItem(stampKey))return;
    if(!(can('hrSettings','view')||isAdmin()||isMgr()))return; // fire from an HR/manager/admin session
    const hrs=_hrUsers();
    const tellRMHoP=(u,text,kind)=>{const m=_mgrOf(u);if(m)_notifyOnce(m.id,text,kind);hrs.forEach(h=>{if(!m||h.id!==m.id)_notifyOnce(h.id,text,kind);});};
    const act=DB.users.filter(u=>u.status==='Active'&&u.role!=='Admin');
    // 1) late arrival + no clock-in (after schedule.in + grace)
    if(A.late!==false){
      act.forEach(u=>{
        const sch=u.hrm?.schedule||{};if((sch.offDays||[]).includes(dayAbbr(d)))return;
        if(_onLeaveToday(u.id,d))return;
        const rec=(DB.attendance||[]).find(a=>a.userId===u.id&&a.date===d);
        const lateAfter=hm2m(sch.in||'09:00')+(Number(A.lateGrace)||20);
        if(rec&&rec.clockIn&&rec.inMin!=null&&rec.inMin>lateAfter)tellRMHoP(u,'⏰ Late arrival: '+fullName(u)+' clocked in at '+rec.clockIn+' on '+fmtS(d),'attendance');
        else if(A.missedClockIn!==false&&!rec&&nowHM()>lateAfter+60)tellRMHoP(u,'❓ No clock-in yet: '+fullName(u)+' ('+fmtS(d)+')','attendance');
      });
    }
    // 2) leave SLA — pending longer than N working days escalates to RM & HoP
    if(A.leaveSLA!==false){
      const slaDays=Number(A.slaDays)||3;
      (DB.leaveRequests||[]).filter(r=>r.status==='Pending').forEach(r=>{
        const u=uById(r.userId);if(!u)return;
        let wd=0,cur=new Date(String(r.createdAt||'').slice(0,10)+'T00:00:00');const end=new Date(d+'T00:00:00');
        while(cur<end){cur.setDate(cur.getDate()+1);if(!['Sat','Sun'].includes(DAYS3[cur.getDay()]))wd++;}
        if(wd>slaDays)tellRMHoP(u,'🚨 Leave SLA overdue: '+fullName(u)+"'s request is pending "+wd+' working days','leave');
      });
    }
    // 3) document expiry (visa/passport/contract — any personal doc with an expiry date)
    if(A.docExpiry!==false){
      const days=Number(A.docExpiryDays)||30;
      const lim=new Date(d+'T00:00:00');lim.setDate(lim.getDate()+days);
      const limISO=lim.toISOString().slice(0,10);
      act.forEach(u=>{(u.hrm?.personalDocs||[]).forEach(doc=>{
        if(!doc.expiry)return;
        if(doc.expiry<=limISO){
          const when=doc.expiry<d?'EXPIRED '+fmtS(doc.expiry):'expires '+fmtS(doc.expiry);
          _notifyOnce(u.id,'📄 Your document "'+doc.name+'" '+when+' — please renew','document');
          hrs.forEach(h=>_notifyOnce(h.id,'📄 '+fullName(u)+' — "'+doc.name+'" '+when,'document'));
        }
      });});
    }
    // 4) probation ending
    if(A.probation!==false){
      const days=Number(A.probationDays)||7;
      const lim=new Date(d+'T00:00:00');lim.setDate(lim.getDate()+days);
      const limISO=lim.toISOString().slice(0,10);
      act.forEach(u=>{
        const pe=u.hrm?.probationEnd;if(!pe)return;
        if(pe>=d&&pe<=limISO)tellRMHoP(u,'🎓 Probation ends '+fmtS(pe)+' for '+fullName(u)+' — start the probation review flow','lifecycle');
        else if(pe<d&&!(DB.flows||[]).some(f=>f.kind==='probation'&&f.userId===u.id))tellRMHoP(u,'🎓 Probation ended '+fmtS(pe)+' for '+fullName(u)+' — review is overdue','lifecycle');
      });
    }
    // 5) benefits — air ticket at the N-month anniversary
    if(A.benefits!==false){
      const months=Number(A.benefitMonths)||24;
      act.forEach(u=>{
        const j=u.hrm?.joiningDate;if(!j)return;
        const ann=new Date(j+'T00:00:00');ann.setMonth(ann.getMonth()+months);
        const annISO=ann.toISOString().slice(0,10);
        if(annISO===d||(annISO<d&&annISO>new Date(Date.now()-7*86400000).toISOString().slice(0,10))){
          _notifyOnce(u.id,'✈️ You\'ve reached your '+months+'-month anniversary — air-ticket benefit is due','benefit');
          hrs.forEach(h=>_notifyOnce(h.id,'✈️ Air-ticket benefit due: '+fullName(u)+' ('+months+'-month anniversary '+fmtS(annISO)+')','benefit'));
        }
      });
    }
    // 6) surveys whose run date has arrived — tell each person what they owe
    (DB.surveys||[]).filter(sv=>sv.status==='Active'&&sv.runDate===d).forEach(sv=>{
      act.forEach(u=>{const t=_svTargetsFor(sv,u.id);if(t.length)_notifyOnce(u.id,'📝 Survey open: "'+sv.title+'" — '+t.length+' form'+(t.length===1?'':'s')+' to fill','survey','surveys');});
    });
    localStorage.setItem(stampKey,'1');
    saveDB();
  }catch(e){console.warn('[triggers]',e.message);}
}

/* ── LIFECYCLE FLOWS: onboarding / probation / exit — one engine, three templates ── */
function _flowStart(kind,userId,ownerPicks){
  const u=uById(userId);if(!u)return null;
  const tpl=((DB.hrmConfig||{}).flowTemplates||{})[kind]||[];
  const hrs=_hrUsers();const m=_mgrOf(u);
  const today=new Date(todayISO()+'T00:00:00');
  const steps=tpl.map((t,i)=>{
    let ownerId=(ownerPicks&&ownerPicks[i])||t.ownerId||null;
    if(!ownerId){
      if(t.ownerType==='manager')ownerId=m?m.id:(hrs[0]||{}).id||null;
      else if(t.ownerType==='role'||t.ownerType==='hr'){const ru=DB.users.find(x=>x.status==='Active'&&x.hrm?.roleProfileId===(t.roleId||'hr'));ownerId=ru?ru.id:(hrs[0]||{}).id||null;}
      else if(t.ownerType==='dept'){const du=DB.users.find(x=>x.status==='Active'&&x.department===t.dept);ownerId=du?du.id:(hrs[0]||{}).id||null;}
    }
    if(t.ownerType==='manager')ownerId=m?m.id:ownerId;
    const due=new Date(today);due.setDate(due.getDate()+(Number(t.offsetDays)||0));
    return{id:uid('fs'),title:t.title,ownerType:t.ownerType,dept:t.dept||'',ownerId,type:t.type||'task',dueDate:due.toISOString().slice(0,10),done:false,doneBy:null,doneAt:null,formText:'',note:''};
  });
  const f={id:uid('flw'),kind,userId,status:'Active',steps,createdBy:S.uid,createdAt:new Date().toISOString(),completedAt:null};
  DB.flows.push(f);_pushRow('flows',_flowRow(f),'flow');
  steps.forEach(st=>{if(st.ownerId&&st.ownerId!==S.uid)notify(st.ownerId,'📋 '+kind[0].toUpperCase()+kind.slice(1)+' task for '+fullName(u)+': "'+st.title+'" · due '+fmtS(st.dueDate),'lifecycle','lifecycle');});
  log(fullName(me()),'Started '+kind+' flow',fullName(u));
  saveDB();return f;
}
App._flowNew=(kind)=>{
  if(!can('lifecycle','manage'))return toast('You need Lifecycle → Manage','err');
  _seedHRMPlan();
  const users=DB.users.filter(u=>u.status==='Active');
  const tpl=((DB.hrmConfig||{}).flowTemplates||{})[kind]||[];
  const hrUsers=users.filter(u=>u.hrm?.isHR===true||u.hrm?.roleProfileId==='hr');
  const stepSel=(t,i)=>{
    if(t.ownerType==='manager')return `<span style="font-size:11px;color:var(--c-text-3)">their manager (automatic)</span>`;
    const pool=(t.ownerType==='role'||t.ownerType==='hr')
      ?users.filter(u=>u.hrm?.roleProfileId===(t.roleId||'hr'))
      :users.filter(u=>u.department===t.dept);
    return `<select id="fs-own-${i}" class="ui-select rf" style="min-height:0;height:30px;font-size:11.5px;padding:3px 22px 3px 8px">${(pool.length?pool:users).map(u=>`<option value="${u.id}" ${t.ownerId===u.id?'selected':''}>${esc(fullName(u))}</option>`).join('')}</select>`;
  };
  modalShell({title:'Start '+kind+' flow',size:'max-w-md',
    body:`<div><label style="display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;margin-bottom:6px">Colleague</label>
      <select id="flw-user" class="ui-select rf" style="margin-bottom:12px">${users.map(u=>`<option value="${u.id}">${esc(fullName(u))}</option>`).join('')}</select>
      <label style="display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;margin-bottom:6px">Steps & owners</label>
      ${tpl.map((t,i)=>`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px dashed var(--c-border)"><span style="flex:1;min-width:0;font-size:12px;font-weight:600;color:var(--c-text)">${esc(t.title)}</span>${stepSel(t,i)}</div>`).join('')}
      <p style="font-size:11px;color:var(--c-text-3);margin-top:10px">HR steps offer HR-role people; department steps offer that department's people. Everyone picked is notified with a due date.</p></div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Start flow',`App._flowStartGo('${kind}')`)});
};
App._flowStartGo=(kind)=>{
  const el=document.getElementById('flw-user');if(!el)return;
  const tpl=((DB.hrmConfig||{}).flowTemplates||{})[kind]||[];
  const owners=tpl.map((t,i)=>{const s2=document.getElementById('fs-own-'+i);return s2?s2.value:null;});
  _flowStart(kind,el.value,owners);closeModal();toast('Flow started');rr();
};
App._flowStep=(fid,sid)=>{
  const f=(DB.flows||[]).find(x=>x.id===fid);if(!f)return;
  const st=f.steps.find(x=>x.id===sid);if(!st)return;
  if(!(st.ownerId===S.uid||can('lifecycle','manage')))return toast('Only the step owner or HR can complete this','err');
  st.done=!st.done;st.doneBy=st.done?S.uid:null;st.doneAt=st.done?new Date().toISOString():null;
  const u=uById(f.userId);
  if(st.done&&st.type==='payrollHold'&&u){_ensureHrm(u);u.hrm.payrollHold=true;notify(...( _hrUsers()[0]?[_hrUsers()[0].id]:[S.uid]),'⏸️ Payroll suspended for '+fullName(u)+' (exit flow)','payroll');}
  if(f.steps.every(x=>x.done)){f.status='Completed';f.completedAt=new Date().toISOString();if(u)notify(f.createdBy||S.uid,'✅ '+f.kind+' flow completed for '+fullName(u),'lifecycle');}
  else f.status='Active';
  _pushRow('flows',_flowRow(f),'flow');log(fullName(me()),(st.done?'Completed':'Reopened')+' flow step',st.title);
  saveDB();rr();
};
App._flowForm=(fid,sid,val)=>{const f=(DB.flows||[]).find(x=>x.id===fid);if(!f)return;const st=f.steps.find(x=>x.id===sid);if(!st)return;st.formText=val;clearTimeout(App._flwT);App._flwT=setTimeout(()=>{_pushRow('flows',_flowRow(f),'flow');saveDB();},1200);};
App._flowDel=(fid)=>{if(!can('lifecycle','manage'))return;const f=(DB.flows||[]).find(x=>x.id===fid);if(!f)return;if(!confirm('Delete this flow?'))return;DB.flows=DB.flows.filter(x=>x.id!==fid);_delRow('flows',fid,'flow');log(fullName(me()),'Deleted flow',f.kind);saveDB();rr();};

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.notify=notify;window._notifyOnce=_notifyOnce;window._hrUsers=_hrUsers;window._mgrOf=_mgrOf;window._seedHRMPlan=_seedHRMPlan;window._runEventTriggers=_runEventTriggers;window._flowStart=_flowStart;
