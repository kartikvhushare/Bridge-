

/* ===== OKR TAB (UI) — hierarchical objectives =====
   One tab. Summary cards on top → "due today" combined check-in panel → the L0 tree.
   Every node expands to its children (L1 under L0, L2 under L1, …) and carries TWO
   dropdown panels: ① Rules & Target (goal, metric, start→target, schedule, period, owner)
   ② Progress & Updates (current value, roll-up graph, check-ins with comments & photos,
   manual status marking, per-OKR activity log). Every change writes an okr_logs entry. */
window._OKR_EXP={};window._OKR_PANEL={};window._OKR_LOGS={};window._OKRED=null;window._OKRCI=null;window._OKRCIALL=null;
const _OKR_LVL_C=['#1C212B','#0EA5E9','#0E9F6E','#8B5CF6','#F59E0B','#EC4899'];
function _okrCanManage(){return can('okr','manage');}
function _okrCanCreate(){return can('okr','create')||_okrCanManage();}
function _okrCanEditNode(o){return isAdmin()||can('okr','edit')||_okrCanManage()||o.createdBy===S.uid||okrIsUpOwner(o);} // R15: toggle decides
function _okrCanCheckin(o){return o.ownerId===S.uid||_okrCanEditNode(o);}
/* ── Granular rights (owner request #10): relationship first, role permission on top.
      Level owner + owner of any UPPER level always can; roles gain the same power via the
      okr.editEntries / okr.changeOwner / okr.deleteLogs toggles in Access Control. ── */
function _okrCanEditEntry(o){return o.ownerId===S.uid||okrIsUpOwner(o)||can('okr','editEntries');}
function _okrCanDeleteLog(o){return o.ownerId===S.uid||okrIsUpOwner(o)||can('okr','deleteLogs');}
function _okrCanChangeOwner(o){return okrIsUpOwner(o)||can('okr','changeOwner')||_okrCanManage()||isAdmin();} // R15
function _okrLvlChip(lvl){const c=_OKR_LVL_C[lvl%_OKR_LVL_C.length];return`<span style="flex-shrink:0;font-size:10px;font-weight:800;padding:2px 7px;border-radius:6px;background:${c};color:#fff;letter-spacing:.03em">L${lvl}</span>`;}
App._okrTogExp=(id)=>{_OKR_EXP[id]=!_OKR_EXP[id];rr();};
App._okrTogPanel=(id,which)=>{_OKR_PANEL[id]=_OKR_PANEL[id]===which?null:which;rr();};
App._okrTogLogs=(id)=>{_OKR_LOGS[id]=!_OKR_LOGS[id];rr();};

function okrPage(){
  const vis=okrVisible(),canCreate=_okrCanCreate();
  const today=todayISO();
  const head=hdr('OKRs','Objectives & key results — every level (L0 / L1 / L2) is measured on its own inputs',canCreate?btn('New L0 objective','App._okrEdit(null,null)',{variant:'primary',icon:'plus'}):'');
  // ── Summary cards ──
  const sts=vis.map(o=>okrStatusOf(o));
  const cnt=x=>sts.filter(s=>s===x).length;
  const scard=(label,n,bg,fg,icon)=>`<div style="flex:1;min-width:118px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:14px;padding:13px 14px;display:flex;align-items:center;gap:10px"><span style="width:36px;height:36px;border-radius:10px;background:${bg};color:${fg};display:grid;place-items:center;flex-shrink:0">${ic(icon,'w-4 h-4')}</span><span style="min-width:0"><span class="fd" style="display:block;font-size:20px;font-weight:800;line-height:1;color:var(--c-text)">${n}</span><span style="display:block;font-size:11px;color:var(--c-text-2);margin-top:3px;white-space:nowrap">${label}</span></span></div>`;
  const summary=`<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
    ${scard('Total OKRs',vis.length,'var(--c-brand-soft)','var(--c-brand-ink)','chart')}
    ${scard('Achieved',cnt('Achieved'),'#D1FAE5','#065F46','check')}
    ${scard('On track',cnt('On track'),'#ECFDF5','#0B7A55','approve')}
    ${scard('Off track',cnt('Off track'),'#FFF1F2','#BE123C','alert')}
    ${scard('Not achieved',cnt('Not achieved'),'#FEF2F2','#991B1B','x')}
  </div>`;
  // ── My check-ins due today (combined task list) ──
  const due=okrDueForUser(S.uid,today);
  const pendDue=due.filter(o=>!okrCheckinFor(o.id,S.uid,today));
  const duePanel=due.length?`<div style="background:${pendDue.length?'var(--c-warn-soft)':'var(--c-success-soft)'};border:1px solid ${pendDue.length?'#FDE68A':'#BBF7D0'};border-radius:14px;padding:14px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <span style="width:38px;height:38px;border-radius:11px;background:var(--c-surface);color:${pendDue.length?'var(--c-warn-ink)':'var(--c-success-ink)'};display:grid;place-items:center;flex-shrink:0">${ic('clock','w-5 h-5')}</span>
      <div style="flex:1;min-width:180px">
        <div class="fd" style="font-size:14px;font-weight:800;color:var(--c-text)">OKR check-ins due today</div>
        <div style="font-size:12.5px;color:var(--c-text-2);margin-top:2px">${due.length-pendDue.length}/${due.length} updated · ${pendDue.length?esc(pendDue.slice(0,3).map(o=>o.title).join(', '))+(pendDue.length>3?' +'+(pendDue.length-3)+' more':''):'all done for today'}</div>
      </div>
      ${btn(pendDue.length?('Update now ('+pendDue.length+')'):'Review / edit',`App._okrCheckinAll('${today}')`,{variant:pendDue.length?'primary':'ghost',icon:'edit'})}
    </div>`:'';
  // ── Filters (department / owner / status / level / search) ──
  const F=S.filters;
  const fActive=!!(F.okrDept||F.okrSub||F.okrOwner||F.okrStatus||F.okrLvl||F.okrQ);
  const deptIds=[...new Set(vis.map(o=>okrRootOf(o).departmentId).filter(Boolean))];
  const subIds=F.okrDept?[...new Set(vis.map(o=>okrRootOf(o)).filter(r=>r.departmentId===F.okrDept&&r.subDepartmentId).map(r=>r.subDepartmentId))]:[];
  const ownerIds=[...new Set(vis.map(o=>o.ownerId).filter(Boolean))];
  const maxLvl=vis.reduce((m,o)=>Math.max(m,okrLevel(o)),0);
  const selSt='font-size:12px;padding:6px 26px 6px 10px;min-height:0;height:32px;width:auto';
  const fBar=vis.length?`<div class="ui-card" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:10px 12px;margin-bottom:14px">
      <input id="okr-q" value="${esc(F.okrQ||'')}" oninput="S.filters.okrQ=this.value;App._searchRR('okr-q')" placeholder="Search objectives…" class="ui-input" style="flex:1;min-width:150px;height:32px;min-height:0;padding:4px 12px;font-size:12.5px"/>
      <select onchange="S.filters.okrDept=this.value;S.filters.okrSub='';rr()" class="ui-select" style="${selSt}"><option value="">All departments</option>${deptIds.map(id=>{const d=(DB.departments||[]).find(x=>x.id===id);return`<option value="${id}" ${F.okrDept===id?'selected':''}>${esc(d?d.name:id)}</option>`;}).join('')}</select>
      ${subIds.length?`<select onchange="S.filters.okrSub=this.value;rr()" class="ui-select" style="${selSt}"><option value="">All sub-departments</option>${subIds.map(id=>{const d=(DB.departments||[]).find(x=>x.id===id);return`<option value="${id}" ${F.okrSub===id?'selected':''}>${esc(d?d.name:id)}</option>`;}).join('')}</select>`:''}
      <select onchange="S.filters.okrOwner=this.value;rr()" class="ui-select" style="${selSt}"><option value="">All owners</option>${ownerIds.map(id=>{const u2=uById(id);return`<option value="${id}" ${F.okrOwner===id?'selected':''}>${esc(u2?fullName(u2):id)}</option>`;}).join('')}</select>
      <select onchange="S.filters.okrStatus=this.value;rr()" class="ui-select" style="${selSt}"><option value="">Any status</option>${['Achieved','On track','Off track','Not achieved','No data'].map(s=>`<option ${F.okrStatus===s?'selected':''}>${s}</option>`).join('')}</select>
      <select onchange="S.filters.okrLvl=this.value;rr()" class="ui-select" style="${selSt}"><option value="">Any level</option>${Array.from({length:maxLvl+1},(_,i)=>`<option value="${i}" ${F.okrLvl===String(i)?'selected':''}>L${i}</option>`).join('')}</select>
      ${fActive?`<button onclick="S.filters.okrQ='';S.filters.okrDept='';S.filters.okrSub='';S.filters.okrOwner='';S.filters.okrStatus='';S.filters.okrLvl='';rr()" class="ui-btn ui-btn-ghost ui-btn-sm">Clear</button>`:''}
    </div>`:'';
  // ── Tree (or a flat filtered list when any filter is on) ──
  let tree;
  if(fActive){
    const q=(F.okrQ||'').toLowerCase();
    const hits=vis.filter(o=>{
      if(F.okrDept&&okrRootOf(o).departmentId!==F.okrDept)return false;
      if(F.okrSub&&okrRootOf(o).subDepartmentId!==F.okrSub)return false;
      if(F.okrOwner&&o.ownerId!==F.okrOwner)return false;
      if(F.okrStatus&&okrStatusOf(o)!==F.okrStatus)return false;
      if(F.okrLvl!==''&&F.okrLvl!==undefined&&okrLevel(o)!==Number(F.okrLvl))return false;
      if(q&&!((o.title||'').toLowerCase().includes(q)||(o.description||'').toLowerCase().includes(q)))return false;
      return true;
    });
    tree=hits.length?`<div style="font-size:11.5px;color:var(--c-text-3);margin-bottom:8px">${hits.length} match${hits.length===1?'':'es'} — showing flat list</div>`+hits.map(o=>_okrNodeHTML(o,0)).join('')
      :empty('chart','Nothing matches','Try clearing a filter.');
  }else{
    const roots=okrVisibleRoots();
    tree=roots.length?roots.map(o=>_okrNodeHTML(o,0)).join('')
      :empty('chart','No OKRs yet',canCreate?'Create your first L0 objective, assign it to a department and an owner, then add L1 / L2 sub-objectives under it.':'No OKRs have been assigned to you yet. Your manager creates them.');
  }
  return `<div class="fade">${head}${_howBar('okr')}${summary}${duePanel}${fBar}<div>${tree}</div></div>`;
}

