

/* ── HR Config: Alerts + Flow-template editors (rendered as hrmConfigPage tabs) ── */
function _alertsCfgHTML(){
  _seedHRMPlan();const A=DB.hrmConfig.alerts;const canEdit=can('hrSettings','edit');
  const tog=(key,label,desc)=>`<label style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 12px;border-radius:10px;border:1px solid var(--c-border);background:var(--c-surface);margin-bottom:7px;cursor:pointer">
    <span><span style="display:block;font-size:13px;font-weight:700;color:var(--c-text)">${label}</span><span style="display:block;font-size:11px;color:var(--c-text-3)">${desc}</span></span>
    <button type="button" ${canEdit?'':'disabled'} role="switch" aria-checked="${A[key]!==false}" class="tog ${A[key]!==false?'on':'off'}" onclick="DB.hrmConfig.alerts.${key}=DB.hrmConfig.alerts.${key}===false;saveDB();rr()"><span></span></button>
  </label>`;
  const num=(key,label,suffix)=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="flex:1;font-size:12.5px;color:var(--c-text-2)">${label}</span><input ${canEdit?'':'disabled'} type="number" min="1" step="any" value="${Number(A[key])||0}" onchange="DB.hrmConfig.alerts.${key}=parseFloat(this.value)||0;saveDB()" class="ui-input" style="width:86px;min-height:0;height:32px;padding:4px 10px"/><span style="font-size:11px;color:var(--c-text-3);width:64px">${suffix}</span></div>`;
  return `<div class="ui-card" style="padding:16px">
    <h3 class="fd" style="font-size:14px;font-weight:800;margin-bottom:4px">Alerts & event triggers</h3>
    <p style="font-size:11.5px;color:var(--c-text-3);margin-bottom:12px">Simple rule: each switch below = one automatic watchdog. Once a day the app checks, and if something is off it tells the person\'s manager and the People team (bell now, email once a provider is connected). Numbers set how strict each watchdog is.</p>
    ${tog('late','Late arrival alert','If someone clocks in later than their start time + grace minutes → their manager and the People team get an alert that day.')}
    ${tog('missedClockIn','Missing clock-in alert','If someone has not clocked in at all by about an hour past the late threshold → manager + People team are alerted.')}
    ${tog('leaveSLA','Stuck leave request alert','If a leave request stays Pending longer than the working days set below → it escalates to the manager AND Head of People.')}
    ${num('slaDays','Escalate pending leave after','working days')}
    ${tog('docExpiry','Document expiry reminders','When a personal document (visa, passport, contract) is close to its expiry date → the person and the People team are reminded until it\'s handled.')}
    ${num('docExpiryDays','Start reminding before expiry','days')}
    ${tog('probation','Probation-ending nudge','When someone\'s probation end date is near → manager + People team are nudged to run the probation review flow.')}
    ${num('probationDays','Nudge before probation ends','days')}
    ${tog('benefits','Air-ticket anniversary','When someone completes the months of service set below → they and the People team are told the ticket benefit is due.')}
    ${num('benefitMonths','Benefit due after','months')}
    <div style="border-top:1px dashed var(--c-border);margin:12px 0 6px"></div>
    <div style="font-size:11px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Limits used by Overtime & Payroll</div>
    ${num('otWeeklyCap','Most overtime a person can log per week','hours')}
    ${num('otMultiplier','Overtime is paid at (× hourly rate)','×')}
    ${num('payrollCutoff','Attendance is verified up to day','of month')}
    <div style="border-top:1px dashed var(--c-border);margin:12px 0 6px"></div>
    <div style="font-size:11px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">In-app alerts per feature</div>
    <p style="font-size:11px;color:var(--c-text-3);margin-bottom:8px">Which features show bell (in-app) notifications. Switching a feature off silences its bell alerts for everyone — email switches below are unaffected.</p>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">${NOTIF_KINDS.map(([k,l])=>{const on=(DB.hrmConfig.inappKinds||{})[k]!==false;return `<button ${canEdit?'':'disabled'} onclick="DB.hrmConfig.inappKinds['${k}']=${on?'false':'true'};saveDB();rr()" style="display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:20px;border:1.5px solid ${on?'#0E9F6E':'var(--c-border)'};background:${on?'#ECFDF5':'var(--c-surface)'};color:${on?'#0B7A55':'var(--c-text-3)'};font-size:11.5px;font-weight:700;cursor:${canEdit?'pointer':'not-allowed'}">${l}</button>`;}).join('')}</div>
    <div style="font-size:11px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Email per feature</div>
    <p style="font-size:11px;color:var(--c-text-3);margin-bottom:8px">These switches decide which features ALSO queue an email (sent once an email provider is connected). People who turned email off on their profile never get emails either way.</p>
    <div style="display:flex;flex-wrap:wrap;gap:6px">${NOTIF_KINDS.map(([k,l])=>{const on=(DB.hrmConfig.emailKinds||{})[k]!==false;return `<button ${canEdit?'':'disabled'} onclick="DB.hrmConfig.emailKinds['${k}']=${on?'false':'true'};saveDB();rr()" style="display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:20px;border:1.5px solid ${on?'#0E9F6E':'var(--c-border)'};background:${on?'#ECFDF5':'var(--c-surface)'};color:${on?'#0B7A55':'var(--c-text-3)'};font-size:11.5px;font-weight:700;cursor:${canEdit?'pointer':'not-allowed'}">${l}</button>`;}).join('')}</div>
  </div>`;
}
function _flowTplCfgHTML(){
  _seedHRMPlan();const T=DB.hrmConfig.flowTemplates;const canEdit=can('hrSettings','edit');
  const kind=S.filters.ftKind||'onboarding';
  const users=DB.users.filter(u=>u.status==='Active');
  const S32='min-height:0;height:32px;font-size:11.5px;padding:4px 22px 4px 8px';
  const rows=(T[kind]||[]).map((s2,i)=>{
    const P=`DB.hrmConfig.flowTemplates['${kind}'][${i}]`;
    const pool=(s2.ownerType==='role'||s2.ownerType==='hr')?users.filter(u=>u.hrm?.roleProfileId===(s2.roleId||'hr'))
      :s2.ownerType==='dept'?users.filter(u=>u.department===s2.dept):[];
    return `<div style="display:grid;grid-template-columns:2fr 100px 64px 105px 120px 130px 28px;gap:6px;align-items:center;margin-bottom:6px">
    <input ${canEdit?'':'disabled'} value="${esc(s2.title)}" onchange="${P}.title=this.value;saveDB()" class="ui-input" style="min-height:0;height:32px;padding:4px 10px;font-size:12px"/>
    <select ${canEdit?'':'disabled'} onchange="${P}.type=this.value;saveDB()" class="ui-select" style="${S32}">${['task','form','letter','payrollHold'].map(o=>`<option ${s2.type===o?'selected':''}>${o}</option>`).join('')}</select>
    <input ${canEdit?'':'disabled'} type="number" min="0" value="${Number(s2.offsetDays)||0}" title="Due N days after the flow starts" onchange="${P}.offsetDays=parseInt(this.value)||0;saveDB()" class="ui-input" style="min-height:0;height:32px;padding:4px 8px;font-size:12px"/>
    <select ${canEdit?'':'disabled'} onchange="${P}.ownerType=this.value;${P}.ownerId=null;saveDB();rr()" class="ui-select" style="${S32}">${[['manager','Manager'],['role','Role'],['dept','Department'],['hr','Role: HR (legacy)']].filter(o=>o[0]!=='hr'||s2.ownerType==='hr').map(o=>`<option value="${o[0]}" ${s2.ownerType===o[0]?'selected':''}>${o[1]}</option>`).join('')}</select>
    ${s2.ownerType==='role'||s2.ownerType==='hr'
      ?`<select ${canEdit?'':'disabled'} onchange="${P}.roleId=this.value;${P}.ownerType='role';${P}.ownerId=null;saveDB();rr()" class="ui-select" style="${S32}">${Object.values(DB.roleProfiles||{}).map(r=>`<option value="${r.id}" ${(s2.roleId||'hr')===r.id?'selected':''}>${esc(r.name)}</option>`).join('')}</select>`
      :s2.ownerType==='dept'
      ?`<select ${canEdit?'':'disabled'} onchange="${P}.dept=this.value;${P}.ownerId=null;saveDB();rr()" class="ui-select" style="${S32}"><option value="">— pick —</option>${(DB.departments||[]).map(dp=>`<option ${s2.dept===dp.name?'selected':''}>${esc(dp.name)}</option>`).join('')}</select>`
      :`<span style="font-size:10.5px;color:var(--c-text-3)">automatic</span>`}
    ${s2.ownerType==='manager'
      ?`<span style="font-size:10.5px;color:var(--c-text-3)">colleague\'s manager</span>`
      :`<select ${canEdit?'':'disabled'} onchange="${P}.ownerId=this.value||null;saveDB()" class="ui-select" style="${S32}"><option value="">— pick at start —</option>${pool.map(u=>`<option value="${u.id}" ${s2.ownerId===u.id?'selected':''}>${esc(fullName(u))}</option>`).join('')}</select>`}
    ${canEdit?`<button onclick="DB.hrmConfig.flowTemplates['${kind}'].splice(${i},1);saveDB();rr()" style="width:26px;height:26px;border:none;background:transparent;color:var(--c-text-3);cursor:pointer">${ic('trash','w-3.5 h-3.5')}</button>`:'<span></span>'}
  </div>`;}).join('');
  return `<div class="ui-card" style="padding:16px">
    <h3 class="fd" style="font-size:14px;font-weight:800;margin-bottom:10px">Lifecycle flow templates</h3>
    <div class="ui-tabs" style="margin-bottom:12px">${['onboarding','probation','exit'].map(k=>`<button class="ui-tab${kind===k?' on':''}" onclick="S.filters.ftKind='${k}';rr()">${k[0].toUpperCase()+k.slice(1)}</button>`).join('')}</div>
    <div style="background:var(--c-surface-2);border-radius:10px;padding:9px 12px;font-size:11.5px;color:var(--c-text-2);line-height:1.6;margin-bottom:10px">
      How a step works: <b>Owner type</b> decides who can be picked as the owner when a flow starts — <b>Role</b> = anyone holding that role, <b>Department</b> = anyone in that department (sub-departments appear in the list too), <b>Manager</b> = the colleague's manager automatically. <b>Type</b>: <b>task</b> = a simple tick-off · <b>form</b> = captures written answers (e.g. exit interview) · <b>letter</b> = opens the Letters tab · <b>payrollHold</b> = suspends the colleague's pay when ticked. <b>+days</b> = the step is due that many days after the flow starts.
    </div>
    <div style="display:grid;grid-template-columns:2fr 100px 64px 105px 120px 130px 28px;gap:6px;font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;margin-bottom:5px"><span>Step</span><span>Type</span><span>Due +days</span><span>Owner type</span><span>Which role / dept</span><span>Owner</span><span></span></div>
    ${rows||'<p style="font-size:12px;color:var(--c-text-3)">No steps yet.</p>'}
    ${canEdit?`<button onclick="DB.hrmConfig.flowTemplates['${kind}'].push({title:'New step',ownerType:'hr',type:'task',offsetDays:0,dept:''});saveDB();rr()" class="ui-btn ui-btn-ghost ui-btn-sm" style="margin-top:6px">${ic('plus','w-3.5 h-3.5')}Add step</button>`:''}
  </div>`;
}
App._brandImg=(which,input)=>{
  const f=input.files&&input.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=e=>{
    const img=new Image();
    img.onload=()=>{
      const maxW=1400,sc=Math.min(1,maxW/img.width);
      const c=document.createElement('canvas');c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      DB.hrmConfig.branding[which]=c.toDataURL('image/jpeg',0.85);
      log(fullName(me()),'Letterhead image updated',which);
      saveDB();toast('Image saved — used on every letter & payslip');rr();
    };
    img.src=e.target.result;
  };
  r.readAsDataURL(f);input.value='';
};
App._pdExpiry=(uid2,docId,val)=>{
  const u=uById(uid2);if(!u)return;
  const d=(u.hrm?.personalDocs||[]).find(x=>x.id===docId);if(!d)return;
  d.expiry=val||null;
  log(fullName(me()),'Document expiry set',d.name+' · '+(val||'cleared'));
  saveDB();toast(val?'Expiry saved — reminders will fire ahead of it':'Expiry cleared');
};
/* HR Config → Surveys tab: create, monitor, results */
function _surveyCfgHTML(){
  const canEd=can('surveys','manage');
  const list=(DB.surveys||[]).filter(s=>s.status!=='Deleted').sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  const results=(sv)=>{
    const ans=(DB.surveyAnswers||[]).filter(a=>a.surveyId===sv.id);
    if(!ans.length)return '<div style="font-size:11.5px;color:var(--c-text-3)">No responses yet.</div>';
    const by={};ans.forEach(a=>{const k=a.aboutUser||'company';(by[k]=by[k]||[]).push(a);});
    const rows=Object.keys(by).map(k=>{
      const u=k==='company'?null:uById(k);
      const sc=by[k].filter(a=>a.score!=null);
      const avg=sc.length?Math.round(sc.reduce((x,y)=>x+y.score,0)/sc.length*10)/10:null;
      return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12.5px"><span style="flex:1;font-weight:600;color:var(--c-text)">${u?esc(fullName(u)):'The company'}</span><span style="color:var(--c-text-3)">${by[k].length} response${by[k].length===1?'':'s'}</span><span style="font-weight:800;color:${avg==null?'var(--c-text-3)':avg>=4?'#0B7A55':avg>=3?'#B45309':'#BE123C'}">${avg==null?'—':avg+' / 5'}</span></div>`;
    }).join('');
    return rows+`<button onclick="App._svCSV('${sv.id}')" class="ui-btn ui-btn-ghost ui-btn-sm" style="margin-top:6px">${ic('doc','w-3.5 h-3.5')}Export CSV</button>`;
  };
  const cards=list.map(sv=>`<div class="ui-card" style="padding:14px;margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <div style="flex:1;min-width:160px"><div class="fd" style="font-size:13.5px;font-weight:800;color:var(--c-text)">${esc(sv.title)}</div>
      <div style="font-size:11px;color:var(--c-text-3)">${esc(SV_KINDS[sv.kind]||sv.kind)} · runs ${sv.runDate?fmtS(sv.runDate):'—'} · ${sv.questions.length} questions</div></div>
      ${chip(sv.status==='Active'?'Active':'Closed')}
      ${canEd?btn(sv.status==='Active'?'Close':'Reopen',`App._svToggle('${sv.id}')`,{variant:'ghost',size:'sm'}):''}
      ${canEd?btn('Delete',`App._svDel('${sv.id}')`,{variant:'danger',size:'sm'}):''}
    </div>
    <div style="border-top:1px dashed var(--c-border);margin-top:10px;padding-top:8px">${results(sv)}</div>
  </div>`).join('');
  return `<div class="ui-card" style="padding:16px">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:4px"><h3 class="fd" style="font-size:14px;font-weight:800">Surveys & performance pulse</h3>${canEd?btnP('New survey','App._svNew()','plus'):''}</div>
    <p style="font-size:11.5px;color:var(--c-text-3);margin-bottom:12px">On the run date, the right people are notified and the form appears in their Surveys tab. Scores aggregate here per person / manager / company.</p>
    ${cards||'<div style="font-size:12px;color:var(--c-text-3)">No surveys yet — create the first one.</div>'}
  </div>`;
}
/* Letter templates editor (HR Config tab) */
function _letterTplCfgHTML(){
  _seedHRMPlan();const T=DB.hrmConfig.letterTemplates;const canEd=can('hrSettings','edit');
  const key=S.filters.ltKey||Object.keys(T)[0];
  const tpl=T[key]||{name:'',body:''};
  return `<div class="ui-card" style="padding:16px">
    <h3 class="fd" style="font-size:14px;font-weight:800;margin-bottom:8px">Letter templates</h3>
    <p style="font-size:11.5px;color:var(--c-text-3);margin-bottom:10px">Placeholders fill automatically: {name} {position} {department} {salary} {joined} {company} {date}</p>
    <div style="background:var(--c-surface-2);border-radius:10px;padding:10px 12px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;margin-bottom:6px">Company letterhead — printed on every letter AND payslip</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        ${['headerImg','footerImg'].map(k=>{const img=(DB.hrmConfig.branding||{})[k];return `<div style="border:1.5px dashed var(--c-border);border-radius:10px;padding:8px;background:var(--c-surface)">
          <div style="font-size:10.5px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;margin-bottom:5px">${k==='headerImg'?'Header image (top of page)':'Footer image (bottom of page)'}</div>
          ${img?`<img src="${img}" style="width:100%;border-radius:6px;display:block;margin-bottom:6px" alt=""/>`:'<div style="font-size:11px;color:var(--c-text-3);padding:8px 0;text-align:center">No image — the text below is used instead</div>'}
          ${canEd?`<div style="display:flex;gap:6px"><label class="ui-btn ui-btn-ghost ui-btn-sm" style="cursor:pointer">${ic('cam','w-3.5 h-3.5')}${img?'Replace':'Upload'}<input type="file" accept="image/*" hidden onchange="App._brandImg('${k}',this)"/></label>${img?`<button onclick="DB.hrmConfig.branding.${k}=null;saveDB();rr()" class="ui-btn ui-btn-ghost ui-btn-sm" style="color:var(--c-danger-ink)">Remove</button>`:''}</div>`:''}
        </div>`;}).join('')}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <input ${canEd?'':'disabled'} value="${esc((DB.hrmConfig.branding||{}).header||'')}" placeholder="Company name (header)" onchange="DB.hrmConfig.branding.header=this.value;saveDB()" class="ui-input rf"/>
        <input ${canEd?'':'disabled'} value="${esc((DB.hrmConfig.branding||{}).sub||'')}" placeholder="Address / tagline (under the name)" onchange="DB.hrmConfig.branding.sub=this.value;saveDB()" class="ui-input rf"/>
      </div>
      <input ${canEd?'':'disabled'} value="${esc((DB.hrmConfig.branding||{}).footer||'')}" placeholder="Footer line (bottom of the page)" onchange="DB.hrmConfig.branding.footer=this.value;saveDB()" class="ui-input rf"/>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">${Object.keys(T).map(k=>`<button class="ui-tab-pill${key===k?' on':''}" onclick="S.filters.ltKey='${k}';rr()">${esc(T[k].name)}</button>`).join('')}
      ${canEd?`<button class="ui-tab-pill" onclick="const n=prompt('New template name');if(n){const k='tpl_'+Date.now();DB.hrmConfig.letterTemplates[k]={name:n,body:'Dear {name},\\n\\n\\n\\nHR Department\\n{company} · {date}'};S.filters.ltKey=k;saveDB();rr()}">+ New</button>`:''}</div>
    <input ${canEd?'':'disabled'} value="${esc(tpl.name)}" onchange="DB.hrmConfig.letterTemplates['${key}'].name=this.value;saveDB()" class="ui-input rf" style="margin-bottom:8px"/>
    <textarea ${canEd?'':'disabled'} rows="10" class="ui-input rf" style="font-family:Georgia,serif;font-size:13px;line-height:1.6;resize:vertical" oninput="DB.hrmConfig.letterTemplates['${key}'].body=this.value;clearTimeout(App._ltcT);App._ltcT=setTimeout(saveDB,800)">${esc(tpl.body)}</textarea>
    ${canEd&&Object.keys(T).length>1?`<button onclick="App._delLetterTpl('${key}')" class="ui-btn ui-btn-ghost ui-btn-sm" style="margin-top:8px;color:var(--c-danger-ink)">${ic('trash','w-3.5 h-3.5')}Delete template</button>`:''}
    <div style="border-top:1px dashed var(--c-border);margin-top:14px;padding-top:12px">
      <div style="font-size:11px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;margin-bottom:4px">Payslip template — exactly what gets printed</div>
      <p style="font-size:11.5px;color:var(--c-text-3);margin-bottom:8px">Numbers fill in automatically per person. Placeholders: {name} {position} {department} {month} {currency} {basic} {allowances} {ot_hours} {ot_amount} {unpaid_days} {per_day} {deductions} {net} {present} {wfh} {leave} {absent} {working} {leave_balance} {note} {status} {date}</p>
      <textarea ${canEd?'':'disabled'} rows="12" class="ui-input rf" style="font-family:Georgia,serif;font-size:12.5px;line-height:1.6;resize:vertical;white-space:pre" oninput="DB.hrmConfig.branding.payslipTpl=this.value;clearTimeout(App._psT);App._psT=setTimeout(saveDB,800)">${esc((DB.hrmConfig.branding||{}).payslipTpl||'')}</textarea>
      <input ${canEd?'':'disabled'} value="${esc((DB.hrmConfig.branding||{}).payslipNote||'')}" placeholder="{note} line — e.g. Salary is confidential." onchange="DB.hrmConfig.branding.payslipNote=this.value;saveDB()" class="ui-input rf" style="margin-top:8px"/>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
        ${['payslipHeaderImg','payslipFooterImg'].map(k=>{const img=(DB.hrmConfig.branding||{})[k];return `<div style="border:1.5px dashed var(--c-border);border-radius:10px;padding:8px;background:var(--c-surface)">
          <div style="font-size:10.5px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;margin-bottom:5px">${k==='payslipHeaderImg'?'Payslip header image':'Payslip footer image'} <span style="text-transform:none;font-weight:600">(blank = company letterhead)</span></div>
          ${img?`<img src="${img}" style="width:100%;border-radius:6px;display:block;margin-bottom:6px" alt=""/>`:''}
          ${canEd?`<div style="display:flex;gap:6px"><label class="ui-btn ui-btn-ghost ui-btn-sm" style="cursor:pointer">${ic('cam','w-3.5 h-3.5')}${img?'Replace':'Upload'}<input type="file" accept="image/*" hidden onchange="App._brandImg('${k}',this)"/></label>${img?`<button onclick="DB.hrmConfig.branding.${k}=null;saveDB();rr()" class="ui-btn ui-btn-ghost ui-btn-sm" style="color:var(--c-danger-ink)">Remove</button>`:''}</div>`:''}
        </div>`;}).join('')}
      </div>
  </div>`;
}

