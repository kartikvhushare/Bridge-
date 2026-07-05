

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
function _okrCanEditNode(o){return isAdmin()||isSubAdmin()||_okrCanManage()||o.createdBy===S.uid;}
function _okrCanCheckin(o){return o.ownerId===S.uid||_okrCanEditNode(o);}
function _okrLvlChip(lvl){const c=_OKR_LVL_C[lvl%_OKR_LVL_C.length];return`<span style="flex-shrink:0;font-size:10px;font-weight:800;padding:2px 7px;border-radius:6px;background:${c};color:#fff;letter-spacing:.03em">L${lvl}</span>`;}
App._okrTogExp=(id)=>{_OKR_EXP[id]=!_OKR_EXP[id];rr();};
App._okrTogPanel=(id,which)=>{_OKR_PANEL[id]=_OKR_PANEL[id]===which?null:which;rr();};
App._okrTogLogs=(id)=>{_OKR_LOGS[id]=!_OKR_LOGS[id];rr();};

function okrPage(){
  const vis=okrVisible(),canCreate=_okrCanCreate();
  const today=todayISO();
  const head=hdr('OKRs','Objectives & key results — inputs roll up L2 → L1 → L0',canCreate?btn('New L0 objective','App._okrEdit(null,null)',{variant:'primary',icon:'plus'}):'');
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

function _okrNodeHTML(o,depth){
  if(depth>10)return'';
  const kids=okrChildren(o.id);
  const lvl=okrLevel(o);
  const exp=!!_OKR_EXP[o.id];
  const panel=_OKR_PANEL[o.id]||null;
  const pct=okrProgress(o);
  const st=okrStatusOf(o);
  const barC=_okrBarColor(st);
  const owner=uById(o.ownerId);
  const dept=(DB.departments||[]).find(d=>d.id===o.departmentId);
  const subDept=(DB.departments||[]).find(d=>d.id===o.subDepartmentId);
  const canEdit=_okrCanEditNode(o),canCk=_okrCanCheckin(o),canCreate=_okrCanCreate();
  const icBtn='width:28px;height:28px;display:grid;place-items:center;border-radius:8px;color:var(--c-text-3);background:transparent;border:none;cursor:pointer;flex-shrink:0';
  const meta='font-size:11.5px;color:var(--c-text-2);display:inline-flex;align-items:center;gap:4px';
  const pTab=(which,label,icon)=>`<button onclick="App._okrTogPanel('${o.id}','${which}')" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:9px;border:1px solid ${panel===which?'var(--c-text)':'var(--c-border)'};background:${panel===which?'var(--c-ink)':'var(--c-surface)'};color:${panel===which?'#fff':'var(--c-text-2)'};font-size:12px;font-weight:700;cursor:pointer">${ic(icon,'w-3.5 h-3.5')}${label}<span style="font-size:9px;transform:${panel===which?'rotate(180deg)':'none'};display:inline-block">▼</span></button>`;
  const card=`<div style="background:var(--c-surface);border:1px solid var(--c-border);border-radius:14px;margin-bottom:8px;${depth?'margin-left:'+Math.min(depth,5)*18+'px;':''}overflow:hidden">
    <div style="padding:13px 14px 10px">
      <div style="display:flex;align-items:flex-start;gap:9px">
        ${kids.length?`<button onclick="App._okrTogExp('${o.id}')" title="${exp?'Collapse':'Expand'} sub-objectives" style="${icBtn};margin-top:1px;transform:${exp?'rotate(90deg)':'none'}">${ic('chevR','w-4 h-4')}</button>`:`<span style="width:28px;flex-shrink:0;display:grid;place-items:center;margin-top:8px"><span style="width:5px;height:5px;border-radius:50%;background:var(--c-border)"></span></span>`}
        ${_okrLvlChip(lvl)}
        <div style="flex:1;min-width:0">
          <div class="fd" style="font-size:14.5px;font-weight:800;color:var(--c-text);line-height:1.25">${esc(o.title||'Untitled')}</div>
          <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:4px">
            ${owner?`<span style="${meta}">${avatar(owner,'w-4 h-4','text-[8px]')}${esc(fullName(owner))}</span>`:''}
            ${dept?`<span style="${meta}">${ic('dept','w-3 h-3')}${esc(dept.name)}${subDept?' › '+esc(subDept.name):''}</span>`:''}
            <span style="${meta}">${ic('clock','w-3 h-3')}${esc(_okrFreqLabel(o))}</span>
            ${o.periodStart||o.periodEnd?`<span style="${meta}">${ic('doc','w-3 h-3')}${fmtS(o.periodStart)} → ${fmtS(o.periodEnd)}</span>`:''}
            ${kids.length?`<span style="${meta}">${ic('tree','w-3 h-3')}${kids.length} sub-objective${kids.length===1?'':'s'}</span>`:''}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0">
          ${okrStatusChip(st)}
          <span class="fd" style="font-size:16px;font-weight:800;color:var(--c-text)">${pct===null?'—':pct+'%'}</span>
        </div>
      </div>
      <div style="height:6px;background:var(--c-border);border-radius:3px;overflow:hidden;margin-top:9px"><div style="height:100%;width:${pct===null?0:Math.max(0,Math.min(100,pct))}%;background:${barC};border-radius:3px;transition:width .3s"></div></div>
      <div style="display:flex;align-items:center;gap:7px;margin-top:10px;flex-wrap:wrap">
        ${pTab('rules','Rules & Target','cog')}
        ${pTab('progress','Progress & Updates','chart')}
        <span style="flex:1"></span>
        ${canCk&&!kids.length?btn('Update',`App._okrCheckin('${o.id}','${todayISO()}')`,{variant:'ghost',size:'sm',icon:'edit'}):''}
        ${canCreate?`<button onclick="App._okrEdit(null,'${o.id}')" title="Add sub-objective (L${lvl+1})" style="${icBtn}">${ic('plus','w-4 h-4')}</button>`:''}
        ${canEdit?`<button onclick="App._okrEdit('${o.id}')" title="Edit" style="${icBtn}">${ic('edit','w-3.5 h-3.5')}</button><button onclick="App._okrDelete('${o.id}')" title="Delete" style="${icBtn}">${ic('trash','w-3.5 h-3.5')}</button>`:''}
      </div>
    </div>
    ${panel==='rules'?_okrRulesPanel(o):''}
    ${panel==='progress'?_okrProgressPanel(o,kids,pct,st):''}
  </div>`;
  return card+(exp?kids.map(k=>_okrNodeHTML(k,depth+1)).join(''):'');
}

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
      ${kids.length?row('Progress source','Average of '+kids.length+' sub-objective'+(kids.length===1?'':'s')):row('Progress source','Own check-ins')}
      ${row('Status',o.statusMode==='manual'?('Marked manually ('+esc(o.statusManual||'—')+')'):'Automatic')}
      ${creator?row('Created by',esc(fullName(creator))+(o.createdAt?' · '+fmtS(String(o.createdAt).slice(0,10)):'')):''}
    </div>
    ${(o.frequency||{}).type==='custom'&&((o.frequency||{}).dates||[]).length?`<div style="margin-top:10px;font-size:12px;color:var(--c-text-2)"><b>Check-in dates:</b> ${(o.frequency.dates||[]).map(d=>esc(fmtS(d))).join(', ')}</div>`:''}
    ${_okrCanEditNode(o)?`<div style="margin-top:12px">${btn('Edit rules & target',`App._okrEdit('${o.id}')`,{variant:'ghost',size:'sm',icon:'edit'})}</div>`:''}
  </div>`;
}

/* ── Panel ②: Progress & Updates ── */
function _okrProgressPanel(o,kids,pct,st){
  const last=okrLatestCheckin(o.id);
  const canCk=_okrCanCheckin(o);
  const lab='font-size:10px;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;font-weight:700';
  const big='font-size:20px;font-weight:800;color:var(--c-text)';
  const cur=kids.length?(pct===null?'—':pct+'%'):esc(_okrFmtVal(o,last?last.value:null));
  const tgt=kids.length?'100%':(o.metricType==='yesno'?'Yes':esc(_okrFmtVal(o,o.targetValue)));
  // manual status marking (owner / manager) — every mark is logged
  const markRow=canCk?`<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:10px">
      <span style="font-size:11px;font-weight:700;color:var(--c-text-3)">MARK:</span>
      ${OKR_STATUSES.map(s=>{const on=o.statusMode==='manual'&&o.statusManual===s;const m=OKR_ST_META[s];return`<button onclick="App._okrMarkStatus('${o.id}','${s}')" style="padding:4px 10px;border-radius:20px;border:1.5px solid ${on?m.dot:'var(--c-border)'};background:${on?m.bg:'var(--c-surface)'};color:${on?m.fg:'var(--c-text-2)'};font-size:11px;font-weight:700;cursor:pointer">${s}</button>`;}).join('')}
      <button onclick="App._okrMarkStatus('${o.id}','auto')" title="Let progress decide the status" style="padding:4px 10px;border-radius:20px;border:1.5px solid ${o.statusMode!=='manual'?'var(--c-text)':'var(--c-border)'};background:${o.statusMode!=='manual'?'var(--c-ink)':'var(--c-surface)'};color:${o.statusMode!=='manual'?'#fff':'var(--c-text-2)'};font-size:11px;font-weight:700;cursor:pointer">Auto</button>
    </div>`:'';
  // check-in feed (latest first)
  const feed=okrCheckinsOf(o.id).slice().reverse().slice(0,30).map(c=>{
    const u=uById(c.userId);
    const photos=(c.photos||[]).filter(p=>typeof p==='string'&&p!=='[photo]');
    const canEditCk=c.userId===S.uid||_okrCanManage();
    return `<div style="display:flex;gap:10px;padding:10px 0;border-top:1px solid var(--c-border)">
      <div style="width:64px;flex-shrink:0;font-size:11.5px;color:var(--c-text-2);font-weight:600">${esc(fmtS(c.date))}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
          <span style="font-size:13px;font-weight:800;color:var(--c-brand-ink)">${esc(_okrFmtVal(o,c.value))}</span>
          ${c.statusMark?okrStatusChip(c.statusMark,true):''}
          <span style="font-size:11px;color:var(--c-text-3)">${u?esc(fullName(u)):'—'}</span>
          ${(c.editCount||0)>0?`<span style="font-size:9.5px;font-weight:800;background:#FEF3C7;color:#92400E;padding:1px 6px;border-radius:10px">edited ×${c.editCount}</span>`:''}
          ${canEditCk?`<button onclick="App._okrCheckin('${o.id}','${c.date}')" title="Edit this update (logged)" style="width:22px;height:22px;display:grid;place-items:center;border-radius:6px;color:var(--c-text-3);background:transparent;border:none;cursor:pointer">${ic('edit','w-3 h-3')}</button>`:''}
        </div>
        ${c.comment?`<div style="font-size:12px;color:var(--c-text-2);font-style:italic;margin-top:3px">"${esc(c.comment)}"</div>`:''}
        ${photos.length?`<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">${photos.map(p=>`<img src="${esc(p)}" onclick="App._bigImg('${esc(p)}')" alt="Check-in photo" style="width:44px;height:44px;object-fit:cover;border-radius:8px;cursor:pointer;border:1px solid var(--c-border)"/>`).join('')}</div>`:''}
      </div>
    </div>`;
  }).join('')||`<div style="padding:12px 0;color:var(--c-text-3);font-size:12.5px;border-top:1px solid var(--c-border)">No updates yet${canCk?' — add the first one.':'.'}</div>`;
  // children breakdown (roll-up view)
  const kidRows=kids.length?`<div style="margin-top:12px">
      <div style="${lab};margin-bottom:6px">Roll-up · sub-objectives feeding this level</div>
      ${kids.map(k=>{const kp=okrProgress(k),ks=okrStatusOf(k);return`<div style="display:flex;align-items:center;gap:9px;padding:6px 0">
        ${_okrLvlChip(okrLevel(k))}
        <span style="flex:1;min-width:0;font-size:12.5px;font-weight:600;color:var(--c-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(k.title)}</span>
        <div style="width:90px;height:5px;background:var(--c-border);border-radius:3px;overflow:hidden"><div style="height:100%;width:${kp===null?0:Math.max(0,Math.min(100,kp))}%;background:${_okrBarColor(ks)}"></div></div>
        <span style="font-size:12px;font-weight:800;color:var(--c-text);width:44px;text-align:right">${kp===null?'—':kp+'%'}</span>
        ${okrStatusChip(ks,true)}
      </div>`;}).join('')}
    </div>`:'';
  const logs=(DB.okrLogs||[]).filter(l=>l.okrId===o.id);
  return `<div style="border-top:1px solid var(--c-border);background:var(--c-surface-2);padding:14px 16px">
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div style="display:flex;gap:22px;flex-wrap:wrap">
        <div><div style="${lab}">${kids.length?'Roll-up progress':'Current'}</div><div style="${big}">${cur}</div></div>
        <div><div style="${lab}">Target</div><div style="${big}">${tgt}</div></div>
        <div><div style="${lab}">Progress</div><div style="${big}">${pct===null?'—':pct+'%'}</div></div>
        <div><div style="${lab}">Status</div><div style="margin-top:3px">${okrStatusChip(st)}</div></div>
      </div>
      ${canCk?btn(kids.length?'Add note / update':'Add update',`App._okrCheckin('${o.id}','${todayISO()}')`,{variant:'primary',size:'sm',icon:'plus'}):''}
    </div>
    ${markRow}
    <div style="height:190px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:12px;padding:10px;margin-top:12px"><canvas data-okr-chart="${o.id}"></canvas></div>
    ${kidRows}
    <div style="margin-top:12px">
      <div style="${lab};margin-bottom:2px">Updates & inputs</div>
      <div style="max-height:300px;overflow-y:auto">${feed}</div>
    </div>
    ${can('audit','view')&&logs.length?`<button onclick="S.filters.audCat='OKRs';S.filters.audQ='${esc((o.title||'').slice(0,40))}';App.go('audit')" style="margin-top:10px;display:inline-flex;align-items:center;gap:6px;background:transparent;border:none;cursor:pointer;font-size:11.5px;font-weight:700;color:var(--c-text-3)">${ic('audit','w-3.5 h-3.5')}${logs.length} logged changes — view in Audit →</button>`:''}
  </div>`;
}

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
      <div><label style="${L}">Owner (does the check-ins) *</label><select class="ui-select rf" onchange="_OKRED.ownerId=this.value||null"><option value="">— Select owner —</option>${users.map(u=>`<option value="${u.id}" ${o.ownerId===u.id?'selected':''}>${esc(fullName(u))}</option>`).join('')}</select></div>
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
    if(o.ownerId&&o.ownerId!==S.uid)DB.notifications.unshift({id:uid('n'),userId:o.ownerId,text:'🎯 New OKR assigned to you: "'+o.title+'" — '+_okrFreqLabel(o),time:new Date().toISOString(),read:false,kind:'okr'});
  }
  _okrPush(o);saveDB();closeModal();toast('OKR saved');rr();
};
App._okrDelete=(id)=>{
  const o=okrById(id);if(!o)return;
  if(!_okrCanEditNode(o))return toast('You can\'t delete this OKR','err');
  const desc=okrDescendants(id);
  if(!confirm('Delete "'+(o.title||'this objective')+'"'+(desc.length?(' and its '+desc.length+' sub-objective'+(desc.length===1?'':'s')):'')+'? Check-in history and logs go with it.'))return;
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
App._okrCheckin=(okrId,date)=>{
  const o=okrById(okrId);if(!o)return;
  if(!_okrCanCheckin(o))return toast('Only the owner or a manager can add updates','err');
  const d=date||todayISO();
  const ex=okrCheckinFor(okrId,S.uid,d)||((DB.okrCheckins||[]).find(c=>c.okrId===okrId&&c.date===d));
  _OKRCI={okrId:okrId,date:d,value:ex?ex.value:(o.metricType==='yesno'?null:null),comment:ex?ex.comment:'',photos:ex?(ex.photos||[]).filter(p=>typeof p==='string'&&p!=='[photo]').slice():[],statusMark:ex?ex.statusMark:null,existingId:ex?ex.id:null};
  App._renderOKRCheckin();
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
    </div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP(d.existingId?'Save changes':'Save update','App._okrCheckinSave()')});
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
  return true;
}
App._okrCheckinSave=()=>{
  const d=_OKRCI;if(!d)return;
  const o=okrById(d.okrId);if(!o)return;
  if(d.value===null||d.value===undefined||!isFinite(d.value))return toast(o.metricType==='yesno'?'Pick Yes or No':'Enter the value','err');
  _okrApplyCheckin(d.okrId,d.date,d);
  _OKRCI=null;saveDB();closeModal();toast('Update saved');rr();
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
    const kids=okrChildren(o.id);
    const fail=(msg)=>{const p=cv.parentElement;if(p)p.innerHTML='<div style="height:100%;display:grid;place-items:center;color:var(--c-text-3);font-size:12px;text-align:center;padding:0 14px">'+msg+'</div>';};
    try{
      let labels,dates,actual,ideal,pctMode;
      if(kids.length){
        pctMode=true;
        const dset=new Set();
        [o,...okrDescendants(o.id)].forEach(n=>okrCheckinsOf(n.id).forEach(c=>dset.add(c.date)));
        dates=[...dset].sort().slice(-40);
        if(!dates.length)return fail('No updates below this level yet — the graph appears after the first check-in.');
        actual=dates.map(d=>_okrProgressAt(o,d));
        ideal=dates.map(d=>_okrIdealAt(o,d,[dates[0],dates[dates.length-1]],true));
      }else{
        pctMode=false;
        const cs=okrCheckinsOf(o.id).filter(c=>c.value!==null&&c.value!==undefined);
        if(!cs.length)return fail('No updates yet — the graph appears after the first check-in.');
        dates=cs.map(c=>c.date);
        actual=cs.map(c=>Number(c.value));
        ideal=o.metricType==='yesno'?null:dates.map(d=>_okrIdealAt(o,d,[dates[0],dates[dates.length-1]],false));
      }
      labels=dates.map(d=>fmtS(d));
      const ds=[];
      if(ideal&&ideal.some(v=>v!==null))ds.push({label:'Ideal (planned pace)',data:ideal,borderColor:'#94A3B8',borderDash:[7,5],pointRadius:0,fill:false,tension:0,borderWidth:2});
      ds.push({label:pctMode?'Actual progress %':'Actual (reported)',data:actual,borderColor:'#0E9F6E',backgroundColor:'rgba(14,159,110,.12)',fill:true,tension:.3,pointRadius:3,pointBackgroundColor:'#0E9F6E',borderWidth:2});
      if(!pctMode&&o.metricType!=='yesno'&&o.targetValue!==null&&o.targetValue!==undefined&&!o.periodStart)ds.push({label:'Target',data:labels.map(()=>Number(o.targetValue)),borderColor:'#F59E0B',borderDash:[3,4],pointRadius:0,fill:false,tension:0,borderWidth:1.5});
      const yOpts={beginAtZero:true,ticks:{color:T.tick,font:{size:10}},grid:{color:T.grid}};
      if(pctMode)yOpts.suggestedMax=110;
      if(o.metricType==='yesno'&&!kids.length)yOpts.ticks.callback=function(v){return v===1?'Yes':v===0?'No':'';};
      _aCharts.push(new Chart(cv.getContext('2d'),{type:'line',data:{labels:labels,datasets:ds},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,labels:{color:T.tick,font:{size:10.5},boxWidth:14,padding:8}}},scales:{x:{ticks:{color:T.tick,font:{size:10},maxRotation:0,autoSkip:true,maxTicksLimit:8},grid:{color:T.grid}},y:yOpts}}}));
    }catch(e){fail("Couldn't draw chart.");}
  });
}

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window._OKR_EXP=_OKR_EXP;window._OKR_PANEL=_OKR_PANEL;window._OKR_LOGS=_OKR_LOGS;window._OKR_LVL_C=_OKR_LVL_C;window._okrCanManage=_okrCanManage;window._okrCanCreate=_okrCanCreate;window._okrCanEditNode=_okrCanEditNode;window._okrCanCheckin=_okrCanCheckin;window._okrLvlChip=_okrLvlChip;window.okrPage=okrPage;window._okrNodeHTML=_okrNodeHTML;window._okrRulesPanel=_okrRulesPanel;window._okrProgressPanel=_okrProgressPanel;window._okrApplyCheckin=_okrApplyCheckin;window._okrClCard=_okrClCard;window._okrValueAt=_okrValueAt;window._okrLeafPctAt=_okrLeafPctAt;window._okrProgressAt=_okrProgressAt;window._okrIdealAt=_okrIdealAt;window._drawOKRCharts=_drawOKRCharts;