/* COMPACT ROWS (owner request): one slim line per OKR so hundreds fit on a page.
   Row click → Progress & Updates popup. Chevron expands children (collapsed by default).
   ⋯ opens the action menu (Update / Rules & Target / Progress / Logs / Add sub / Edit / Delete). */
function _okrNodeHTML(o,depth){
  if(depth>10)return'';
  const kids=okrChildren(o.id);
  const lvl=okrLevel(o);
  const exp=!!_OKR_EXP[o.id];
  const pct=okrProgress(o);
  const st=okrStatusOf(o);
  const barC=_okrBarColor(st);
  const owner=uById(o.ownerId);
  const icBtn='width:26px;height:26px;display:grid;place-items:center;border-radius:7px;color:var(--c-text-3);background:transparent;border:none;cursor:pointer;flex-shrink:0';
  const cur=esc(_okrFmtVal(o,(okrLatestCheckin(o.id)||{}).value));
  const tgt=o.metricType==='yesno'?'Yes':esc(_okrFmtVal(o,o.targetValue));
  const row=`<div style="display:flex;align-items:center;gap:8px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:10px;margin-bottom:5px;padding:7px 10px;${depth?'margin-left:'+Math.min(depth,5)*16+'px;':''}">
    ${kids.length?`<button onclick="App._okrTogExp('${o.id}')" title="${exp?'Collapse':'Expand'} ${kids.length} sub-objective${kids.length===1?'':'s'}" style="${icBtn};transform:${exp?'rotate(90deg)':'none'};transition:transform .15s">${ic('chevR','w-4 h-4')}</button>`:`<span style="width:26px;flex-shrink:0;display:grid;place-items:center"><span style="width:4px;height:4px;border-radius:50%;background:var(--c-border)"></span></span>`}
    ${_okrLvlChip(lvl)}
    <div onclick="App._okrPop('${o.id}','progress')" role="button" tabindex="0" title="Open Progress & Updates" style="flex:1;min-width:0;cursor:pointer">
      <div class="fd" style="font-size:13.5px;font-weight:800;color:var(--c-text);line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(o.title||'Untitled')}${kids.length?` <span style="font-size:10px;font-weight:700;color:var(--c-text-3)">· ${kids.length} sub</span>`:''}</div>
      <div class="okr-meta" style="font-size:10.5px;color:var(--c-text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px">${owner?esc(fullName(owner)):'—'} · ${esc(_okrFreqLabel(o))}${o.periodStart||o.periodEnd?' · '+fmtS(o.periodStart)+' → '+fmtS(o.periodEnd):''}</div>
    </div>
    <div class="okr-bar" style="width:64px;height:5px;background:var(--c-border);border-radius:3px;overflow:hidden;flex-shrink:0"><div style="height:100%;width:${pct===null?0:Math.max(0,Math.min(100,pct))}%;background:${barC};border-radius:3px"></div></div>
    <span class="fd" style="font-size:13px;font-weight:800;color:var(--c-text);width:42px;text-align:right;flex-shrink:0">${pct===null?'—':pct+'%'}</span>
    <span style="font-size:11px;font-weight:700;color:var(--c-text-2);white-space:nowrap;flex-shrink:0" title="Current → Target (this level's own inputs)">${cur} <span style="color:var(--c-text-3)">→</span> ${tgt}</span>
    ${okrStatusChip(st,true)}
    <button onclick="App._okrMenu('${o.id}')" title="Actions" style="${icBtn};font-weight:800;font-size:15px;color:var(--c-text-2)">⋯</button>
  </div>`;
  return row+(exp?kids.map(k=>_okrNodeHTML(k,depth+1)).join(''):'');
}
/* Action menu popup — everything that used to crowd the card, one tap away. */
App._okrMenu=(id)=>{
  const o=okrById(id);if(!o)return;
  const lvl=okrLevel(o);
  const canEdit=_okrCanEditNode(o),canCk=_okrCanCheckin(o),canCreate=_okrCanCreate();
  const item=(label,icon,onclick,danger)=>`<button onclick="App.closeModal();${onclick}" style="display:flex;align-items:center;gap:10px;width:100%;padding:11px 12px;border-radius:10px;border:none;background:transparent;color:${danger?'var(--c-danger-ink)':'var(--c-text)'};font-size:13.5px;font-weight:600;cursor:pointer;text-align:left" onmouseover="this.style.background='var(--c-surface-2)'" onmouseout="this.style.background='transparent'">${ic(icon,'w-4 h-4')}${label}</button>`;
  modalShell({title:o.title||'Objective',sub:'L'+lvl+' · what do you want to do?',size:'max-w-sm',
    body:`<div style="display:flex;flex-direction:column;gap:2px">
      ${canCk?item('Add / edit update','edit',`App._okrCheckin('${id}','${todayISO()}')`):''}
      ${item('Progress & Updates','chart',`App._okrPop('${id}','progress')`)}
      ${item('Rules & Target','cog',`App._okrPop('${id}','rules')`)}
      ${item('Activity log','audit',`App._okrPop('${id}','logs')`)}
      ${canCreate?item('Add sub-objective (L'+(lvl+1)+')','plus',`App._okrEdit(null,'${id}')`):''}
      ${canEdit?item('Edit objective','edit',`App._okrEdit('${id}')`):''}
      ${canEdit?item('Delete','trash',`App._okrDelete('${id}')`,true):''}
    </div>`,
    footer:btnG('Close','App.closeModal()')});
};

/* ── Panel ①: Rules & Target ── */
function _okrRulesPanel(o){
  const owner=uById(o.ownerId),creator=uById(o.createdBy);
  const dept=(DB.departments||[]).find(d=>d.id===o.departmentId);
  const subDept=(DB.departments||[]).find(d=>d.id===o.subDepartmentId);
  const kids=okrChildren(o.id);
  const mLabel=(OKR_METRICS.find(m=>m[0]===o.metricType)||['','Number'])[1];
  const row=(l,v)=>`<div style="display:flex;flex-direction:column;gap:2px;min-width:130px"><span style="font-size:10px;font-weight:700;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em">${l}</span><span style="font-size:13px;font-weight:600;color:var(--c-text)">${v}</span></div>`;
  return `<div style="border-top:1px solid var(--c-border);background:var(--c-surface-2);padding:14px 16px">
    ${o.description?`<div style="font-size:13px;color:var(--c-text-2);line-height:1.55;margin-bottom:12px"><b style="color:var(--c-text)">Goal:</b> ${esc(o.description)}</div>`:''}
    <div style="display:flex;flex-wrap:wrap;gap:16px 26px">
      ${row('Measured as',esc(mLabel))}
      ${o.metricType==='yesno'?row('Target','Done (Yes)'):row('Start → Target',esc(_okrFmtVal(o,o.startValue))+' → '+esc(_okrFmtVal(o,o.targetValue)))}
      ${o.metricType!=='yesno'?row('Better when',o.direction==='down'?'Lower ↓':'Higher ↑'):''}
      ${row('Check-in schedule',esc(_okrFreqLabel(o)))}
      ${row('Period',(o.periodStart||o.periodEnd)?(fmtS(o.periodStart)+' → '+fmtS(o.periodEnd)):'Ongoing')}
      ${row('Owner',owner?esc(fullName(owner)):'—')}
      ${dept?row('Department',esc(dept.name)):''}
      ${subDept?row('Sub-department',esc(subDept.name)):''}
      ${row('Progress source','Own check-ins — levels are independent'+(kids.length?' ('+kids.length+' sub-objective'+(kids.length===1?'':'s')+' measured separately)':''))}
      ${row('Status',o.statusMode==='manual'?('Marked manually ('+esc(o.statusManual||'—')+')'):'Automatic')}
      ${creator?row('Created by',esc(fullName(creator))+(o.createdAt?' · '+fmtS(String(o.createdAt).slice(0,10)):'')):''}
    </div>
    ${(o.frequency||{}).type==='custom'&&((o.frequency||{}).dates||[]).length?`<div style="margin-top:10px;font-size:12px;color:var(--c-text-2)"><b>Check-in dates:</b> ${(o.frequency.dates||[]).map(d=>esc(fmtS(d))).join(', ')}</div>`:''}
    ${_okrCanEditNode(o)?`<div style="margin-top:12px">${btn('Edit rules & target',`App._okrEdit('${o.id}')`,{variant:'ghost',size:'sm',icon:'edit'})}</div>`:''}
  </div>`;
}

