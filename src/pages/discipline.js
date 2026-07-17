

/* ── DISCIPLINE — warnings on file, 12-month retention ── */
App._discNew=()=>{
  if(!can('discipline','create'))return toast('You need Discipline → Create','err');
  const users=DB.users.filter(u=>u.status==='Active');
  modalShell({title:'Record a warning',size:'max-w-md',
    body:`<div style="display:flex;flex-direction:column;gap:12px">
      <div><label style="display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;margin-bottom:6px">Colleague</label><select id="dc-user" class="ui-select rf">${users.map(u=>`<option value="${u.id}">${esc(fullName(u))}</option>`).join('')}</select></div>
      <div><label style="display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;margin-bottom:6px">Level</label><select id="dc-level" class="ui-select rf">${['Verbal','First','Second','Dismissal'].map(l=>`<option>${l}</option>`).join('')}</select></div>
      <div><label style="display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;margin-bottom:6px">Reason *</label><input id="dc-reason" class="ui-input rf" placeholder="e.g. Repeated late arrivals"/></div>
      <div><label style="display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;margin-bottom:6px">Details</label><textarea id="dc-note" rows="3" class="ui-input rf" style="resize:vertical" placeholder="What happened, when, witnesses…"></textarea></div>
      <div style="font-size:11px;color:var(--c-text-3)">Warnings stay on file for 12 months, then expire automatically.</div>
    </div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Record warning','App._discSave()')});
};
App._discSave=()=>{
  const uid2=document.getElementById('dc-user')?.value,level=document.getElementById('dc-level')?.value,reason=(document.getElementById('dc-reason')?.value||'').trim(),note=document.getElementById('dc-note')?.value||'';
  if(!reason)return toast('Reason is required','err');
  const exp=new Date(todayISO()+'T00:00:00');exp.setFullYear(exp.getFullYear()+1);
  const d={id:uid('dsc'),userId:uid2,level,reason,note,issuedBy:S.uid,createdAt:new Date().toISOString(),expiresAt:exp.toISOString().slice(0,10)};
  DB.discipline.push(d);_pushRow('discipline',_discRow(d),'warning');
  notify(uid2,'⚠️ A '+level.toLowerCase()+' warning was recorded on your file: '+reason,'discipline');
  const u=uById(uid2);const m=_mgrOf(u);if(m&&m.id!==S.uid)notify(m.id,'⚠️ '+level+' warning recorded for '+fullName(u),'discipline');
  log(fullName(me()),'Warning recorded',level+' · '+(u?fullName(u):''));
  saveDB();closeModal();toast('Warning recorded');rr();
};
App._discDel=(id)=>{if(!can('discipline','delete'))return toast('You need Discipline → Delete','err');if(!confirm('Remove this warning from file?'))return;DB.discipline=DB.discipline.filter(x=>x.id!==id);_delRow('discipline',id,'warning');saveDB();toast('Removed','warn');rr();};
function disciplinePage(){
  const canMng=can('discipline','create')||can('discipline','edit')||can('discipline','delete');
  const f=scopeFilter('discipline');
  const today=todayISO();
  let mine=(DB.discipline||[]).filter(d=>canMng||f(d.userId)||d.userId===S.uid).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  const F=S.filters;
  const dPeople=[...new Set(mine.map(d=>d.userId))];
  if(F.dcUser)mine=mine.filter(d=>d.userId===F.dcUser);
  if(F.dcLevel)mine=mine.filter(d=>d.level===F.dcLevel);
  if(F.dcStatus==='active')mine=mine.filter(d=>!d.expiresAt||d.expiresAt>=today);
  if(F.dcStatus==='expired')mine=mine.filter(d=>d.expiresAt&&d.expiresAt<today);
  if(F.dcQ){const q=F.dcQ.toLowerCase();mine=mine.filter(d=>((d.reason||'')+' '+(d.note||'')).toLowerCase().includes(q));}
  const dcBar=`<div class="ui-card" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:10px 12px;margin-bottom:12px">
    <input id="dc-q" value="${esc(F.dcQ||'')}" oninput="S.filters.dcQ=this.value;App._searchRR('dc-q')" placeholder="Search reason…" class="ui-input" style="flex:1;min-width:140px;height:32px;min-height:0;padding:4px 12px;font-size:12.5px"/>
    <select onchange="S.filters.dcUser=this.value;rr()" class="ui-select" style="font-size:12px;padding:6px 26px 6px 10px;min-height:0;height:32px;width:auto"><option value="">All people</option>${dPeople.map(id=>{const u2=uById(id);return`<option value="${id}" ${F.dcUser===id?'selected':''}>${esc(u2?fullName(u2):id)}</option>`;}).join('')}</select>
    <select onchange="S.filters.dcLevel=this.value;rr()" class="ui-select" style="font-size:12px;padding:6px 26px 6px 10px;min-height:0;height:32px;width:auto"><option value="">Any level</option>${['Verbal','First','Second','Dismissal'].map(l=>`<option ${F.dcLevel===l?'selected':''}>${l}</option>`).join('')}</select>
    <select onchange="S.filters.dcStatus=this.value;rr()" class="ui-select" style="font-size:12px;padding:6px 26px 6px 10px;min-height:0;height:32px;width:auto"><option value="">On file + expired</option><option value="active" ${F.dcStatus==='active'?'selected':''}>On file</option><option value="expired" ${F.dcStatus==='expired'?'selected':''}>Expired</option></select>
    ${(F.dcQ||F.dcUser||F.dcLevel||F.dcStatus)?`<button onclick="S.filters.dcQ='';S.filters.dcUser='';S.filters.dcLevel='';S.filters.dcStatus='';rr()" class="ui-btn ui-btn-ghost ui-btn-sm">Clear</button>`:''}
  </div>`;
  const lvC={Verbal:['#FFFBEB','#B45309'],First:['#FFF7ED','#C2410C'],Second:['#FFF1F2','#BE123C'],Dismissal:['#1C212B','#fff']};
  const rows=mine.map(d=>{
    const u=uById(d.userId);const by=uById(d.issuedBy);const expired=d.expiresAt&&d.expiresAt<today;
    const [bg,fg]=lvC[d.level]||['#F6F7F8','#6B7280'];
    return `<div class="ui-card" style="padding:13px 14px;margin-bottom:8px;display:flex;gap:11px;align-items:flex-start;${expired?'opacity:.55':''}">
      ${u?avatar(u,'w-9 h-9','text-xs'):''}
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span class="fd" style="font-size:13.5px;font-weight:800;color:var(--c-text)">${u?esc(fullName(u)):'—'}</span>
          <span style="font-size:10px;font-weight:800;padding:2px 9px;border-radius:20px;background:${bg};color:${fg}">${d.level}${d.level!=='Verbal'&&d.level!=='Dismissal'?' warning':''}</span>
          ${expired?'<span style="font-size:10px;font-weight:800;color:var(--c-text-3)">EXPIRED</span>':''}</div>
        <div style="font-size:12.5px;color:var(--c-text);margin-top:3px;font-weight:600">${esc(d.reason)}</div>
        ${d.note?`<div style="font-size:12px;color:var(--c-text-2);margin-top:2px">${esc(d.note)}</div>`:''}
        <div style="font-size:10.5px;color:var(--c-text-3);margin-top:4px">by ${by?esc(fullName(by)):'—'} · ${fmtS(String(d.createdAt).slice(0,10))} · on file until ${fmtS(d.expiresAt)}</div>
      </div>
      ${canMng?`<button onclick="App._discDel('${d.id}')" style="width:26px;height:26px;display:grid;place-items:center;border:none;background:transparent;color:var(--c-text-3);cursor:pointer">${ic('trash','w-3.5 h-3.5')}</button>`:''}
    </div>`;
  }).join('');
  return `<div class="fade">${hdr('Discipline','Warnings on file — auto-expire after 12 months',canMng?btnP('Record warning','App._discNew()','plus'):'')}
    ${_howBar('discipline')}
    ${dcBar}
    ${rows||empty('alert','Nothing on file','Verbal, first, second and dismissal warnings recorded here stay for 12 months.')}
  </div>`;
}

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.disciplinePage=disciplinePage;