/* ════════ HR CONFIG PAGE ════════ */
function hrmConfigPage(){
  _seedProfiles();
  const TABS=[['policy','Timing & accrual'],['types','Leave Types'],['holidays','Holidays'],['alerts','Alerts & triggers'],['flows','Flow templates'],['lettertpl','Letter templates'],['surveys','Surveys'],['compliance','Compliance']];
  // §3a/§3b: balance-management tabs, gated by the leave-balances permission (shim → HR/Admin).
  if(can('leaveBalances','edit'))TABS.push(['bulk','Bulk Balances']);
  if(can('leaveBalances','grant'))TABS.push(['compoff','Comp-off']);

  // H2: HR Config uses its OWN tab-state key (cfgtab); coerce unknown values to the default so the page never renders blank.
  let tab=S.filters.cfgtab||'policy';
  if(!TABS.some(t=>t[0]===tab))tab='policy';
  const profId=DB.hrmConfig.activeProfile||'UAE';
  const prof=DB.hrmConfig.profiles[profId]||{};
  let body='';
  if(tab==='alerts')body=_alertsCfgHTML();
  if(tab==='flows')body=_flowTplCfgHTML();
  if(tab==='lettertpl')body=_letterTplCfgHTML();
  if(tab==='surveys')body=_surveyCfgHTML();
  if(tab==='compliance')body=_complianceCfgHTML();
  if(tab==='policy'){
    const canEdit=can('hrSettings','edit');
    body=`<div class="space-y-4">
      <div style="background:#fff;border-radius:16px;border:1px solid #ECEDF0;padding:16px">
        <h3 class="fd font-bold text-sm mb-1">Timing & accrual</h3>
        <p style="font-size:11.5px;color:#9CA3AF;margin-bottom:10px">Three simple company-wide rules: how many minutes late is still OK (grace), when an open day auto-closes, and whether leave years run Jan–Dec or from each person\'s joining date.</p>
        <div class="grid grid-cols-2 gap-3">${fld('Grace period (min)','cfg-grace',prof.grace??15,'number')}${fld('Auto clock-out time','cfg-auto',prof.autoCloseAt||'00:00','time')}</div>
        <div class="mt-3">${selF('How a leave year is counted','cfg-basis',[['calendar','Calendar year (Jan–Dec)'],['anniversary','From each employee’s joining date']],prof.leaveYearBasis||'calendar')}
          <p style="font-size:11px;color:#9CA3AF;margin-top:4px">Calendar year resets every January; anniversary resets on each employee's own joining date.</p></div>
        <p style="font-size:11px;color:#9CA3AF;margin-top:8px">Note: 6-day weeks accrue leave at ${HRM_SIXDAY_PRORATE.toFixed(2)}× the 5-day rate (each employee's own schedule decides their work week). UAE annual leave accrues ${HRM_ANNUAL_MID}/mo during months 6–12 of service, full rate after. True midnight auto clock-out & scheduled email reminders require a backend (deferred — runs lazily on app open). Geofencing is configured per <strong>Location</strong>.</p>
      </div>
      <div style="background:var(--c-info-soft);border:1px solid #BFDBFE;border-radius:10px;padding:9px 12px;font-size:11.5px;color:#1E40AF;line-height:1.5"><b>Approval flow</b> = the sign-off chain every LEAVE REQUEST travels, in order — e.g. Manager first, then HR. It is used automatically each time anyone applies for leave; you never pick it per request.</div>
      ${canEdit?_approvalFlowEditor(prof):`<div style="background:#fff;border-radius:16px;border:1px solid #ECEDF0;padding:16px"><h3 class="fd font-bold text-sm mb-2">Approval flow</h3><p style="font-size:13px;color:#374151">${_normalizeFlow(prof).map(s=>esc(_stageLabel(s))).join(' → ')}</p></div>`}
      <div style="background:#fff;border-radius:16px;border:1px solid #ECEDF0;padding:16px">
        <h3 class="fd" style="font-size:14px;font-weight:800;margin-bottom:4px">Payroll cycle (whole company)</h3>
        <p style="font-size:12px;color:#6B7280;margin-bottom:10px">Which day your salary month starts. <b>1</b> = plain calendar month. <b>21</b> = the "July" salary covers <b>21 Jun → 20 Jul</b>, and you process it in the remaining days — payroll runs, payslips, unpaid-day deductions and overtime all follow this window automatically.</p>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <select ${canEdit?'':'disabled'} onchange="DB.hrmConfig.payroll=Object.assign({},DB.hrmConfig.payroll,{cycleStartDay:parseInt(this.value)||1});saveDB();rr()" class="ui-select" style="width:auto;min-height:0;height:40px;padding:0 34px 0 12px;line-height:38px;font-size:13px">${Array.from({length:28},(_,i)=>i+1).map(d3=>`<option value="${d3}" ${_payCycleStartDay()===d3?'selected':''}>${d3===1?'1 — calendar month':'Starts on day '+d3}</option>`).join('')}</select>
          <span style="font-size:11.5px;font-weight:700;color:#1E40AF;background:var(--c-info-soft);border:1px solid #BFDBFE;border-radius:99px;padding:5px 12px">${(()=>{const pp=_payPeriod(todayISO().slice(0,7));return 'This month\u2019s run covers '+fmtD(pp.start)+' → '+fmtD(pp.end);})()}</span>
        </div>
        <p style="font-size:11px;color:#9CA3AF;margin-top:8px">Applies from the next run you create — already-created runs keep the numbers they were computed with. Leave years are separate and stay calendar/anniversary as set above.</p>
      </div>
      ${canEdit?btn('Save configuration',`App.saveHrmConfig('${profId}')`,{variant:'primary',attrs:'style="width:100%"'}):''}
    </div>`;
  }else if(tab==='types'){
    const types=_typesFor(profId);
    // O14: India leave types intentionally seed with entitlement 0 (HR fills statutory values per
    //   company policy) — surface a note so an empty entitlement isn't mistaken for "config broken".
    const zeroNote=(types.some(t=>t.enabled&&(t.entitlement||0)===0&&(t.accrualPerMonth||0)===0&&!_isCompOffLt(t)))
      ?`<div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:11px 14px;margin-bottom:8px;font-size:12px;color:#92400E">Note: types seeded with <strong>0 entitlement</strong> are placeholders — set each type's entitlement &amp; accrual here to match your company policy. They are not a bug.</div>`
      :'';
    body=`<div class="space-y-2">${zeroNote}${types.map(lt=>`<div style="background:#fff;border-radius:14px;border:1px solid #ECEDF0;padding:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><div><div style="font-size:14px;font-weight:700">${esc(lt.name)}${lt.enabled?'':' <span style="font-size:10px;color:#9CA3AF">(disabled)</span>'}</div><div style="font-size:11px;color:#9CA3AF">Entitlement ${lt.entitlement}${lt.accrualPerMonth?(' · '+lt.accrualPerMonth+'/mo'):''} · ${lt.unit} days${lt.carryOver?.enabled?(' · carry '+lt.carryOver.maxDays):''}</div></div>${btn('Edit',`App.editLeaveType('${lt.id}')`,{variant:'ghost',size:'sm'})}</div>
    </div>`).join('')}</div>`;
  }else if(tab==='holidays'){
    const hols=(DB.holidays||[]).filter(h=>h.profileId===profId).sort((a,b)=>a.date.localeCompare(b.date));
    body=`<div style="background:#fff;border-radius:14px;border:1px solid #ECEDF0;padding:14px;margin-bottom:12px">
      <div class="grid grid-cols-2 gap-2"><input id="hol-date" type="date" class="bg-white border border-ink-200 rounded-xl px-3 py-2 text-sm rf"/><input id="hol-name" placeholder="Holiday name" class="bg-white border border-ink-200 rounded-xl px-3 py-2 text-sm rf"/></div>
      ${btn('Add holiday',`App.addHoliday('${profId}')`,{variant:'primary',attrs:'style="margin-top:8px;width:100%"'})}
    </div>
    ${hols.length?hols.map(h=>`<div style="display:flex;align-items:center;justify-content:space-between;background:#fff;border-radius:12px;border:1px solid #ECEDF0;padding:11px 14px;margin-bottom:6px"><div><div style="font-size:13px;font-weight:600">${esc(h.name)}</div><div style="font-size:12px;color:#9CA3AF">${fmtD(h.date)}</div></div><button onclick="App.delHoliday('${h.id}')" style="color:#D1D5DB;background:none;border:none;cursor:pointer">${ic('trash','w-4 h-4')}</button></div>`).join(''):empty('pin','No holidays','Add public holidays.')}`;
  }else if(tab==='bulk'){
    body=_bulkBalanceEditor();
  }else if(tab==='compoff'){
    body=_compOffManager();
  }else if(tab==='audit'){
    const logs=(DB.hrmAudit||[]).slice(0,80);
    body=`<div style="background:#fff;border-radius:14px;border:1px solid #ECEDF0;overflow:hidden">${logs.length?logs.map(l=>`<div style="display:flex;gap:10px;padding:11px 14px;border-bottom:1px solid #F3F4F6"><div style="flex:1"><div style="font-size:13px;font-weight:600">${esc(l.action)}</div><div style="font-size:12px;color:#9CA3AF">${esc(l.target)}</div></div><div style="font-size:11px;color:#9CA3AF;white-space:nowrap">${esc(l.actor)} · ${new Date(l.time).toLocaleString('en-GB')}</div></div>`).join(''):empty('audit','No HRM activity','')}</div>`;
  }
  return `<div class="fade">${hdr('HR Config','Leave policy, timing, approval flows & holidays')}${_howBar('hrmconfig')}
    <div style="margin-bottom:16px">${chipBar(TABS,tab,'App._setCfgTab')}</div>
    ${body}</div>`;
}
/* ════════ §3b — BULK LEAVE-BALANCE EDITOR (HR Config tab, gated by leaveBalances.edit) ════════
   Inline-editable table (employees × leave types) writing DB.leaveBalances via _balanceFor; adjusts
   `entitled` (manual grant) — consistent with the M3 fix — never `accrued`. Plus a multi-select
   "adjust together" mode applying a +/- delta with a reason. All changes audit-logged. Super Admins
   excluded. Comp-off is intentionally NOT a bulk-editable column (it lives in its own ledger). */
