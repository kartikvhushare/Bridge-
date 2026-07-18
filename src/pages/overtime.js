

/* ── OVERTIME — capture, caps, approval, pay or time-in-lieu (comp-off ledger).
   R22 (UAE Art 19): entries are typed — normal ×1.25 · night 22:00–04:00 ×1.5 · rest-day/holiday ×1.5
   (floors; HR Config can raise, never lower). Daily cap 2h + weekly cap. The rate is FROZEN on the
   entry at approval time so later config changes never rewrite history. Rest-day lieu = substitute day. ── */
const OT_KINDS={normal:'Normal',night:'Night 10pm–4am',rest:'Rest-day / holiday'};
function _otKindBadge(o){
  const k=o.kind==='night'?'night':o.kind==='rest'?'rest':'normal';
  const C={normal:['#EFF6FF','#1D4ED8'],night:['#EEF2FF','#4338CA'],rest:['#FFF7ED','#C2410C']}[k];
  const r=Number(o.rate)>=1?Number(o.rate):_otRateOf(o);
  return `<span title="${OT_KINDS[k]} — paid ×${r}${o.rate?' (frozen at approval)':''}" style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:20px;background:${C[0]};color:${C[1]}">${OT_KINDS[k].split(' ')[0]} ×${r}</span>`;
}
function _otWeekOf(date){const d=new Date(date+'T00:00:00');d.setDate(d.getDate()-((d.getDay()+6)%7));const ws=d.toISOString().slice(0,10);const e=new Date(d);e.setDate(e.getDate()+6);return{ws,we:e.toISOString().slice(0,10)};}
App._otNew=()=>{
  if(!can('overtime','submit'))return toast('You need Overtime → Submit','err');
  const A=DB.hrmConfig?.alerts||{};const m=_otMults();
  modalShell({title:'Log overtime',size:'max-w-sm',
    body:`<div style="display:flex;flex-direction:column;gap:12px">
      <div><label style="display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;margin-bottom:6px">Date</label><input id="ot-date" type="date" value="${todayISO()}" class="ui-input rf" onchange="App._otHint()"/></div>
      <div><label style="display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;margin-bottom:6px">Hours *</label><input id="ot-hours" type="number" min="0.5" step="0.5" class="ui-input rf" placeholder="e.g. 2"/></div>
      <div><label style="display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;margin-bottom:6px">Reason *</label><input id="ot-reason" class="ui-input rf" placeholder="What required the extra hours?"/></div>
      <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600;color:var(--c-text);cursor:pointer"><input id="ot-night" type="checkbox" onchange="App._otHint()"/> Night hours (10pm–4am) — paid ×${m.night}</label>
      <div id="ot-kind-hint" style="font-size:11px;font-weight:700;border-radius:9px;padding:7px 11px;background:var(--c-surface-2);color:var(--c-text-2)"></div>
      <div style="font-size:11px;color:var(--c-text-3)">Caps (Art 19): ${Number(A.otDailyCap)||2}h/day · ${Number(A.otWeeklyCap)||10}h/week. Your manager approves as payment or time-in-lieu.</div>
    </div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Submit','App._otSave()')});
  App._otHint();
};
App._otHint=()=>{
  const el=document.getElementById('ot-kind-hint');if(!el)return;
  const date=document.getElementById('ot-date')?.value||todayISO();
  const night=!!document.getElementById('ot-night')?.checked;
  const m=_otMults();const kind=_otKindFor(me(),date);
  el.textContent=kind==='rest'?'Rest-day / holiday overtime → paid ×'+m.rest+' (or substitute day if approved as time-in-lieu) — Art 19'
    :night?'Night overtime (10pm–4am) → paid ×'+m.night+' — Art 19'
    :'Normal overtime → paid ×'+m.normal;
};
App._otSave=()=>{
  const date=document.getElementById('ot-date')?.value,hours=parseFloat(document.getElementById('ot-hours')?.value),reason=(document.getElementById('ot-reason')?.value||'').trim();
  const night=!!document.getElementById('ot-night')?.checked;
  if(!date||!isFinite(hours)||hours<=0)return toast('Enter the hours','err');
  if(!reason)return toast('Reason is required','err');
  const A=DB.hrmConfig?.alerts||{};
  const dCap=Number(A.otDailyCap)||2;                                   // UAE Art 19: max 2h overtime/day
  const dayH=(DB.overtime||[]).filter(o=>o.userId===S.uid&&o.date===date&&o.status!=='Rejected'&&o.status!=='Deleted').reduce((a,o)=>a+o.hours,0);
  if(dayH+hours>dCap)return toast('Over the daily cap (Art 19: '+dCap+'h/day) — you already have '+dayH+'h on '+fmtS(date),'err');
  const cap=Number(A.otWeeklyCap)||10;
  const{ws,we}=_otWeekOf(date);
  const wkH=(DB.overtime||[]).filter(o=>o.userId===S.uid&&o.date>=ws&&o.date<=we&&o.status!=='Rejected'&&o.status!=='Deleted').reduce((a,o)=>a+o.hours,0);
  if(wkH+hours>cap)return toast('Over the weekly cap ('+cap+'h): you already have '+wkH+'h this week','err');
  let kind=_otKindFor(me(),date);if(kind!=='rest'&&night)kind='night';  // rest-day already carries the higher floor
  const o={id:uid('ot'),userId:S.uid,date,hours,reason,kind,rate:null,status:'Pending',comp:null,decidedBy:null,decidedAt:null,decisionNote:'',createdAt:new Date().toISOString()};
  DB.overtime.push(o);_pushRow('overtime',_otRow(o),'overtime');
  const m=_mgrOf(me());if(m)notify(m.id,'⏱️ Overtime submitted: '+fullName(me())+' · '+hours+'h ('+OT_KINDS[kind]+') on '+fmtS(date),'overtime','overtime');
  log(fullName(me()),'Overtime submitted',hours+'h '+kind+' '+date);
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
  if(action==='approve')o.rate=_otRateOf(o);                            // R22: freeze the legal rate on the entry
  if(action==='approve'&&o.comp==='lieu'){
    const u=uById(o.userId);
    if(u){_ensureHrm(u);const days=Math.round((o.hours/8)*100)/100;
      const em=Number(DB.hrmConfig?.alerts?.compOffExpiryMonths);      // R22: 0 / unset = never expires (UAE-safe)
      let expiry=null;
      if(isFinite(em)&&em>0){const exp=new Date(todayISO()+'T00:00:00');exp.setMonth(exp.getMonth()+em);expiry=exp.toISOString().slice(0,10);}
      u.hrm.compOff=u.hrm.compOff||[];u.hrm.compOff.push({id:uid('co'),days,reason:'Time-in-lieu · OT '+o.hours+'h on '+o.date+(o.kind==='rest'?' (rest-day substitute)':''),expiry,at:new Date().toISOString(),by:S.uid});
    }
  }
  _pushRow('overtime',_otRow(o),'overtime');
  notify(o.userId,'⏱️ Overtime '+o.status.toLowerCase()+(o.comp?' ('+(o.comp==='lieu'?'time-in-lieu → comp-off':'payment ×'+o.rate)+')':'')+': '+o.hours+'h on '+fmtS(o.date),'overtime','overtime');
  if(o.status==='Approved'&&o.comp==='lieu'&&_hnpEmail('email_hrm_comp_off'))queueEmail('hrm_comp_off',o.userId,null,o.date,{days:(o.hours/8).toFixed(2)}); // FINAL-FIX: wire dormant template
  log(fullName(me()),'Overtime '+o.status.toLowerCase(),o.hours+'h ×'+(o.rate||'—')+' · '+(uById(o.userId)?fullName(uById(o.userId)):''));
  saveDB();rr();
};
function overtimePage(){
  const canAppr=can('overtime','approve');
  const f=scopeFilter('overtime');
  const mine=(DB.overtime||[]).filter(o=>o.status!=='Deleted'&&(o.userId===S.uid||canAppr&&f(o.userId))).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const pend=mine.filter(o=>o.status==='Pending'&&o.userId!==S.uid);
  const stC={Pending:['#FFFBEB','#B45309'],Approved:['#ECFDF5','#047857'],Rejected:['#FFF1F2','#9F1239']};
  const A=DB.hrmConfig?.alerts||{};const wCap=Number(A.otWeeklyCap)||10;
  const{ws,we}=_otWeekOf(todayISO());
  const myWk=(DB.overtime||[]).filter(o=>o.userId===S.uid&&o.date>=ws&&o.date<=we&&o.status!=='Rejected'&&o.status!=='Deleted').reduce((a,o)=>a+o.hours,0);
  const wkPct=Math.min(100,Math.round(myWk/wCap*100));
  const meter=can('overtime','submit')?`<div class="ui-card" style="padding:11px 14px;margin-bottom:12px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <span style="font-size:11px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em">My week</span>
      <div style="flex:1;min-width:140px;height:8px;background:var(--c-surface-2);border-radius:4px;overflow:hidden"><div style="width:${wkPct}%;height:100%;background:${wkPct>=100?'#BE123C':wkPct>=70?'#B45309':'#0E9F6E'}"></div></div>
      <span style="font-size:12px;font-weight:800;color:var(--c-text)">${fmtH(myWk)} / ${wCap}h</span>
      <span style="font-size:10.5px;color:var(--c-text-3)">daily cap ${Number(A.otDailyCap)||2}h (Art 19) · normal ×${_otMults().normal} · night & rest-day ×${_otMults().night}</span>
    </div>`:'';
  const row=o=>{
    const u=uById(o.userId);const [bg,fg]=stC[o.status];
    return `<div class="ui-card" style="padding:12px 14px;margin-bottom:7px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      ${u?avatar(u,'w-8 h-8','text-[10px]'):''}
      <div style="flex:1;min-width:150px">
        <div style="font-size:13px;font-weight:700;color:var(--c-text);display:flex;align-items:center;gap:7px;flex-wrap:wrap">${u?esc(fullName(u)):'—'} · <span style="color:var(--c-brand-ink)">${fmtH(o.hours)}</span> on ${fmtS(o.date)} ${_otKindBadge(o)}</div>
        <div style="font-size:11.5px;color:var(--c-text-2)">${esc(o.reason)}${o.comp?' · '+(o.comp==='lieu'?(o.kind==='rest'?'substitute day (lieu)':'time-in-lieu'):'payment'):''}</div>
      </div>
      <span style="font-size:10.5px;font-weight:800;padding:3px 10px;border-radius:20px;background:${bg};color:${fg}">${o.status}</span>
      ${o.status==='Rejected'&&canAppr?`<button onclick="App._otSoftDel('${o.id}')" title="Remove from list (kept in database + audit)" style="width:26px;height:26px;display:grid;place-items:center;border:none;background:transparent;color:var(--c-text-3);cursor:pointer">${ic('trash','w-3.5 h-3.5')}</button>`:''}
      ${o.status==='Pending'&&canAppr&&o.userId!==S.uid?`<div style="display:flex;gap:6px;flex-wrap:wrap">
        ${btn('Pay ×'+_otRateOf(o),`App._otDecide('${o.id}','approve','pay')`,{variant:'primary',size:'sm'})}
        ${btn(o.kind==='rest'?'Substitute day':'Time-in-lieu',`App._otDecide('${o.id}','approve','lieu')`,{variant:'ghost',size:'sm'})}
        ${btn('Reject',`App._otDecide('${o.id}','reject')`,{variant:'danger',size:'sm'})}
      </div>`:''}
    </div>`;
  };
  return `<div class="fade">${hdr('Overtime','Typed hours at legal rates — normal ×1.25, night & rest-day ×1.5 (Art 19)',can('overtime','submit')?btnP('Log overtime','App._otNew()','plus'):'')}
    ${_howBar('overtime')}
    ${meter}
    ${pend.length?`<div style="font-size:11px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">To review (${pend.length})</div>${pend.map(row).join('')}<div style="height:10px"></div>`:''}
    <div style="font-size:11px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">All entries</div>
    ${mine.map(row).join('')||empty('clock','No overtime yet','Log extra hours worked — your manager approves as payment (at the legal rate) or time-in-lieu (comp-off).')}
  </div>`;
}

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.overtimePage=overtimePage;window.OT_KINDS=OT_KINDS;window._otKindBadge=_otKindBadge;window._otWeekOf=_otWeekOf;
