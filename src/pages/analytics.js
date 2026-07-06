

/* ── REPORTS HUB (inside HRM Analytics) ── */
function _reportsHubHTML(){
  const R=S.filters.rhKind||'absentee';
  const kinds=[['absentee','Absentee (today)'],['sla','Leave SLA overdue'],['docexp','Document expiries'],['otpend','Overtime pending'],['wfh','WFH days (month)'],['status','Status changes']];
  const d=todayISO();const month=d.slice(0,7);
  let head=[],rows=[];
  if(R==='absentee'){
    head=['Person','Department','Reason unknown since'];
    DB.users.filter(u=>u.status==='Active'&&u.role!=='Admin').forEach(u=>{
      const sch=u.hrm?.schedule||{};if((sch.offDays||[]).includes(dayAbbr(d)))return;
      if(_onLeaveToday(u.id,d))return;
      const rec=(DB.attendance||[]).find(a=>a.userId===u.id&&a.date===d&&a.clockIn);
      if(!rec)rows.push([fullName(u),u.department||'—',sch.in||'09:00']);
    });
  }else if(R==='sla'){
    head=['Person','Requested','Working days pending','Type'];
    (DB.leaveRequests||[]).filter(r=>r.status==='Pending').forEach(r=>{
      const u=uById(r.userId);if(!u)return;
      let wd=0,cur3=new Date(String(r.createdAt||'').slice(0,10)+'T00:00:00');const end=new Date(d+'T00:00:00');
      while(cur3<end){cur3.setDate(cur3.getDate()+1);if(!['Sat','Sun'].includes(DAYS3[cur3.getDay()]))wd++;}
      const lt=(DB.leaveTypes||[]).find(t=>t.id===r.leaveTypeId);
      rows.push([fullName(u),fmtS(String(r.createdAt||'').slice(0,10)),wd,(lt||{}).name||'—']);
    });
    rows.sort((a,b)=>b[2]-a[2]);
  }else if(R==='docexp'){
    head=['Person','Document','Expires','Status'];
    DB.users.filter(u=>u.status==='Active').forEach(u=>(u.hrm?.personalDocs||[]).forEach(doc=>{
      if(doc.expiry)rows.push([fullName(u),doc.name,fmtS(doc.expiry),doc.expiry<d?'EXPIRED':'Upcoming']);
    }));
    rows.sort((a,b)=>String(a[2]).localeCompare(String(b[2])));
  }else if(R==='otpend'){
    head=['Person','Date','Hours','Reason'];
    (DB.overtime||[]).filter(o=>o.status==='Pending').forEach(o=>{const u=uById(o.userId);rows.push([u?fullName(u):'—',fmtS(o.date),o.hours,o.reason]);});
  }else if(R==='wfh'){
    head=['Person','WFH days in '+month];
    const byU={};(DB.attendance||[]).filter(a=>String(a.date).slice(0,7)===month&&(a.flags||[]).includes('WFH')).forEach(a=>{byU[a.userId]=(byU[a.userId]||0)+1;});
    Object.keys(byU).forEach(k=>{const u=uById(k);rows.push([u?fullName(u):k,byU[k]]);});
    rows.sort((a,b)=>b[1]-a[1]);
  }else if(R==='status'){
    head=['When','Who','What','Target'];
    (DB.audit||[]).filter(l=>/user|role|deactivat|access/i.test(l.action||'')).slice(0,80).forEach(l=>rows.push([new Date(l.time).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}),l.actor,l.action,l.target||'—']));
  }
  const table=rows.length?`<div class="ui-card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse">
    <thead><tr>${head.map(h=>`<th style="text-align:left;padding:9px 12px;font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase">${esc(String(h))}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r=>`<tr style="border-top:1px solid var(--c-border)">${r.map(c=>`<td style="padding:8px 12px;font-size:12.5px;color:var(--c-text)">${esc(String(c))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
    :`<div class="ui-card" style="padding:24px">${empty('chart','Nothing to report','This report is empty right now — that\'s usually good news.')}</div>`;
  return `<div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">${kinds.map(k=>`<button class="ui-tab-pill${R===k[0]?' on':''}" onclick="S.filters.rhKind='${k[0]}';rr()">${k[1]}</button>`).join('')}
      <span style="flex:1"></span>
      ${rows.length&&can('reports','download')?btn('Export CSV',`App._rhCSV('${R}')`,{variant:'ghost',size:'sm',icon:'doc'}):''}
    </div>
    ${table}
  </div>`;
}
App._rhCSV=(kind)=>{const el=document.querySelector('.fade table');if(!el)return;const rows=[...el.querySelectorAll('tr')].map(tr=>[...tr.querySelectorAll('th,td')].map(td=>td.textContent.trim()));_csvDownload(rows,'report_'+kind+'_'+todayISO());};


// ── Analytics clickable stat card ──
App._aStatCard=(label,val,color,type,data)=>{
  const colMap={sky:'#0EA5E9',brand:'#0E9F6E',rose:'#EF4444',orange:'#F97316'};
  const c=colMap[color]||color;
  return`<div class="stat-card-click" onclick="App._aStatDrill('${type}')" data-col="${c}" style="background:var(--c-surface);border-radius:var(--r-lg);border:1px solid var(--c-border);box-shadow:var(--sh-sm);padding:18px;cursor:pointer;transition:border-color .15s,box-shadow .15s">`
  +`<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--c-text-3);margin-bottom:10px">${label}</div><div class="fd" style="font-size:30px;font-weight:800;line-height:1;color:${c}">${val}</div><div style="font-size:12px;color:var(--c-text-3);margin-top:8px;display:flex;align-items:center;gap:3px">Details ${ic('chevR','w-3 h-3')}</div></div>`;
};