// People in scope for balance management: scoped users minus Super Admins, with dept/loc/profile filters.
function _balScopeUsers(){
  const f=S.filters;
  let list=scopedUsers('leaveBalances').filter(u=>u.status!=='Inactive'); // FIX: Admins (incl. you) now appear — owners take leave too
  if(f.cfgBalDept)list=list.filter(u=>u.department===f.cfgBalDept);
  if(f.cfgBalLoc)list=list.filter(u=>(u.hrm?.locationId||'')===f.cfgBalLoc);
  if(f.cfgBalQ){const q=f.cfgBalQ.toLowerCase();list=list.filter(u=>fullName(u).toLowerCase().includes(q)||(u.department||'').toLowerCase().includes(q));}
  return list.sort((a,b)=>fullName(a).localeCompare(fullName(b)));
}
// A3 (cause 1): the bulk-balance filter bar's change/search handlers call rr(), which re-renders the
//   table from DB and would WIPE any un-flushed inline cell edits. Flush first so manual edits survive
//   a dept/location/company/search filter change. Saves locally (saveDB) + targeted server push.
App._bulkBalFlushBeforeFilter=()=>{
  if(!document.querySelector('.bulkbal-cell'))return; // only the bulkbal editor has cells
  const n=_bulkBalFlush();
  if(n){saveDB();_bulkBalTargetedSave();toast('Saved '+n+' balance change(s)');}
};
function _balFilterBar(prefix){
  const f=S.filters;
  const fl=prefix==='bulkbal'?'App._bulkBalFlushBeforeFilter();':'';
  return `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
    <div style="position:relative;flex:1;min-width:180px"><span style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:#9CA3AF">${ic('search','w-4 h-4')}</span><input id="${prefix}-search" value="${esc(f.cfgBalQ||'')}" onchange="${fl}" oninput="S.filters.cfgBalQ=this.value;App._searchRR('${prefix}-search')" placeholder="Search employees…" style="width:100%;padding:9px 12px 9px 34px;border:1.5px solid #ECEDF0;border-radius:11px;font-size:13px"/></div>
    <select onchange="${fl}S.filters.cfgBalDept=this.value;rr()" class="bg-white border border-ink-200 rounded-xl px-3 py-2 text-sm rf"><option value="">All departments</option>${DB.departments.map(d=>`<option${f.cfgBalDept===d.name?' selected':''}>${esc(d.name)}</option>`).join('')}</select>
    <select onchange="${fl}S.filters.cfgBalLoc=this.value;rr()" class="bg-white border border-ink-200 rounded-xl px-3 py-2 text-sm rf"><option value="">All locations</option>${DB.locations.map(l=>`<option value="${l.id}"${f.cfgBalLoc===l.id?' selected':''}>${esc(l.name)}</option>`).join('')}</select>
  </div>`;
}
function _bulkBalanceEditor(){
  if(!can('leaveBalances','edit'))return empty('lock','Not permitted','You do not have access to edit balances.');
  const profId=DB.hrmConfig.activeProfile||'UAE';
  const users=_balScopeUsers();
  // Columns = enabled, non-comp-off leave types for the selected company/profile.
  const cols=_typesFor(profId).filter(t=>t.enabled&&!_isCompOffLt(t));
  const yrOf=u=>_leaveYearOf(u,todayISO());
  const head=`<tr class="text-[10px] text-ink-400 uppercase tracking-wide border-b border-ink-100 text-left"><th class="px-3 py-2.5 font-semibold" style="position:sticky;left:0;background:#fff"><input type="checkbox" onclick="App._bulkBalSelectAll(this.checked)" title="Select all"/> Employee</th>${cols.map(c=>`<th class="px-3 py-2.5 font-semibold" style="white-space:nowrap">${esc(c.name)}</th>`).join('')}</tr>`;
  const rows=users.map(u=>{
    const yr=yrOf(u);
    return `<tr class="hover:bg-ink-50/50"><td class="px-3 py-2" style="position:sticky;left:0;background:#fff;white-space:nowrap"><label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" class="bulkbal-sel" data-uid="${u.id}"/>${avatar(u,'w-6 h-6','text-[9px]')}<span class="font-medium" style="font-size:12px">${esc(fullName(u))}${u.id===S.uid?' <span style="color:var(--c-text-3);font-weight:600">(you)</span>':''}</span></label></td>${cols.map(c=>{
      const b=_balanceReadonly(u.id,c.id,yr);
      return `<td class="px-3 py-2"><input type="number" step="0.5" value="${b.entitled||0}" data-uid="${u.id}" data-lt="${c.id}" data-yr="${yr}" class="bulkbal-cell" style="width:64px;border:1px solid #E5E7EB;border-radius:8px;padding:5px 7px;font-size:12px" title="Entitled days · remaining ${_balRemaining(b)}"/></td>`;
    }).join('')}</tr>`;
  }).join('');
  const table=users.length?`<div style="background:#fff;border-radius:16px;border:1px solid #ECEDF0;overflow:hidden"><div style="overflow-x:auto"><table class="w-full text-sm"><thead>${head}</thead><tbody class="divide-y divide-ink-50">${rows}</tbody></table></div></div>`:empty('users','No employees','Adjust the filters above.');
  const ltOpts=cols.map(c=>[c.id,c.name]);
  const adjust=cols.length?`<div style="background:#fff;border-radius:16px;border:1px solid #ECEDF0;padding:14px;margin-top:12px">
    <div style="font-size:12px;font-weight:700;margin-bottom:8px">Adjust selected employees together</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end">
      <div style="flex:1;min-width:140px">${selF('Leave type','bulkbal-lt',ltOpts,ltOpts[0]?.[0]||'')}</div>
      <div style="width:120px">${fld('Days (+/−)','bulkbal-delta','','number')}</div>
      <div style="flex:1;min-width:160px">${fld('Reason','bulkbal-reason','','text')}</div>
      ${btn('Apply to selected',`App._bulkBalAdjust('${profId}')`,{variant:'primary'})}
    </div>
    <p style="font-size:11px;color:#9CA3AF;margin-top:6px">Adds (or removes, if negative) the days to the chosen type's entitlement for every checked employee. Audit-logged with the reason.</p>
  </div>`:'';
  return `<div>
    ${_balFilterBar('bulkbal')}
    ${table}
    ${users.length?btn('Save all balance edits','App._bulkBalSaveAll()',{variant:'brand',attrs:'style="width:100%;margin-top:12px"'}):''}
    ${adjust}
  </div>`;
}
App._bulkBalSelectAll=(on)=>{$$('.bulkbal-sel').forEach(cb=>{cb.checked=on;});};
// A3: rows changed by the last flush/adjust, for the targeted server save (cause 4: don't rely on the
//   debounced full-array _sync, which fails SILENTLY under RLS for non-_is_elevated() editors).
window._bulkBalDirty=[];
function _bulkBalMarkDirty(b){if(b&&!_bulkBalDirty.includes(b))_bulkBalDirty.push(b);}
// Flush every visible .bulkbal-cell input into DB.leaveBalances. Returns the number of changed cells.
// Shared by "Save all" and by "Apply to selected" (UI-2) so manual edits are never silently dropped.
function _bulkBalFlush(){
  let n=0;
  $$('.bulkbal-cell').forEach(inp=>{
    const uId=inp.dataset.uid,ltId=inp.dataset.lt,yr=inp.dataset.yr;
    const v=Number(inp.value);if(isNaN(v))return;
    const b=_balanceFor(uId,ltId,yr);const old=b.entitled||0;
    if(_r2(v)!==_r2(old)){b.entitled=_r2(Math.max(0,v));_bulkBalMarkDirty(b);const u=uById(uId),lt=ltById(ltId);hlog('Balance edited '+(lt?lt.name:''),fullName(u)+': '+old+' → '+b.entitled+' entitled');n++;}
  });
  return n;
}
// A3 (cause 4): targeted upsert of only the changed leave_balances rows. Surfaces an RLS/connection
//   failure via toast so a non-elevated editor sees "Couldn't save" instead of a false "Saved ✓"
//   (the change would otherwise vanish on reload). Mirrors the targeted savers at 3201/3738.
function _bulkBalTargetedSave(){
  const rows=_bulkBalDirty.slice();_bulkBalDirty=[];
  if(!rows.length)return;
  sb.from('leave_balances').upsert(rows.map(b=>({id:b.id,user_id:b.userId,leave_type_id:b.leaveTypeId,leave_year:b.leaveYear,entitled:b.entitled||0,accrued:b.accrued||0,carried_in:b.carriedIn||0,carried_expiry:b.carriedExpiry||null,used:b.used||0,pending:b.pending||0,last_accrued_month:b.lastAccruedMonth||null})),{onConflict:'id'})
    .then(({error})=>{if(error){console.warn('[bulk balance save]',error.message);toast("Couldn't save balances to the server — you may not have permission",'err');}})
    .catch(e=>{console.warn('[bulk balance save]',e.message);toast("Couldn't save balances — check your connection",'err');});
}
App._bulkBalSaveAll=()=>{
  if(!can('leaveBalances','edit')){toast('Not permitted','err');return;}
  const n=_bulkBalFlush();
  if(!n){toast('No changes to save','warn');return;}
  saveDB();_bulkBalTargetedSave();toast('Saved '+n+' balance change(s)');rr();
};
App._bulkBalAdjust=(profId)=>{
  if(!can('leaveBalances','edit')){toast('Not permitted','err');return;}
  const ltId=$('#bulkbal-lt')?.value;const delta=Number($('#bulkbal-delta')?.value);const reason=($('#bulkbal-reason')?.value||'').trim();
  const sel=$$('.bulkbal-sel').filter(cb=>cb.checked).map(cb=>cb.dataset.uid);
  if(!sel.length){toast('Select at least one employee','err');return;}
  if(!delta||isNaN(delta)){toast('Enter a non-zero number of days','err');return;}
  if(!reason){toast('Reason required','err');return;}
  const lt=ltById(ltId);if(!lt){toast('Pick a leave type','err');return;}
  // UI-2: persist any in-progress inline cell edits BEFORE applying the delta, otherwise rr() below
  // would re-render the table from DB and wipe them. Read cells against current DB (pre-delta).
  const flushed=_bulkBalFlush();
  sel.forEach(uId=>{
    const u=uById(uId);const yr=_leaveYearOf(u,todayISO());const b=_balanceFor(uId,ltId,yr);
    b.entitled=_r2(Math.max(0,(b.entitled||0)+delta));_bulkBalMarkDirty(b);
    hlog('Balance adjusted '+(delta>0?'+':'')+delta+' '+lt.name,fullName(u)+': '+reason);
  });
  saveDB();_bulkBalTargetedSave();toast('Adjusted '+sel.length+' employee(s)'+(flushed?' · saved '+flushed+' cell edit(s)':'')+'');rr();
};

