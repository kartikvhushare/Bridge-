
function lifecyclePage(){
  const canMng=can('lifecycle','manage');
  const f=scopeFilter('lifecycle');
  const mine=(DB.flows||[]).filter(x=>canMng||f(x.userId)||x.userId===S.uid||x.steps.some(s=>s.ownerId===S.uid));
  const tab=S.filters.lcTab||'all';
  const KINDS=[['all','All'],['onboarding','Onboarding'],['probation','Probation'],['exit','Exit']];
  const list=mine.filter(x=>tab==='all'||x.kind===tab).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  const kindChip=k=>({onboarding:['#ECFDF5','#0B7A55','Onboarding'],probation:['#EFF6FF','#1D4ED8','Probation'],exit:['#FFF1F2','#BE123C','Exit']}[k]||['#F6F7F8','#6B7280',k]);
  const cards=list.map(fl=>{
    const u=uById(fl.userId);const done=fl.steps.filter(s=>s.done).length;
    const [bg,fg,lb]=kindChip(fl.kind);
    const open=S.filters.lcOpen===fl.id;
    const steps=open?fl.steps.map(st=>{
      const o=uById(st.ownerId);const late=!st.done&&st.dueDate<todayISO();
      return `<div style="display:flex;gap:10px;padding:8px 0;border-top:1px dashed var(--c-border);align-items:flex-start">
        <button onclick="App._flowStep('${fl.id}','${st.id}')" title="Toggle done" style="width:22px;height:22px;border-radius:7px;border:2px solid ${st.done?'#22C55E':'var(--c-border)'};background:${st.done?'#22C55E':'var(--c-surface)'};color:#fff;display:grid;place-items:center;cursor:pointer;flex-shrink:0;margin-top:1px">${st.done?ic('check','w-3 h-3'):''}</button>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--c-text);${st.done?'text-decoration:line-through;opacity:.6':''}">${esc(st.title)}</div>
          <div style="font-size:11px;color:${late?'var(--c-danger-ink)':'var(--c-text-3)'}">${o?esc(fullName(o)):'—'}${st.dept?' · '+esc(st.dept):''} · due ${fmtS(st.dueDate)}${late?' · OVERDUE':''}${st.done&&st.doneBy?' · done by '+esc(fullName(uById(st.doneBy))||''):''}</div>
          ${st.type==='form'?`<textarea rows="2" placeholder="Capture the ${esc(st.title.toLowerCase())} here…" oninput="App._flowForm('${fl.id}','${st.id}',this.value)" class="ui-input rf" style="margin-top:6px;resize:vertical;font-size:12px">${esc(st.formText||'')}</textarea>`:''}
          ${st.type==='letter'?`<button onclick="App._letterNew('${fl.userId}')" class="ui-btn ui-btn-ghost ui-btn-sm" style="margin-top:6px">${ic('doc','w-3.5 h-3.5')}Open Letters</button>`:''}
          ${st.type==='payrollHold'?`<div style="font-size:10.5px;color:var(--c-text-3);margin-top:3px">Completing this sets a payroll hold on the colleague.</div>`:''}
        </div>
      </div>`;
    }).join(''):'';
    return `<div class="ui-card" style="padding:14px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:10px;cursor:pointer" onclick="S.filters.lcOpen=S.filters.lcOpen==='${fl.id}'?null:'${fl.id}';rr()">
        ${u?avatar(u,'w-9 h-9','text-xs'):''}
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span class="fd" style="font-size:14px;font-weight:800;color:var(--c-text)">${u?esc(fullName(u)):'—'}</span><span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:20px;background:${bg};color:${fg}">${lb}</span>${fl.status==='Completed'?chip('Approved').replace('Approved','Completed'):''}</div>
          <div style="font-size:11.5px;color:var(--c-text-3)">${done}/${fl.steps.length} steps · started ${fmtS(String(fl.createdAt).slice(0,10))}</div>
        </div>
        <div style="width:90px;height:6px;background:var(--c-border);border-radius:3px;overflow:hidden"><div style="height:100%;width:${fl.steps.length?Math.round(done/fl.steps.length*100):0}%;background:${done===fl.steps.length?'#22C55E':'#0EA5E9'}"></div></div>
        ${canMng?`<button onclick="event.stopPropagation();App._flowDel('${fl.id}')" style="width:26px;height:26px;display:grid;place-items:center;border:none;background:transparent;color:var(--c-text-3);cursor:pointer">${ic('trash','w-3.5 h-3.5')}</button>`:''}
        <span style="font-size:10px;color:var(--c-text-3);transform:${open?'rotate(180deg)':'none'}">▼</span>
      </div>
      ${open?`<div style="margin-top:8px">${steps}</div>`:''}
    </div>`;
  }).join('');
  return `<div class="fade">${hdr('Lifecycle','Onboarding · probation · exit — guided flows with owners & due dates',canMng?[['onboarding','Onboarding'],['probation','Probation'],['exit','Exit']].map(k=>btn('+ '+k[1],`App._flowNew('${k[0]}')`,{variant:k[0]==='onboarding'?'primary':'ghost',size:'sm'})).join(''):'')}
    ${_howBar('lifecycle')}
    <div class="ui-tabs" style="margin-bottom:14px">${KINDS.map(k=>`<button class="ui-tab${tab===k[0]?' on':''}" onclick="S.filters.lcTab='${k[0]}';rr()">${k[1]}</button>`).join('')}</div>
    ${cards||empty('users','No flows yet',canMng?'Start an onboarding, probation or exit flow — steps and owners come from the templates in HR Config.':'Flows you own steps in will appear here.')}
  </div>`;
}

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.lifecyclePage=lifecyclePage;