App._aStatDrill=(type)=>{
  const f=S.filters;
  const fArr=k=>Array.isArray(f[k])?f[k]:(f[k]?[f[k]]:[]);
  let subs=DB.submissions;
  if(!isAdmin()){const _sc=_reportScopeIds();subs=subs.filter(s=>_sc.has(s.userId));}
  if(fArr('users').length)subs=subs.filter(s=>fArr('users').includes(s.userId));
  if(fArr('deps').length)subs=subs.filter(s=>{const c=clById(s.checklistId);return c&&fArr('deps').includes(c.department);});
  if(fArr('locs').length)subs=subs.filter(s=>{const c=clById(s.checklistId);return c&&fArr('locs').some(l=>(c.locationIds||[]).includes(l));});
  if(fArr('stats').length)subs=subs.filter(s=>fArr('stats').includes(s.status));
  if(f.dr1)subs=subs.filter(s=>s.date>=f.dr1);
  if(f.dr2)subs=subs.filter(s=>s.date<=f.dr2);
  let aTickets=(DB.tickets||[]).slice();
  if(!isAdmin()){
    // Both manager and user: only tickets assigned to them
    aTickets=aTickets.filter(t=>t.assignedTo===S.uid);
  }
  if(f.dr1)aTickets=aTickets.filter(t=>(t.date||t.createdAt?.slice(0,10)||'')>=f.dr1);
  if(f.dr2)aTickets=aTickets.filter(t=>(t.date||t.createdAt?.slice(0,10)||'')<=f.dr2);
  const today=todayISO();
  let title='',rows='',emptyMsg='No data.';
  const subRow=s=>{
    const u=uById(s.userId),c=clById(s.checklistId);
    const extra=s.submittedAt?' · '+new Date(s.submittedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):'';
    return'<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--c-border);cursor:pointer" onclick="App.viewSub(\''+s.id+'\')" onmouseover="this.style.background=\'var(--c-surface-2)\'" onmouseout="this.style.background=\'\'">'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-size:13px;font-weight:600;color:var(--c-text);overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+(c?esc(c.name):'<span style="color:var(--c-danger);font-style:italic">[Deleted checklist]</span>')+'</div>'
      +'<div style="font-size:11px;color:var(--c-text-3);margin-top:1px">'+(u?esc(fullName(u)):'?')+' · '+fmtS(s.date)+extra+'</div>'
      +'</div>'+chip(s.status)+'</div>';
  };
  if(type==='submitted'){
    const list=subs.slice().sort((a,b)=>(b.submittedAt||'').localeCompare(a.submittedAt||''));
    title='All Submissions ('+list.length+')';rows=list.map(subRow).join('');emptyMsg='No submissions in this period.';
  } else if(type==='ontime'){
    const list=subs.filter(s=>s.status==='On Time').sort((a,b)=>(b.submittedAt||'').localeCompare(a.submittedAt||''));
    title='On Time ('+list.length+')';rows=list.map(subRow).join('');emptyMsg='No on-time submissions.';
  } else if(type==='late'){
    const list=subs.filter(s=>s.status==='Late').sort((a,b)=>(b.submittedAt||'').localeCompare(a.submittedAt||''));
    title='Late ('+list.length+')';rows=list.map(subRow).join('');emptyMsg='No late submissions.';
  } else if(type==='missed'){
    const relevantUsers=isAdmin()?DB.users:DB.users.filter(u=>_reportScopeIds().has(u.id));
    const dr1=f.dr1||(new Date(Date.now()-30*86400000).toISOString().slice(0,10));
    const dr2=f.dr2||today;
    const dateRange=[];
    let d=new Date(dr1+'T00:00:00');const dEnd=new Date(dr2+'T00:00:00');
    while(d<=dEnd&&dateRange.length<60){dateRange.push(d.toISOString().slice(0,10));d.setDate(d.getDate()+1);}
    const missed=[];
    const _seenGrp=new Set(); // anyOne checklists are collective → list once per date
    relevantUsers.forEach(u=>{
      dateRange.forEach(dt=>{
        if(dt>=today)return;
        DB.checklists.filter(c=>(c.assignees||[]).includes(u.id)&&clOn(c,dt)&&c.status!=='Draft').forEach(c=>{
          // For "any one" group checklists, a completion by ANY assignee counts for everyone —
          // so it's only "missed" if nobody in the group submitted. Otherwise check own submission.
          const done=c.anyOne
            ? DB.submissions.some(s=>s.checklistId===c.id&&s.date===dt&&s.status!=='Editing')
            : !!DB.submissions.find(s=>s.checklistId===c.id&&s.userId===u.id&&s.date===dt);
          if(done)return;
          if(c.anyOne){
            const k=c.id+'|'+dt;
            if(_seenGrp.has(k))return; // already listed this group checklist for this date
            _seenGrp.add(k);
            missed.push({u:null,c,dt}); // group → no single owner
          } else {
            missed.push({u,c,dt});
          }
        });
      });
    });
    title='Missed ('+missed.length+')';
    rows=missed.slice(0,100).map(({u,c,dt})=>'<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--c-border)"><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:var(--c-text)">'+esc(c.name)+(c.anyOne?' <span style="font-size:9px;font-weight:700;padding:1px 6px;border-radius:8px;background:var(--c-info-soft);color:var(--c-info-ink);display:inline-flex;align-items:center;gap:3px;vertical-align:middle">'+ic('users','w-3 h-3')+'Group</span>':'')+'</div><div style="font-size:11px;color:var(--c-text-3)">'+(u?esc(fullName(u)):'No one in group completed')+' · '+fmtS(dt)+'</div></div><span style="font-size:11px;font-weight:700;color:var(--c-warn);background:var(--c-warn-soft);padding:2px 8px;border-radius:20px">Missed</span></div>').join('');
    emptyMsg='No missed checklists in this period.';
  } else if(type==='compliant'||type==='noncompliant'){
    const want=type==='noncompliant';
    const list=subs.map(s=>{const c=clById(s.checklistId);if(!c||!(c.questionIds||[]).length)return null;const n=_subEscalationCount(c,s);return{s,c,n};})
      .filter(x=>x&&((x.n>0)===want))
      .sort((a,b)=>want?(b.n-a.n)||((b.s.submittedAt||'').localeCompare(a.s.submittedAt||'')):(b.s.submittedAt||'').localeCompare(a.s.submittedAt||''));
    title=(want?'Non-compliant':'Compliant')+' ('+list.length+')';
    rows=list.map(({s,c,n})=>{const u=uById(s.userId);return'<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--c-border);cursor:pointer" onclick="App.viewSub(\''+s.id+'\')" onmouseover="this.style.background=\'var(--c-surface-2)\'" onmouseout="this.style.background=\'\'">'
      +'<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:var(--c-text);overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+esc(c.name)+'</div>'
      +'<div style="font-size:11px;color:var(--c-text-3);margin-top:1px">'+(u?esc(fullName(u)):'?')+' · '+fmtS(s.date)+'</div></div>'
      +(want
        ? '<span style="display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:var(--c-danger-soft);color:var(--c-danger-ink)">'+ic('alert','w-3 h-3')+n+' escalated</span>'
        : '<span style="display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:var(--c-success-soft);color:var(--c-success-ink)">'+ic('check','w-3 h-3')+'Compliant</span>')
      +'</div>';}).join('');
    emptyMsg=want?'No non-compliant submissions in this period — all clear.':'No compliant submissions in this period.';
  } else {
    const tkMap={tickets:aTickets,tkopen:aTickets.filter(t=>t.status==='Open'),tkhigh:aTickets.filter(t=>t.priority==='High'||t.priority==='Critical'),tkresolved:aTickets.filter(t=>t.status==='Resolved'||t.status==='Closed')};
    const tkLabels={tickets:'All Tickets',tkopen:'Open Tickets',tkhigh:'High Priority Tickets',tkresolved:'Resolved Tickets'};
    const list=(tkMap[type]||[]).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
    title=(tkLabels[type]||'Tickets')+' ('+list.length+')';
    const priClr={High:'#DC2626',Medium:'#F59E0B',Low:'#6B7280',Critical:'#7C3AED'};
    rows=list.map(t=>'<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--c-border)"><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:var(--c-text);overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+esc(t.title)+'</div><div style="font-size:11px;color:var(--c-text-3);margin-top:1px">'+(uById(t.submitterId)?'From '+esc(fullName(uById(t.submitterId))):'')+' → '+(uById(t.assignedTo)?esc(fullName(uById(t.assignedTo))):'?')+' · '+fmtS(t.date||t.createdAt?.slice(0,10)||'')+'</div></div><span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:#FEF2F2;color:'+(priClr[t.priority]||'#6B7280')+'">'+esc(t.priority)+'</span>'+chip(t.status)+'</div>').join('');
    emptyMsg='No tickets in this category.';
  }
  modalShell({title,size:'max-w-lg',
    body:'<div style="margin:-20px">'+(rows||'<div style="padding:32px;text-align:center;color:var(--c-text-3);font-size:13px">'+emptyMsg+'</div>')+'</div>'});
};

window._AData=null;window._HData=null;window._HRMData=null;window._AFiltered=null;window._aCharts=[];
// Who the dashboard analytics can see — the SAME reports-permission scope HRM Analytics uses, so the
// two pages always show the same set of people (instead of a hard-coded reporting subtree).
function _reportScopeIds(){const s=new Set(scopedUsers('reports').map(u=>u.id));s.add(S.uid);return s;}
function analyticsPage(){
  const today=todayISO();
  // Collect all relevant submissions
  let subs=DB.submissions;
  if(!isAdmin()){const _sc=_reportScopeIds();subs=subs.filter(s=>_sc.has(s.userId));}
  const f=S.filters;
  const fArr=k=>Array.isArray(f[k])?f[k]:(f[k]?[f[k]]:[]);
  if(fArr('users').length)  subs=subs.filter(s=>fArr('users').includes(s.userId));
  if(fArr('deps').length)   subs=subs.filter(s=>{const c=clById(s.checklistId);return c&&fArr('deps').includes(c.department);});
  if(fArr('locs').length)   subs=subs.filter(s=>{const c=clById(s.checklistId);return c&&fArr('locs').some(l=>(c.locationIds||[]).includes(l));});
  if(fArr('stats').length)  subs=subs.filter(s=>fArr('stats').includes(s.status));
  if(f.dr1) subs=subs.filter(s=>s.date>=f.dr1);
  if(f.dr2) subs=subs.filter(s=>s.date<=f.dr2);

  // Ticket stats for analytics
  let aTickets=(DB.tickets||[]).slice();
  if(!isAdmin()){
    // Both manager and user: only tickets assigned to them
    aTickets=aTickets.filter(t=>t.assignedTo===S.uid);
  }
  if(f.dr1)aTickets=aTickets.filter(t=>(t.date||t.createdAt?.slice(0,10)||'')>=f.dr1);
  if(f.dr2)aTickets=aTickets.filter(t=>(t.date||t.createdAt?.slice(0,10)||'')<=f.dr2);
  const tkOpen=aTickets.filter(t=>t.status==='Open').length;
  const tkResolved=aTickets.filter(t=>t.status==='Resolved'||t.status==='Closed').length;
  const tkHigh=aTickets.filter(t=>t.priority==='High'||t.priority==='Critical').length;
  const tot=Math.max(subs.length,1);
  const byS={'On Time':0,'Late':0,'Pending Approval':0,'Rejected':0,'Pending (not submitted)':0};
  subs.forEach(s=>{if(byS[s.status]!==undefined)byS[s.status]++;else byS['Pending (not submitted)']++;});
  // ── Compliance over the filtered submissions (computed from answers → covers old data) ──
  let compliantN=0,nonCompliantN=0,totalEscalations=0;
  subs.forEach(s=>{const c=clById(s.checklistId);if(!c||!(c.questionIds||[]).length)return;const n=_subEscalationCount(c,s);if(n>0){nonCompliantN++;totalEscalations+=n;}else{compliantN++;}});

  // Count missed (assigned but no submission for past dates)
  const relevantUsers=isAdmin()?DB.users:DB.users.filter(u=>_reportScopeIds().has(u.id));
  const dateRange=[];
  const dr1=f.dr1||(new Date(Date.now()-30*86400000).toISOString().slice(0,10));
  const dr2=f.dr2||today;
  let d=new Date(dr1+'T00:00:00');const dEnd=new Date(dr2+'T00:00:00');
  while(d<=dEnd&&dateRange.length<60){dateRange.push(d.toISOString().slice(0,10));d.setDate(d.getDate()+1);}
  let totalAssigned=0,totalMissed=0;const _missedList=[];
  relevantUsers.forEach(u=>{
    if(fArr('users').length&&!fArr('users').includes(u.id))return;
    dateRange.forEach(dt=>{
      const cls=DB.checklists.filter(c=>(c.assignees||[]).includes(u.id)&&clOn(c,dt)&&c.status!=='Draft');
      cls.forEach(c=>{
        totalAssigned++;
        // For "any one" group checklists, a submission by ANY assignee completes it for
        // everyone — so it's only "missed" if nobody submitted (Fix #2).
        const _done=c.anyOne
          ? DB.submissions.some(s=>s.checklistId===c.id&&s.date===dt&&s.status!=='Editing')
          : !!DB.submissions.find(s=>s.checklistId===c.id&&s.userId===u.id&&s.date===dt);
        if(!_done&&dt<today){
          totalMissed++;
          _missedList.push({userId:u.id,checklistId:c.id,date:dt});
        }
      });
    });
  });

  const topU=relevantUsers.map(u=>({u,n:subs.filter(s=>s.userId===u.id).length,tk:aTickets.filter(t=>t.assignedTo===u.id||t.submitterId===u.id).length})).filter(x=>x.n).sort((a,b)=>b.n-a.n);
  const recent=subs.slice().sort((a,b)=>(b.submittedAt||'').localeCompare(a.submittedAt||'')).slice(0,50);
  const activeCount=fArr('users').length+fArr('deps').length+fArr('locs').length+fArr('stats').length+(f.dr1?1:0)+(f.dr2?1:0);

  function msDropdown(label,key,items,getId,getLabel){
    const sel=fArr(key);const isOpen=S.afOpen===key;
    const txt=sel.length===0?'All':sel.length===1?getLabel(items.find(x=>getId(x)===sel[0])||items[0])||'?':sel.length+' selected';
    return`<div data-af="1" style="position:relative;flex:1;min-width:120px">
      <button data-af="1" type="button" onclick="S.afOpen=S.afOpen==='${key}'?null:'${key}';rr()"
        style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:6px;background:var(--c-surface);border:1px solid ${isOpen?'var(--c-brand)':sel.length?'var(--c-text)':'var(--c-border)'};border-radius:10px;padding:8px 12px;font-size:13px;font-weight:${sel.length?600:400};color:${sel.length?'var(--c-text)':'var(--c-text-3)'};cursor:pointer">
        <span style="overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(label+(sel.length?': '+txt:''))}</span>
        <span style="color:var(--c-text-3);transform:rotate(${isOpen?180:0}deg);transition:transform .15s;flex-shrink:0">${ic('chevD','w-4 h-4')}</span>
      </button>
      ${isOpen?`<div data-af="1" style="position:absolute;top:calc(100%+4px);left:0;right:0;background:var(--c-surface);border:1px solid var(--c-border);border-radius:12px;box-shadow:var(--sh-pop);z-index:100;max-height:220px;overflow-y:auto;padding:6px">
        ${sel.length?`<button data-af="1" onclick="delete S.filters['${key}'];rr()" style="width:100%;text-align:left;padding:6px 10px;font-size:12px;font-weight:600;color:var(--c-rose,#E11D48);background:none;border:none;cursor:pointer;border-radius:8px">Clear selection</button><div style="height:1px;background:var(--c-border);margin:4px 0"></div>`:''}
        ${items.map(item=>{const id=getId(item);const nm=getLabel(item)||'?';const on=sel.includes(id);return`<button data-af="1" type="button" onclick="App._togF('${key}','${id}')"
          style="width:100%;display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;border:none;cursor:pointer;background:${on?'var(--c-brand-soft)':'transparent'};text-align:left">
          <div style="width:16px;height:16px;border-radius:4px;border:1.5px solid ${on?'var(--c-brand)':'var(--c-border)'};background:${on?'var(--c-brand)':'var(--c-surface)'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
            ${on?`<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>`:''}
          </div>
          <span style="font-size:13px;font-weight:${on?600:400};color:${on?'var(--c-text)':'var(--c-text-2)'}">${esc(nm)}</span>
        </button>`;}).join('')}
      </div>`:''}
    </div>`;
  }
  

  // ── Pending approvals (scoped) + per-user performance + chart datasets for the live visuals ──
  const _pendA=(DB.approvals||[]).filter(a=>a.status==='Pending'&&(isAdmin()||relevantUsers.some(u=>u.id===a.requesterId))).length;
  const _perfRows=relevantUsers.filter(u=>u.status==='Active').map(u=>{
    const asgn=DB.checklists.filter(c=>(c.assignees||[]).includes(u.id)).length;
    const ss=subs.filter(s=>s.userId===u.id);
    const ot=ss.filter(s=>s.status==='On Time').length;
    return{u,asgn,total:ss.length,late:ss.filter(s=>s.status==='Late').length,pend:ss.filter(s=>['Pending','Pending Approval'].includes(s.status)).length,tk:aTickets.filter(t=>t.assignedTo===u.id&&(t.status==='Open'||t.status==='In Progress')).length,pct:ss.length?Math.round(ot/ss.length*100):0};
  }).filter(r=>r.total||r.asgn).sort((a,b)=>fullName(a.u).localeCompare(fullName(b.u)));
  const _trendLabels=dateRange.map(d=>d.slice(5));
  const _dateMap={};dateRange.forEach(d=>{_dateMap[d.slice(5)]=d;});
  const _depMap={};subs.forEach(s=>{const c=clById(s.checklistId);if(!c)return;const dn=c.department||'—';(_depMap[dn]=_depMap[dn]||{t:0,ot:0});_depMap[dn].t++;if(s.status==='On Time')_depMap[dn].ot++;});
  const _depArr=Object.keys(_depMap).map(k=>({name:k,t:_depMap[k].t,ot:_depMap[k].ot})).sort((a,b)=>b.t-a.t).slice(0,8);
  // compliant / non-compliant submission LISTS (for click-to-drill)
  const _comp=[],_noncomp=[];subs.forEach(s=>{const c=clById(s.checklistId);if(!c||!(c.questionIds||[]).length)return;(_subEscalationCount(c,s)>0?_noncomp:_comp).push(s);});
  // per-employee dataset — respects the employee filter (else top 15 by activity)
  let _empUsers=relevantUsers.filter(u=>u.status==='Active');
  if(fArr('users').length)_empUsers=_empUsers.filter(u=>fArr('users').includes(u.id));
  const _empRows=_empUsers.map(u=>{const ss=subs.filter(s=>s.userId===u.id);return{id:u.id,name:fullName(u),ot:ss.filter(s=>s.status==='On Time').length,late:ss.filter(s=>s.status==='Late').length,pend:ss.filter(s=>['Pending','Pending Approval'].includes(s.status)).length,total:ss.length};}).filter(r=>r.total).sort((a,b)=>b.total-a.total).slice(0,15);
  _AData={
    status:{labels:['On Time','Late','Pending Approval','Rejected','Missed'],data:[byS['On Time']||0,byS['Late']||0,byS['Pending Approval']||0,byS['Rejected']||0,totalMissed],colors:['#10B981','#EF4444','#F97316','#9F1239','#F59E0B']},
    trend:{labels:_trendLabels,sub:dateRange.map(dt=>subs.filter(s=>s.date===dt).length),ontime:dateRange.map(dt=>subs.filter(s=>s.date===dt&&s.status==='On Time').length),late:dateRange.map(dt=>subs.filter(s=>s.date===dt&&s.status==='Late').length)},
    dept:{labels:_depArr.map(d=>d.name),total:_depArr.map(d=>d.t),onTime:_depArr.map(d=>d.ot)},
    tickets:{labels:['Open','In Progress','Resolved'],data:[aTickets.filter(t=>t.status==='Open').length,aTickets.filter(t=>t.status==='In Progress').length,aTickets.filter(t=>t.status==='Resolved'||t.status==='Closed').length],colors:['#F59E0B','#0EA5E9','#0E9F6E']},
    compliance:{labels:['Compliant','Non-compliant'],data:[compliantN,nonCompliantN],colors:['#0E9F6E','#BE123C']},
    emp:{ids:_empRows.map(r=>r.id),labels:_empRows.map(r=>r.name),onTime:_empRows.map(r=>r.ot),late:_empRows.map(r=>r.late),pend:_empRows.map(r=>r.pend)},
    top:{labels:topU.slice(0,8).map(x=>fullName(x.u)),data:topU.slice(0,8).map(x=>x.n)}
  };
  _AFiltered={subs:subs.slice(),tickets:aTickets.slice(),missed:_missedList,compliant:_comp,nonCompliant:_noncomp,dateMap:_dateMap};
  // Company hero: today's headline figures (permission-scoped: relevantUsers already honors report scope)
  const _hero=(()=>{try{
    const scope=relevantUsers.filter(x=>x.status==='Active'&&x.role!=='Admin');
    const att=(DB.attendance||[]).filter(x2=>x2.date===today&&scope.some(x=>x.id===x2.userId));
    const present=att.filter(x2=>x2.clockIn).length;
    const wfh=att.filter(x2=>(x2.flags||[]).includes('WFH')&&x2.clockIn).length;
    const late=att.filter(x2=>(x2.flags||[]).includes('late')).length;
    const onLv=scope.filter(x=>_onLeaveToday(x.id,today)).length;
    const onT=byS['On Time'],ltN=byS['Late'];const rate=(onT+ltN)?Math.round(onT/(onT+ltN)*100):null;
    const k=(v,l,c)=>`<div style="flex:1;min-width:116px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:14px;padding:13px 15px;box-shadow:var(--sh-sm)"><div class="fd" style="font-size:25px;font-weight:800;letter-spacing:-.5px;color:${c||'var(--c-text)'}">${v}</div><div style="font-size:11px;font-weight:700;color:var(--c-text-2);margin-top:3px">${l}</div></div>`;
    return `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">${k(scope.length,'Active people')}${k(present,'Clocked in today','var(--c-success-ink)')}${k(wfh,'WFH today','#0369A1')}${k(onLv,'On leave','#B45309')}${k(late,'Late today',late?'var(--c-danger-ink)':undefined)}${rate!=null?k(rate+'%','Checklist on-time','var(--c-brand-ink)'):''}${k(tkOpen,'Open tickets',tkOpen?'#B45309':undefined)}</div>`;
  }catch(e){return'';}})();
  const _cc='background:var(--c-surface);border-radius:var(--r-lg);border:1px solid var(--c-border);box-shadow:var(--sh-sm);padding:18px';
  const _ct='font-size:14px;font-weight:700;color:var(--c-text);margin-bottom:12px';
  const _view=S.dashView==='details'?'details':'visuals';
  const _stb=(v,lbl,icn)=>`<button onclick="S.dashView='${v}';rr()" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:1px solid ${_view===v?'var(--c-text)':'var(--c-border)'};background:${_view===v?'var(--c-text)':'var(--c-surface)'};color:${_view===v?'#fff':'var(--c-text-2)'};font-size:13px;font-weight:700;cursor:pointer">${ic(icn,'w-4 h-4')}${lbl}</button>`;
  const _subTab=`<div style="display:flex;gap:8px;margin-bottom:14px">${_stb('visuals','Visuals','chart')}${_stb('details','Details','list')}</div>`;

  return`<div class="fade" onclick="(function(e){if(S.afOpen&&!e.target.closest('[data-af]')){S.afOpen=null;rr();}})(event)">
  ${hdr('Company',new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'}))}
  ${typeof _pulseStrip==='function'?_pulseStrip():''}
  ${typeof _whoIsInWidget==='function'?_whoIsInWidget():''}
  <!-- Filter bar -->
  <div style="background:var(--c-surface);border-radius:var(--r-lg);border:1px solid var(--c-border);box-shadow:var(--sh-sm);padding:14px 16px;margin-bottom:14px;position:sticky;top:0;z-index:20">
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      ${msDropdown('Status','stats',['On Time','Late','Pending Approval','Rejected'],s=>s,s=>s)}
      ${msDropdown('Department','deps',DB.departments,d=>d.name,d=>d.name)}
      ${msDropdown('Team member','users',relevantUsers,u=>u.id,u=>fullName(u))}
      ${DB.locations.length?msDropdown('Location','locs',DB.locations,l=>l.id,l=>l.name):''}
    </div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:220px">
        <input type="date" value="${f.dr1||''}" onchange="S.filters.dr1=this.value;rr()" style="flex:1;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:8px;padding:7px 10px;font-size:13px;outline:none;color:var(--c-text)"/>
        <span style="color:var(--c-text-3)">to</span>
        <input type="date" value="${f.dr2||''}" onchange="S.filters.dr2=this.value;rr()" style="flex:1;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:8px;padding:7px 10px;font-size:13px;outline:none;color:var(--c-text)"/>
      </div>

      ${activeCount?btn('Clear ('+activeCount+')','S.filters={};S.afOpen=null;rr()',{variant:'ghost',size:'sm'}):''}
      ${btnG('Export','App._exportReport()','download')}
    </div>
  </div>

  ${_subTab}
  ${_view==='details'?`
  <!-- Stats row 1: submissions (all clickable) -->
  <div class="astat-grid" style="margin-bottom:8px">
    ${App._aStatCard('Submitted',subs.length,'sky','submitted',subs)}
    ${App._aStatCard('On time',byS['On Time']||0,'brand','ontime',subs.filter(s=>s.status==='On Time'))}
    ${App._aStatCard('Late',byS['Late']||0,'rose','late',subs.filter(s=>s.status==='Late'&&!!clById(s.checklistId)))}
    ${App._aStatCard('Missed',totalMissed,'orange','missed',null)}
  </div>
  <!-- Stats row 2: tickets (all clickable) -->
  <div class="astat-grid" style="margin-bottom:8px">
    ${App._aStatCard('Tickets',aTickets.length,'#F97316','tickets',aTickets)}
    ${App._aStatCard('Open',tkOpen,'#F59E0B','tkopen',aTickets.filter(t=>t.status==='Open'))}
    ${App._aStatCard('High Priority',tkHigh,'#DC2626','tkhigh',aTickets.filter(t=>t.priority==='High'||t.priority==='Critical'))}
    ${App._aStatCard('Resolved',tkResolved,'#0E9F6E','tkresolved',aTickets.filter(t=>t.status==='Resolved'||t.status==='Closed'))}
  </div>
  <!-- Stats row 3: compliance + pending approvals -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
    ${App._aStatCard('Compliant',compliantN,'#0E9F6E','compliant',null)}
    ${App._aStatCard('Non-compliant',nonCompliantN,'#BE123C','noncompliant',null)}
    <div onclick="App.go('approvals')" style="background:var(--c-surface);border-radius:var(--r-lg);border:1px solid var(--c-border);box-shadow:var(--sh-sm);padding:18px;cursor:pointer"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--c-text-3);margin-bottom:10px">Pending approvals</div><div class="fd" style="font-size:30px;font-weight:800;line-height:1;color:#F59E0B">${_pendA}</div><div style="font-size:12px;color:var(--c-text-3);margin-top:8px;display:flex;align-items:center;gap:3px">Open approvals ${ic('chevR','w-3 h-3')}</div></div>
  </div>
  `:''}
  ${_view==='visuals'?`
  <!-- Live charts (update with every filter) -->
  <div class="achart-grid" style="margin-bottom:14px">
    <div style="${_cc}"><div class="fd" style="${_ct}">Status breakdown</div><div style="position:relative;height:230px"><canvas id="aChartStatus" data-chart="status"></canvas></div></div>
    <div style="${_cc}"><div class="fd" style="${_ct}">Submissions over time</div><div style="position:relative;height:230px"><canvas id="aChartTrend" data-chart="submissions-over-time"></canvas></div></div>
    <div style="${_cc}"><div class="fd" style="${_ct}">Department performance</div><div style="position:relative;height:230px"><canvas id="aChartDept" data-chart="department"></canvas></div></div>
    <div style="${_cc}"><div class="fd" style="${_ct}">Tickets</div><div style="position:relative;height:230px"><canvas id="aChartTickets" data-chart="tickets"></canvas></div></div>
  </div>
  <div style="${_cc};margin-bottom:14px"><div class="fd" style="${_ct};display:flex;align-items:center;justify-content:space-between">By employee${fArr('users').length?'<span style="font-size:11px;font-weight:600;color:var(--c-brand-ink);background:var(--c-brand-soft);padding:2px 9px;border-radius:99px">filtered</span>':'<span style="font-size:11px;font-weight:500;color:var(--c-text-3)">top 15 · click a bar for detail</span>'}</div><div style="position:relative;height:${Math.max(220,(_AData.emp.ids.length||1)*34+60)}px"><canvas id="aChartEmp" data-chart="by-employee"></canvas></div></div>
  <div class="achart-grid" style="margin-bottom:14px">
    <div style="${_cc}"><div class="fd" style="${_ct}">Compliance</div><div style="position:relative;height:210px"><canvas id="aChartCompliance" data-chart="compliance"></canvas></div></div>
    <div style="${_cc}"><div class="fd" style="${_ct}">Top contributors</div>
      ${topU.slice(0,7).map(({u,n})=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:9px;cursor:pointer" onclick="App._userDrill('${u.id}')">${avatar(u,'w-7 h-7','text-[10px]')}<div style="flex:1;font-size:13px;font-weight:500;color:var(--c-text);overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(fullName(u))}</div><span class="fd" style="font-size:15px;font-weight:800;color:var(--c-text)">${n}</span><span style="font-size:11px;color:var(--c-text-3)">&rsaquo;</span></div>`).join('')||'<p style="font-size:13px;color:var(--c-text-3)">No data yet</p>'}
    </div>
  </div>
  `:''}
  ${_view==='details'?`
  <!-- Folded from the old admin/manager dashboard: per-user performance (respects the same scope + filters) -->
  <div style="${_cc};padding:0;overflow:hidden;margin-bottom:14px">
    <div style="padding:14px 18px;border-bottom:1px solid var(--c-border)"><span class="fd" style="font-size:14px;font-weight:700;color:var(--c-text)">${isAdmin()?'All users performance':'Team performance'} (${_perfRows.length})</span></div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="border-bottom:1px solid var(--c-border)">${['Member','Assigned','Submitted','Late','Pending','Tickets','On-time %'].map(h=>`<th style="padding:9px 16px;font-size:10px;font-weight:700;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;text-align:left;white-space:nowrap">${h}</th>`).join('')}</tr></thead>
      <tbody>${_perfRows.map(({u,asgn,total,late:lt,pend,tk,pct})=>`<tr style="border-bottom:1px solid var(--c-border);cursor:pointer" onclick="App._userDrill('${u.id}')" onmouseover="this.style.background='var(--c-surface-2)'" onmouseout="this.style.background=''"><td style="padding:9px 16px"><div style="display:flex;align-items:center;gap:7px">${avatar(u,'w-7 h-7','text-[10px]')}<span style="font-weight:500;color:var(--c-text)">${esc(fullName(u))}</span></div></td><td style="padding:9px 16px">${asgn}</td><td style="padding:9px 16px;color:var(--c-success-ink);font-weight:600">${total}</td><td style="padding:9px 16px;${lt?'color:var(--c-danger-ink);font-weight:700':''}">${lt}</td><td style="padding:9px 16px;color:var(--c-warn-ink)">${pend}</td><td style="padding:9px 16px">${tk||'<span style="color:var(--c-text-3)">0</span>'}</td><td style="padding:9px 16px"><div style="display:flex;align-items:center;gap:8px"><div style="width:60px;height:6px;border-radius:3px;background:var(--c-surface-2);overflow:hidden"><div style="height:100%;width:${pct}%;background:${pct>=80?'#0E9F6E':pct>=50?'#F59E0B':'#F43F5E'}"></div></div><span style="font-size:12px;font-weight:600;color:var(--c-text)">${pct}%</span></div></td></tr>`).join('')||`<tr><td colspan="7" style="padding:18px;text-align:center;color:var(--c-text-3);font-size:13px">No people match the current filters</td></tr>`}</tbody>
    </table></div>
  </div>

  <!-- Table -->
  <div style="background:var(--c-surface);border-radius:var(--r-lg);border:1px solid var(--c-border);box-shadow:var(--sh-sm);overflow:hidden">
    <div style="padding:14px 18px;border-bottom:1px solid var(--c-border);display:flex;justify-content:space-between;align-items:center">
      <span class="fd" style="font-size:14px;font-weight:700;color:var(--c-text)">Submissions (${subs.length})</span>
      ${btnG('Export CSV','App._exportCSV()','download')}
    </div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="border-bottom:1px solid var(--c-border)">
        ${['User','Checklist','Dept','Date','Status','Answered','Compliance'].map(h=>`<th style="padding:9px 16px;font-size:10px;font-weight:700;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;text-align:left;white-space:nowrap">${h}</th>`).join('')}
      </tr></thead>
      <tbody>${recent.map(s=>{const u=uById(s.userId),c=clById(s.checklistId);if(!u)return'';const qCount=(s.questionResponses||[]).filter(r=>r.response!==null&&r.response!==undefined&&r.response!=='').length;if(!c)return`<tr style="border-bottom:1px solid var(--c-border);opacity:.5"><td style="padding:9px 16px" colspan="7"><span style="font-size:12px;color:var(--c-text-3)">${esc(fullName(u))} — deleted checklist — ${fmtS(s.date)}</span></td></tr>`;const _qTot=(c.questionIds||[]).length;const _esc=_qTot?_subEscalationCount(c,s):0;return`<tr style="border-bottom:1px solid var(--c-border);cursor:pointer" onclick="App.viewSub('${s.id}')" onmouseover="this.style.background='var(--c-surface-2)'" onmouseout="this.style.background=''">
        <td style="padding:9px 16px"><div style="display:flex;align-items:center;gap:7px;cursor:pointer" onclick="event.stopPropagation();App._userDrill('${u.id}')">${avatar(u,'w-7 h-7','text-[10px]')}<span style="font-weight:500;color:var(--c-text);text-decoration:underline;text-decoration-color:var(--c-border)">${esc(fullName(u))}</span></div></td>
        <td style="padding:9px 16px;max-width:140px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:var(--c-text)">${esc(c.name)}</td>
        <td style="padding:9px 16px;color:var(--c-text-3);font-size:12px">${esc(c.department)}</td>
        <td style="padding:9px 16px;color:var(--c-text-3);font-size:12px;white-space:nowrap">${fmtS(s.date)}</td>
        <td style="padding:9px 16px">${chip(s.status)}</td>
        <td style="padding:9px 16px">${qCount?`<span style="font-size:12px;font-weight:700;color:var(--c-brand)">${qCount}/${_qTot}</span>`:'<span style="color:var(--c-text-3)">—</span>'}</td>
        <td style="padding:9px 16px">${_qTot?(_esc>0?`<span style="display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:var(--c-danger-soft);color:var(--c-danger-ink);white-space:nowrap">${ic('alert','w-3 h-3')}${_esc}</span>`:`<span style="display:inline-flex;align-items:center;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:var(--c-success-soft);color:var(--c-success-ink);white-space:nowrap">${ic('check','w-3 h-3')}</span>`):'<span style="color:var(--c-text-3)">—</span>'}</td>
      </tr>`;}).join('')}</tbody>
    </table>${recent.length?'':empty('chart','No submissions match','Adjust filters or date range')}</div>
  </div>
  `:''}</div>`;
}


App._viewSubById=(id)=>App.viewSub(id);
App._userDrill=(uid)=>{
  const u=uById(uid);if(!u)return;
  let subs=DB.submissions.filter(s=>s.userId===uid);
  const today=todayISO();
  const dr1=new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  subs=subs.filter(s=>s.date>=dr1);
  const tot=subs.length;
  const onTime=subs.filter(s=>s.status==='On Time').length;
  const late=subs.filter(s=>s.status==='Late'&&!!clById(s.checklistId)).length;
  const pending=subs.filter(s=>s.status==='Pending Approval').length;
  const rejected=subs.filter(s=>s.status==='Rejected').length;
  const issues=subs.reduce((n,s)=>n+(s.questionResponses||[]).filter(r=>r.response!==null&&r.response!==undefined&&r.response!=='').length,0);
  const nonComp=subs.reduce((n,s)=>{const c=clById(s.checklistId);return n+((c&&(c.questionIds||[]).length&&_subEscalationCount(c,s)>0)?1:0);},0);
  const pct=tot?Math.round(onTime/tot*100):0;
  const recent=subs.slice().sort((a,b)=>(b.submittedAt||'').localeCompare(a.submittedAt||'')).slice(0,10);
  modalShell({title:fullName(u),sub:(u.position||'')+' · '+(u.department||''),size:'max-w-md',
    body:''
    // Score
    +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">'
    +[['Submitted',tot,'var(--c-text)'],['On time',onTime,'#059669'],['Late',late,'#DC2626'],['Pending',pending,'#F97316'],['Non-compliant',nonComp,'#BE123C'],['Answered',issues,'#0E9F6E']].map(([l,v,c])=>'<div style="background:var(--c-surface-2);border-radius:12px;padding:12px;text-align:center"><div class="fd" style="font-size:22px;font-weight:800;color:'+c+'">'+v+'</div><div style="font-size:11px;font-weight:600;color:var(--c-text-3);margin-top:2px">'+l+'</div></div>').join('')
    +'</div>'
    // Completion rate bar
    +'<div style="background:var(--c-surface-2);border-radius:12px;padding:12px;margin-bottom:16px">'
    +'<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:6px"><span style="color:var(--c-text)">On-time rate (last 30d)</span><span style="color:'+(pct>=80?'#059669':pct>=60?'#F97316':'#DC2626')+'">'+pct+'%</span></div>'
    +'<div style="height:6px;background:var(--c-border);border-radius:3px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+(pct>=80?'#059669':pct>=60?'#F97316':'#DC2626')+';border-radius:3px;transition:width .5s"></div></div>'
    +'</div>'
    // Recent submissions
    +'<div class="fd" style="font-size:13px;font-weight:700;color:var(--c-text);margin-bottom:8px">Recent submissions</div>'
    +(recent.length
      ? recent.map(s=>{const c=clById(s.checklistId);const _esc=(c&&(c.questionIds||[]).length)?_subEscalationCount(c,s):0;const _comp=(c&&(c.questionIds||[]).length)?(_esc>0?'<span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;background:var(--c-danger-soft);color:var(--c-danger-ink);white-space:nowrap">'+ic('alert','w-3 h-3')+_esc+'</span>':'<span style="display:inline-flex;align-items:center;font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;background:var(--c-success-soft);color:var(--c-success-ink)">'+ic('check','w-3 h-3')+'</span>'):'';return'<div style="display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid var(--c-border);cursor:pointer" onclick="App._viewSubById(this.dataset.id)" data-id="'+s.id+'">'+'<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500;color:var(--c-text);overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+esc(c?.name||'—')+'</div><div style="font-size:11px;color:var(--c-text-3);margin-top:1px">'+fmtS(s.date)+'</div></div>'+_comp+chip(s.status)+'</div>';}).join('')
      : '<p style="font-size:13px;color:var(--c-text-3)">No submissions in last 30 days</p>'
    )});
};
App._togF=(key,val)=>{
  if(!S.filters)S.filters={};
  if(!S.filters[key])S.filters[key]=[];
  if(!Array.isArray(S.filters[key]))S.filters[key]=[S.filters[key]];
  const idx=S.filters[key].indexOf(val);
  if(idx>-1)S.filters[key].splice(idx,1);
  else S.filters[key].push(val);
  if(!S.filters[key].length)delete S.filters[key];
  S.afOpen=key; // keep dropdown open
  rr();
};

/* ════════ HRM ANALYTICS PAGE ════════ */
function hrmAnalyticsPage(){
  const f=S.filters;
  // Reports hub (build plan Phase 0): one place for absentee / SLA / expiry / OT / WFH / status reports.
  const hraTab=f.hraTab||'dash';
  const _hraTabs=`<div class="ui-tabs" style="margin-bottom:14px"><button class="ui-tab${hraTab==='dash'?' on':''}" onclick="S.filters.hraTab='dash';rr()">Dashboard</button><button class="ui-tab${hraTab==='reports'?' on':''}" onclick="S.filters.hraTab='reports';rr()">Reports</button></div>`;
  if(hraTab==='reports')return `<div class="fade">${hdr('HRM Analytics','One reports hub — filters + one-click CSV export')}${_hraTabs}${_reportsHubHTML()}</div>`;
  // §1.8 step 5: data scope honors the resolver's `reports` scope (mirrors attendancePage).
  // scopedUsers('reports') already implements self/team/department/location/everyone and keeps
  // other Super Admins out of HR reports for non-admins (scopeFilter line ~799). Unassigned users
  // fall through to _baseScope → today's behavior (admin all / HR all-except-super-admin / mgr team / self).
  let scope=scopedUsers('reports');
  if(!scope.length||!scope.some(u=>u.id===S.uid))scope=[me(),...scope.filter(u=>u.id!==S.uid)];
  // apply filters
  let users=scope.slice();
  if(f.haUser)users=users.filter(u=>u.id===f.haUser);
  if(f.haDept)users=users.filter(u=>u.department===f.haDept);
  if(f.haLoc)users=users.filter(u=>u.hrm?.locationId===f.haLoc); // L6: real location filter (DB.locations)
  const d1=f.haD1||todayISO().slice(0,8)+'01';
  const d2=f.haD2||todayISO();
  const ltFilter=f.haLt||'';
  const rows=users.map(u=>{
    const att=(DB.attendance||[]).filter(a=>a.userId===u.id&&a.date>=d1&&a.date<=d2);
    const worked=_r2(att.reduce((s,a)=>s+(a.hours||0),0));
    const lates=att.filter(a=>(a.flags||[]).includes('late')).length;
    const absences=_deriveAbsences(u,d1,d2); // L4: dropped dead Absent-filter term (Absent is virtual, never persisted)
    let leaveReqs=(DB.leaveRequests||[]).filter(r=>r.userId===u.id&&r.status==='Approved'&&!(r.end<d1||r.start>d2));
    if(ltFilter)leaveReqs=leaveReqs.filter(r=>r.leaveTypeId===ltFilter);
    const leavesTaken=_r2(leaveReqs.reduce((s,r)=>s+_leaveDaysInRange(r,d1,d2),0)); // L5/M2: clip to window, exclude worked-day overlaps
    const remaining=_r2(_typesFor(userProfileId(u)).filter(t=>t.enabled).reduce((s,t)=>s+_ltRemaining(u.id,t,_leaveYearOf(u,todayISO())),0));
    return {u,worked,lates,absences,leavesTaken,remaining};
  });
  const allLts=_typesFor(userProfileId(me())||DB.hrmConfig.activeProfile);
  const canDl=can('reports','download');
  const _lblS='display:block;font-size:10.5px;font-weight:700;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px';
  const _anyHa=f.haUser||f.haDept||f.haLoc||f.haLt||f.haD1||f.haD2;
  const filterBar=`<div style="background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--r-lg);box-shadow:var(--sh-sm);padding:14px 16px;margin-bottom:16px">
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:10px 12px;align-items:end">
      <div><label style="${_lblS}">From</label><input type="date" value="${d1}" onchange="S.filters.haD1=this.value;rr()" class="ui-input rf" style="width:100%"/></div>
      <div><label style="${_lblS}">To</label><input type="date" value="${d2}" onchange="S.filters.haD2=this.value;rr()" class="ui-input rf" style="width:100%"/></div>
      <div><label style="${_lblS}">Employee</label><select onchange="S.filters.haUser=this.value;rr()" class="ui-select rf" style="width:100%"><option value="">All employees</option>${scope.slice().sort((a,b)=>fullName(a).localeCompare(fullName(b))).map(u=>`<option value="${u.id}"${f.haUser===u.id?' selected':''}>${esc(fullName(u))}</option>`).join('')}</select></div>
      <div><label style="${_lblS}">Department</label><select onchange="S.filters.haDept=this.value;rr()" class="ui-select rf" style="width:100%"><option value="">All departments</option>${DB.departments.map(d=>`<option${f.haDept===d.name?' selected':''}>${esc(d.name)}</option>`).join('')}</select></div>
      <div><label style="${_lblS}">Location</label><select onchange="S.filters.haLoc=this.value;rr()" class="ui-select rf" style="width:100%"><option value="">All locations</option>${DB.locations.map(l=>`<option value="${l.id}"${f.haLoc===l.id?' selected':''}>${esc(l.name)}</option>`).join('')}</select></div>
      <div><label style="${_lblS}">Leave type</label><select onchange="S.filters.haLt=this.value;rr()" class="ui-select rf" style="width:100%"><option value="">All leave types</option>${allLts.map(t=>`<option value="${t.id}"${f.haLt===t.id?' selected':''}>${esc(t.name)}</option>`).join('')}</select></div>
      ${_anyHa?`<div><label style="${_lblS}">&nbsp;</label><button onclick="['haUser','haDept','haLoc','haLt','haD1','haD2'].forEach(k=>delete S.filters[k]);rr()" class="ui-btn ui-btn-subtle ui-btn-md" style="width:100%">Clear filters</button></div>`:''}

    </div>
  </div>`;
  const tot=rows.reduce((a,r)=>({w:a.w+r.worked,l:a.l+r.lates,lv:a.lv+r.leavesTaken,ab:a.ab+r.absences}),{w:0,l:0,lv:0,ab:0});
  const stats=`<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">${statCard('Total worked hrs',_r2(tot.w),'brand')}${statCard('Late check-ins',tot.l,'amber')}${statCard('Leave days taken',_r2(tot.lv),'sky')}${statCard('Absences',tot.ab,'rose')}</div>`;
  const table=`<div style="background:var(--c-surface);border-radius:var(--r-lg);border:1px solid var(--c-border);box-shadow:var(--sh-sm);overflow:hidden"><div style="overflow-x:auto"><table class="w-full text-sm"><thead><tr style="border-bottom:1px solid var(--c-border);text-align:left"><th class="px-4 py-2.5" style="font-size:10px;font-weight:700;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em">Employee</th><th class="px-4 py-2.5" style="font-size:10px;font-weight:700;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em">Dept</th><th class="px-4 py-2.5" style="font-size:10px;font-weight:700;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em">Worked hrs</th><th class="px-4 py-2.5" style="font-size:10px;font-weight:700;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em">Lates</th><th class="px-4 py-2.5" style="font-size:10px;font-weight:700;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em">Leaves taken</th><th class="px-4 py-2.5" style="font-size:10px;font-weight:700;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em">Remaining</th><th class="px-4 py-2.5" style="font-size:10px;font-weight:700;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em">Absences</th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr style="border-bottom:1px solid var(--c-border)"><td class="px-4 py-2.5"><div class="flex items-center gap-2">${avatar(r.u,'w-7 h-7','text-[10px]')}<span style="font-weight:500;color:var(--c-text)">${esc(fullName(r.u))}</span></div></td><td class="px-4 py-2.5" style="font-size:12px;color:var(--c-text-2)">${esc(r.u.department||'')}</td><td class="px-4 py-2.5" style="font-weight:600;color:var(--c-text)">${r.worked}h</td><td class="px-4 py-2.5" style="${r.lates?'color:var(--c-warn);font-weight:600':'color:var(--c-text)'}">${r.lates}</td><td class="px-4 py-2.5" style="color:var(--c-text)">${r.leavesTaken}</td><td class="px-4 py-2.5" style="color:var(--c-success-ink)">${r.remaining}</td><td class="px-4 py-2.5" style="${r.absences?'color:var(--c-rose,#E11D48);font-weight:600':'color:var(--c-text)'}">${r.absences}</td></tr>`).join(''):`<tr><td colspan="7">${empty('chart','No data','Adjust filters or date range.')}</td></tr>`}</tbody></table></div></div>`;
  const _cc='background:var(--c-surface);border-radius:var(--r-lg);border:1px solid var(--c-border);box-shadow:var(--sh-sm);padding:18px';
  const _ct='font-size:14px;font-weight:700;color:var(--c-text);margin-bottom:12px';
  const _hv=S.hrmView==='details'?'details':'visuals';
  // Subtitle reflects the ACTUAL resolved reports-scope (not just the role flag), so a manager granted
  // a broader scope via a role profile is labelled accurately.
  const _rsc=scopeOf('reports');
  const _scopeSuffix=isAdmin()?'':_rsc==='everyone'?' (all staff)':_rsc==='department'?' (your department)':_rsc==='location'?' (your branch)':_rsc==='team'?' (your team)':' (you)';
  const _hrmTop=rows.slice().sort((a,b)=>b.worked-a.worked).slice(0,12);
  _HRMData={ids:_hrmTop.map(r=>r.u.id),byId:Object.fromEntries(_hrmTop.map(r=>[r.u.id,r])),labels:_hrmTop.map(r=>fullName(r.u)),worked:_hrmTop.map(r=>r.worked),lates:_hrmTop.map(r=>r.lates),absences:_hrmTop.map(r=>r.absences),taken:_hrmTop.map(r=>r.leavesTaken),remaining:_hrmTop.map(r=>r.remaining)};
  const _stb=(v,lbl,icn)=>`<button onclick="S.hrmView='${v}';rr()" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:1px solid ${_hv===v?'var(--c-text)':'var(--c-border)'};background:${_hv===v?'var(--c-text)':'var(--c-surface)'};color:${_hv===v?'#fff':'var(--c-text-2)'};font-size:13px;font-weight:700;cursor:pointer">${ic(icn,'w-4 h-4')}${lbl}</button>`;
  const _subTab=`<div style="display:flex;gap:8px;margin-bottom:16px">${_stb('visuals','Visuals','chart')}${_stb('details','Details','list')}</div>`;
  const visualsHTML=rows.length?`<div class="achart-grid" style="margin-bottom:14px">
      <div style="${_cc}"><div class="fd" style="${_ct}">Worked hours by employee</div><div style="position:relative;height:360px"><canvas id="hrmChartWorked" data-chart="worked-hours"></canvas></div></div>
      <div style="${_cc}"><div class="fd" style="${_ct}">Lateness &amp; absences</div><div style="position:relative;height:360px"><canvas id="hrmChartLate" data-chart="lateness-absences"></canvas></div></div>
    </div>
    <div style="${_cc};margin-bottom:14px"><div class="fd" style="${_ct}">Leave: taken vs remaining</div><div style="position:relative;height:360px"><canvas id="hrmChartLeave" data-chart="leave-balance"></canvas></div></div>`:empty('chart','No data','Adjust filters or date range.');
  return `<div class="fade">${hdr('HRM Analytics','Worked hours, lateness, leaves & absences'+_scopeSuffix,canDl?btn('Download CSV','App.downloadPayroll()',{variant:'primary',icon:'download'}):'')}${filterBar}${_subTab}${_hv==='visuals'?visualsHTML:(stats+table)}</div>`;
}
function _deriveAbsences(u,d1,d2){
  // count past working days in range with no attendance record and no approved leave
  let d=d1,n=0,guard=0;const today=todayISO();
  const off=new Set(u.hrm?.schedule?.offDays||[]);const prof=userProfileId(u);
  const hols=new Set((DB.holidays||[]).filter(h=>h.profileId===prof).map(h=>h.date));
  // L4: never flag days before the user joined OR before HRM adoption (their first attendance record).
  // Without a first record there is no adoption baseline → don't derive absences at all (avoids huge false counts).
  const firstRec=(DB.attendance||[]).filter(a=>a.userId===u.id).reduce((m,a)=>(!m||a.date<m?a.date:m),null);
  if(!firstRec)return 0;
  let start=d1;
  if(u.hrm?.joiningDate&&u.hrm.joiningDate>start)start=u.hrm.joiningDate;
  if(firstRec>start)start=firstRec;
  d=start;
  while(d<=d2&&d<today&&guard++<400){
    const dow=DAYS3[new Date(d+'T00:00:00').getDay()];
    if(!off.has(dow)&&!hols.has(d)){
      const rec=attFor(u.id,d);
      const onLeave=(DB.leaveRequests||[]).some(r=>r.userId===u.id&&r.status==='Approved'&&r.start<=d&&r.end>=d);
      if(!rec&&!onLeave)n++;
    }
    d=_isoAdd(d,1);
  }
  return n;
}
App.downloadPayroll=()=>{
  const canDl=can('reports','download');
  if(!canDl){toast('No download permission','err');return;}
  const f=S.filters;
  // N4: use the SAME scope resolver as the on-screen HRM Analytics table so the export
  // population matches what the user sees (was a divergent legacy isAdmin/isHR/isMgr ladder).
  let scope=scopedUsers('reports');
  if(!scope.length||!scope.some(u=>u.id===S.uid))scope=[me(),...scope.filter(u=>u&&u.id!==S.uid)].filter(Boolean);
  let users=scope.slice();
  if(f.haUser)users=users.filter(u=>u.id===f.haUser);
  if(f.haDept)users=users.filter(u=>u.department===f.haDept);
  if(f.haLoc)users=users.filter(u=>u.hrm?.locationId===f.haLoc); // L6: real location filter (DB.locations)
  const d1=f.haD1||todayISO().slice(0,8)+'01',d2=f.haD2||todayISO();
  const rows=[['Employee','Email','Department','Location','Worked Hours','Late Check-ins','Leaves Taken','Leaves Remaining','Absences','Period']];
  users.forEach(u=>{
    const att=(DB.attendance||[]).filter(a=>a.userId===u.id&&a.date>=d1&&a.date<=d2);
    const worked=_r2(att.reduce((s,a)=>s+(a.hours||0),0));
    const lates=att.filter(a=>(a.flags||[]).includes('late')).length;
    const absences=_deriveAbsences(u,d1,d2); // L4: dropped dead Absent-filter term (Absent is virtual, never persisted)
    const leavesTaken=_r2((DB.leaveRequests||[]).filter(r=>r.userId===u.id&&r.status==='Approved'&&!(r.end<d1||r.start>d2)).reduce((s,r)=>s+_leaveDaysInRange(r,d1,d2),0)); // L5/M2
    const remaining=_r2(_typesFor(userProfileId(u)).filter(t=>t.enabled).reduce((s,t)=>s+_ltRemaining(u.id,t,_leaveYearOf(u,todayISO())),0));
    rows.push([fullName(u),u.email||'',u.department||'',userProfileId(u),worked,lates,leavesTaken,remaining,absences,d1+' to '+d2]);
  });
  const csv=rows.map(r=>r.map(v=>{let c=String(v??'');if(/^[=+\-@\t\r]/.test(c))c="'"+c;return '"'+c.replace(/"/g,'""')+'"';}).join(',')).join('\n');
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,﻿'+encodeURIComponent(csv);a.download='bridge_payroll_'+todayISO()+'.csv';a.click();
  hlog('Payroll exported',d1+' to '+d2+' ('+users.length+' staff)');
  toast('Exported '+users.length+' staff');
};

// Shared sanitized CSV writer — IDENTICAL guard to _exportCSV/downloadPayroll.
// rows: array of arrays. filenamePrefix: e.g. 'bridge_report_attendance'.
function _csvDownload(rows,filenamePrefix){
  const csv=rows.map(r=>r.map(v=>{let c=String(v??'');
    // Neutralize CSV formula injection (= + - @ tab CR → text).
    if(/^[=+\-@\t\r]/.test(c))c="'"+c;
    return '"'+c.replace(/"/g,'""')+'"';}).join(',')).join('\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,﻿'+encodeURIComponent(csv);
  a.download=(filenamePrefix||'bridge_report')+'_'+todayISO()+'.csv';
  a.click();
}

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window._reportsHubHTML=_reportsHubHTML;window._reportScopeIds=_reportScopeIds;window.analyticsPage=analyticsPage;window.hrmAnalyticsPage=hrmAnalyticsPage;window._deriveAbsences=_deriveAbsences;window._csvDownload=_csvDownload;
