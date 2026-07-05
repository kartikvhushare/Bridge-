

/* ===== LIVE DASHBOARD CHARTS (Chart.js) =====
   _AData / _HData are filled by analyticsPage() / homeDash() during render; the canvases are then
   painted by _paintCharts(), which render()/rr() call after the DOM is in place. Charts are destroyed
   and rebuilt on every render so they always reflect the current filters. */
function _aChartTheme(){return {tick:'#8A93A3',grid:'rgba(138,147,163,0.18)'};}
function _destroyACharts(){_aCharts.forEach(c=>{try{c.destroy();}catch(e){}});_aCharts=[];}
function _paintCharts(){try{
  const need=document.getElementById('aChartStatus')||document.getElementById('hChartOnTime')||document.getElementById('hrmChartWorked')||document.querySelector('canvas[data-okr-chart]');
  if(need&&typeof Chart==='undefined'){if(!_paintCharts._r){_paintCharts._r=1;setTimeout(_paintCharts,250);}return;}
  _paintCharts._r=0;
  if(document.getElementById('aChartStatus'))_drawAnalyticsCharts();
  else if(document.getElementById('hChartOnTime'))_drawHomeCharts();
  else if(document.getElementById('hrmChartWorked'))_drawHrmCharts();
  else if(document.querySelector('canvas[data-okr-chart]'))_drawOKRCharts();
  else _destroyACharts();
}catch(e){}}
function _drawHrmCharts(){
  if(typeof Chart==='undefined'||!_HRMData)return;
  _destroyACharts();
  const T=_aChartTheme(),D=_HRMData;
  const mk=(id,empty,cfg)=>{const cv=document.getElementById(id);if(!cv)return;if(empty){_emptyChart(id);return;}try{_aCharts.push(new Chart(cv.getContext('2d'),cfg));}catch(e){}};
  const legB={legend:{position:'bottom',labels:{color:T.tick,font:{size:11},boxWidth:12,padding:10}}};
  const clk=_aClick(i=>{const id=D.ids&&D.ids[i];if(id)App._hrmDrill(id);});
  const noRows=!D.labels||!D.labels.length;
  mk('hrmChartWorked',noRows,{type:'bar',data:{labels:D.labels,datasets:[{label:'Worked hrs',data:D.worked,backgroundColor:'#0E9F6E',borderRadius:4}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},onHover:_aHover,onClick:clk,scales:{x:{beginAtZero:true,ticks:{color:T.tick,font:{size:10}},grid:{color:T.grid}},y:{ticks:{color:T.tick,font:{size:11}},grid:{display:false}}}}});
  mk('hrmChartLate',noRows,{type:'bar',data:{labels:D.labels,datasets:[{label:'Lates',data:D.lates,backgroundColor:'#F59E0B',borderRadius:4},{label:'Absences',data:D.absences,backgroundColor:'#EF4444',borderRadius:4}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:legB,onHover:_aHover,onClick:clk,scales:{x:{beginAtZero:true,ticks:{color:T.tick,font:{size:10},precision:0},grid:{color:T.grid}},y:{ticks:{color:T.tick,font:{size:11}},grid:{display:false}}}}});
  mk('hrmChartLeave',noRows,{type:'bar',data:{labels:D.labels,datasets:[{label:'Taken',data:D.taken,backgroundColor:'#0EA5E9',borderRadius:4},{label:'Remaining',data:D.remaining,backgroundColor:'#CBD5E1',borderRadius:4}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:legB,onHover:_aHover,onClick:clk,scales:{x:{stacked:true,beginAtZero:true,ticks:{color:T.tick,font:{size:10}},grid:{color:T.grid}},y:{stacked:true,ticks:{color:T.tick,font:{size:11}},grid:{display:false}}}}});
}
function _aClick(fn){return (e,els)=>{if(els&&els.length)fn(els[0].index,els[0].datasetIndex);};}
function _aHover(e,els){try{e.native.target.style.cursor=(els&&els.length)?'pointer':'default';}catch(_){}}
// When a chart has no data, show a tidy "No data" panel instead of empty axes/blank rings.
function _allZero(a){return !a||!a.length||a.every(v=>!v);}
function _emptyChart(id){const cv=document.getElementById(id);if(!cv)return;const p=cv.parentElement;if(p)p.innerHTML='<div style="height:100%;display:grid;place-items:center;color:var(--c-text-3);font-size:12.5px;text-align:center;padding:0 14px">No data for this range</div>';}
function _drawAnalyticsCharts(){
  if(typeof Chart==='undefined'||!_AData)return;
  _destroyACharts();
  const T=_aChartTheme(),A=_AData;
  const mk=(id,empty,cfg)=>{const cv=document.getElementById(id);if(!cv)return;if(empty){_emptyChart(id);return;}try{_aCharts.push(new Chart(cv.getContext('2d'),cfg));}catch(e){}};
  const legB={legend:{position:'bottom',labels:{color:T.tick,font:{size:11},boxWidth:12,padding:10}}};
  mk('aChartStatus',_allZero(A.status.data),{type:'doughnut',data:{labels:A.status.labels,datasets:[{data:A.status.data,backgroundColor:A.status.colors,borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:'58%',plugins:legB,onHover:_aHover,onClick:_aClick(i=>App._chartDrill('status',A.status.labels[i]))}});
  mk('aChartTrend',_allZero(A.trend.sub),{type:'line',data:{labels:A.trend.labels,datasets:[{label:'Submitted',data:A.trend.sub,borderColor:'#0EA5E9',backgroundColor:'rgba(14,165,233,0.12)',fill:true,tension:0.3,pointRadius:2,borderWidth:2},{label:'On time',data:A.trend.ontime,borderColor:'#0E9F6E',fill:false,tension:0.3,pointRadius:2,borderWidth:2},{label:'Late',data:A.trend.late,borderColor:'#EF4444',fill:false,tension:0.3,pointRadius:2,borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:legB,onHover:_aHover,onClick:_aClick(i=>App._chartDrill('date',A.trend.labels[i])),scales:{x:{ticks:{color:T.tick,font:{size:10},maxRotation:0,autoSkip:true,maxTicksLimit:8},grid:{display:false}},y:{beginAtZero:true,ticks:{color:T.tick,font:{size:10},precision:0},grid:{color:T.grid}}}}});
  mk('aChartDept',!A.dept.labels.length,{type:'bar',data:{labels:A.dept.labels,datasets:[{label:'On time',data:A.dept.onTime,backgroundColor:'#0E9F6E',borderRadius:4},{label:'Total',data:A.dept.total,backgroundColor:'#CBD5E1',borderRadius:4}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:legB,onHover:_aHover,onClick:_aClick(i=>App._chartDrill('dept',A.dept.labels[i])),scales:{x:{beginAtZero:true,ticks:{color:T.tick,font:{size:10},precision:0},grid:{color:T.grid}},y:{ticks:{color:T.tick,font:{size:11}},grid:{display:false}}}}});
  mk('aChartTickets',_allZero(A.tickets.data),{type:'doughnut',data:{labels:A.tickets.labels,datasets:[{data:A.tickets.data,backgroundColor:A.tickets.colors,borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:'58%',plugins:legB,onHover:_aHover,onClick:_aClick(i=>App._chartDrill('ticket',A.tickets.labels[i]))}});
  mk('aChartEmp',!A.emp.labels.length,{type:'bar',data:{labels:A.emp.labels,datasets:[{label:'On time',data:A.emp.onTime,backgroundColor:'#0E9F6E',borderRadius:3},{label:'Late',data:A.emp.late,backgroundColor:'#EF4444',borderRadius:3},{label:'Pending',data:A.emp.pend,backgroundColor:'#F59E0B',borderRadius:3}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:legB,onHover:_aHover,onClick:_aClick(i=>{const id=A.emp.ids[i];if(id)App._userDrill(id);}),scales:{x:{stacked:true,beginAtZero:true,ticks:{color:T.tick,font:{size:10},precision:0},grid:{color:T.grid}},y:{stacked:true,ticks:{color:T.tick,font:{size:11}},grid:{display:false}}}}});
  mk('aChartCompliance',_allZero(A.compliance.data),{type:'doughnut',data:{labels:A.compliance.labels,datasets:[{data:A.compliance.data,backgroundColor:A.compliance.colors,borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:legB,onHover:_aHover,onClick:_aClick(i=>App._chartDrill('compliance',A.compliance.labels[i]))}});
}
function _drawHomeCharts(){
  if(typeof Chart==='undefined'||!_HData)return;
  _destroyACharts();
  const T=_aChartTheme();
  const mk=(id,empty,cfg)=>{const cv=document.getElementById(id);if(!cv)return;if(empty){_emptyChart(id);return;}try{_aCharts.push(new Chart(cv.getContext('2d'),cfg));}catch(e){}};
  mk('hChartOnTime',_allZero(_HData.donut),{type:'doughnut',data:{labels:['On time','Late','Pending'],datasets:[{data:_HData.donut,backgroundColor:['#0E9F6E','#EF4444','#F59E0B'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'bottom',labels:{color:T.tick,font:{size:11},boxWidth:12,padding:10}}}}});
  mk('hChartTrend',_allZero(_HData.done),{type:'line',data:{labels:_HData.labels,datasets:[{label:'Completed',data:_HData.done,borderColor:'#0E9F6E',backgroundColor:'rgba(14,159,110,0.12)',fill:true,tension:0.3,pointRadius:2,borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:T.tick,font:{size:10},maxRotation:0,autoSkip:true,maxTicksLimit:7},grid:{display:false}},y:{beginAtZero:true,ticks:{color:T.tick,font:{size:10},precision:0},grid:{color:T.grid}}}}});
}
// Export every visible chart as a PNG (white background) plus the data CSV.
function _pngWithBg(cv){const c=document.createElement('canvas');c.width=cv.width||cv.clientWidth;c.height=cv.height||cv.clientHeight;const x=c.getContext('2d');x.fillStyle='#ffffff';x.fillRect(0,0,c.width,c.height);x.drawImage(cv,0,0);return c.toDataURL('image/png');}
App._exportReport=()=>{
  const cvs=Array.from(document.querySelectorAll('canvas[data-chart]'));
  toast(cvs.length?('Exporting '+cvs.length+' chart'+(cvs.length!==1?'s':'')+' + data…'):'Exporting data…');
  cvs.forEach((cv,i)=>setTimeout(()=>{try{const a=document.createElement('a');a.href=_pngWithBg(cv);a.download='bridge_'+(cv.dataset.chart||'chart')+'_'+todayISO()+'.png';document.body.appendChild(a);a.click();a.remove();}catch(e){}},i*400));
  setTimeout(()=>{try{App._exportCSV();}catch(e){}},cvs.length*400+250);
};
// ── Click-to-drill: clicking any analytics chart opens the underlying rows in a popup ──
function _subListModal(title,subs){
  const rows=subs.slice().sort((a,b)=>(b.submittedAt||b.date||'').localeCompare(a.submittedAt||a.date||'')).slice(0,300);
  modalShell({title,sub:subs.length+' item'+(subs.length!==1?'s':''),size:'max-w-lg',
    body:rows.length?rows.map(s=>{const u=uById(s.userId),c=clById(s.checklistId);return `<div onclick="App.closeModal();App.viewSub('${s.id}')" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--c-border);cursor:pointer">${avatar(u,'w-8 h-8','text-[11px]')}<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:var(--c-text);overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(u?fullName(u):'—')}</div><div style="font-size:11px;color:var(--c-text-3);overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(c?c.name:'[deleted checklist]')} · ${fmtS(s.date)}</div></div>${chip(s.status)}</div>`;}).join(''):'<p style="font-size:13px;color:var(--c-text-3);text-align:center;padding:20px">No items.</p>'});
}
function _missedDrillModal(missed){
  const rows=(missed||[]).slice(0,300);
  modalShell({title:'Missed checklists',sub:(missed||[]).length+' missed',size:'max-w-lg',
    body:rows.length?rows.map(m=>{const u=uById(m.userId),c=clById(m.checklistId);return `<div onclick="App.closeModal();App._userDrill('${m.userId}')" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--c-border);cursor:pointer">${avatar(u,'w-8 h-8','text-[11px]')}<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:var(--c-text)">${esc(u?fullName(u):'—')}</div><div style="font-size:11px;color:var(--c-text-3)">${esc(c?c.name:'[deleted]')} · ${fmtS(m.date)}</div></div><span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:var(--c-warn-soft);color:var(--c-warn-ink)">Missed</span></div>`;}).join(''):'<p style="font-size:13px;color:var(--c-text-3);text-align:center;padding:20px">No missed checklists in range.</p>'});
}
function _ticketDrillModal(key,tickets){
  const m={'Open':t=>t.status==='Open','In Progress':t=>t.status==='In Progress','Resolved':t=>t.status==='Resolved'||t.status==='Closed'};
  const list=(tickets||[]).filter(m[key]||(()=>true));
  modalShell({title:key+' tickets',sub:list.length+' ticket'+(list.length!==1?'s':''),size:'max-w-lg',
    body:list.length?list.slice(0,300).map(t=>{const u=uById(t.assignedTo);return `<div onclick="App.closeModal();App.go('tickets')" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--c-border);cursor:pointer"><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:var(--c-text);overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(t.title||'Ticket')}</div><div style="font-size:11px;color:var(--c-text-3)">${esc(t.priority||'')}${u?' · '+esc(fullName(u)):''}</div></div>${chip(t.status)}</div>`;}).join(''):'<p style="font-size:13px;color:var(--c-text-3);text-align:center;padding:20px">No tickets.</p>'});
}
App._chartDrill=(kind,key)=>{
  const D=_AFiltered||{};
  if(kind==='status'){
    if(key==='Missed')return _missedDrillModal(D.missed);
    return _subListModal(key+' submissions',(D.subs||[]).filter(s=>s.status===key));
  }
  if(kind==='date'){const full=(D.dateMap||{})[key]||key;return _subListModal('Submissions · '+fmtS(full),(D.subs||[]).filter(s=>s.date===full));}
  if(kind==='dept')return _subListModal(key+' · submissions',(D.subs||[]).filter(s=>{const c=clById(s.checklistId);return c&&(c.department||'—')===key;}));
  if(kind==='compliance')return _subListModal(key+' submissions',key==='Compliant'?(D.compliant||[]):(D.nonCompliant||[]));
  if(kind==='ticket')return _ticketDrillModal(key,D.tickets);
};
App._hrmDrill=(uid)=>{
  const r=_HRMData&&_HRMData.byId&&_HRMData.byId[uid];if(!r)return;const u=r.u;
  modalShell({title:fullName(u),sub:(u.position||'')+(u.department?' · '+u.department:''),size:'max-w-sm',
    body:'<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">'+[['Worked hrs',r.worked+'h'],['Lates',r.lates],['Absences',r.absences],['Leaves taken',r.leavesTaken],['Remaining',r.remaining]].map(([l,v])=>'<div style="background:var(--c-surface-2);border-radius:12px;padding:14px;text-align:center"><div class="fd" style="font-size:22px;font-weight:800;color:var(--c-text)">'+v+'</div><div style="font-size:11px;color:var(--c-text-3);margin-top:2px">'+l+'</div></div>').join('')+'</div>'});
};

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window._aChartTheme=_aChartTheme;window._destroyACharts=_destroyACharts;window._paintCharts=_paintCharts;window._drawHrmCharts=_drawHrmCharts;window._aClick=_aClick;window._aHover=_aHover;window._allZero=_allZero;window._emptyChart=_emptyChart;window._drawAnalyticsCharts=_drawAnalyticsCharts;window._drawHomeCharts=_drawHomeCharts;window._pngWithBg=_pngWithBg;window._subListModal=_subListModal;window._missedDrillModal=_missedDrillModal;window._ticketDrillModal=_ticketDrillModal;
