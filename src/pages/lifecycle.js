
/* ═══ LIFECYCLE (R20 redesign) ═══
   - Tabs/expand re-render ONLY #lc-wrap (no full-page fade flash on every click).
   - Tab counts, summary tiles, next-step preview, overdue pills, timeline steps,
     and per-tab empty states with a direct "start" CTA.
   - All data handlers (App._flowNew/_flowStep/_flowForm/_flowDel) are unchanged. */
const _LC_KIND={
  onboarding:{bg:'#ECFDF5',fg:'#0B7A55',label:'Onboarding',icon:'party',blurb:'Welcome a new colleague with a guided checklist — IT setup, documents, intro meetings.'},
  probation:{bg:'#EFF6FF',fg:'#1D4ED8',label:'Probation',icon:'flag',blurb:'Track a probation review — each step lands with its owner before the end date.'},
  exit:{bg:'#FFF1F2',fg:'#BE123C',label:'Exit',icon:'logout',blurb:'Run a clean offboarding — handovers, asset returns, and an automatic payroll hold.'},
};
function _lcVisible(){
  const canMng=can('lifecycle','start')||can('lifecycle','progress');
  const f=scopeFilter('lifecycle');
  return (DB.flows||[]).filter(x=>canMng||f(x.userId)||x.userId===S.uid||x.steps.some(s=>s.ownerId===S.uid));
}
function _lcStepMeta(st){
  const o=uById(st.ownerId);const late=!st.done&&st.dueDate<todayISO();
  return{owner:o,late};
}
function _lcCard(fl,canMng){
  const u=uById(fl.userId);
  const k=_LC_KIND[fl.kind]||{bg:'#F6F7F8',fg:'#6B7280',label:fl.kind,icon:'doc'};
  const done=fl.steps.filter(s=>s.done).length,total=fl.steps.length;
  const pct=total?Math.round(done/total*100):0;
  const open=S.filters.lcOpen===fl.id;
  const today=todayISO();
  const overdue=fl.steps.filter(s=>!s.done&&s.dueDate<today).length;
  const next=fl.steps.find(s=>!s.done);
  const completed=fl.status==='Completed';
  // ── collapsed meta line: next step (or completion) ──
  const nextO=next?uById(next.ownerId):null;
  const metaLine=completed
    ?`<span style="color:#0B7A55;font-weight:600">${ic('check','w-3 h-3')} Completed ${fl.completedAt?fmtS(String(fl.completedAt).slice(0,10)):''}</span>`
    :next
      ?`Next: <b style="color:var(--c-text-2)">${esc(next.title)}</b>${nextO?' — '+esc(fullName(nextO)):''} · due <span style="${next.dueDate<today?'color:var(--c-danger-ink);font-weight:700':''}">${fmtS(next.dueDate)}</span>`
      :'All steps ticked';
  // ── expanded: timeline steps ──
  const steps=open?`<div style="margin:14px 0 2px 15px;padding-left:20px;border-left:2px solid var(--c-border)">${fl.steps.map(st=>{
    const {owner:o,late}=_lcStepMeta(st);
    const doneBy=st.done&&st.doneBy?uById(st.doneBy):null;
    return `<div style="position:relative;padding:9px 0 11px">
      <button onclick="App._flowStep('${fl.id}','${st.id}')" title="${st.done?'Mark not done':'Mark done'}" aria-label="Toggle step" style="position:absolute;left:-33px;top:8px;width:24px;height:24px;border-radius:50%;border:2px solid ${st.done?'#22C55E':'var(--c-border)'};background:${st.done?'#22C55E':'var(--c-surface)'};color:#fff;display:grid;place-items:center;cursor:pointer;transition:all .15s;box-shadow:0 0 0 3px var(--c-surface)">${st.done?ic('check','w-3 h-3'):''}</button>
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <div style="font-size:13.5px;font-weight:650;color:var(--c-text);${st.done?'text-decoration:line-through;opacity:.55':''}">${esc(st.title)}</div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:4px">
            ${o?`<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--c-text-2);background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:20px;padding:2px 8px 2px 3px">${avatar(o,'w-4 h-4','text-[7px]')}${esc(fullName(o))}</span>`:`<span style="font-size:11px;color:var(--c-text-3)">Unassigned</span>`}
            ${st.dept?`<span style="font-size:11px;color:var(--c-text-3)">${esc(st.dept)}</span>`:''}
            ${st.done
              ?`<span style="font-size:11px;font-weight:700;color:#0B7A55;background:#ECFDF5;border-radius:20px;padding:2px 8px">done ${st.doneAt?fmtS(String(st.doneAt).slice(0,10)):''}${doneBy?' · '+esc(fullName(doneBy)):''}</span>`
              :`<span style="font-size:11px;font-weight:700;color:${late?'var(--c-danger-ink)':'var(--c-text-2)'};background:${late?'var(--c-danger-soft)':'var(--c-surface-2)'};border-radius:20px;padding:2px 8px">${late?'overdue · ':''}due ${fmtS(st.dueDate)}</span>`}
          </div>
          ${st.type==='form'?`<textarea rows="2" placeholder="Capture the ${esc(st.title.toLowerCase())} here…" oninput="App._flowForm('${fl.id}','${st.id}',this.value)" class="ui-input rf" style="margin-top:8px;resize:vertical;font-size:12px">${esc(st.formText||'')}</textarea>`:''}
          ${st.type==='letter'?`<div style="margin-top:8px">${btn('Open Letters',`App._letterNew('${fl.userId}')`,{variant:'ghost',size:'sm',icon:'doc'})}</div>`:''}
          ${st.type==='payrollHold'?`<div style="font-size:11px;color:var(--c-text-3);margin-top:5px">${ic('alert','w-3 h-3')} Completing this sets a payroll hold on the colleague.</div>`:''}
        </div>
      </div>
    </div>`;
  }).join('')}</div>`:'';
  return `<div class="ui-card" style="padding:16px 18px;margin-bottom:10px;${completed?'opacity:.82;':''}transition:box-shadow .15s">
    <div style="display:flex;align-items:center;gap:12px;cursor:pointer" onclick="App._lcToggle('${fl.id}')">
      ${u?avatar(u,'w-10 h-10','text-xs'):''}
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="fd" style="font-size:14.5px;font-weight:800;color:var(--c-text)">${u?esc(fullName(u)):'—'}</span>
          <span style="font-size:10px;font-weight:800;padding:2px 9px;border-radius:20px;background:${k.bg};color:${k.fg}">${esc(k.label)}</span>
          ${overdue?`<span style="font-size:10px;font-weight:800;padding:2px 9px;border-radius:20px;background:var(--c-danger-soft);color:var(--c-danger-ink)">${overdue} overdue</span>`:''}
          ${completed?`<span style="font-size:10px;font-weight:800;padding:2px 9px;border-radius:20px;background:#ECFDF5;color:#0B7A55">COMPLETED</span>`:''}
        </div>
        <div style="font-size:11.5px;color:var(--c-text-3);margin-top:3px">${metaLine} · started ${fmtS(String(fl.createdAt).slice(0,10))}</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;flex-shrink:0">
        <div style="text-align:right">
          <div style="font-size:11px;font-weight:800;color:${pct===100?'#0B7A55':'var(--c-text-2)'}">${done}/${total} steps</div>
          <div style="width:110px;height:7px;background:var(--c-border);border-radius:4px;overflow:hidden;margin-top:4px"><div style="height:100%;width:${pct}%;background:${pct===100?'#22C55E':'#0EA5E9'};border-radius:4px;transition:width .25s"></div></div>
        </div>
        ${canMng?`<button onclick="event.stopPropagation();App._flowDel('${fl.id}')" title="Delete flow" aria-label="Delete flow" style="width:30px;height:30px;display:grid;place-items:center;border:none;border-radius:8px;background:transparent;color:var(--c-text-3);cursor:pointer" onmouseover="this.style.background='var(--c-danger-soft)';this.style.color='var(--c-danger)'" onmouseout="this.style.background='transparent';this.style.color='var(--c-text-3)'">${ic('trash','w-4 h-4')}</button>`:''}
        <span style="color:var(--c-text-3);display:grid;place-items:center;transform:${open?'rotate(180deg)':'none'};transition:transform .18s">${ic('chevD','w-4 h-4')}</span>
      </div>
    </div>
    ${steps}
  </div>`;
}
function _lcBody(){
  const canMng=can('lifecycle','start')||can('lifecycle','progress');
  const mine=_lcVisible();
  const tab=S.filters.lcTab||'all';
  const today=todayISO();
  const counts={all:mine.length,onboarding:0,probation:0,exit:0};
  mine.forEach(x=>{if(counts[x.kind]!==undefined)counts[x.kind]++;});
  const active=mine.filter(x=>x.status!=='Completed');
  const completedN=mine.length-active.length;
  const overdueN=active.reduce((n,x)=>n+x.steps.filter(s=>!s.done&&s.dueDate<today).length,0);
  const KINDS=[['all','All'],['onboarding','Onboarding'],['probation','Probation'],['exit','Exit']];
  const list=mine.filter(x=>tab==='all'||x.kind===tab)
    .sort((a,b)=>(a.status==='Completed')-(b.status==='Completed')||String(b.createdAt).localeCompare(String(a.createdAt)));
  // ── summary tiles ──
  const tile=(n,label,tone)=>`<div class="ui-card" style="flex:1;min-width:130px;padding:13px 16px"><div class="fd" style="font-size:22px;font-weight:800;line-height:1;color:${tone}">${n}</div><div style="font-size:11px;font-weight:700;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;margin-top:5px">${label}</div></div>`;
  const stats=mine.length?`<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
    ${tile(active.length,'Active flows','var(--c-text)')}
    ${tile(overdueN,'Overdue steps',overdueN?'var(--c-danger-ink)':'var(--c-text)')}
    ${tile(completedN,'Completed','#0B7A55')}
  </div>`:'';
  // ── per-tab empty state with a direct CTA ──
  let emptyHtml='';
  if(!list.length){
    if(tab==='all'){
      emptyHtml=emptyCTA('users','No lifecycle flows yet',
        canMng?'Start an onboarding, probation or exit flow — steps and owners come from the templates in HR Config.':'Flows you own steps in will appear here.',
        canMng?'Start onboarding':'',canMng?`App._flowNew('onboarding')`:'');
    }else{
      const k=_LC_KIND[tab];
      emptyHtml=emptyCTA(k.icon,'No '+tab+' flows',canMng?k.blurb:'Flows you own steps in will appear here.',
        canMng?('Start '+tab):'',canMng?`App._flowNew('${tab}')`:'');
    }
  }
  return `${stats}
    <div class="ui-tabs" style="margin-bottom:14px">${KINDS.map(k=>`<button class="ui-tab${tab===k[0]?' on':''}" onclick="App._lcTab('${k[0]}')">${k[1]}<span style="font-size:10.5px;font-weight:800;padding:1px 7px;border-radius:20px;background:${tab===k[0]?'var(--c-surface-2)':'rgba(20,28,46,.06)'};color:var(--c-text-3)">${counts[k[0]]}</span></button>`).join('')}</div>
    ${list.map(fl=>_lcCard(fl,canMng)).join('')||emptyHtml}`;
}
/* Scoped refresh: swap ONLY the lifecycle body — no full-page re-render, no fade flash. */
function _lcRefresh(){const w=document.getElementById('lc-wrap');if(w)w.innerHTML=_lcBody();else rr();}
function _lcRR(){if(S.route==='lifecycle'&&document.getElementById('lc-wrap'))_lcRefresh();else rr();}
App._lcTab=(k)=>{S.filters.lcTab=k;_lcRefresh();};
App._lcToggle=(id)=>{S.filters.lcOpen=S.filters.lcOpen===id?null:id;_lcRefresh();};
function lifecyclePage(){
  const canMng=can('lifecycle','start');
  return `<div class="fade">${hdr('Lifecycle','Onboarding · probation · exit — guided flows with owners & due dates',canMng?[['onboarding','Onboarding'],['probation','Probation'],['exit','Exit']].map(k=>btn('+ '+k[1],`App._flowNew('${k[0]}')`,{variant:k[0]==='onboarding'?'primary':'ghost',size:'sm'})).join(''):'')}
    ${_howBar('lifecycle')}
    <div id="lc-wrap">${_lcBody()}</div>
  </div>`;
}

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.lifecyclePage=lifecyclePage;window._lcBody=_lcBody;window._lcRefresh=_lcRefresh;window._lcRR=_lcRR;window._lcVisible=_lcVisible;