/* ── Popup ②: Progress & Updates (owner request #2/#3/#7/#9) ──
      Start · Current · Target · Progress stats, the graph (Actual vs Ideal, every date of the
      window, Progress % pinned top-right of the chart card), the input feed with edit/DELETE
      (level owner / upper-level owner / okr.editEntries), and an informational sub-objective
      list (independent — they do NOT feed this level). */
function _okrProgressBody(o){
  const kids=okrChildren(o.id);
  const pct=okrProgress(o),st=okrStatusOf(o);
  const last=okrLatestCheckin(o.id);
  const canCk=_okrCanCheckin(o);
  const lab='font-size:10px;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;font-weight:700';
  const big='font-size:20px;font-weight:800;color:var(--c-text)';
  const cur=esc(_okrFmtVal(o,last?last.value:null));
  const tgt=o.metricType==='yesno'?'Yes':esc(_okrFmtVal(o,o.targetValue));
  const strt=o.metricType==='yesno'?'No':esc(_okrFmtVal(o,o.startValue));
  // manual status marking (owner / manager) — every mark is logged
  const markRow=canCk?`<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:10px">
      <span style="font-size:11px;font-weight:700;color:var(--c-text-3)">MARK:</span>
      ${OKR_STATUSES.map(s=>{const on=o.statusMode==='manual'&&o.statusManual===s;const m=OKR_ST_META[s];return`<button onclick="App._okrMarkStatus('${o.id}','${s}');App._okrPop('${o.id}','progress')" style="padding:4px 10px;border-radius:20px;border:1.5px solid ${on?m.dot:'var(--c-border)'};background:${on?m.bg:'var(--c-surface)'};color:${on?m.fg:'var(--c-text-2)'};font-size:11px;font-weight:700;cursor:pointer">${s}</button>`;}).join('')}
      <button onclick="App._okrMarkStatus('${o.id}','auto');App._okrPop('${o.id}','progress')" title="Let progress decide the status" style="padding:4px 10px;border-radius:20px;border:1.5px solid ${o.statusMode!=='manual'?'var(--c-text)':'var(--c-border)'};background:${o.statusMode!=='manual'?'var(--c-ink)':'var(--c-surface)'};color:${o.statusMode!=='manual'?'#fff':'var(--c-text-2)'};font-size:11px;font-weight:700;cursor:pointer">Auto</button>
    </div>`:'';
  // input feed (latest first) — edit + delete, gated per owner rules
  const canEntry=_okrCanEditEntry(o);
  const feed=okrCheckinsOf(o.id).slice().reverse().slice(0,40).map(c=>{
    const u=uById(c.userId);
    const photos=(c.photos||[]).filter(p=>typeof p==='string'&&p!=='[photo]');
    return `<div style="display:flex;gap:10px;padding:10px 0;border-top:1px solid var(--c-border)">
      <div style="width:64px;flex-shrink:0;font-size:11.5px;color:var(--c-text-2);font-weight:600">${esc(fmtS(c.date))}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
          <span style="font-size:13px;font-weight:800;color:var(--c-brand-ink)">${esc(_okrFmtVal(o,c.value))}</span>
          ${c.statusMark?okrStatusChip(c.statusMark,true):''}
          <span style="font-size:11px;color:var(--c-text-3)">${u?esc(fullName(u)):'—'}</span>
          ${(c.editCount||0)>0?`<span style="font-size:9.5px;font-weight:800;background:#FEF3C7;color:#92400E;padding:1px 6px;border-radius:10px">edited ×${c.editCount}</span>`:''}
          ${canEntry?`<button onclick="App._okrCheckin('${o.id}','${c.date}','progress')" title="Edit this input (logged)" style="width:22px;height:22px;display:grid;place-items:center;border-radius:6px;color:var(--c-text-3);background:transparent;border:none;cursor:pointer">${ic('edit','w-3 h-3')}</button><button onclick="App._okrCkDelete('${o.id}','${c.id}')" title="Delete this input (logged)" style="width:22px;height:22px;display:grid;place-items:center;border-radius:6px;color:var(--c-danger-ink);background:transparent;border:none;cursor:pointer">${ic('trash','w-3 h-3')}</button>`:''}
        </div>
        ${c.comment?`<div style="font-size:12px;color:var(--c-text-2);font-style:italic;margin-top:3px">"${esc(c.comment)}"</div>`:''}
        ${photos.length?`<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">${photos.map(p=>`<img src="${esc(p)}" onclick="App._bigImg('${esc(p)}')" alt="Check-in photo" style="width:44px;height:44px;object-fit:cover;border-radius:8px;cursor:pointer;border:1px solid var(--c-border)"/>`).join('')}</div>`:''}
      </div>
    </div>`;
  }).join('')||`<div style="padding:12px 0;color:var(--c-text-3);font-size:12.5px;border-top:1px solid var(--c-border)">No inputs yet${canCk?' — add the first one.':'.'}</div>`;
  // sub-objective overview — informational only (levels are independent)
  const kidRows=kids.length?`<div style="margin-top:12px">
      <div style="${lab};margin-bottom:6px">Sub-objectives (measured independently — they don't feed this level)</div>
      ${kids.map(k=>{const kp=okrProgress(k),ks=okrStatusOf(k);return`<div style="display:flex;align-items:center;gap:9px;padding:6px 0">
        ${_okrLvlChip(okrLevel(k))}
        <span style="flex:1;min-width:0;font-size:12.5px;font-weight:600;color:var(--c-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(k.title)}</span>
        <div style="width:90px;height:5px;background:var(--c-border);border-radius:3px;overflow:hidden"><div style="height:100%;width:${kp===null?0:Math.max(0,Math.min(100,kp))}%;background:${_okrBarColor(ks)}"></div></div>
        <span style="font-size:12px;font-weight:800;color:var(--c-text);width:44px;text-align:right">${kp===null?'—':kp+'%'}</span>
        ${okrStatusChip(ks,true)}
      </div>`;}).join('')}
    </div>`:'';
  return `<div>
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div style="display:flex;gap:22px;flex-wrap:wrap">
        <div><div style="${lab}">Start</div><div style="${big}">${strt}</div></div>
        <div><div style="${lab}">Current</div><div style="${big}">${cur}</div></div>
        <div><div style="${lab}">Target</div><div style="${big}">${tgt}</div></div>
        <div><div style="${lab}">Status</div><div style="margin-top:3px">${okrStatusChip(st)}</div></div>
      </div>
      ${canCk?btn('Add update',`App._okrCheckin('${o.id}','${todayISO()}','progress')`,{variant:'primary',size:'sm',icon:'plus'}):''}
    </div>
    ${markRow}
    <div style="background:var(--c-surface);border:1px solid var(--c-border);border-radius:12px;padding:10px;margin-top:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">
        <span style="${lab}">Actual vs ideal pace</span>
        <span title="Progress: how far Current has moved from Start toward Target" style="font-size:12px;font-weight:800;padding:3px 11px;border-radius:20px;background:${_okrBarColor(st)}1E;color:${_okrBarColor(st)}">Progress ${pct===null?'—':pct+'%'}</span>
      </div>
      <div style="height:210px;position:relative"><canvas data-okr-chart="${o.id}"></canvas></div>
    </div>
    ${kidRows}
    <div style="margin-top:12px">
      <div style="${lab};margin-bottom:2px">Updates & inputs</div>
      <div style="max-height:280px;overflow-y:auto">${feed}</div>
    </div>
  </div>`;
}
/* ── Popup dispatcher (#6/#8/#9): Rules & Target · Progress & Updates · per-level Logs ── */
App._okrPop=(id,which)=>{
  const o=okrById(id);if(!o)return;
  if(which==='rules'){
    modalShell({title:'Rules & Target',sub:o.title||'',size:'max-w-2xl',
      body:_okrRulesPanel(o),
      footer:btnG('Close','App.closeModal()')+(_okrCanEditNode(o)?btnP('Edit rules & target',`App.closeModal();App._okrEdit('${id}')`):'')});
  }else if(which==='progress'){
    modalShell({title:'Progress & Updates',sub:o.title||'',size:'max-w-2xl',
      body:_okrProgressBody(o),
      footer:btnG('Close','App.closeModal()')+`<button type="button" onclick="App._okrPop('${id}','logs')" class="ui-btn ui-btn-ghost">${ic('audit','w-4 h-4')}Activity log</button>`});
    setTimeout(_paintCharts,40); // paint the modal's canvas after it's in the DOM
  }else if(which==='logs'){
    const logs=(DB.okrLogs||[]).filter(l=>l.okrId===id).slice(0,150);
    const canDel=_okrCanDeleteLog(o);
    const rows=logs.map(l=>{
      const u=uById(l.actorId);
      const det=l.details&&Object.keys(l.details).length?Object.entries(l.details).map(([k,v])=>esc(k)+': '+esc(typeof v==='object'?JSON.stringify(v):String(v))).join(' · '):'';
      return `<div style="display:flex;gap:10px;padding:9px 0;border-bottom:1px solid var(--c-border)">
        <div style="width:96px;flex-shrink:0;font-size:11px;color:var(--c-text-3);font-weight:600">${esc(String(l.createdAt||'').slice(0,10))}<br>${esc(String(l.createdAt||'').slice(11,16))}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;color:var(--c-text)">${esc(l.action||'')}</div>
          <div style="font-size:11.5px;color:var(--c-text-2)">${u?esc(fullName(u)):'—'}${det?' · '+det:''}</div>
        </div>
        ${canDel?`<button onclick="App._okrLogDelete('${id}','${l.id}')" title="Delete this log entry" style="width:24px;height:24px;display:grid;place-items:center;border-radius:6px;color:var(--c-danger-ink);background:transparent;border:none;cursor:pointer;flex-shrink:0">${ic('trash','w-3.5 h-3.5')}</button>`:''}
      </div>`;
    }).join('')||'<div style="text-align:center;padding:22px;color:var(--c-text-3);font-size:13px">No activity logged for this level yet.</div>';
    modalShell({title:'Activity log — this level only',sub:o.title||'',size:'max-w-lg',
      body:`<div>${rows}</div>`,
      footer:btnG('Close','App.closeModal()')});
  }
};
/* Delete one input (check-in) — level owner / upper-level owner / okr.editEntries. Logged. */
App._okrCkDelete=(okrId,ckId)=>{
  const o=okrById(okrId);if(!o)return;
  if(!_okrCanEditEntry(o)){toast('Only this level\'s owner (or an upper-level owner) can delete inputs','err');return;}
  const c=(DB.okrCheckins||[]).find(x=>x.id===ckId);if(!c)return;
  if(!confirm('Delete the '+fmtS(c.date)+' input ('+_okrFmtVal(o,c.value)+')? This is logged.'))return;
  DB.okrCheckins=(DB.okrCheckins||[]).filter(x=>x.id!==ckId);
  sb.from('okr_checkins').delete().eq('id',ckId).then(({error})=>{if(error)_syncErr('OKR input delete')(error);}).catch(_syncErr('OKR input delete'));
  okrLog(okrId,'Deleted input',{date:c.date,value:c.value});
  saveDB();toast('Input deleted','warn');
  App._okrPop(okrId,'progress');
};
/* Delete one log entry — level owner / upper-level owner / okr.deleteLogs. */
App._okrLogDelete=(okrId,logId)=>{
  const o=okrById(okrId);if(!o)return;
  if(!_okrCanDeleteLog(o)){toast('Only this level\'s owner (or an upper-level owner) can delete log entries','err');return;}
  if(!confirm('Delete this log entry? This cannot be undone.'))return;
  DB.okrLogs=(DB.okrLogs||[]).filter(l=>l.id!==logId);
  sb.from('okr_logs').delete().eq('id',logId).then(({error})=>{if(error)_syncErr('OKR log delete')(error);}).catch(_syncErr('OKR log delete'));
  saveDB();toast('Log entry deleted','warn');
  App._okrPop(okrId,'logs');
};

/* ── Node editor (create / edit any level) ── */
App._okrEdit=(id,parentId)=>{
  const existing=id?okrById(id):null;
  if(existing&&!_okrCanEditNode(existing))return toast('You can\'t edit this OKR','err');
  if(!existing&&!_okrCanCreate())return toast('You can\'t create OKRs','err');
  _OKRED=existing?JSON.parse(JSON.stringify(existing)):{id:uid('okr'),parentId:parentId||null,title:'',description:'',departmentId:null,subDepartmentId:null,ownerId:S.uid,metricType:'number',startValue:0,targetValue:null,unit:'',direction:'up',frequency:{type:'weekly',day:'Mon'},periodStart:null,periodEnd:null,statusMode:'auto',statusManual:null,sort:okrChildren(parentId||null).length,createdBy:S.uid,createdAt:new Date().toISOString()};
  App._renderOKREdit();
};
App._okrEdSetFreqType=(t)=>{const o=_OKRED;if(!o)return;if(t==='none')o.frequency={};else if(t==='weekly')o.frequency={type:'weekly',day:(o.frequency||{}).day&&WKDAYS.includes(o.frequency.day)?o.frequency.day:'Mon'};else if(t==='monthly')o.frequency={type:'monthly',day:Number((o.frequency||{}).day)||1};else o.frequency={type:'custom',dates:Array.isArray((o.frequency||{}).dates)?o.frequency.dates:[]};App._renderOKREdit();};
App._okrEdAddDate=()=>{const el=document.getElementById('okrEdCustomDate');if(!el||!el.value)return;const o=_OKRED;o.frequency=o.frequency||{type:'custom',dates:[]};o.frequency.dates=o.frequency.dates||[];if(!o.frequency.dates.includes(el.value)){o.frequency.dates.push(el.value);o.frequency.dates.sort();}App._renderOKREdit();};
App._okrEdRmDate=(i)=>{const o=_OKRED;if(o&&o.frequency&&Array.isArray(o.frequency.dates)){o.frequency.dates.splice(i,1);App._renderOKREdit();}};
App._renderOKREdit=()=>{
  const o=_OKRED;if(!o)return;
  const isExisting=!!okrById(o.id);
  const parent=o.parentId?okrById(o.parentId):null;
  const lvl=parent?okrLevel(parent)+1:0;
  const L='display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px';
  const users=visU().filter(u=>u&&u.status==='Active');
  const f=o.frequency||{};
  const fType=f.type||'none';
  // Department (top level) + separate Sub-department select (children of the chosen department)
  const deptOpts=(topDepts()||[]).map(d=>[d.id,d.name]);
  const subOpts=o.departmentId?(subDepts(o.departmentId)||[]).map(s=>[s.id,s.name]):[];
  const dayChip=d=>`<button type="button" onclick="_OKRED.frequency.day='${d}';App._renderOKREdit()" style="padding:6px 11px;border-radius:9px;border:1.5px solid ${f.day===d?'var(--c-text)':'var(--c-border)'};background:${f.day===d?'var(--c-ink)':'var(--c-surface)'};color:${f.day===d?'#fff':'var(--c-text-2)'};font-size:12px;font-weight:700;cursor:pointer">${d}</button>`;
  modalShell({title:(isExisting?'Edit':'New')+' L'+lvl+' objective',sub:parent?('Under: '+(parent.title||'—')):('Top-level objective — assigned to a department'),size:'max-w-lg',
    body:`<div style="display:flex;flex-direction:column;gap:14px">
      <div><label style="${L}">Objective title *</label><input type="text" value="${esc(o.title||'')}" oninput="_OKRED.title=this.value" placeholder="e.g. Increase monthly revenue" class="ui-input rf"/></div>
      <div><label style="${L}">Goal / description</label><textarea rows="2" oninput="_OKRED.description=this.value" placeholder="What does success look like? Why does it matter?" class="ui-input rf" style="resize:vertical">${esc(o.description||'')}</textarea></div>
      ${!o.parentId?`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label style="${L}">Department *</label><select class="ui-select rf" onchange="_OKRED.departmentId=this.value||null;_OKRED.subDepartmentId=null;App._renderOKREdit()"><option value="">— Select department —</option>${deptOpts.map(d=>`<option value="${esc(d[0])}" ${o.departmentId===d[0]?'selected':''}>${esc(d[1])}</option>`).join('')}</select></div>
        <div><label style="${L}">Sub-department</label><select class="ui-select rf" ${subOpts.length?'':'disabled'} onchange="_OKRED.subDepartmentId=this.value||null"><option value="">${subOpts.length?'— All / none —':'No sub-departments'}</option>${subOpts.map(s=>`<option value="${esc(s[0])}" ${o.subDepartmentId===s[0]?'selected':''}>${esc(s[1])}</option>`).join('')}</select></div>
      </div>`:''}
      ${(()=>{ // Owner: changing it on an EXISTING node is gated (#10) — upper-level owner / okr.changeOwner / manage.
        const locked=isExisting&&!_okrCanChangeOwner(okrById(o.id));
        if(locked){const cu=uById(o.ownerId);return `<div><label style="${L}">Owner (does the check-ins)</label><div class="ui-input" style="background:var(--c-surface-2);color:var(--c-text-2)">${cu?esc(fullName(cu)):'—'}</div><p style="font-size:11px;color:var(--c-text-3);margin-top:4px">Only an upper-level owner (or a role with “Change owner”) can reassign this level.</p></div>`;}
        return `<div><label style="${L}">Owner (does the check-ins) *</label><select class="ui-select rf" onchange="_OKRED.ownerId=this.value||null"><option value="">— Select owner —</option>${users.map(u=>`<option value="${u.id}" ${o.ownerId===u.id?'selected':''}>${esc(fullName(u))}</option>`).join('')}</select></div>`;})()}
      <div style="border-top:1px dashed var(--c-border);padding-top:12px"><label style="${L}">Rules & target — how is this measured?</label>
        <select class="ui-select rf" onchange="_OKRED.metricType=this.value;App._renderOKREdit()">${OKR_METRICS.map(m=>`<option value="${m[0]}" ${o.metricType===m[0]?'selected':''}>${m[1]}</option>`).join('')}</select>
      </div>
      ${o.metricType!=='yesno'?`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label style="${L}">Start value</label><input type="number" step="any" value="${o.startValue!==null&&o.startValue!==undefined?o.startValue:''}" oninput="_OKRED.startValue=this.value===''?0:parseFloat(this.value)" placeholder="0" class="ui-input rf"/></div>
        <div><label style="${L}">Target value *</label><input type="number" step="any" value="${o.targetValue!==null&&o.targetValue!==undefined?o.targetValue:''}" oninput="_OKRED.targetValue=this.value===''?null:parseFloat(this.value)" placeholder="e.g. 100" class="ui-input rf"/></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label style="${L}">${o.metricType==='currency'?'Currency':'Unit'} ${o.metricType==='percent'?'(auto: %)':''}</label><input type="text" value="${esc(o.unit||'')}" oninput="_OKRED.unit=this.value" placeholder="${o.metricType==='currency'?'e.g. AED / $':'e.g. orders, hrs'}" class="ui-input rf" ${o.metricType==='percent'?'disabled':''}/></div>
        <div><label style="${L}">Better when</label><select class="ui-select rf" onchange="_OKRED.direction=this.value"><option value="up" ${o.direction!=='down'?'selected':''}>Higher is better</option><option value="down" ${o.direction==='down'?'selected':''}>Lower is better</option></select></div>
      </div>`:`<div style="font-size:12px;color:var(--c-text-3);background:var(--c-surface-2);border-radius:9px;padding:9px 12px">Yes / No objective — a check-in of "Yes" counts as 100%, "No" as 0%.</div>`}
      <div style="border-top:1px dashed var(--c-border);padding-top:12px"><label style="${L}">Check-in frequency — when is the owner asked for an update?</label>
        <select class="ui-select rf" onchange="App._okrEdSetFreqType(this.value)">
          <option value="weekly" ${fType==='weekly'?'selected':''}>Weekly · on a chosen day</option>
          <option value="monthly" ${fType==='monthly'?'selected':''}>Monthly · on a chosen date</option>
          <option value="custom" ${fType==='custom'?'selected':''}>Custom dates</option>
          <option value="none" ${fType==='none'?'selected':''}>No schedule (manual updates only)</option>
        </select>
        ${fType==='weekly'?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:9px">${WKDAYS.map(dayChip).join('')}</div><div style="font-size:11px;color:var(--c-text-3);margin-top:6px">Every ${esc(f.day||'Mon')}, this OKR joins the owner's combined check-in list.</div>`:''}
        ${fType==='monthly'?`<div style="display:flex;align-items:center;gap:8px;margin-top:9px"><span style="font-size:12.5px;color:var(--c-text-2)">Day of month</span><input type="number" min="1" max="31" value="${Number(f.day)||1}" oninput="_OKRED.frequency.day=Math.max(1,Math.min(31,parseInt(this.value)||1))" class="ui-input rf" style="width:80px"/><span style="font-size:11px;color:var(--c-text-3)">shorter months use their last day</span></div>`:''}
        ${fType==='custom'?`<div style="margin-top:9px"><div style="display:flex;gap:8px"><input type="date" id="okrEdCustomDate" class="ui-input rf" style="flex:1"/><button type="button" onclick="App._okrEdAddDate()" class="ui-btn ui-btn-ghost ui-btn-sm">Add</button></div>
          ${(f.dates||[]).length?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${(f.dates||[]).map((d,i)=>`<span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:20px;padding:3px 6px 3px 10px">${esc(fmtS(d))}<button type="button" onclick="App._okrEdRmDate(${i})" style="width:16px;height:16px;border-radius:50%;border:none;background:var(--c-border);color:var(--c-text-2);cursor:pointer;font-size:10px;line-height:1">×</button></span>`).join('')}</div>`:'<div style="font-size:11px;color:var(--c-text-3);margin-top:6px">No dates added yet.</div>'}</div>`:''}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label style="${L}">Period start</label><input type="date" value="${o.periodStart||''}" oninput="_OKRED.periodStart=this.value||null" class="ui-input rf"/></div>
        <div><label style="${L}">Period end</label><input type="date" value="${o.periodEnd||''}" oninput="_OKRED.periodEnd=this.value||null" class="ui-input rf"/></div>
      </div>
      <div style="font-size:11px;color:var(--c-text-3)">The period drives the automatic On track / Off track pace and stops check-in reminders after it ends.</div>
    </div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP(isExisting?'Save changes':'Create objective','App._okrSave()')});
};
App._okrSave=()=>{
  const o=_OKRED;if(!o)return;
  if(!(o.title||'').trim())return toast('Add an objective title','err');
  if(!o.ownerId)return toast('Pick an owner','err');
  if(!o.parentId&&!o.departmentId)return toast('Assign the L0 objective to a department','err');
  if(o.metricType!=='yesno'&&(o.targetValue===null||o.targetValue===undefined||!isFinite(o.targetValue)))return toast('Set a target value','err');
  if(o.metricType==='percent')o.unit='%';
  const f=o.frequency||{};
  if(f.type==='weekly'&&!WKDAYS.includes(f.day))return toast('Pick the weekday for check-ins','err');
  if(f.type==='monthly'&&!(Number(f.day)>=1&&Number(f.day)<=31))return toast('Pick a day of month (1–31)','err');
  if(f.type==='custom'&&!(f.dates||[]).length)return toast('Add at least one check-in date','err');
  if(o.periodStart&&o.periodEnd&&o.periodEnd<o.periodStart)return toast('Period end is before its start','err');
  if(o.metricType==='yesno'){o.startValue=0;o.targetValue=1;o.direction='up';}
  const idx=(DB.okrs||[]).findIndex(x=>x.id===o.id);
  if(idx>-1){
    const prev=DB.okrs[idx];
    // #10: never trust the form — reassigning the owner requires upper-level-owner / changeOwner / manage.
    if(String(prev.ownerId||'')!==String(o.ownerId||'')&&!_okrCanChangeOwner(prev)){o.ownerId=prev.ownerId;toast('Owner unchanged — only an upper-level owner can reassign this level','warn');}
    const fields=[['title','Title'],['description','Goal'],['departmentId','Department'],['subDepartmentId','Sub-department'],['ownerId','Owner'],['metricType','Metric'],['startValue','Start value'],['targetValue','Target'],['unit','Unit'],['direction','Direction'],['periodStart','Period start'],['periodEnd','Period end']];
    const changes=[];
    fields.forEach(([k,label])=>{const a=prev[k],b=o[k];if(String(a===null||a===undefined?'':a)!==String(b===null||b===undefined?'':b)){
      let from=a,to=b;
      if(k==='ownerId'){const ua=uById(a),ub=uById(b);from=ua?fullName(ua):a;to=ub?fullName(ub):b;}
      if(k==='departmentId'||k==='subDepartmentId'){const da=(DB.departments||[]).find(d=>d.id===a),db2=(DB.departments||[]).find(d=>d.id===b);from=da?da.name:(a||'—');to=db2?db2.name:(b||'—');}
      changes.push({field:label,from:from,to:to});
    }});
    if(JSON.stringify(prev.frequency||{})!==JSON.stringify(o.frequency||{}))changes.push({field:'Frequency',from:_okrFreqLabel(prev),to:_okrFreqLabel(o)});
    DB.okrs[idx]=o;
    if(changes.length)okrLog(o.id,'Edited objective',{changes:changes});
    log(fullName(me()),'Edited OKR',o.title);
  }else{
    DB.okrs=DB.okrs||[];DB.okrs.push(o);
    okrLog(o.id,'Created objective',{level:'L'+(o.parentId?okrLevel(o):0)});
    log(fullName(me()),'Created OKR',o.title);
    if(o.parentId)_OKR_EXP[o.parentId]=true;
    if(o.ownerId&&o.ownerId!==S.uid&&_inappOn('okr'))DB.notifications.unshift({id:uid('n'),userId:o.ownerId,text:'🎯 New OKR assigned to you: "'+o.title+'" — '+_okrFreqLabel(o),time:new Date().toISOString(),read:false,kind:'okr'});
  }
  _okrPush(o);saveDB();closeModal();toast('OKR saved');rr();
};
App._okrDelete=(id)=>{
  const o=okrById(id);if(!o)return;
  if(!_okrCanEditNode(o))return toast('You can\'t delete this OKR','err');
  // Referential-integrity guard: an OKR with sub-objectives can't be deleted (the old cascade is
  // gone) — delete or re-parent the children first. Its own check-ins/logs go with it as before.
  if(!guardDelete('okr',id,'"'+(o.title||'this objective')+'"'))return;
  const desc=okrDescendants(id); // empty by now — kept so the cleanup below stays byte-compatible
  if(!confirm('Delete "'+(o.title||'this objective')+'"? Check-in history and logs go with it.'))return;
  const ids=new Set([id,...desc.map(d=>d.id)]);
  DB.okrs=(DB.okrs||[]).filter(x=>!ids.has(x.id));
  DB.okrCheckins=(DB.okrCheckins||[]).filter(c=>!ids.has(c.okrId));
  DB.okrLogs=(DB.okrLogs||[]).filter(l=>!ids.has(l.okrId));
  sb.from('okrs').delete().eq('id',id).then(({error})=>{if(error)_syncErr('OKR delete')(error);}).catch(_syncErr('OKR delete'));
  log(fullName(me()),'Deleted OKR',(o.title||'')+(desc.length?(' (+'+desc.length+' children)'):''));
  saveDB();toast('OKR deleted','warn');rr();
};
App._okrMarkStatus=(id,st)=>{
  const o=okrById(id);if(!o)return;
  if(!_okrCanCheckin(o))return toast('Only the owner or a manager can mark status','err');
  if(st==='auto'){
    if(o.statusMode!=='auto'){o.statusMode='auto';o.statusManual=null;okrLog(id,'Status switched to automatic',{});_okrPush(o);}
  }else{
    if(!(o.statusMode==='manual'&&o.statusManual===st)){o.statusMode='manual';o.statusManual=st;okrLog(id,'Marked status',{to:st});_okrPush(o);log(fullName(me()),'OKR status marked',(o.title||'')+' → '+st);}
  }
  saveDB();rr();
};

/* ── Single check-in modal (value + comment + photos + optional status mark) ── */
App._okrCheckin=(okrId,date,backTo)=>{
  const o=okrById(okrId);if(!o)return;
  if(!_okrCanCheckin(o))return toast('Only the owner or a manager can add updates','err');
  const d=date||todayISO();
  const ex=okrCheckinFor(okrId,S.uid,d)||((DB.okrCheckins||[]).find(c=>c.okrId===okrId&&c.date===d));
  // Editing an EXISTING input is gated separately (#5): level owner / upper-level owner / okr.editEntries.
  if(ex&&!_okrCanEditEntry(o))return toast('Only this level\'s owner (or an upper-level owner) can edit inputs','err');
  _OKRCI={okrId:okrId,date:d,value:ex?ex.value:(o.metricType==='yesno'?null:null),comment:ex?ex.comment:'',photos:ex?(ex.photos||[]).filter(p=>typeof p==='string'&&p!=='[photo]').slice():[],statusMark:ex?ex.statusMark:null,existingId:ex?ex.id:null,_backTo:backTo||null};
  // PHASE4b: no saved check-in for this date → resume the server draft (saved on any device).
  if(!ex){
    const _dr=_draftFor('okr',okrId,null);
    if(_dr&&_dr.payload&&(_dr.payload.value!==null&&_dr.payload.value!==undefined||_dr.payload.comment||_dr.payload.statusMark)){
      _OKRCI.value=_dr.payload.value??null;_OKRCI.comment=_dr.payload.comment||'';_OKRCI.statusMark=_dr.payload.statusMark||null;_OKRCI._fromDraft=true;
    }
  }
  App._renderOKRCheckin();
};
/* PHASE4b: save the current check-in form as a server-backed draft (one per OKR; photos excluded). */
App._okrCkDraft=()=>{
  const d=_OKRCI;if(!d)return;
  if((d.value===null||d.value===undefined)&&!(d.comment||'').trim()&&!d.statusMark){toast('Nothing to save yet','warn');return;}
  _draftSave('okr',d.okrId,null,{date:d.date,value:d.value??null,comment:d.comment||'',statusMark:d.statusMark||null});
  toast('Draft saved — it will be here on any of your devices');
};
App._okrCISetDate=(v)=>{if(!v||!_OKRCI)return;App._okrCheckin(_OKRCI.okrId,v);};
App._okrCISetVal=(v)=>{if(_OKRCI){_OKRCI.value=v;App._renderOKRCheckin();}};
App._okrCIPhotoAdd=(input)=>{
  const files=[...(input.files||[])];if(!files.length)return;
  let pending=files.length;
  files.forEach(f=>{const r=new FileReader();r.onload=e=>{_OKRCI&&_OKRCI.photos.push(e.target.result);if(--pending===0)App._renderOKRCheckin();};r.onerror=()=>{if(--pending===0)App._renderOKRCheckin();};r.readAsDataURL(f);});
  input.value='';
};
App._okrCIPhotoRm=(i)=>{if(_OKRCI){_OKRCI.photos.splice(i,1);App._renderOKRCheckin();}};
App._renderOKRCheckin=()=>{
  const d=_OKRCI;if(!d)return;
  const o=okrById(d.okrId);if(!o)return;
  const L='display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px';
  const ynBtn=(v,label)=>`<button type="button" onclick="App._okrCISetVal(${v})" style="flex:1;padding:12px;border-radius:11px;border:2px solid ${Number(d.value)===v?(v===1?'#22C55E':'#EF4444'):'var(--c-border)'};background:${Number(d.value)===v?(v===1?'#ECFDF5':'#FFF1F2'):'var(--c-surface)'};color:${Number(d.value)===v?(v===1?'#047857':'#BE123C'):'var(--c-text-2)'};font-size:14px;font-weight:800;cursor:pointer">${label}</button>`;
  modalShell({title:(d.existingId?'Edit update':'Add update'),sub:(o.title||'')+' · target '+(o.metricType==='yesno'?'Yes':_okrFmtVal(o,o.targetValue)),size:'max-w-md',
    body:`<div style="display:flex;flex-direction:column;gap:14px">
      <div><label style="${L}">Date</label><input type="date" value="${d.date}" onchange="App._okrCISetDate(this.value)" class="ui-input rf"/></div>
      ${o.metricType==='yesno'
        ?`<div><label style="${L}">Done?</label><div style="display:flex;gap:10px">${ynBtn(1,'Yes ✓')}${ynBtn(0,'No ✗')}</div></div>`
        :`<div><label style="${L}">Value ${o.unit?('('+esc(o.unit)+')'):''} *</label><input type="number" step="any" value="${d.value!==null&&d.value!==undefined?d.value:''}" oninput="_OKRCI.value=this.value===''?null:parseFloat(this.value)" placeholder="Latest measured value" class="ui-input rf"/></div>`}
      <div><label style="${L}">Comment</label><textarea rows="2" oninput="_OKRCI.comment=this.value" placeholder="Context, blockers, wins…" class="ui-input rf" style="resize:vertical">${esc(d.comment||'')}</textarea></div>
      <div><label style="${L}">Photos</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${d.photos.map((p,i)=>`<span style="position:relative;display:inline-block"><img src="${esc(p)}" alt="Attached photo" style="width:52px;height:52px;object-fit:cover;border-radius:9px;border:1px solid var(--c-border)"/><button type="button" onclick="App._okrCIPhotoRm(${i})" style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;border:none;background:#1C212B;color:#fff;font-size:10px;cursor:pointer;line-height:1">×</button></span>`).join('')}
          <label style="width:52px;height:52px;border:1.5px dashed var(--c-border);border-radius:9px;display:grid;place-items:center;color:var(--c-text-3);cursor:pointer">${ic('cam','w-4 h-4')}<input type="file" accept="image/*" multiple hidden onchange="App._okrCIPhotoAdd(this)"/></label>
        </div>
      </div>
      <div><label style="${L}">Mark status (optional)</label><div style="display:flex;gap:6px;flex-wrap:wrap">
        ${OKR_STATUSES.map(s=>{const on=d.statusMark===s;const m=OKR_ST_META[s];return`<button type="button" onclick="_OKRCI.statusMark=_OKRCI.statusMark==='${s}'?null:'${s}';App._renderOKRCheckin()" style="padding:5px 11px;border-radius:20px;border:1.5px solid ${on?m.dot:'var(--c-border)'};background:${on?m.bg:'var(--c-surface)'};color:${on?m.fg:'var(--c-text-2)'};font-size:11.5px;font-weight:700;cursor:pointer">${s}</button>`;}).join('')}
      </div><div style="font-size:11px;color:var(--c-text-3);margin-top:6px">Marking a status here also sets it on the objective (logged). Leave empty to keep the automatic status.</div></div>
      ${d.existingId?`<div style="font-size:11.5px;color:#92400E;background:#FEF3C7;border-radius:9px;padding:8px 11px">You're editing an existing update — the change is recorded in the activity log.</div>`:''}
      ${d._fromDraft?`<div style="font-size:11.5px;color:#92400E;background:#FFFBEB;border:1px solid #FDE68A;border-radius:9px;padding:8px 11px">📝 Draft restored — you saved this earlier${'' /* cross-device via the drafts table */}. Submit it or keep editing.</div>`:''}
    </div>`,
    footer:btnG('Cancel','App.closeModal()')+(d.existingId?'':`<button type="button" onclick="App._okrCkDraft()" class="ui-btn" style="background:#FFFBEB;border:1px solid #FDE68A;color:#92400E;font-weight:700">Save draft</button>`)+btnP(d.existingId?'Save changes':'Save update','App._okrCheckinSave()')});
};
// Shared apply: used by the single modal AND the combined "due today" modal. Logs everything.
function _okrApplyCheckin(okrId,date,d){
  const o=okrById(okrId);if(!o)return false;
  if(d.value===null||d.value===undefined||!isFinite(d.value))return false;
  const ex=d.existingId?(DB.okrCheckins||[]).find(c=>c.id===d.existingId):null;
  if(ex){
    const changes=[];
    if(String(ex.value)!==String(d.value))changes.push({field:'value',from:ex.value,to:d.value});
    if((ex.comment||'')!==(d.comment||''))changes.push({field:'comment',from:(ex.comment||'').slice(0,80),to:(d.comment||'').slice(0,80)});
    ex.value=d.value;ex.comment=d.comment||'';
    if(d.photos)ex.photos=d.photos;
    ex.statusMark=d.statusMark||null;
    if(changes.length){ex.editCount=(ex.editCount||0)+1;okrLog(okrId,'Edited check-in',{date:date,changes:changes});}
    ex.updatedAt=new Date().toISOString();
    _okrPushCheckin(ex);
  }else{
    const c={id:uid('okc'),okrId:okrId,userId:S.uid,date:date,value:d.value,comment:String(d.comment||'').slice(0,2000),photos:d.photos||[],statusMark:d.statusMark||null,editCount:0,createdAt:new Date().toISOString()};
    DB.okrCheckins=DB.okrCheckins||[];DB.okrCheckins.push(c);
    okrLog(okrId,'Check-in',{date:date,value:d.value});
    _okrPushCheckin(c);
  }
  if(d.statusMark&&!(o.statusMode==='manual'&&o.statusManual===d.statusMark)){
    o.statusMode='manual';o.statusManual=d.statusMark;
    okrLog(okrId,'Marked status',{to:d.statusMark});_okrPush(o);
  }
  _draftDelete('okr',okrId,null); // PHASE4b: a real check-in landed → the draft leaves the drafts table
  return true;
}
App._okrCheckinSave=()=>{
  const d=_OKRCI;if(!d)return;
  const o=okrById(d.okrId);if(!o)return;
  if(d.value===null||d.value===undefined||!isFinite(d.value))return toast(o.metricType==='yesno'?'Pick Yes or No':'Enter the value','err');
  const back=d._backTo,bid=d.okrId;
  _okrApplyCheckin(d.okrId,d.date,d);
  _OKRCI=null;saveDB();closeModal();toast('Update saved');rr();
  if(back==='progress')App._okrPop(bid,'progress'); // came from the Progress popup — go back to it
};

/* ── Combined "all OKR tasks due that day" modal — the scheduled checklist ── */
App._okrCheckinAll=(date)=>{
  const d=date||todayISO();
  const due=okrDueForUser(S.uid,d);
  if(!due.length)return toast('No OKR check-ins scheduled for this day','warn');
  _OKRCIALL={date:d,items:due.map(o=>{const ex=okrCheckinFor(o.id,S.uid,d);return{okrId:o.id,value:ex?ex.value:null,comment:ex?ex.comment:'',statusMark:ex?ex.statusMark:null,existingId:ex?ex.id:null,photos:ex?(ex.photos||[]).slice():[]};})};
  App._renderOKRCheckinAll();
};
App._okrCIAllVal=(i,v)=>{const it=_OKRCIALL&&_OKRCIALL.items[i];if(it){it.value=v;App._renderOKRCheckinAll();}};
App._renderOKRCheckinAll=()=>{
  const A=_OKRCIALL;if(!A)return;
  const rows=A.items.map((it,i)=>{
    const o=okrById(it.okrId);if(!o)return'';
    const done=it.existingId?'<span style="font-size:10px;font-weight:800;background:#ECFDF5;color:#0B7A55;padding:2px 8px;border-radius:10px">already updated — editing</span>':'';
    const ynBtn=(v,label)=>`<button type="button" onclick="App._okrCIAllVal(${i},${v})" style="flex:1;padding:8px;border-radius:9px;border:2px solid ${Number(it.value)===v?(v===1?'#22C55E':'#EF4444'):'var(--c-border)'};background:${Number(it.value)===v?(v===1?'#ECFDF5':'#FFF1F2'):'var(--c-surface)'};color:${Number(it.value)===v?(v===1?'#047857':'#BE123C'):'var(--c-text-2)'};font-size:12.5px;font-weight:800;cursor:pointer">${label}</button>`;
    return `<div style="border:1px solid var(--c-border);border-radius:12px;padding:12px;margin-bottom:10px;background:var(--c-surface)">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
        ${_okrLvlChip(okrLevel(o))}
        <span style="flex:1;min-width:0;font-size:13.5px;font-weight:800;color:var(--c-text)">${esc(o.title)}</span>
        ${done}
        <button type="button" title="Open full form (photos)" onclick="App.closeModal();App._okrCheckin('${o.id}','${A.date}')" style="width:26px;height:26px;display:grid;place-items:center;border-radius:7px;border:1px solid var(--c-border);background:var(--c-surface);color:var(--c-text-3);cursor:pointer">${ic('cam','w-3.5 h-3.5')}</button>
      </div>
      <div style="font-size:11px;color:var(--c-text-3);margin-bottom:7px">Target: ${o.metricType==='yesno'?'Yes':esc(_okrFmtVal(o,o.targetValue))}${o.metricType!=='yesno'?' · currently '+esc(_okrFmtVal(o,(okrLatestCheckin(o.id)||{}).value)):''}</div>
      ${o.metricType==='yesno'
        ?`<div style="display:flex;gap:8px;margin-bottom:8px">${ynBtn(1,'Yes ✓')}${ynBtn(0,'No ✗')}</div>`
        :`<input type="number" step="any" value="${it.value!==null&&it.value!==undefined?it.value:''}" oninput="_OKRCIALL.items[${i}].value=this.value===''?null:parseFloat(this.value)" placeholder="Value ${o.unit?('('+esc(o.unit)+')'):''}" class="ui-input rf" style="margin-bottom:8px"/>`}
      <input type="text" value="${esc(it.comment||'')}" oninput="_OKRCIALL.items[${i}].comment=this.value" placeholder="Comment (optional)" class="ui-input rf"/>
    </div>`;
  }).join('');
  modalShell({title:'OKR check-ins · '+fmtD(A.date),sub:A.items.length+' scheduled update'+(A.items.length===1?'':'s')+' — fill what you have, save once',size:'max-w-lg',
    body:`<div>${rows}</div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Save all','App._okrCheckinAllSave()')});
};
App._okrCheckinAllSave=()=>{
  const A=_OKRCIALL;if(!A)return;
  let n=0;
  A.items.forEach(it=>{if(it.value!==null&&it.value!==undefined&&isFinite(it.value)){if(_okrApplyCheckin(it.okrId,A.date,it))n++;}});
  if(!n)return toast('Enter at least one value','err');
  _OKRCIALL=null;saveDB();closeModal();toast(n+' update'+(n===1?'':'s')+' saved');rr();
};

/* ── Virtual "OKR Check-ins" card shown inside My Checklists on due days ── */
function _okrClCard(due,date){
  const today=todayISO();
  const doneN=due.filter(o=>okrCheckinFor(o.id,S.uid,date)).length;
  const allDone=doneN===due.length;
  const isFuture=date>today;
  const rows=due.slice(0,6).map(o=>{
    const ck=okrCheckinFor(o.id,S.uid,date);
    return `<div style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--c-text-2);padding:3px 0">
      ${ck?`<span style="color:#0B7A55;flex-shrink:0">${ic('check','w-3.5 h-3.5')}</span>`:`<span style="width:6px;height:6px;border-radius:50%;background:#F59E0B;flex-shrink:0;margin:0 5px"></span>`}
      <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(o.title)}</span>
      ${ck?`<span style="font-weight:800;color:var(--c-success-ink);font-size:12px">${esc(_okrFmtVal(o,ck.value))}</span>`:''}
    </div>`;
  }).join('');
  return `<div class="ui-card" style="padding:14px;border-left:3px solid ${allDone?'#22C55E':'#F59E0B'}">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <span style="width:36px;height:36px;border-radius:10px;background:var(--c-brand-soft);color:var(--c-brand-ink);display:grid;place-items:center;flex-shrink:0">${ic('chart','w-4.5 h-4.5')}</span>
      <div style="flex:1;min-width:0">
        <div class="fd" style="font-size:14px;font-weight:800;color:var(--c-text)">OKR Check-ins <span style="font-size:10px;font-weight:800;padding:1px 7px;border-radius:20px;background:var(--c-brand-soft);color:var(--c-brand-ink);vertical-align:middle;margin-left:4px">OKR</span></div>
        <div style="font-size:12px;color:var(--c-text-2)">${doneN}/${due.length} updated · combined from all your scheduled OKRs</div>
      </div>
      <span style="font-size:12px;font-weight:800;padding:3px 10px;border-radius:20px;background:${allDone?'var(--c-success-soft)':'var(--c-warn-soft)'};color:${allDone?'var(--c-success-ink)':'var(--c-warn-ink)'}">${allDone?'Done':(due.length-doneN)+' to do'}</span>
    </div>
    ${rows}${due.length>6?`<div style="font-size:11px;color:var(--c-text-3);padding:3px 0">+${due.length-6} more…</div>`:''}
    <div style="display:flex;justify-content:flex-end;margin-top:9px">
      ${isFuture?'<span style="font-size:12px;color:#9CA3AF;font-weight:600">Scheduled for this date</span>':btn(allDone?'Review / edit':'Update now',`App._okrCheckinAll('${date}')`,{variant:allDone?'ghost':'primary',size:'sm',icon:'edit'})}
    </div>
  </div>`;
}

/* ── Per-node charts v2: TWO lines in one graph — “Ideal” (how it should go, a straight pace
   line from start → target across the period) and “Actual” (what the owner really reported).
   Leaves plot metric values; parents plot roll-up progress % over time vs the 0→100% pace. ── */
function _okrValueAt(o,date){
  let v=null;
  okrCheckinsOf(o.id).forEach(c=>{if(c.date<=date&&c.value!==null&&c.value!==undefined)v=Number(c.value);});
  return v;
}
function _okrLeafPctAt(o,date){
  const v=_okrValueAt(o,date);if(v===null)return null;
  if(o.metricType==='yesno')return v>=1?100:0;
  const s=Number(o.startValue||0),t=(o.targetValue===null||o.targetValue===undefined)?null:Number(o.targetValue);
  if(t===null||!isFinite(t))return null;
  if(t===s)return(o.direction==='down'?(v<=t):(v>=t))?100:0;
  return Math.round(Math.max(0,Math.min(150,((v-s)/(t-s))*100))*10)/10;
}
// Roll-up progress as it stood on `date` (only check-ins ≤ date count). Cycle-safe.
function _okrProgressAt(o,date,_seen){
  if(!o)return null;_seen=_seen||new Set();
  if(_seen.has(o.id))return null;_seen.add(o.id);
  const kids=okrChildren(o.id);
  if(kids.length){
    const vals=kids.map(k=>_okrProgressAt(k,date,_seen)).filter(v=>v!==null&&isFinite(v));
    if(!vals.length)return null;
    return Math.round((vals.reduce((x,y)=>x+y,0)/vals.length)*10)/10;
  }
  return _okrLeafPctAt(o,date);
}
// Ideal value on a given date: linear from start → target across the period window
// (falls back to the first→last data-point span when no period is set).
function _okrIdealAt(o,date,span,pctMode){
  const ps=o.periodStart||span[0],pe=o.periodEnd||span[1];
  const lo=pctMode?0:Number(o.startValue||0);
  const hi=pctMode?100:Number(o.targetValue);
  if(!ps||!pe||!isFinite(hi))return null;
  if(date<=ps)return lo;if(date>=pe)return hi;
  const t0=new Date(ps+'T00:00:00').getTime(),t1=new Date(pe+'T00:00:00').getTime(),tn=new Date(date+'T00:00:00').getTime();
  if(t1<=t0)return hi;
  return Math.round((lo+(hi-lo)*((tn-t0)/(t1-t0)))*100)/100;
}
function _drawOKRCharts(){
  if(typeof Chart==='undefined')return;
  _destroyACharts();
  const T=_aChartTheme();
  document.querySelectorAll('canvas[data-okr-chart]').forEach(cv=>{
    const o=okrById(cv.getAttribute('data-okr-chart'));if(!o)return;
    const fail=(msg)=>{const p=cv.parentElement;if(p)p.innerHTML='<div style="height:100%;display:grid;place-items:center;color:var(--c-text-3);font-size:12px;text-align:center;padding:0 14px">'+msg+'</div>';};
    try{
      /* INDEPENDENT LEVELS (#1): every node graphs its OWN inputs only — children never appear.
         Window (#4): periodStart → periodEnd when set (every single date is a label; a 1st→31st
         window shows 1,2,3,…31); otherwise first input → today. Two lines (#3): Actual (the
         inputs, connected) and Ideal (straight start-value → target pace across the window). */
      const cs=okrCheckinsOf(o.id).filter(c=>c.value!==null&&c.value!==undefined);
      if(!cs.length)return fail('No inputs on this level yet — the graph appears after the first check-in.');
      const t=todayISO();
      let ws=o.periodStart||cs[0].date;
      let we=o.periodEnd||(cs[cs.length-1].date>t?cs[cs.length-1].date:t);
      if(cs[0].date<ws)ws=cs[0].date;
      if(cs[cs.length-1].date>we)we=cs[cs.length-1].date;
      if(we<ws)we=ws;
      const days=[];{let d=ws,g=0;while(d<=we&&g++<370){days.push(d);d=_isoAdd(d,1);}}
      const byDate={};cs.forEach(c=>{byDate[c.date]=Number(c.value);}); // last input of a day wins
      const actual=days.map(d=>byDate[d]!==undefined?byDate[d]:null);
      const s=Number(o.startValue||0),tv=(o.targetValue===null||o.targetValue===undefined)?null:Number(o.targetValue);
      const N=days.length;
      const ideal=(tv===null||o.metricType==='yesno'&&false)?null:days.map((d,i)=>N<=1?tv:Math.round((s+(tv-s)*(i/(N-1)))*100)/100);
      // Month-style tick labels (#4): a window inside ~5 weeks shows the DAY NUMBER for every date.
      const short=N<=37;
      const labels=days.map(d=>short?String(Number(d.slice(8,10))):d.slice(5));
      const ds=[];
      if(ideal)ds.push({label:'Ideal (on-track pace)',data:ideal,borderColor:'#94A3B8',borderDash:[7,5],pointRadius:0,fill:false,tension:0,borderWidth:2});
      ds.push({label:'Actual (your inputs)',data:actual,spanGaps:true,borderColor:T.brand,backgroundColor:_vfill(T.brand),fill:true,tension:.32,pointRadius:(c)=>actual[c.dataIndex]===null?0:3.5,pointBackgroundColor:T.brand,borderWidth:2.5});
      const yOpts={beginAtZero:true,ticks:{color:T.tick,font:{size:10}},grid:{color:T.grid}};
      if(o.metricType==='yesno'){yOpts.suggestedMax=1;yOpts.ticks.stepSize=1;yOpts.ticks.callback=function(v){return v===1?'Yes':v===0?'No':'';};}
      _aCharts.push(new Chart(cv.getContext('2d'),{type:'line',data:{labels:labels,datasets:ds},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:true,labels:{color:T.tick,font:{size:10.5}}},tooltip:{callbacks:{title:(items)=>items.length?fmtS(days[items[0].dataIndex]):''}}},scales:{x:{ticks:{color:T.tick,font:{size:short?9.5:10},maxRotation:0,autoSkip:!short,...(short?{}:{maxTicksLimit:10})},grid:{display:false}},y:yOpts}}}));
    }catch(e){fail("Couldn't draw chart.");}
  });
}

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window._OKR_EXP=_OKR_EXP;window._OKR_PANEL=_OKR_PANEL;window._OKR_LOGS=_OKR_LOGS;window._OKR_LVL_C=_OKR_LVL_C;window._okrCanManage=_okrCanManage;window._okrCanCreate=_okrCanCreate;window._okrCanEditNode=_okrCanEditNode;window._okrCanCheckin=_okrCanCheckin;window._okrLvlChip=_okrLvlChip;window.okrPage=okrPage;window._okrNodeHTML=_okrNodeHTML;window._okrRulesPanel=_okrRulesPanel;window._okrProgressBody=_okrProgressBody;window._okrCanEditEntry=_okrCanEditEntry;window._okrCanDeleteLog=_okrCanDeleteLog;window._okrCanChangeOwner=_okrCanChangeOwner;window._okrApplyCheckin=_okrApplyCheckin;window._okrClCard=_okrClCard;window._okrValueAt=_okrValueAt;window._okrLeafPctAt=_okrLeafPctAt;window._okrProgressAt=_okrProgressAt;window._okrIdealAt=_okrIdealAt;window._drawOKRCharts=_drawOKRCharts;
