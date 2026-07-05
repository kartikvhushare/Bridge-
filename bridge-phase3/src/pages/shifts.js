

/* ── SHIFT ROSTER (revived over the existing shifts table) ── */
function shiftsPage(){
  const canMng=can('scheduling','manage');
  const f=scopeFilter('scheduling');
  const today=todayISO();
  S.filters.shWk=S.filters.shWk||0;
  const ref=new Date(today+'T00:00:00');const dow=ref.getDay();ref.setDate(ref.getDate()+(dow===0?-6:1-dow)+S.filters.shWk*7);
  const week=Array.from({length:7},(_,i)=>{const d2=new Date(ref);d2.setDate(d2.getDate()+i);return d2.toISOString().slice(0,10);});
  let people=canMng?DB.users.filter(u=>u.status==='Active'&&u.role!=='Admin'&&(f(u.id)||isAdmin()||isSubAdmin())):[me()].filter(Boolean);
  // department / sub-department filter
  const FD=S.filters;
  const topD=topDepts();
  const subD=FD.shDept?subDepts((topD.find(d=>d.name===FD.shDept)||{}).id||''):[];
  if(FD.shSub)people=people.filter(u=>u.department===FD.shSub);
  else if(FD.shDept){const names=new Set([FD.shDept,...subD.map(s2=>s2.name)]);people=people.filter(u=>names.has(u.department));}
  const offToday=DB.users.filter(u=>u.status==='Active'&&(_onLeaveToday(u.id,today)||(u.hrm?.schedule?.offDays||[]).includes(dayAbbr(today))));
  const cell=(u,d2)=>{
    const sh=(DB.shifts||[]).find(s=>s.userId===u.id&&s.date===d2);
    const off=(u.hrm?.schedule?.offDays||[]).includes(dayAbbr(d2));
    const onLv=_onLeaveToday(u.id,d2);
    if(onLv)return `<div style="font-size:10px;font-weight:800;color:#B45309;background:#FFFBEB;border-radius:7px;padding:5px 4px;text-align:center">LEAVE</div>`;
    if(sh)return `<div ${canMng?`onclick="App._shEdit('${u.id}','${d2}')" style="cursor:pointer;`:'style="'}font-size:10px;font-weight:800;color:${sh.status==='published'?'#0B7A55':'#92400E'};background:${sh.status==='published'?'#ECFDF5':'#FEF3C7'};border-radius:7px;padding:5px 3px;text-align:center" title="${esc(sh.note||'')}${sh.status==='draft'?' (draft)':''}">${esc(sh.start)}–${esc(sh.end)}</div>`;
    if(off)return canMng
      ?`<button onclick="App._shEdit('${u.id}','${d2}')" title="Add a shift (any day, including Sundays)" style="width:100%;border:1px dashed var(--c-border);background:transparent;border-radius:7px;color:var(--c-text-3);font-size:11px;cursor:pointer;padding:4px 0">+</button>`
      :`<div style="text-align:center;color:var(--c-text-3);font-size:10px;padding:5px 0">—</div>`;
    return canMng?`<button onclick="App._shEdit('${u.id}','${d2}')" style="width:100%;border:1px dashed var(--c-border);background:transparent;border-radius:7px;color:var(--c-text-3);font-size:11px;cursor:pointer;padding:4px 0">+</button>`:'<div style="text-align:center;color:var(--c-text-3);font-size:10px;padding:5px 0">—</div>';
  };
  const draftN=(DB.shifts||[]).filter(s=>s.status==='draft'&&week.includes(s.date)).length;
  return `<div class="fade">${hdr('Shifts','Weekly roster — publish so colleagues see their shifts',(canMng?btn('Copy last week',`App._shCopyWeek('${week[0]}')`,{variant:'ghost',icon:'copy'}):'')+(canMng&&draftN?btn('Publish week ('+draftN+')','App._shPublish(\''+week[0]+'\',\''+week[6]+'\')',{variant:'primary',icon:'check'}):''))}
    ${_howBar('shifts')}
    ${offToday.length?`<div class="ui-card" style="padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span style="font-size:11.5px;font-weight:800;color:var(--c-text-2)">Off / on leave today:</span>${offToday.slice(0,10).map(u=>`<span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:var(--c-text-2)">${avatar(u,'w-5 h-5','text-[8px]')}${esc(fullName(u))}</span>`).join('')}</div>`:''}
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:10px;flex-wrap:wrap">
      <button onclick="S.filters.shWk--;rr()" class="ui-btn ui-btn-ghost ui-btn-sm">‹ Prev</button>
      <button onclick="S.filters.shWk=0;rr()" class="ui-btn ui-btn-ghost ui-btn-sm">This week</button>
      <button onclick="S.filters.shWk++;rr()" class="ui-btn ui-btn-ghost ui-btn-sm">Next ›</button>
      <span style="font-size:12px;font-weight:700;color:var(--c-text-2);margin-left:6px">${fmtS(week[0])} → ${fmtS(week[6])}</span>
      <span style="flex:1"></span>
      <select onchange="S.filters.shDept=this.value;S.filters.shSub='';rr()" class="ui-select" style="width:auto;min-height:0;height:32px;font-size:12px;padding:4px 24px 4px 9px"><option value="">All departments</option>${topD.map(d=>`<option ${FD.shDept===d.name?'selected':''}>${esc(d.name)}</option>`).join('')}</select>
      ${subD.length?`<select onchange="S.filters.shSub=this.value;rr()" class="ui-select" style="width:auto;min-height:0;height:32px;font-size:12px;padding:4px 24px 4px 9px"><option value="">All sub-departments</option>${subD.map(s2=>`<option ${FD.shSub===s2.name?'selected':''}>${esc(s2.name)}</option>`).join('')}</select>`:''}
    </div>
    <div class="ui-card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:720px">
      <thead><tr><th style="text-align:left;padding:9px 12px;font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase">Person</th>${week.map(d2=>`<th style="padding:9px 6px;font-size:10px;font-weight:800;color:${d2===today?'var(--c-brand-ink)':'var(--c-text-3)'};text-transform:uppercase">${dayAbbr(d2)} ${new Date(d2+'T00:00:00').getDate()}</th>`).join('')}</tr></thead>
      <tbody>${people.map(u=>`<tr style="border-top:1px solid var(--c-border)"><td style="padding:8px 12px"><div style="display:flex;align-items:center;gap:8px">${avatar(u,'w-7 h-7','text-[10px]')}<span style="font-size:12.5px;font-weight:700;color:var(--c-text);white-space:nowrap">${esc(fullName(u))}</span></div></td>${week.map(d2=>`<td style="padding:5px 4px;min-width:78px">${cell(u,d2)}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="8">${empty('clock','Nobody to roster','')}</td></tr>`}</tbody>
    </table></div>
    ${canMng?'<div style="font-size:11px;color:var(--c-text-3);margin-top:8px">Amber = draft (only you see it) · green = published. Click a cell to edit.</div>':''}
  </div>`;
}
App._shEdit=(uid2,date)=>{
  if(!can('scheduling','manage'))return;
  // Anti-self-edit guard: your own shift, created by someone else (your manager/HR) → locked for you.
  const ex0=(DB.shifts||[]).find(s=>s.userId===uid2&&s.date===date);
  if(ex0&&ex0.userId===S.uid&&ex0.createdBy&&ex0.createdBy!==S.uid)return toast('This shift was set for you by '+(uById(ex0.createdBy)?fullName(uById(ex0.createdBy)):'your manager')+' — only they (or someone above) can change it','err');
  const sh=(DB.shifts||[]).find(s=>s.userId===uid2&&s.date===date);
  const u=uById(uid2);
  modalShell({title:'Shift — '+fullName(u),sub:fmtD(date),size:'max-w-sm',
    body:`<div style="display:flex;flex-direction:column;gap:12px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label style="display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;margin-bottom:6px">Start</label><input id="sh-start" type="time" value="${esc(sh?.start||'09:00')}" class="ui-input rf"/></div>
        <div><label style="display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;margin-bottom:6px">End</label><input id="sh-end" type="time" value="${esc(sh?.end||'18:00')}" class="ui-input rf"/></div>
      </div>
      <div><label style="display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;margin-bottom:6px">Location</label><select id="sh-loc" class="ui-select rf"><option value="">— Any —</option>${(DB.locations||[]).filter(l=>l.status==='Active').map(l=>`<option value="${l.id}" ${sh?.locationId===l.id?'selected':''}>${esc(l.name)}</option>`).join('')}</select></div>
      <div><label style="display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;margin-bottom:6px">Note</label><input id="sh-note" value="${esc(sh?.note||'')}" class="ui-input rf" placeholder="Optional"/></div>
    </div>`,
    footer:(sh?btn('Remove',`App._shDel('${sh.id}')`,{variant:'danger',size:'sm'}):'')+btnG('Cancel','App.closeModal()')+btnP('Save shift',`App._shSave('${uid2}','${date}','${sh?sh.id:''}')`)});
};
App._shSave=(uid2,date,id)=>{
  if(!can('scheduling','manage'))return;
  const _ex=id?(DB.shifts||[]).find(s=>s.id===id):null;
  if(_ex&&_ex.userId===S.uid&&_ex.createdBy&&_ex.createdBy!==S.uid)return toast('You can\'t change a shift set for you by someone else','err');
  const start=document.getElementById('sh-start')?.value,end=document.getElementById('sh-end')?.value;
  if(!start||!end)return toast('Set start and end','err');
  let sh=id?(DB.shifts||[]).find(s=>s.id===id):null;
  if(!sh){sh={id:uid('sh'),userId:uid2,date,createdBy:S.uid,createdAt:new Date().toISOString(),status:'draft',publishedAt:null};DB.shifts.push(sh);}
  const wasPublished=sh.status==='published';
  sh.start=start;sh.end=end;sh.locationId=document.getElementById('sh-loc')?.value||null;sh.note=document.getElementById('sh-note')?.value||'';
  if(wasPublished){sh.status='draft';if(sh.userId!==S.uid)notify(sh.userId,'📅 Your published shift on '+fmtS(sh.date)+' is being changed — you\'ll be re-notified when the week is published again','shift','shifts');}
  log(fullName(me()),'Shift saved',fullName(uById(uid2))+' · '+date);
  saveDB();closeModal();toast('Shift saved (draft — publish the week to share)');rr();
};
App._shDel=(id)=>{
  const _ex=(DB.shifts||[]).find(s=>s.id===id);
  if(_ex&&_ex.userId===S.uid&&_ex.createdBy&&_ex.createdBy!==S.uid)return toast('You can\'t remove a shift set for you by someone else','err');
  if(_ex)log(fullName(me()),'Shift removed',fullName(uById(_ex.userId))+' · '+_ex.date);
  DB.shifts=(DB.shifts||[]).filter(s=>s.id!==id);sb.from('shifts').delete().eq('id',id).then(()=>{}).catch(()=>{});saveDB();closeModal();toast('Shift removed','warn');rr();};
App._shCopyWeek=(ws)=>{
  if(!can('scheduling','manage'))return;
  const start=new Date(ws+'T00:00:00');
  let n=0;
  for(let i=0;i<7;i++){
    const d2=new Date(start);d2.setDate(d2.getDate()+i);const cur=d2.toISOString().slice(0,10);
    const prev=new Date(d2);prev.setDate(prev.getDate()-7);const pd=prev.toISOString().slice(0,10);
    (DB.shifts||[]).filter(s2=>s2.date===pd).forEach(s2=>{
      if((DB.shifts||[]).some(x=>x.userId===s2.userId&&x.date===cur))return;
      const c={id:uid('sh'),userId:s2.userId,date:cur,start:s2.start,end:s2.end,locationId:s2.locationId||null,note:s2.note||'',status:'draft',publishedAt:null,createdBy:S.uid,createdAt:new Date().toISOString()};
      DB.shifts.push(c);n++;
    });
  }
  log(fullName(me()),'Roster copied from last week',ws+' ('+n+' shifts)');
  saveDB();toast(n?n+' shifts copied as drafts — review then Publish':'Nothing to copy from last week',n?'ok':'warn');rr();
};
App._shPublish=(ws,we)=>{
  if(!can('scheduling','manage'))return;
  const drafts=(DB.shifts||[]).filter(s=>s.status==='draft'&&s.date>=ws&&s.date<=we);
  drafts.forEach(s=>{s.status='published';s.publishedAt=new Date().toISOString();if(s.userId!==S.uid)notify(s.userId,'📅 Shift published: '+fmtS(s.date)+' '+s.start+'–'+s.end,'shift','shifts');});
  log(fullName(me()),'Roster published',ws+' → '+we+' ('+drafts.length+' shifts)');
  saveDB();toast(drafts.length+' shift'+(drafts.length===1?'':'s')+' published');rr();
};

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.shiftsPage=shiftsPage;
