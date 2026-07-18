

/* ── DISCIPLINE — due-process cases (R22 · UAE Art 39/40 + Cabinet Res 1/2022).
   Flow: written CHARGE → employee STATEMENT (right to defend) → DECISION from the statutory ladder
   → on file 12 months → auto-expire. Windows: charge ≤30 days from discovery · decision ≤60 days
   from the statement. Fines (≤5 days' wage/month) deduct automatically in that month's payroll.
   Legacy one-click warnings (level, no status) render as already-decided records. ── */
const DC_PEN={notice:'Written notice',warning:'Written warning',fine:'Fine — days of wage',suspend:'Suspension without pay',bonus:'Withhold periodic bonus',promotion:'Withhold promotion',dismiss:'Dismissal (EOSB preserved)'};
const DC_LIM={fine:5,suspend:14,bonus:12,promotion:24};                 // Art 39 statutory maxima
function _dcStatus(d){return d.status||((d.penalty||d.level)?'Decided':'Charge');}
function _dcPenLabel(d){
  const p=d.penalty;
  if(p){const base=DC_PEN[p.type]||p.type;
    return p.type==='fine'?'Fine — '+p.days+' day'+(p.days==1?'':'s')+'\' wage'
      :p.type==='suspend'?base+' — '+p.days+' day'+(p.days==1?'':'s')
      :(p.type==='bonus'||p.type==='promotion')?base+' — '+p.months+' month'+(p.months==1?'':'s')
      :base;}
  return d.level?(d.level+(d.level!=='Verbal'&&d.level!=='Dismissal'?' warning':'')):'—';
}
function _dcDeadline(d){                                                 // decision due 60d after the statement (or the charge)
  const base=String(d.defenceAt||d.createdAt||'').slice(0,10);
  return base?_isoAdd(base,60):null;
}
App._discNew=()=>{
  if(!can('discipline','create'))return toast('You need Discipline → Create','err');
  const users=DB.users.filter(u=>u.status==='Active');
  modalShell({title:'Open a disciplinary case',size:'max-w-md',
    body:`<div style="display:flex;flex-direction:column;gap:12px">
      <div><label style="display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;margin-bottom:6px">Colleague</label><select id="dc-user" class="ui-select rf">${users.map(u=>`<option value="${u.id}">${esc(fullName(u))}</option>`).join('')}</select></div>
      <div><label style="display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;margin-bottom:6px">Violation discovered on</label><input id="dc-disc" type="date" value="${todayISO()}" class="ui-input rf" onchange="App._dc30()"/><div id="dc-30" style="font-size:11px;font-weight:700;margin-top:5px"></div></div>
      <div><label style="display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;margin-bottom:6px">Violation *</label><input id="dc-reason" class="ui-input rf" placeholder="e.g. Repeated late arrivals"/></div>
      <div><label style="display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;margin-bottom:6px">Written charge (details)</label><textarea id="dc-note" rows="3" class="ui-input rf" style="resize:vertical" placeholder="What happened, when, witnesses… — this is the written notification the colleague sees."></textarea></div>
      <div style="font-size:11px;color:var(--c-text-3)">Art 39 process: this opens the case and notifies the colleague in writing. They submit their statement, THEN you decide a penalty. Charge within 30 days of discovery; decide within 60 days of the statement.</div>
    </div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Open case & notify','App._discSave()')});
  App._dc30();
};
App._dc30=()=>{
  const el=document.getElementById('dc-30');if(!el)return;
  const disc=document.getElementById('dc-disc')?.value||todayISO();
  const late=todayISO()>_isoAdd(disc,30);
  el.style.color=late?'#BE123C':'var(--c-text-3)';
  el.textContent=late?'⚠ Outside the 30-day window (Art 39) — the case will be flagged as charged late.':'Within the 30-day charge window (Art 39).';
};
App._discSave=()=>{
  const uid2=document.getElementById('dc-user')?.value,reason=(document.getElementById('dc-reason')?.value||'').trim(),note=document.getElementById('dc-note')?.value||'';
  const discoveredAt=document.getElementById('dc-disc')?.value||todayISO();
  if(!reason)return toast('The violation is required','err');
  const d={id:uid('dsc'),userId:uid2,level:null,reason,note,status:'Charge',discoveredAt,defence:null,defenceAt:null,penalty:null,decidedAt:null,decidedBy:null,issuedBy:S.uid,createdAt:new Date().toISOString(),expiresAt:null};
  DB.discipline.push(d);_pushRow('discipline',_discRow(d),'warning');
  notify(uid2,'⚠️ Written notification (Art 39): a disciplinary case was opened — "'+reason+'". Submit your statement in the Discipline tab.','discipline');
  const u=uById(uid2);const m=_mgrOf(u);if(m&&m.id!==S.uid)notify(m.id,'⚠️ Disciplinary case opened for '+fullName(u),'discipline');
  log(fullName(me()),'Disciplinary case opened',reason+' · '+(u?fullName(u):''));
  saveDB();closeModal();toast('Case opened — the colleague was notified in writing');rr();
};
/* Employee statement (right to defend) — the person themselves, or edit-holders recording a hearing. */
App._discDefend=(id)=>{
  const d=(DB.discipline||[]).find(x=>x.id===id);if(!d)return;
  if(d.userId!==S.uid&&!can('discipline','edit'))return toast('You need Discipline → Edit','err');
  const own=d.userId===S.uid;
  modalShell({title:own?'Your statement':'Record the employee\'s statement',size:'max-w-md',
    body:`<div style="display:flex;flex-direction:column;gap:10px">
      <div style="font-size:12px;color:var(--c-text-2)"><b>Case:</b> ${esc(d.reason)}</div>
      <textarea id="dc-def" rows="4" class="ui-input rf" style="resize:vertical" placeholder="${own?'Your side of the story — it goes on file with the case.':'What the employee said in the hearing…'}"></textarea>
      <div style="font-size:11px;color:var(--c-text-3)">Cabinet Res 1/2022: the employee must be heard and their defence reviewed before any penalty.</div>
    </div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Save statement',`App._discDefendGo('${id}')`)});
};
App._discDefendGo=(id)=>{
  const d=(DB.discipline||[]).find(x=>x.id===id);if(!d)return;
  if(d.userId!==S.uid&&!can('discipline','edit'))return;
  const t=(document.getElementById('dc-def')?.value||'').trim();
  if(!t)return toast('Write the statement','err');
  d.defence=t;d.defenceAt=new Date().toISOString();
  _pushRow('discipline',_discRow(d),'warning');
  if(d.userId===S.uid){const by=uById(d.issuedBy);if(by)notify(by.id,'📝 '+fullName(me())+' submitted their statement on the disciplinary case.','discipline');}
  else notify(d.userId,'📝 Your statement was recorded on the disciplinary case.','discipline');
  log(fullName(me()),'Disciplinary statement recorded',(uById(d.userId)?fullName(uById(d.userId)):''));
  saveDB();closeModal();toast('Statement on file');rr();
};
App._discDecideM=(id)=>{
  if(!can('discipline','edit'))return toast('You need Discipline → Edit','err');
  const d=(DB.discipline||[]).find(x=>x.id===id);if(!d||_dcStatus(d)!=='Charge')return;
  const due=_dcDeadline(d);const past=due&&todayISO()>due;
  modalShell({title:'Decide the penalty',size:'max-w-md',
    body:`<div style="display:flex;flex-direction:column;gap:12px">
      <div style="font-size:12px;color:var(--c-text-2)"><b>Case:</b> ${esc(d.reason)}<br><b>Statement:</b> ${d.defence?esc(d.defence).slice(0,300):'<span style="color:#BE123C">not submitted yet</span>'}</div>
      ${past?`<div style="font-size:11px;font-weight:700;color:#BE123C;background:#FFF1F2;border-radius:9px;padding:7px 11px">⚠ Past the 60-day decision window (was due ${fmtS(due)}) — deciding now is flagged in the audit log.</div>`:due?`<div style="font-size:11px;color:var(--c-text-3)">Decide by ${fmtS(due)} (60 days — Art 39).</div>`:''}
      <div><label style="display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;margin-bottom:6px">Penalty (statutory ladder — Art 39)</label>
        <select id="dc-pen" class="ui-select rf" onchange="App._dcPenUI()">${Object.keys(DC_PEN).map(k=>`<option value="${k}">${DC_PEN[k]}</option>`).join('')}</select></div>
      <div id="dc-pen-x"></div>
      ${d.defence?'':`<label style="display:flex;align-items:flex-start;gap:8px;font-size:12px;color:var(--c-text-2);cursor:pointer"><input id="dc-heard" type="checkbox" style="margin-top:2px"/> The employee was heard / given a documented chance to respond and did not (required before a penalty — Cabinet Res 1/2022).</label>`}
      <div style="font-size:11px;color:var(--c-text-3)">Fines cap at 5 days' wage per month and deduct in that month's payroll. Dismissal preserves end-of-service benefits (Art 39-7); the employee may escalate to MOHRE.</div>
    </div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Record decision',`App._discDecideGo('${id}')`)});
  App._dcPenUI();
};
App._dcPenUI=()=>{
  const x=document.getElementById('dc-pen-x');if(!x)return;
  const t=document.getElementById('dc-pen')?.value;
  x.innerHTML=t==='fine'?`<label style="display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;margin-bottom:6px">Days of wage (max 5/month)</label><input id="dc-days" type="number" min="1" max="5" value="1" class="ui-input rf"/>`
    :t==='suspend'?`<label style="display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;margin-bottom:6px">Days without pay (max 14)</label><input id="dc-days" type="number" min="1" max="14" value="1" class="ui-input rf"/>`
    :(t==='bonus'||t==='promotion')?`<label style="display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;margin-bottom:6px">Months (max ${DC_LIM[t]})</label><input id="dc-months" type="number" min="1" max="${DC_LIM[t]}" value="1" class="ui-input rf"/>`
    :t==='dismiss'?`<div style="font-size:11.5px;font-weight:700;color:#BE123C;background:#FFF1F2;border-radius:9px;padding:8px 11px">Dismissal is the last rung: it requires the completed investigation above, written reasons (this case), and pays end-of-service in full.</div>`:'';
};
App._discDecideGo=(id)=>{
  if(!can('discipline','edit'))return;
  const d=(DB.discipline||[]).find(x=>x.id===id);if(!d||_dcStatus(d)!=='Charge')return;
  if(!d.defence&&!document.getElementById('dc-heard')?.checked)return toast('Hear the employee first (or confirm the documented chance to respond) — Cabinet Res 1/2022','err');
  const t=document.getElementById('dc-pen')?.value;if(!DC_PEN[t])return;
  const p={type:t};
  if(t==='fine'){p.days=Math.min(Math.max(parseInt(document.getElementById('dc-days')?.value)||1,1),DC_LIM.fine);}
  if(t==='suspend'){p.days=Math.min(Math.max(parseInt(document.getElementById('dc-days')?.value)||1,1),DC_LIM.suspend);}
  if(t==='bonus'||t==='promotion'){p.months=Math.min(Math.max(parseInt(document.getElementById('dc-months')?.value)||1,1),DC_LIM[t]);}
  const due=_dcDeadline(d);const past=due&&todayISO()>due;
  d.penalty=p;d.status='Decided';d.decidedAt=new Date().toISOString();d.decidedBy=S.uid;
  d.level=t==='notice'?'Verbal':t==='warning'?'First':t==='dismiss'?'Dismissal':'Second'; // legacy field kept for old records/UI
  const exp=new Date(todayISO()+'T00:00:00');exp.setFullYear(exp.getFullYear()+1);d.expiresAt=exp.toISOString().slice(0,10);
  _pushRow('discipline',_discRow(d),'warning');
  notify(d.userId,'⚠️ Disciplinary decision: '+_dcPenLabel(d)+' — "'+d.reason+'". '+(t==='fine'?'It deducts in this month\'s payroll. ':'')+'You may raise a complaint with MOHRE.','discipline');
  const u=uById(d.userId);const m=_mgrOf(u);if(m&&m.id!==S.uid)notify(m.id,'⚠️ Decision recorded for '+fullName(u)+': '+_dcPenLabel(d),'discipline');
  log(fullName(me()),'Disciplinary decision'+(past?' (past 60-day window)':''),_dcPenLabel(d)+' · '+(u?fullName(u):''));
  saveDB();closeModal();toast('Decision recorded — on file 12 months');rr();
};
App._discDrop=(id)=>{
  if(!can('discipline','edit'))return toast('You need Discipline → Edit','err');
  const d=(DB.discipline||[]).find(x=>x.id===id);if(!d||_dcStatus(d)!=='Charge')return;
  if(!confirm('Close this case with no penalty?'))return;
  d.status='Dropped';d.decidedAt=new Date().toISOString();d.decidedBy=S.uid;
  _pushRow('discipline',_discRow(d),'warning');
  notify(d.userId,'✅ The disciplinary case ("'+d.reason+'") was closed with no penalty.','discipline');
  log(fullName(me()),'Disciplinary case dropped',(uById(d.userId)?fullName(uById(d.userId)):''));
  saveDB();toast('Case closed — no penalty','warn');rr();
};
App._discDel=(id)=>{if(!can('discipline','delete'))return toast('You need Discipline → Delete','err');if(!confirm('Remove this record from file?'))return;DB.discipline=DB.discipline.filter(x=>x.id!==id);_delRow('discipline',id,'warning');saveDB();toast('Removed','warn');rr();};
function disciplinePage(){
  const canMng=can('discipline','create')||can('discipline','edit')||can('discipline','delete');
  const canEdit=can('discipline','edit');
  const f=scopeFilter('discipline');
  const today=todayISO();
  let mine=(DB.discipline||[]).filter(d=>canMng||f(d.userId)||d.userId===S.uid).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  const F=S.filters;
  const dPeople=[...new Set(mine.map(d=>d.userId))];
  if(F.dcUser)mine=mine.filter(d=>d.userId===F.dcUser);
  if(F.dcStatus==='open')mine=mine.filter(d=>_dcStatus(d)==='Charge');
  if(F.dcStatus==='active')mine=mine.filter(d=>_dcStatus(d)==='Decided'&&(!d.expiresAt||d.expiresAt>=today));
  if(F.dcStatus==='expired')mine=mine.filter(d=>_dcStatus(d)==='Decided'&&d.expiresAt&&d.expiresAt<today);
  if(F.dcStatus==='dropped')mine=mine.filter(d=>_dcStatus(d)==='Dropped');
  if(F.dcQ){const q=F.dcQ.toLowerCase();mine=mine.filter(d=>((d.reason||'')+' '+(d.note||'')+' '+(d.defence||'')).toLowerCase().includes(q));}
  const open=mine.filter(d=>_dcStatus(d)==='Charge').length;
  const dcBar=`<div class="ui-card" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:10px 12px;margin-bottom:12px">
    <input id="dc-q" value="${esc(F.dcQ||'')}" oninput="S.filters.dcQ=this.value;App._searchRR('dc-q')" placeholder="Search reason / statement…" class="ui-input" style="flex:1;min-width:140px;height:32px;min-height:0;padding:4px 12px;font-size:12.5px"/>
    <select onchange="S.filters.dcUser=this.value;rr()" class="ui-select" style="font-size:12px;padding:6px 26px 6px 10px;min-height:0;height:32px;width:auto"><option value="">All people</option>${dPeople.map(id=>{const u2=uById(id);return`<option value="${id}" ${F.dcUser===id?'selected':''}>${esc(u2?fullName(u2):id)}</option>`;}).join('')}</select>
    <select onchange="S.filters.dcStatus=this.value;rr()" class="ui-select" style="font-size:12px;padding:6px 26px 6px 10px;min-height:0;height:32px;width:auto"><option value="">Everything</option><option value="open" ${F.dcStatus==='open'?'selected':''}>Open cases${open?' ('+open+')':''}</option><option value="active" ${F.dcStatus==='active'?'selected':''}>On file</option><option value="expired" ${F.dcStatus==='expired'?'selected':''}>Expired</option><option value="dropped" ${F.dcStatus==='dropped'?'selected':''}>Dropped</option></select>
    ${(F.dcQ||F.dcUser||F.dcStatus)?`<button onclick="S.filters.dcQ='';S.filters.dcUser='';S.filters.dcStatus='';rr()" class="ui-btn ui-btn-ghost ui-btn-sm">Clear</button>`:''}
  </div>`;
  const penC={notice:['#FFFBEB','#B45309'],warning:['#FFF7ED','#C2410C'],fine:['#FFF1F2','#BE123C'],suspend:['#FFF1F2','#BE123C'],bonus:['#F5F3FF','#6D28D9'],promotion:['#F5F3FF','#6D28D9'],dismiss:['#1C212B','#fff']};
  const lvC={Verbal:['#FFFBEB','#B45309'],First:['#FFF7ED','#C2410C'],Second:['#FFF1F2','#BE123C'],Dismissal:['#1C212B','#fff']};
  const step=(n,label,done,warn)=>`<span style="display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:800;color:${done?'#0B7A55':warn?'#BE123C':'var(--c-text-3)'}"><span style="width:16px;height:16px;border-radius:50%;display:grid;place-items:center;background:${done?'#0E9F6E':warn?'#BE123C':'var(--c-border)'};color:#fff;font-size:9px">${done?'✓':n}</span>${label}</span>`;
  const rows=mine.map(d=>{
    const u=uById(d.userId);const by=uById(d.issuedBy);
    const st=_dcStatus(d);const expired=st==='Decided'&&d.expiresAt&&d.expiresAt<today;
    const pk=d.penalty?d.penalty.type:null;
    const [bg,fg]=pk?(penC[pk]||['#F6F7F8','#6B7280']):(lvC[d.level]||['#F6F7F8','#6B7280']);
    const lateCharge=d.discoveredAt&&String(d.createdAt).slice(0,10)>_isoAdd(d.discoveredAt,30);
    const due=st==='Charge'?_dcDeadline(d):null;const pastDue=due&&today>due;
    const stepper=`<div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:6px">
      ${step(1,'Charge '+fmtS(String(d.createdAt).slice(0,10)),true)}<span style="color:var(--c-border)">—</span>
      ${step(2,d.defenceAt?'Statement '+fmtS(String(d.defenceAt).slice(0,10)):'Statement pending',!!d.defenceAt,st==='Charge'&&!d.defenceAt)}<span style="color:var(--c-border)">—</span>
      ${step(3,st==='Decided'?'Decided '+fmtS(String(d.decidedAt).slice(0,10)):st==='Dropped'?'Dropped':'Decide by '+(due?fmtS(due):'—'),st!=='Charge',pastDue)}
    </div>`;
    return `<div class="ui-card" style="padding:13px 14px;margin-bottom:8px;display:flex;gap:11px;align-items:flex-start;${expired?'opacity:.55':''}${st==='Charge'?'border-left:4px solid #B45309':''}">
      ${u?avatar(u,'w-9 h-9','text-xs'):''}
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span class="fd" style="font-size:13.5px;font-weight:800;color:var(--c-text)">${u?esc(fullName(u)):'—'}</span>
          ${st==='Charge'?`<span style="font-size:10px;font-weight:800;padding:2px 9px;border-radius:20px;background:#FFFBEB;color:#B45309">OPEN CASE</span>`:st==='Dropped'?`<span style="font-size:10px;font-weight:800;padding:2px 9px;border-radius:20px;background:#F6F7F8;color:#6B7280">DROPPED</span>`:`<span style="font-size:10px;font-weight:800;padding:2px 9px;border-radius:20px;background:${bg};color:${fg}">${esc(_dcPenLabel(d))}</span>`}
          ${lateCharge?'<span title="Charged more than 30 days after discovery (Art 39)" style="font-size:10px;font-weight:800;color:#BE123C">CHARGED LATE</span>':''}
          ${expired?'<span style="font-size:10px;font-weight:800;color:var(--c-text-3)">EXPIRED</span>':''}</div>
        <div style="font-size:12.5px;color:var(--c-text);margin-top:3px;font-weight:600">${esc(d.reason)}</div>
        ${d.note?`<div style="font-size:12px;color:var(--c-text-2);margin-top:2px">${esc(d.note)}</div>`:''}
        ${d.defence?`<div style="font-size:11.5px;color:var(--c-text-2);margin-top:4px;background:var(--c-surface-2);border-radius:8px;padding:6px 9px"><b style="font-size:10px;text-transform:uppercase;color:var(--c-text-3)">Statement</b><br>${esc(d.defence)}</div>`:''}
        ${stepper}
        <div style="font-size:10.5px;color:var(--c-text-3);margin-top:5px">by ${by?esc(fullName(by)):'—'}${d.discoveredAt?' · discovered '+fmtS(d.discoveredAt):''}${st==='Decided'&&d.expiresAt?' · on file until '+fmtS(d.expiresAt):''}${pk==='fine'?' · deducts in payroll (≤5 days/mo — Art 25/39)':''}</div>
        ${st==='Charge'?`<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
          ${d.userId===S.uid&&!d.defence?btn('Submit my statement',`App._discDefend('${d.id}')`,{variant:'primary',size:'sm'}):''}
          ${canEdit&&!d.defence?btn('Record statement',`App._discDefend('${d.id}')`,{variant:'ghost',size:'sm'}):''}
          ${canEdit?btn('Decide penalty',`App._discDecideM('${d.id}')`,{variant:'primary',size:'sm'}):''}
          ${canEdit?btn('Close · no penalty',`App._discDrop('${d.id}')`,{variant:'ghost',size:'sm'}):''}
        </div>`:''}
      </div>
      ${can('discipline','delete')?`<button onclick="App._discDel('${d.id}')" style="width:26px;height:26px;display:grid;place-items:center;border:none;background:transparent;color:var(--c-text-3);cursor:pointer">${ic('trash','w-3.5 h-3.5')}</button>`:''}
    </div>`;
  }).join('');
  return `<div class="fade">${hdr('Discipline','Due-process cases — charge → statement → statutory penalty (Art 39) · 12-month file',can('discipline','create')?btnP('Open a case','App._discNew()','plus'):'')}
    ${_howBar('discipline')}
    ${dcBar}
    ${rows||empty('alert','Nothing on file','Cases follow the legal process: written charge → the colleague\'s statement → a penalty from the statutory ladder. Decided records stay 12 months, then expire.')}
  </div>`;
}

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.disciplinePage=disciplinePage;window.DC_PEN=DC_PEN;window.DC_LIM=DC_LIM;window._dcStatus=_dcStatus;window._dcPenLabel=_dcPenLabel;window._dcDeadline=_dcDeadline;