/* ════════ §3a — COMP-OFF MANAGER (HR Config tab, gated by leaveBalances.grant) ════════
   Pick employees, enter +/- days, reason, expiry → appends to each u.hrm.compOff ledger. */
function _compOffManager(){
  if(!can('leaveBalances','grant'))return empty('lock','Not permitted','You do not have access to manage comp-off.');
  const users=_balScopeUsers();
  const rows=users.map(u=>`<tr class="hover:bg-ink-50/50"><td class="px-3 py-2"><label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" class="compoff-sel" data-uid="${u.id}"/>${avatar(u,'w-6 h-6','text-[9px]')}<span class="font-medium" style="font-size:12px">${esc(fullName(u))}${u.id===S.uid?' <span style="color:var(--c-text-3);font-weight:600">(you)</span>':''}</span></label></td><td class="px-3 py-2 text-xs text-ink-500">${esc(u.department||'')}</td><td class="px-3 py-2 font-semibold text-emerald-700">${_compOffRemaining(u.id)}</td></tr>`).join('');
  const table=users.length?`<div style="background:#fff;border-radius:16px;border:1px solid #ECEDF0;overflow:hidden"><div style="overflow-x:auto"><table class="w-full text-sm"><thead><tr class="text-[10px] text-ink-400 uppercase tracking-wide border-b border-ink-100 text-left"><th class="px-3 py-2.5 font-semibold"><input type="checkbox" onclick="App._compOffSelectAll(this.checked)"/> Employee</th><th class="px-3 py-2.5 font-semibold">Dept</th><th class="px-3 py-2.5 font-semibold">Comp-off bal</th></tr></thead><tbody class="divide-y divide-ink-50">${rows}</tbody></table></div></div>`:empty('users','No employees','Adjust the filters above.');
  return `<div>
    ${_balFilterBar('compoff')}
    <div style="background:#fff;border-radius:16px;border:1px solid #ECEDF0;padding:14px;margin-bottom:12px">
      <div style="font-size:12px;font-weight:700;margin-bottom:8px">Grant or remove comp-off for selected employees</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end">
        <div style="width:130px">${fld('Days (+/−)','compoff-days','','number')}</div>
        <div style="width:150px">${fld('Expiry (grants)','compoff-exp','','date')}</div>
        <div style="flex:1;min-width:160px">${fld('Reason','compoff-reason','','text')}</div>
        ${btn('Apply','App._compOffApply()',{variant:'primary'})}
      </div>
      <p style="font-size:11px;color:#9CA3AF;margin-top:6px">Positive grants honor their own expiry; negative removes days. Each change is recorded in the HR activity log.</p>
    </div>
    ${table}
  </div>`;
}
App._compOffSelectAll=(on)=>{$$('.compoff-sel').forEach(cb=>{cb.checked=on;});};
App._compOffApply=()=>{
  if(!can('leaveBalances','grant')){toast('Not permitted','err');return;}
  const days=Number($('#compoff-days')?.value);const reason=($('#compoff-reason')?.value||'').trim();const exp=$('#compoff-exp')?.value||null;
  const sel=$$('.compoff-sel').filter(cb=>cb.checked).map(cb=>cb.dataset.uid);
  if(!sel.length){toast('Select at least one employee','err');return;}
  if(!days||isNaN(days)){toast('Enter a non-zero number of days','err');return;}
  if(!reason){toast('Reason required','err');return;}
  // O15: warn (and require confirmation) when a removal exceeds an employee's remaining comp-off —
  //   the ledger floors at 0, so an over-removal would otherwise be silently swallowed.
  if(days<0){
    const over=sel.map(uId=>uById(uId)).filter(Boolean).filter(u=>_compOffRemaining(u.id)<Math.abs(days));
    if(over.length&&!confirm('Removing '+Math.abs(days)+' day(s) exceeds the current comp-off balance for '+over.length+' employee(s) ('+over.map(u=>fullName(u)).join(', ')+'). Their balance will floor at 0. Continue?'))return;
  }
  sel.forEach(uId=>{const u=uById(uId);if(!u)return;_ensureHrm(u);u.hrm.compOff.push({id:uid('co'),days:_r2(days),reason,expiry:(days>0?(exp||null):null),at:new Date().toISOString(),by:fullName(me())});hlog('Comp-off '+(days>0?'+':'')+days,fullName(u)+': '+reason);});
  saveDB();toast((days>0?'Granted ':'Removed ')+Math.abs(days)+' comp-off day(s) for '+sel.length+' employee(s)');rr();
};

