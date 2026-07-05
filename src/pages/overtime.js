

/* ── OVERTIME — capture, caps, approval, pay or time-in-lieu (comp-off ledger) ── */
App._otNew=()=>{
  if(!can('overtime','submit'))return toast('You need Overtime → Submit','err');
  modalShell({title:'Log overtime',size:'max-w-sm',
    body:`<div style="display:flex;flex-direction:column;gap:12px">
      <div><label style="display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;margin-bottom:6px">Date</label><input id="ot-date" type="date" value="${todayISO()}" class="ui-input rf"/></div>
      <div><label style="display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;margin-bottom:6px">Hours *</label><input id="ot-hours" type="number" min="0.5" step="0.5" class="ui-input rf" placeholder="e.g. 2"/></div>
      <div><label style="display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;margin-bottom:6px">Reason *</label><input id="ot-reason" class="ui-input rf" placeholder="What required the extra hours?"/></div>
      <div style="font-size:11px;color:var(--c-text-3)">Weekly cap: ${(DB.hrmConfig?.alerts?.otWeeklyCap)||10}h. Your manager reviews weekly and approves as payment or time-in-lieu.</div>
    </div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Submit','App._otSave()')});
};
App._otSave=()=>{
  const date=document.getElementById('ot-date')?.value,hours=parseFloat(document.getElementById('ot-hours')?.value),reason=(document.getElementById('ot-reason')?.value||'').trim();
  if(!date||!isFinite(hours)||hours<=0)return toast('Enter the hours','err');
  if(!reason)return toast('Reason is required','err');
  const cap=Number(DB.hrmConfig?.alerts?.otWeeklyCap)||10;
  const wkStart=new Date(date+'T00:00:00');wkStart.setDate(wkStart.getDate()-((wkStart.getDay()+6)%7));
  const ws=wkStart.toISOString().slice(0,10);const we=new Date(wkStart);we.setDate(we.getDate()+6);const weISO=we.toISOString().slice(0,10);
  const wkH=(DB.overtime||[]).filter(o=>o.userId===S.uid&&o.date>=ws&&o.date<=weISO&&o.status!=='Rejected').reduce((a,o)=>a+o.hours,0);
  if(wkH+hours>cap)return toast('Over the weekly cap ('+cap+'h): you already have '+wkH+'h this week','err');
  const o={id:uid('ot'),userId:S.uid,date,hours,reason,status:'Pending',comp:null,decidedBy:null,decidedAt:null,decisionNote:'',createdAt:new Date().toISOString()};
  DB.overtime.push(o);_pushRow('overtime',_otRow(o),'overtime');
  const m=_mgrOf(me());if(m)notify(m.id,'⏱️ Overtime submitted: '+fullName(me())+' · '+hours+'h on '+fmtS(date),'overtime','overtime');
  log(fullName(me()),'Overtime submitted',hours+'h '+date);
  saveDB();closeModal();toast('Overtime submitted');rr();
};
App._otSoftDel=(id)=>{
  const o=(DB.overtime||[]).find(x=>x.id===id);if(!o)return;
  if(!confirm('Remove this rejected entry from the list? It stays in the database and the deletion is logged.'))return;
  o.status='Deleted';_pushRow('overtime',_otRow(o),'overtime');
  log(fullName(me()),'Deleted rejected overtime',o.hours+'h · '+(uById(o.userId)?fullName(uById(o.userId)):''));
  saveDB();toast('Removed (kept in database + audit)','warn');rr();
};
App._otDecide=(id,action,comp)=>{
  if(!can('overtime','approve'))return toast('You need Overtime → Approve','err');
  const o=(DB.overtime||[]).find(x=>x.id===id);if(!o)return;
  o.status=action==='approve'?'Approved':'Rejected';o.comp=action==='approve'?(comp||'pay'):null;o.decidedBy=S.uid;o.decidedAt=new Date().toISOString();
  if(action==='approve'&&o.comp==='lieu'){
    const u=uById(o.userId);
    if(u){_ensureHrm(u);const days=Math.round((o.hours/8)*100)/100;
      const exp=new Date(todayISO()+'T00:00:00');exp.setMonth(exp.getMonth()+3);
      u.hrm.compOff=u.hrm.compOff||[];u.hrm.compOff.push({id:uid('co'),days,reason:'Time-in-lieu · OT '+o.hours+'h on '+o.date,expiry:exp.toISOString().slice(0,10),at:new Date().toISOString(),by:S.uid});
    }
  }
  _pushRow('overtime',_otRow(o),'overtime');
  notify(o.userId,'⏱️ Overtime '+o.status.toLowerCase()+(o.comp?' ('+(o.comp==='lieu'?'time-in-lieu → comp-off':'payment')+')':'')+': '+o.hours+'h on '+fmtS(o.date),'overtime','overtime');
  if(o.status==='Approved'&&o.comp==='lieu'&&_hnpEmail('email_hrm_comp_off'))queueEmail('hrm_comp_off',o.userId,null,o.date,{days:(o.hours/8).toFixed(2)}); // FINAL-FIX: wire dormant template
  log(fullName(me()),'Overtime '+o.status.toLowerCase(),o.hours+'h · '+(uById(o.userId)?fullName(uById(o.userId)):''));
  saveDB();rr();
};
function overtimePage(){
  const canAppr=can('overtime','approve');
  const f=scopeFilter('overtime');
  const mine=(DB.overtime||[]).filter(o=>o.status!=='Deleted'&&(o.userId===S.uid||canAppr&&f(o.userId))).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const pend=mine.filter(o=>o.status==='Pending'&&o.userId!==S.uid);
  const stC={Pending:['#FFFBEB','#B45309'],Approved:['#ECFDF5','#047857'],Rejected:['#FFF1F2','#9F1239']};
  const row=o=>{
    const u=uById(o.userId);const [bg,fg]=stC[o.status];
    return `<div class="ui-card" style="padding:12px 14px;margin-bottom:7px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      ${u?avatar(u,'w-8 h-8','text-[10px]'):''}
      <div style="flex:1;min-width:150px">
        <div style="font-size:13px;font-weight:700;color:var(--c-text)">${u?esc(fullName(u)):'—'} · <span style="color:var(--c-brand-ink)">${o.hours}h</span> on ${fmtS(o.date)}</div>
        <div style="font-size:11.5px;color:var(--c-text-2)">${esc(o.reason)}${o.comp?' · '+(o.comp==='lieu'?'time-in-lieu':'payment'):''}</div>
      </div>
      <span style="font-size:10.5px;font-weight:800;padding:3px 10px;border-radius:20px;background:${bg};color:${fg}">${o.status}</span>
      ${o.status==='Rejected'&&canAppr?`<button onclick="App._otSoftDel('${o.id}')" title="Remove from list (kept in database + audit)" style="width:26px;height:26px;display:grid;place-items:center;border:none;background:transparent;color:var(--c-text-3);cursor:pointer">${ic('trash','w-3.5 h-3.5')}</button>`:''}
      ${o.status==='Pending'&&canAppr&&o.userId!==S.uid?`<div style="display:flex;gap:6px">
        ${btn('Pay',`App._otDecide('${o.id}','approve','pay')`,{variant:'primary',size:'sm'})}
        ${btn('Time-in-lieu',`App._otDecide('${o.id}','approve','lieu')`,{variant:'ghost',size:'sm'})}
        ${btn('Reject',`App._otDecide('${o.id}','reject')`,{variant:'danger',size:'sm'})}
      </div>`:''}
    </div>`;
  };
  return `<div class="fade">${hdr('Overtime','Log extra hours — weekly review, paid or time-in-lieu',can('overtime','submit')?btnP('Log overtime','App._otNew()','plus'):'')}
    ${_howBar('overtime')}
    ${pend.length?`<div style="font-size:11px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">To review (${pend.length})</div>${pend.map(row).join('')}<div style="height:10px"></div>`:''}
    <div style="font-size:11px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">All entries</div>
    ${mine.map(row).join('')||empty('clock','No overtime yet','Log extra hours worked — your manager approves as payment or time-in-lieu (comp-off).')}
  </div>`;
}

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.overtimePage=overtimePage;
