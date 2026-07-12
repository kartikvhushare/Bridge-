
function payrollPage(){
  if(!can('payroll','view'))return empty('shield','Restricted','You don\'t have Payroll access.');
  _seedHRMPlan();
  const month=S.filters.pyMonth||todayISO().slice(0,7);S.filters.pyMonth=month;
  const pyView=S.filters.pyView||'month';
  if(pyView==='year'){
    const yr=S.filters.pyYear||todayISO().slice(0,4);S.filters.pyYear=yr;
    const cur0=(DB.users.find(u=>u.hrm?.salary?.currency)?.hrm.salary.currency)||'AED';
    const rowsY=Array.from({length:12},(_,m)=>{
      const mm=yr+'-'+String(m+1).padStart(2,'0');
      const run=(DB.payrollRuns||[]).find(r=>r.month===mm&&r.status!=='RolledBack');
      const its=run?(DB.payrollItems||[]).filter(i=>i.runId===run.id):[];
      const net=its.reduce((a2,i)=>a2+i.net,0);
      return `<tr style="border-top:1px solid var(--c-border);${run?'cursor:pointer':''}" ${run?`onclick="S.filters.pyView='month';S.filters.pyMonth='${mm}';rr()"`:''}>
        <td style="padding:9px 12px;font-size:12.5px;font-weight:700;color:var(--c-text)">${new Date(mm+'-01T00:00:00').toLocaleString('en',{month:'long'})} ${yr}</td>
        <td style="padding:9px 8px">${run?chip(run.status==='Finalized'?'Approved':'Pending').replace(run.status==='Finalized'?'Approved':'Pending',run.status):'<span style="font-size:11px;color:var(--c-text-3)">No run</span>'}</td>
        <td style="padding:9px 8px;font-size:12px;text-align:center">${its.length||'—'}</td>
        <td style="padding:9px 12px;font-size:12.5px;font-weight:800;text-align:right;color:var(--c-text)">${run?cur0+' '+(Math.round(net*100)/100).toLocaleString():'—'}</td></tr>`;
    }).join('');
    return `<div class="fade">${hdr('Payroll','Yearly overview — click a month to open it','')}
      ${_howBar('payroll')}
      <div class="ui-card" style="padding:12px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div class="ui-tabs" style="margin:0"><button class="ui-tab" onclick="S.filters.pyView='month';rr()">Month</button><button class="ui-tab on">Year</button></div>
        <input type="number" min="2020" max="2100" value="${yr}" onchange="S.filters.pyYear=this.value;rr()" class="ui-input" style="width:100px;min-height:0;height:36px"/>
      </div>
      <div class="ui-card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse">
        <thead><tr style="text-align:left"><th style="padding:9px 12px;font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase">Month</th><th style="padding:9px 8px;font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase">Status</th><th style="padding:9px 8px;font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;text-align:center">People</th><th style="padding:9px 12px;font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;text-align:right">Total net</th></tr></thead>
        <tbody>${rowsY}</tbody></table></div>
    </div>`;
  }
  const run=(DB.payrollRuns||[]).find(r=>r.month===month&&r.status!=='RolledBack');
  const items=run?(DB.payrollItems||[]).filter(i=>i.runId===run.id):[];
  const cutoff=Number(DB.hrmConfig?.alerts?.payrollCutoff)||23;
  const prev=(()=>{const d2=new Date(month+'-01T00:00:00');d2.setMonth(d2.getMonth()-1);return d2.toISOString().slice(0,7);})();
  const prevRun=(DB.payrollRuns||[]).find(r=>r.month===prev&&(r.status==='Finalized'||r.status==='Approved'));
  const prevItems=prevRun?(DB.payrollItems||[]).filter(i=>i.runId===prevRun.id):[];
  const cur=(DB.users.find(u=>u.hrm?.salary?.currency)?.hrm.salary.currency)||'AED';
  const money=v=>cur+' '+(Math.round(Number(v||0)*100)/100).toLocaleString();
  const stFlow=['Draft','Verified','Approved','Finalized'];
  const stIdx=run?stFlow.indexOf(run.status):-1;
  const steps=stFlow.map((s2,i)=>`<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;color:${i<=stIdx?'#0B7A55':'var(--c-text-3)'}"><span style="width:18px;height:18px;border-radius:50%;display:grid;place-items:center;background:${i<=stIdx?'#0E9F6E':'var(--c-border)'};color:#fff;font-size:10px">${i+1}</span>${s2}</span>`).join('<span style="color:var(--c-border)">—</span>');
  const totals=items.reduce((a,i)=>({net:a.net+i.net,ot:a.ot+i.otAmount,ded:a.ded+i.deductions}),{net:0,ot:0,ded:0});
  const rows=items.map(i=>{
    const u=uById(i.userId);if(!u)return'';
    const pv=prevItems.find(x=>x.userId===i.userId);
    const varPct=pv&&pv.net?Math.round(((i.net-pv.net)/pv.net)*1000)/10:null;
    const d2=i.detail||{};
    return `<tr style="border-top:1px solid var(--c-border);${d2.hold?'opacity:.5':''}">
      <td style="padding:8px 12px"><div style="display:flex;align-items:center;gap:8px">${avatar(u,'w-7 h-7','text-[10px]')}<div><div style="font-size:12.5px;font-weight:700;color:var(--c-text)">${esc(fullName(u))}${d2.hold?' <span style="font-size:9px;font-weight:800;color:#BE123C">HOLD</span>':''}</div><div style="font-size:10px;color:var(--c-text-3)">${esc(u.department||'')}</div></div></div></td>
      <td style="padding:8px 6px;font-size:12px;text-align:right">${money(i.basic+i.allowances)}</td>
      <td style="padding:8px 6px;font-size:12px;text-align:center">${d2.present||0}<span style="color:var(--c-text-3)">/${d2.working||0}</span>${d2.wfh?` <span style="font-size:9px;color:#0369A1">+${d2.wfh} WFH</span>`:''}</td>
      <td style="padding:8px 6px;font-size:12px;text-align:center;color:${i.unpaidDays?'var(--c-danger-ink)':'var(--c-text-3)'}">${i.unpaidDays||0}</td>
      <td style="padding:8px 6px;font-size:12px;text-align:right;color:${i.otAmount?'#0B7A55':'var(--c-text-3)'}">${i.otAmount?'+'+money(i.otAmount):'—'}</td>
      <td style="padding:8px 6px;font-size:12.5px;font-weight:800;text-align:right;color:var(--c-text)">${money(i.net)}</td>
      <td style="padding:8px 6px;font-size:11px;text-align:right;color:${varPct===null?'var(--c-text-3)':(Math.abs(varPct)<0.1?'var(--c-text-3)':(varPct>0?'#0B7A55':'#BE123C'))}">${varPct===null?'—':((varPct>0?'+':'')+varPct+'%')}</td>
      <td style="padding:8px 6px;text-align:center">${run.status==='Draft'&&can('payroll','verify')?`<button onclick="App._payVerify('${i.id}')" title="Verify" style="width:24px;height:24px;border-radius:7px;border:1.5px solid ${i.verified?'#22C55E':'var(--c-border)'};background:${i.verified?'#ECFDF5':'transparent'};color:${i.verified?'#0B7A55':'var(--c-text-3)'};cursor:pointer;display:grid;place-items:center">${ic('check','w-3 h-3')}</button>`:(i.verified?`<span style="color:#0B7A55">${ic('check','w-3.5 h-3.5')}</span>`:'—')}</td>
      <td style="padding:8px 10px;text-align:right"><button onclick="App._payslip('${i.id}')" class="ui-btn ui-btn-ghost ui-btn-sm" style="min-height:24px;padding:2px 10px;font-size:11px">Payslip</button></td>
    </tr>`;
  }).join('');
  const allVerified=items.length&&items.every(i=>i.verified||(i.detail||{}).hold);
  let actions='';
  if(!run&&can('payroll','run'))actions=btnP('Create draft run — '+month,'App._payRun()','plus');
  else if(run){
    if(run.status==='Draft'&&can('payroll','verify')&&allVerified)actions=btn('Mark verified','App._payAdvance(\'Verified\')',{variant:'primary',icon:'check'});
    else if(run.status==='Draft')actions=(can('payroll','verify')&&items.length?btn('Verify all','App._payVerifyAll()',{variant:'ghost',size:'sm',icon:'check'}):'')+'<span style="font-size:12px;color:var(--c-text-3);align-self:center">Verify every line (✓) to continue'+(can('payroll','run')?' · attendance up to the '+cutoff+' cut-off':'')+'</span>';
    if(run.status==='Verified'&&can('payroll','approve'))actions=btn('Approve (Head of People)','App._payAdvance(\'Approved\')',{variant:'primary',icon:'check'});
    if(run.status==='Approved'&&can('payroll','finalize'))actions=btn('Finalize payroll','App._payAdvance(\'Finalized\')',{variant:'brand',icon:'lock'});
    if(can('payroll','download')&&(run.status==='Approved'||run.status==='Finalized'))actions+=btn('WPS / bank file','App._payWPS()',{variant:'ghost',icon:'doc'});
    if(can('payroll','download'))actions+=btn('Gratuity CSV','App._compGratuityCSV()',{variant:'ghost',size:'sm',icon:'doc'});
    if(run.status!=='Finalized'&&can('payroll','rollback'))actions+=btn('Roll back','App._payRollback()',{variant:'danger',size:'sm'});
    else if(run.status==='Finalized'&&can('payroll','rollback'))actions+=btn('Roll back (admin)','App._payRollback()',{variant:'danger',size:'sm'});
  }
  return `<div class="fade">${hdr('Payroll','Verify attendance → run → approve → finalize · payslips & WPS export','')}
    ${_howBar('payroll')}
    <div class="ui-card" style="padding:12px 14px;margin-bottom:12px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <div class="ui-tabs" style="margin:0"><button class="ui-tab on">Month</button><button class="ui-tab" onclick="S.filters.pyView='year';rr()">Year</button></div>
      <input type="month" value="${month}" onchange="S.filters.pyMonth=this.value;rr()" class="ui-input" style="width:auto;min-height:0;height:40px;padding:0 12px;line-height:38px;font-size:13px"/>
        <span style="font-size:11.5px;font-weight:700;color:var(--c-text-2);background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:99px;padding:5px 12px">${(()=>{const pp=_payPeriod(month);return 'Salary period: '+fmtD(pp.start)+' → '+fmtD(pp.end)+(_payCycleStartDay()===1?'':' · custom cycle (day '+_payCycleStartDay()+')');})()}</span>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${steps}</div>
      <span style="flex:1"></span>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${actions}</div>
    </div>
    ${run?`<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
      ${[['People',items.length],['Total net',money(totals.net)],['Overtime',money(totals.ot)],['Deductions',money(totals.ded)]].map(c=>`<div style="flex:1;min-width:120px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:12px;padding:11px 13px"><div class="fd" style="font-size:17px;font-weight:800;color:var(--c-text)">${c[1]}</div><div style="font-size:11px;color:var(--c-text-2)">${c[0]}</div></div>`).join('')}
    </div>
    <div class="ui-card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:820px">
      <thead><tr style="text-align:left"><th style="padding:9px 12px;font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase">Person</th><th style="padding:9px 6px;font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;text-align:right">Salary</th><th style="padding:9px 6px;font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;text-align:center">Present</th><th style="padding:9px 6px;font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;text-align:center">Unpaid d.</th><th style="padding:9px 6px;font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;text-align:right">OT</th><th style="padding:9px 6px;font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;text-align:right">Net</th><th style="padding:9px 6px;font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;text-align:right">vs ${prev}</th><th style="padding:9px 6px;font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;text-align:center">✓</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`
    :`<div class="ui-card" style="padding:30px">${empty('chart','No run for '+month,can('payroll','run')?'Create a draft run — it computes salary, attendance, unpaid days and approved overtime for every active colleague (set salaries in Users → edit → HRM).':'A payroll run for this month hasn\'t been created yet.')}</div>`}
  </div>`;
}
App._payRun=()=>{
  if(!can('payroll','run'))return toast('You need Payroll → Run','err');
  const month=S.filters.pyMonth||todayISO().slice(0,7);
  if((DB.payrollRuns||[]).some(r=>r.month===month&&r.status!=='RolledBack'))return toast('A run already exists for '+month,'warn');
  const run={id:uid('pr'),month,status:'Draft',cutoffDay:Number(DB.hrmConfig?.alerts?.payrollCutoff)||23,totals:{},sign:{},createdBy:S.uid,createdAt:new Date().toISOString()};
  const people=DB.users.filter(u=>u.status==='Active'&&u.role!=='Admin');
  const items=people.map(u=>{const c=_payCompute(u,month);return{id:uid('pi'),runId:run.id,userId:u.id,...c,verified:false,verifiedBy:null};});
  run.totals={net:items.reduce((a,i)=>a+i.net,0),people:items.length};
  DB.payrollRuns.push(run);items.forEach(i=>DB.payrollItems.push(i));
  _pushRow('payroll_runs',_pRunRow(run),'payroll');_pushRows('payroll_items',items.map(_pItemRow),'payroll'); // R19: one batched write, not 24 racing upserts
  log(fullName(me()),'Payroll draft created',month+' · '+items.length+' people');
  saveDB();toast('Draft run created — verify each line');rr();
};
App._payVerifyAll=()=>{
  if(!can('payroll','verify'))return toast('You need Payroll → Verify','err');
  const month=S.filters.pyMonth;const run=(DB.payrollRuns||[]).find(r=>r.month===month&&r.status!=='RolledBack');if(!run)return;
  const _toVerify=(DB.payrollItems||[]).filter(i=>i.runId===run.id&&!i.verified);_toVerify.forEach(i=>{i.verified=true;i.verifiedBy=S.uid;});_pushRows('payroll_items',_toVerify.map(_pItemRow),'payroll'); // R19: batched
  log(fullName(me()),'Payroll verified all lines',month);
  saveDB();toast('All lines verified');rr();
};
App._payVerify=(itemId)=>{
  if(!can('payroll','verify'))return toast('You need Payroll → Verify','err');
  const i=(DB.payrollItems||[]).find(x=>x.id===itemId);if(!i)return;
  i.verified=!i.verified;i.verifiedBy=i.verified?S.uid:null;
  _pushRow('payroll_items',_pItemRow(i),'payroll');saveDB();rr();
};
App._payAdvance=(to)=>{
  const need={Verified:'verify',Approved:'approve',Finalized:'finalize'}[to];
  if(!can('payroll',need))return toast('You need Payroll → '+need,'err');
  const month=S.filters.pyMonth;const run=(DB.payrollRuns||[]).find(r=>r.month===month&&r.status!=='RolledBack');if(!run)return;
  run.status=to;run.sign=run.sign||{};
  run.sign[need+'edBy']=S.uid;run.sign[need+'edAt']=new Date().toISOString();
  _pushRow('payroll_runs',_pRunRow(run),'payroll');
  log(fullName(me()),'Payroll '+to.toLowerCase(),month);
  if(to==='Finalized')DB.users.filter(u=>u.status==='Active').forEach(u=>notify(u.id,'💰 Payroll for '+month+' is finalized — your payslip is ready','payroll','payroll'));
  saveDB();toast('Payroll '+to.toLowerCase());rr();
};
App._payRollback=()=>{
  if(!can('payroll','rollback'))return toast('You need Payroll → Roll back','err');
  const month=S.filters.pyMonth;const run=(DB.payrollRuns||[]).find(r=>r.month===month&&r.status!=='RolledBack');if(!run)return;
  if(!confirm('Roll back the '+month+' payroll run? Its lines are removed and a fresh draft can be created.'))return;
  run.status='RolledBack';
  DB.payrollItems=(DB.payrollItems||[]).filter(i=>i.runId!==run.id);
  _pushRow('payroll_runs',_pRunRow(run),'payroll');
  sb.from('payroll_items').delete().eq('run_id',run.id).then(()=>{}).catch(()=>{});
  log(fullName(me()),'Payroll rolled back',month);
  saveDB();toast('Run rolled back','warn');rr();
};
App._payslip=(itemId)=>{
  const i=(DB.payrollItems||[]).find(x=>x.id===itemId);if(!i)return;
  const u=uById(i.userId);const run=(DB.payrollRuns||[]).find(r=>r.id===i.runId);if(!u||!run)return;
  const sal=u.hrm?.salary||{};const cur2=sal.currency||'AED';
  const n2=v=>(Math.round(Number(v||0)*100)/100).toLocaleString();
  const d2=i.detail||{};
  const bal=(DB.leaveBalances||[]).filter(b=>b.userId===u.id).reduce((a2,b)=>a2+(Number(b.remaining)||0),0);
  const B=(DB.hrmConfig&&DB.hrmConfig.branding)||{};
  const V={name:fullName(u),position:u.position||'—',department:u.department||'—',month:run.month,period:(d2.period?fmtD(d2.period.start)+' → '+fmtD(d2.period.end):run.month),currency:cur2,
    basic:n2(i.basic),allowances:n2(i.allowances),ot_hours:d2.otHours||0,ot_amount:n2(i.otAmount),
    unpaid_days:i.unpaidDays||0,per_day:n2(d2.perDay||0),deductions:n2(i.deductions),net:n2(i.net),
    present:d2.present||0,wfh:d2.wfh||0,leave:d2.leaveDays||0,absent:d2.absent||0,working:d2.working||0,
    leave_balance:bal,note:B.payslipNote||'',status:run.status+((d2.hold)?' · PAYROLL HOLD':''),date:fmtD(todayISO())};
  const _DEF_TPL='PAYSLIP — {month}\nSalary period: {period}\n\nEmployee: {name}\nPosition: {position} · {department}\nStatus: {status}\n\n— Earnings —\nBasic salary:            {currency} {basic}\nAllowances:              {currency} {allowances}\nOvertime ({ot_hours}h):        {currency} {ot_amount}\n\n— Deductions —\nUnpaid days ({unpaid_days} × {per_day}): {currency} {deductions}\n\nNET PAY: {currency} {net}\n\n— Month summary —\nWorking days: {working} · Present: {present} · WFH: {wfh} · On leave: {leave} · Absent: {absent}\nLeave balance remaining: {leave_balance} days\n\n{note}\nGenerated on {date}';
  let body=String(B.payslipTpl||_DEF_TPL);
  Object.keys(V).forEach(k=>{body=body.split('{'+k+'}').join(String(V[k]));});
  const _g=typeof _gratuityAccrued==='function'?_gratuityAccrued(u):null; // PHASE4: informational EOSB line
  if(_g&&_g.amount)body+='\n\nEnd-of-service accrued to date ('+_g.country+'): '+(_g.currency||cur2)+' '+n2(_g.amount)+' — informational, not part of this payslip.';
  const html='<div style="font-family:Georgia,serif;font-size:14px;line-height:1.8;white-space:pre-wrap">'+esc(body)+'</div>';
  _printHTML('Payslip — '+fullName(u),html,{headerImg:B.payslipHeaderImg,footerImg:B.payslipFooterImg});
};
App._payWPS=()=>{
  if(!can('payroll','download'))return toast('You need Payroll → Download','err');
  const month=S.filters.pyMonth;const run=(DB.payrollRuns||[]).find(r=>r.month===month&&r.status!=='RolledBack');if(!run)return;
  const items=(DB.payrollItems||[]).filter(i=>i.runId===run.id&&!(i.detail||{}).hold);
  const rows=[['Employee ID','Name','IBAN','Basic','Allowances','Overtime','Deductions','Net Pay','Month','Currency']];
  {const cs=(typeof _compCfg==='function'?_compCfg().countries:null)||{};Object.keys(cs).forEach(k=>{const w=(cs[k]&&cs[k].wps)||{};if(w.employerId)rows.push(['#EMPLOYER',cs[k].label||k,w.employerId,w.bankCode||'','','','','',month,cs[k].currency||'']);});}
  items.forEach(i=>{const u=uById(i.userId);if(!u)return;rows.push([u.id,fullName(u),u.hrm?.iban||'',i.basic,i.allowances,i.otAmount,i.deductions,i.net,month,(u.hrm?.salary?.currency)||'AED']);});
  _csvDownload(rows,'WPS_'+month);
  log(fullName(me()),'WPS file exported',month);
};

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.payrollPage=payrollPage;