App.saveHrmConfig=(profId)=>{
  if(!can('hrSettings','edit')){toast('Not permitted','err');return;}
  const p=DB.hrmConfig.profiles[profId];if(!p)return;
  p.grace=Number($('#cfg-grace')?.value)||15;
  p.autoCloseAt=$('#cfg-auto')?.value||'00:00';
  p.leaveYearBasis=$('#cfg-basis')?.value||'calendar';
  // §3: default work week removed (each user's schedule decides) — p.workWeekDefault left untouched in data.
  // §3: profile-level geofence removed (geofence now lives only on Locations) — p.office no longer written here.
  // §2: persist the approval flow built in _approvalFlowEditor (working copy on _AF).
  if(Array.isArray(_AF))p.approvalFlow=_AF.filter(s=>s&&s.type).map((s,i)=>({id:s.id||('st'+i),type:s.type,...(s.type==='role'?{role:s.role||'hr'}:{}),...(s.type==='user'?{userId:s.userId||null}:{})})).filter(s=>s.type!=='user'||s.userId);
  if(!Array.isArray(p.approvalFlow)||!p.approvalFlow.length)p.approvalFlow=_normalizeFlow(p);
  // Bug 3: clear the working copy so the next editor render reseeds from the just-saved profile.
  _AF=null;_AFProfId=null;
  hlog('HR config saved',profId);saveDB();toast('Configuration saved');rr();
};

/* ════════ APPROVAL FLOW EDITOR (§2) — inside HR Config policy tab, gated by hrSettings.edit ════════ */
// Working copy mutated by the editor; flushed to prof.approvalFlow in saveHrmConfig.
window._AF=null;
window._AFProfId=null; // Bug 3: which profile the working copy belongs to (guards against clobbering edits).
function _approvalFlowEditor(prof){
  // Bug 3 (binding decision #7): do NOT reseed the working copy when an in-progress copy already
  //   exists for THIS open profile — an incidental rr()/re-render between editing the flow and
  //   clicking "Save configuration" must not silently discard unsaved stage edits. Reseed only when
  //   there is no working copy yet, or the editor switched to a different profile.
  if(!Array.isArray(_AF)||_AFProfId!==(prof&&prof.id)){
    _AF=JSON.parse(JSON.stringify(_normalizeFlow(prof)));
    _AFProfId=prof&&prof.id||null;
  }
  return `<div style="background:#fff;border-radius:16px;border:1px solid #ECEDF0;padding:16px">
    <h3 class="fd font-bold text-sm mb-1">Approval flow</h3>
    <p style="font-size:11px;color:#9CA3AF;margin-bottom:10px">Requests move through these stages in order. Each stage is approved (advance) or rejected (stops & releases the days). Super Admin can act at any stage.</p>
    <div id="af-list">${_afRows()}</div>
    <button type="button" onclick="App._afAdd()" style="margin-top:10px;font-size:13px;font-weight:600;padding:8px 14px;border-radius:10px;border:1.5px dashed #D1D5DB;background:#fff;color:#374151;cursor:pointer;width:100%">+ Add stage</button>
  </div>`;
}
function _afRows(){
  const users=DB.users.filter(u=>u.status==='Active'&&!isSuperU(u)).map(u=>[u.id,fullName(u)]);
  return (_AF||[]).map((s,i)=>{
    const typeSel=`<select onchange="App._afSet(${i},'type',this.value)" class="bg-white border border-ink-200 rounded-lg px-2 py-1.5 text-sm rf">${[['manager','Manager'],['role','HR'],['user','Specific person']].map(([v,l])=>`<option value="${v}"${s.type===v?' selected':''}>${l}</option>`).join('')}</select>`;
    const userSel=s.type==='user'?`<select onchange="App._afSet(${i},'userId',this.value)" class="bg-white border border-ink-200 rounded-lg px-2 py-1.5 text-sm rf" style="flex:1;min-width:0"><option value="">— choose person —</option>${users.map(([v,l])=>`<option value="${v}"${s.userId===v?' selected':''}>${esc(l)}</option>`).join('')}</select>`:'';
    return `<div style="display:flex;align-items:center;gap:8px;background:#F9FAFB;border:1px solid #ECEDF0;border-radius:10px;padding:8px;margin-bottom:6px">
      <span style="font-size:11px;font-weight:700;color:#9CA3AF;min-width:18px">${i+1}.</span>
      ${typeSel}${userSel}
      <div style="margin-left:auto;display:flex;gap:4px">
        <button type="button" title="Move up" onclick="App._afMove(${i},-1)" ${i===0?'disabled':''} style="width:28px;height:28px;border-radius:8px;border:1px solid #ECEDF0;background:#fff;cursor:pointer;${i===0?'opacity:.4;cursor:default':''}">▲</button>
        <button type="button" title="Move down" onclick="App._afMove(${i},1)" ${i===(_AF.length-1)?'disabled':''} style="width:28px;height:28px;border-radius:8px;border:1px solid #ECEDF0;background:#fff;cursor:pointer;${i===(_AF.length-1)?'opacity:.4;cursor:default':''}">▼</button>
        <button type="button" title="Remove" onclick="App._afDel(${i})" ${_AF.length<=1?'disabled':''} style="width:28px;height:28px;border-radius:8px;border:1px solid #FECACA;background:#fff;color:#B91C1C;cursor:pointer;display:grid;place-items:center;${_AF.length<=1?'opacity:.4;cursor:default':''}">${ic('x','w-3.5 h-3.5')}</button>
      </div>
    </div>`;
  }).join('');
}
function _afRefresh(){const el=$('#af-list');if(el)el.innerHTML=_afRows();}
App._afSet=(i,k,v)=>{if(!_AF||!_AF[i])return;if(k==='type'){_AF[i]={id:_AF[i].id,type:v};if(v==='role')_AF[i].role='hr';if(v==='user')_AF[i].userId='';}else{_AF[i][k]=v;}_afRefresh();};
App._afAdd=()=>{if(!_AF)_AF=[];_AF.push({id:'st'+Date.now(),type:'manager'});_afRefresh();};
App._afDel=(i)=>{if(!_AF||_AF.length<=1)return;_AF.splice(i,1);_afRefresh();};
App._afMove=(i,d)=>{if(!_AF)return;const j=i+d;if(j<0||j>=_AF.length)return;const t=_AF[i];_AF[i]=_AF[j];_AF[j]=t;_afRefresh();};
App.addHoliday=(profId)=>{
  const date=$('#hol-date')?.value,name=($('#hol-name')?.value||'').trim();
  if(!date||!name){toast('Date & name required','err');return;}
  DB.holidays.push({id:uid('hol'),profileId:profId,date,name,locationId:null});
  hlog('Holiday added',name+' ('+date+')');saveDB();toast('Holiday added');rr();
};
App.delHoliday=(id)=>{DB.holidays=(DB.holidays||[]).filter(h=>h.id!==id);hlog('Holiday removed',id);saveDB();rr();};
App.editLeaveType=(id)=>{
  const lt=ltById(id);if(!lt)return;
  const tiers=lt.paidTiers||{};
  modalShell({title:lt.name,size:'max-w-lg',
    body:`<div style="display:flex;flex-direction:column;gap:14px">
      ${fld('Name','lt-name',lt.name)}
      ${mkTog('lt-en',lt.enabled,'Enabled')}
      <div class="grid grid-cols-2 gap-3">${fld('Entitlement (days/yr)','lt-ent',lt.entitlement,'number')}${fld('Accrual / month','lt-acc',lt.accrualPerMonth,'number')}</div>
      <div class="grid grid-cols-2 gap-3">${selF('Unit','lt-unit',[['calendar','Calendar days'],['working','Working days']],lt.unit)}${fld('Eligibility (months)','lt-elig',lt.eligibilityMonths,'number')}</div>
      <div class="grid grid-cols-2 gap-3">${fld('Max per year','lt-max',lt.maxPerYear??'','number')}${mkTog('lt-half',lt.halfDayAllowed,'Half-day allowed')}</div>
      ${lt.paidTiers||lt.key==='sick'||lt.key==='maternity'?`<div style="background:var(--c-surface-2);border-radius:12px;padding:12px"><p style="font-size:10px;font-weight:700;color:var(--c-text-3);text-transform:uppercase;margin-bottom:8px">Sick-leave pay tiers (days)</p><div class="grid grid-cols-3 gap-2">${fld('Full pay','lt-tf',tiers.full??'','number')}${fld('Half pay','lt-th',tiers.half??'','number')}${fld('Unpaid','lt-tu',tiers.unpaid??'','number')}</div></div>`:''}
      <div style="background:var(--c-surface-2);border-radius:12px;padding:12px"><p style="font-size:10px;font-weight:700;color:var(--c-text-3);text-transform:uppercase;margin-bottom:8px">Carry-over</p>${mkTog('lt-co',lt.carryOver?.enabled,'Enable carry-over')}<div class="grid grid-cols-2 gap-2 mt-2">${fld('Max carry days','lt-comax',lt.carryOver?.maxDays??0,'number')}${fld('Expiry (months)','lt-coexp',lt.carryOver?.expiryMonths??0,'number')}</div></div>
      ${mkTog('lt-bday',lt.birthdayMonthOnly,'Birthday month only')}
      ${mkTog('lt-once',lt.oncePerEmployment,'Once per employment')}
    </div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Save',`App.saveLeaveType('${id}')`)});
};
App.saveLeaveType=(id)=>{
  const lt=ltById(id);if(!lt)return;
  lt.name=($('#lt-name')?.value||lt.name).trim();
  lt.enabled=togV('lt-en');
  lt.entitlement=Number($('#lt-ent')?.value)||0;
  lt.accrualPerMonth=Number($('#lt-acc')?.value)||0;
  lt.unit=$('#lt-unit')?.value||'calendar';
  lt.eligibilityMonths=Number($('#lt-elig')?.value)||0;
  lt.maxPerYear=$('#lt-max')?.value!==''?Number($('#lt-max').value):null;
  lt.halfDayAllowed=togV('lt-half');
  if($('#lt-tf')){lt.paidTiers={full:Number($('#lt-tf').value)||0,half:Number($('#lt-th').value)||0,unpaid:Number($('#lt-tu').value)||0};}
  lt.carryOver={enabled:togV('lt-co'),maxDays:Number($('#lt-comax')?.value)||0,expiryMonths:Number($('#lt-coexp')?.value)||0};
  lt.birthdayMonthOnly=togV('lt-bday');
  lt.oncePerEmployment=togV('lt-once');
  hlog('Leave type updated',lt.name);saveDB();closeModal();toast('Saved');rr();
};

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window._alertsCfgHTML=_alertsCfgHTML;window._flowTplCfgHTML=_flowTplCfgHTML;window._surveyCfgHTML=_surveyCfgHTML;window._letterTplCfgHTML=_letterTplCfgHTML;window.hrmConfigPage=hrmConfigPage;window._balScopeUsers=_balScopeUsers;window._balFilterBar=_balFilterBar;window._bulkBalanceEditor=_bulkBalanceEditor;window._bulkBalMarkDirty=_bulkBalMarkDirty;window._bulkBalFlush=_bulkBalFlush;window._bulkBalTargetedSave=_bulkBalTargetedSave;window._compOffManager=_compOffManager;window._approvalFlowEditor=_approvalFlowEditor;window._afRows=_afRows;window._afRefresh=_afRefresh;

/* ════════ COMPLIANCE (Phase 4) — per-country rules the accountant sets once + filing exports.
   DISPLAY-ONLY: payslips show the accrual, exports are filing-ready, net pay never changes. ════════ */
function _complianceCfgHTML(){
  const canEdit=can('hrSettings','edit');const c=_compCfg();
  const cCard=(k)=>{const cc=c.countries[k];const g=cc.gratuity||{tiers:[]};const t1=(g.tiers||[])[0]||{},t2=(g.tiers||[])[1]||{};
    return `<div style="background:#fff;border:1px solid var(--c-border);border-radius:16px;padding:16px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b class="fd">${esc(cc.label||k)}</b><span style="font-size:11px;color:var(--c-text-3)">${esc(k)}</span></div>
      <div class="grid grid-cols-3 gap-3">
        ${fld('Currency','cmp-'+k+'-cur',cc.currency||'','text')}
        ${fld('WPS employer ID','cmp-'+k+'-emp',(cc.wps||{}).employerId||'','text')}
        ${fld('Bank / routing code','cmp-'+k+'-bank',(cc.wps||{}).bankCode||'','text')}
      </div>
      <div style="margin:10px 0 4px;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase">End-of-service (gratuity) accrual</div>
      <div class="grid grid-cols-3 gap-3">
        ${fld('Days per year — first period','cmp-'+k+'-d1',(t1.daysPerYear??0),'number')}
        ${fld('First period lasts (years)','cmp-'+k+'-y1',(t1.uptoYears??5),'number')}
        ${fld('Days per year — after that','cmp-'+k+'-d2',(t2.daysPerYear??t1.daysPerYear??0),'number')}
      </div>
      <p style="font-size:11px;color:#9CA3AF;margin-top:6px">${esc(cc.notes||'')} Daily rate = basic ÷ ${g.dailyDivisor||30}. Shown on payslips & the liability export — never deducted from pay.</p>
    </div>`;};
  const locRows=(DB.locations||[]).map(l=>`<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px"><span style="flex:1;font-size:13px;font-weight:600">${esc(l.name)}</span>
    <select class="ui-select rf" style="width:220px" id="cmp-loc-${l.id}" ${canEdit?'':'disabled'}>${Object.keys(c.countries).map(k=>`<option value="${k}" ${(c.locationCountry[l.id]||'AE')===k?'selected':''}>${esc(c.countries[k].label||k)}</option>`).join('')}</select></div>`).join('');
  return `<div class="space-y-4">
    <div style="background:var(--c-surface-2);border-radius:12px;padding:10px 14px;font-size:12px;color:var(--c-text-2)">Your accountant sets these once. Everything here is <b>informational</b> — payslips show the accrual, exports are filing-ready, and net pay is never changed.</div>
    ${Object.keys(c.countries).map(cCard).join('')}
    <div style="background:#fff;border:1px solid var(--c-border);border-radius:16px;padding:16px">
      <b class="fd" style="font-size:13.5px">Which country applies to each office</b>
      <p style="font-size:11.5px;color:#9CA3AF;margin:4px 0 10px">People follow their assigned office's country. Offices with no mapping use UAE rules.</p>${locRows||'<span style="font-size:12px;color:var(--c-text-3)">No locations yet.</span>'}
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${canEdit?'<button onclick="App._compSave()" class="ui-btn ui-btn-primary">Save compliance settings</button>':''}
      <button onclick="App._compGratuityCSV()" class="ui-btn ui-btn-subtle">Export gratuity liability CSV</button>
    </div>
  </div>`;
}
App._compSave=()=>{
  if(!can('hrSettings','edit'))return toast('You need HR settings → Edit','err');
  const c=_compCfg();
  Object.keys(c.countries).forEach(k=>{const cc=c.countries[k];
    const v=id=>{const el=document.getElementById(id);return el?el.value:null;};
    if(v('cmp-'+k+'-cur')!=null)cc.currency=String(v('cmp-'+k+'-cur')).trim();
    cc.wps=cc.wps||{};if(v('cmp-'+k+'-emp')!=null)cc.wps.employerId=String(v('cmp-'+k+'-emp')).trim();if(v('cmp-'+k+'-bank')!=null)cc.wps.bankCode=String(v('cmp-'+k+'-bank')).trim();
    const d1=Number(v('cmp-'+k+'-d1')),y1=Number(v('cmp-'+k+'-y1')),d2=Number(v('cmp-'+k+'-d2'));
    if(isFinite(d1)&&isFinite(y1)&&isFinite(d2))cc.gratuity={basis:'basic',dailyDivisor:(cc.gratuity||{}).dailyDivisor||30,tiers:[{uptoYears:(y1||5),daysPerYear:(d1||0)},{uptoYears:null,daysPerYear:(d2||0)}]};
  });
  (DB.locations||[]).forEach(l=>{const el=document.getElementById('cmp-loc-'+l.id);if(el)c.locationCountry[l.id]=el.value;});
  log(fullName(me()),'Compliance settings saved','');
  saveDB();toast('Compliance settings saved');rr();
};
/* Guarded letter-template delete (replaces the old inline confirm) — blocked while any
   letter request with status 'Requested' still uses this template. */
App._delLetterTpl=(key)=>{
  if(!can('hrSettings','edit')){toast('Not allowed','err');return;}
  const T=DB.hrmConfig.letterTemplates||{};const tpl=T[key];if(!tpl)return;
  if(Object.keys(T).length<=1){toast('At least one template must remain','err');return;}
  if(!guardDelete('letterTemplate',key,'template "'+tpl.name+'"'))return;
  if(!confirm('Delete this template?'))return;
  delete DB.hrmConfig.letterTemplates[key];S.filters.ltKey='';saveDB();
  log(fullName(me()),'Letter template deleted',tpl.name);
  toast('Template deleted','warn');rr();
};
window._complianceCfgHTML=_complianceCfgHTML;
