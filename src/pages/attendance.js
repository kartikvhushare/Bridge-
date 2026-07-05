
App.clockIn=()=>{
  const uId=S.uid,date=todayISO();
  // LV-2: only an ACTUAL clock-in (clockIn/inMin set) means "already clocked in today".
  //   A pre-written Leave/HalfDay record (clockIn:null/inMin:null) must NOT block clock-in — on a
  //   half-day-leave day the worked half is still clocked, and a cancelled-leave day must be clockable.
  const existing=attFor(uId,date);
  if(existing&&(existing.clockIn!=null||existing.inMin!=null)){toast('Already clocked in today','warn');return;}
  const _record=(geo)=>{
    // L1: `date` & `inMin` are LOCAL (todayISO/nowHM); all hours/late math uses these local *Min values.
    // `clockIn` ISO is a UTC display/audit stamp only — never used for hours math (no functional change).
    const m=nowHM();
    let rec=existing;
    if(rec){
      // Merge the clock-in onto the existing Leave/HalfDay row rather than creating a duplicate.
      rec.clockIn=new Date().toISOString();rec.inMin=m;rec.clockOut=null;rec.outMin=null;rec.hours=null;
      rec.inGeo=geo;rec.autoClosed=false;
      // Keep HalfDay status for a half-day-leave day (worked half); a leftover full-Leave row becomes Present.
      if(rec.status!=='HalfDay')rec.status='Present';
    }else{
      rec={id:_attId(uId,date),userId:uId,date,clockIn:new Date().toISOString(),clockOut:null,inMin:m,outMin:null,hours:null,status:'Present',leaveType:null,flags:[],inGeo:geo,autoClosed:false,note:'',createdAt:new Date().toISOString()}; // M5: deterministic id
      DB.attendance.unshift(rec);
    }
    _applyFlags(rec);
    saveDB();
    if(rec.flags.includes('late')&&_hnp('inapp_hrm_late'))_hrmNotify(uId,'⚠️ You clocked in late at '+_m2hm(m)+' on '+fmtD(date)+'.','attendance');
    if(rec.flags.includes('late')&&_hnpEmail('email_hrm_late'))queueEmail('hrm_late',uId,null,date,{user_name:fullName(uById(uId)),date:fmtD(date),time:_m2hm(m)});
    toast('Clocked in at '+_m2hm(m)+'');rr();
  };
  _withGeofence('in',_record,false,'App.clockIn()'); // W1.6: geofence-fail → Retry affordance
};
App.clockOut=()=>{
  const uId=S.uid,date=todayISO();
  const rec=attFor(uId,date);
  // LV-2: a pre-written Leave/HalfDay row (no actual clock-in) is not "clocked in" — require a real clock-in.
  if(!rec||(rec.clockIn==null&&rec.inMin==null)){toast('Clock in first','warn');return;}
  if(rec.clockOut){toast('Already clocked out','warn');return;}
  // H4: lenient gate — a real clock-in already exists, so a mid-shift geofence change must never trap
  //   the out-punch (which would force a corrupted auto-close). Fence still enforced when active+GPS ok.
  _withGeofence('out',(geo)=>{
    const m=nowHM();
    rec.clockOut=new Date().toISOString();rec.outMin=m;rec.hours=computeHours(rec);
    if(geo)rec.outGeo=geo;
    else{rec.outGeo=null;if(!(rec.flags||[]).includes('fence-changed'))rec.flags=[...(rec.flags||[]),'fence-changed'];} // H4 audit
    _applyFlags(rec);saveDB();
    if(rec.flags.includes('early'))_hrmNotify(uId,'⚠️ You clocked out early at '+_m2hm(m)+' on '+fmtD(date)+'.','attendance');
    toast('Clocked out — '+rec.hours+'h worked');rr();
  },true); // H4: lenient — a real clock-in exists, never trap the out-punch on a mid-shift fence change
};

function _clockWidget(){
  const date=todayISO();const rec=attFor(S.uid,date);const u=me();
  const sched=u.hrm?.schedule||{};
  // Clock-out reminder (in-app, lazy)
  if(rec&&rec.clockIn&&!rec.clockOut&&nowHM()>hm2m(sched.out)+(userProfile(u).grace??15)){ // LV-6: user's profile
    if(!rec._remNotified){rec._remNotified=true;_hrmNotify(S.uid,'🔔 Don\'t forget to clock out — your shift ended at '+(sched.out||'18:00')+'.','attendance');saveDB();}
  }
  const nowTime=new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  // LV-2: a record that exists but has no actual clock-in (a pre-written Leave/HalfDay row) must still
  //   show the Clock In button so the worked (half-)day can be clocked.
  const _clockedIn=rec&&(rec.clockIn!=null||rec.inMin!=null);
  const actBtn=(label,onclick,variant)=>`<button onclick="${onclick}" class="ui-btn ui-btn-${variant}" style="font-size:15px;font-weight:700;padding:14px 30px;min-height:52px;border-radius:14px;flex:1 1 200px;max-width:280px">${ic('clock','w-5 h-5')}${label}</button>`;
  const tile=(ico,ibg,iink)=>`<div style="width:56px;height:56px;border-radius:16px;background:${ibg};color:${iink};display:grid;place-items:center;flex-shrink:0">${ic(ico,'w-7 h-7')}</div>`;
  let left,right,accent='var(--c-brand)';
  if(!_clockedIn){
    left=`${tile('clock','var(--c-brand-soft)','var(--c-brand-ink)')}<div style="min-width:0"><div class="fd" style="font-size:32px;font-weight:800;letter-spacing:-1px;line-height:1">${nowTime}</div><p style="font-size:13px;color:var(--c-text-2);margin-top:5px">${rec&&rec.status==='HalfDay'?'Half-day · ':''}Shift ${sched.in||'09:00'}–${sched.out||'18:00'} · ${sched.hours||9}h</p></div>`;
    right=actBtn('Clock In',"App.clockIn()",'brand');
  }else if(!rec.clockOut){
    accent='var(--c-ink)';
    left=`${tile('clock','var(--c-success-soft)','var(--c-success-ink)')}<div style="min-width:0"><div class="fd" style="font-size:32px;font-weight:800;letter-spacing:-1px;line-height:1">${nowTime}</div><p style="font-size:13px;color:var(--c-text-2);margin-top:5px">On shift since <strong style="color:var(--c-text)">${_m2hm(rec.inMin)}</strong>${rec.flags.includes('late')?' · Late':''}</p></div>`;
    right=actBtn('Clock Out',"App.clockOut()",'primary');
  }else{
    accent='var(--c-success)';
    left=`${tile('approve','var(--c-success-soft)','var(--c-success)')}<div style="min-width:0"><div class="fd" style="font-size:19px;font-weight:800;color:var(--c-success-ink)">Shift complete</div><div style="font-size:13px;color:var(--c-text-2);margin-top:4px">${_m2hm(rec.inMin)} → ${_m2hm(rec.outMin)} · <strong style="color:var(--c-text)">${rec.hours}h</strong>${rec.autoClosed?' '+badge('Auto-closed','warn'):''}${rec.flags.includes('late')?' '+badge('Late in','danger'):''}${rec.flags.includes('early')?' '+badge('Early out','warn'):''}</div></div>`;
    right='';
  }
  return `<div class="ui-card" style="padding:20px 24px;margin-bottom:18px;border-left:4px solid ${accent};display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap"><div style="display:flex;align-items:center;gap:18px;min-width:0;flex:1 1 240px">${left}</div>${right}</div>`;
}


/* Month-grid attendance calendar for a user */
function _attCalendar(userId,ym){
  ym=ym||todayISO().slice(0,7);
  const[y,mo]=ym.split('-').map(Number);
  const first=new Date(y,mo-1,1),firstDow=first.getDay();
  const days=new Date(y,mo,0).getDate();
  let cells='';
  for(let i=0;i<firstDow;i++)cells+='<div></div>';
  for(let d=1;d<=days;d++){
    const date=ym+'-'+String(d).padStart(2,'0');
    const st=_dayStatus(userId,date);
    const bg=st?(ATT_SOFT[st.status]||'#F6F7F8'):'#F8F9FB';
    const txt=st?(ATT_INK[st.status]||'#7A8395'):'#B6BDC9';
    const isT=date===todayISO();
    const tip=st?(ATT_LABEL[st.status]+(st.note?' — '+st.note:'')+(st.hours?(' ('+st.hours+'h)'):'')):'';
    cells+=`<div onclick="App._attDay('${userId}','${date}')" title="${esc(tip)}" style="aspect-ratio:1;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:700;cursor:pointer;background:${bg};color:${txt};border:${isT?'2px solid var(--c-ink)':'1px solid transparent'};transition:transform .1s" onmouseover="this.style.transform='scale(1.08)'" onmouseout="this.style.transform='none'">${d}</div>`;
  }
  const monName=first.toLocaleDateString('en-GB',{month:'long',year:'numeric'});
  const prevYm=_ymShift(ym,-1),nextYm=_ymShift(ym,1);
  const legend=Object.keys(ATT_COLOR).map(k=>`<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#6B7280"><span style="width:10px;height:10px;border-radius:3px;background:${ATT_COLOR[k]}"></span>${ATT_LABEL[k]}</span>`).join('');
  return `<div style="background:#fff;border-radius:20px;border:1px solid #ECEDF0;padding:18px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <button onclick="S.filters.attYm='${prevYm}';rr()" style="width:32px;height:32px;border-radius:9px;border:1px solid #ECEDF0;background:#fff;cursor:pointer;display:grid;place-items:center"><span style="transform:rotate(180deg)">${ic('chevR','w-4 h-4')}</span></button>
      <div class="fd" style="font-weight:800;font-size:15px">${monName}</div>
      <button onclick="S.filters.attYm='${nextYm}';rr()" style="width:32px;height:32px;border-radius:9px;border:1px solid #ECEDF0;background:#fff;cursor:pointer;display:grid;place-items:center">${ic('chevR','w-4 h-4')}</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-bottom:5px">${['S','M','T','W','T','F','S'].map(d=>`<div style="text-align:center;font-size:10px;font-weight:800;color:#B8B5AC">${d}</div>`).join('')}</div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px">${cells}</div>
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;padding-top:12px;border-top:1px solid #F3F4F6">${legend}</div>
  </div>`;
}
function _ymShift(ym,n){const[y,m]=ym.split('-').map(Number);const d=new Date(y,m-1+n,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}

/* §6 — Day detail modal: clock-in/out, hours, status, flags, notes for one user/day. */
App._attDay=(userId,date)=>{
  // Scope: own day always; others only within attendance scope.
  if(userId!==S.uid&&!(can('attendance','view')&&scopeFilter('attendance')(userId))){toast('Not allowed','err');return;}
  const u=uById(userId);if(!u)return;
  const st=_dayStatus(userId,date);
  const status=st?st.status:'—';
  const col=ATT_COLOR[status]||'#9CA3AF';
  const label=ATT_LABEL[status]||status;
  const rec=st&&!st.virtual?st:null; // a real attendance record (has in/out)
  const row=(k,v)=>'<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #F3F4F6"><span style="font-size:12px;font-weight:600;color:#9CA3AF">'+k+'</span><span style="font-size:14px;font-weight:700;color:#15171C">'+v+'</span></div>';
  const flags=(rec&&(rec.flags||[]).length)?(rec.flags||[]).map(f=>'<span style="display:inline-block;font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;background:#FEF2F2;color:#B91C1C;margin-right:4px">'+esc(f)+'</span>').join(''):'';
  let body='';
  if(rec){
    body=row('Clock in',_m2hm(rec.inMin))
      +row('Clock out',_m2hm(rec.outMin))
      +row('Hours worked',rec.hours!=null?rec.hours+'h':'—')
      +(rec.autoClosed?row('Note','<span style="color:#B45309">Auto-closed</span>'):'')
      +(flags?'<div style="padding:10px 0"><div style="font-size:12px;font-weight:600;color:#9CA3AF;margin-bottom:6px">Flags</div>'+flags+'</div>':'')
      +(rec.note?row('Note',esc(rec.note)):'');
  }else if(st){
    body=row('Clock in','—')+row('Clock out','—')+row('Hours worked','—')
      +(st.note?row('Details',esc(st.note)):'');
  }else{
    body='<p style="font-size:13px;color:#9CA3AF;text-align:center;padding:18px">No record for this day.</p>';
  }
  openModal('<div style="padding:20px">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">'
    +'<h2 style="font-size:18px;font-weight:800;font-family:var(--font-display)">'+fmtD(date)+'</h2>'
    +'<button onclick="App.closeModal()" style="width:28px;height:28px;display:grid;place-items:center;border-radius:8px;border:none;background:transparent;cursor:pointer;color:#9CA3AF">'+ic('x')+'</button></div>'
    +'<p style="font-size:12px;color:#9CA3AF;margin-bottom:12px">'+esc(fullName(u))+(userId===S.uid?' (me)':'')+'</p>'
    +'<div style="margin-bottom:12px"><span style="font-size:12px;font-weight:700;padding:3px 12px;border-radius:20px;background:'+col+'22;color:'+col+'">'+esc(label)+'</span></div>'
    +body
    +'</div>','max-w-sm');
};

/* ════════ ATTENDANCE PAGE ════════ */
function attendancePage(){
  _runAutoClose();
  const ym=S.filters.attYm||todayISO().slice(0,7);
  // §1.8 step 5 / §6: who can we view? Self always; others only within attendance scope.
  // scopedUsers('attendance') already honors self/team/department/location/everyone + Super-Admin exclusion.
  let viewUsers=[me()];
  if(can('attendance','view')){
    const scoped=scopedUsers('attendance');
    viewUsers=scoped.length?scoped:[me()];
    if(!viewUsers.some(u=>u.id===S.uid))viewUsers=[me(),...viewUsers];
  }
  const selUser=S.filters.attUser&&viewUsers.find(u=>u.id===S.filters.attUser)?S.filters.attUser:S.uid;
  const canSwitch=viewUsers.length>1;
  // logs (attendance + leave history) for selected user
  const att=(DB.attendance||[]).filter(a=>a.userId===selUser).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,60);
  const sortKey=S.filters.attSort||'date';
  const rows=att.slice().sort((a,b)=>sortKey==='hours'?((b.hours||0)-(a.hours||0)):b.date.localeCompare(a.date));
  const logTable=`<div style="background:#fff;border-radius:20px;border:1px solid #ECEDF0;overflow:hidden">
    <div style="padding:14px 18px;border-bottom:1px solid #F3F4F6;display:flex;align-items:center;justify-content:space-between"><h3 class="fd" style="font-weight:700;font-size:14px">Attendance log</h3>
      <select onchange="S.filters.attSort=this.value;rr()" class="bg-white border border-ink-200 rounded-lg px-2 py-1 text-xs rf"><option value="date"${sortKey==='date'?' selected':''}>Newest first</option><option value="hours"${sortKey==='hours'?' selected':''}>Most hours</option></select>
    </div>
    <div style="overflow-x:auto"><table class="w-full text-sm"><thead><tr class="text-[10px] text-ink-400 uppercase tracking-wide border-b border-ink-100 text-left"><th class="px-4 py-2.5 font-semibold">Date</th><th class="px-4 py-2.5 font-semibold">In</th><th class="px-4 py-2.5 font-semibold">Out</th><th class="px-4 py-2.5 font-semibold">Hours</th><th class="px-4 py-2.5 font-semibold">Status</th><th class="px-4 py-2.5 font-semibold">Flags</th></tr></thead>
    <tbody class="divide-y divide-ink-50">${rows.length?rows.map(r=>`<tr class="hover:bg-ink-50/50"><td class="px-4 py-2.5 font-medium">${fmtD(r.date)}</td><td class="px-4 py-2.5">${_m2hm(r.inMin)}</td><td class="px-4 py-2.5">${_m2hm(r.outMin)}</td><td class="px-4 py-2.5 font-semibold">${r.hours!=null?r.hours+'h':'—'}</td><td class="px-4 py-2.5"><span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:${ATT_COLOR[r.status]}22;color:${ATT_COLOR[r.status]}">${ATT_LABEL[r.status]||r.status}</span></td><td class="px-4 py-2.5 text-xs">${(r.flags||[]).map(f=>`<span style="display:inline-block;font-size:10px;font-weight:700;padding:1px 6px;border-radius:6px;background:#FEF2F2;color:#B91C1C;margin-right:3px">${esc(f)}</span>`).join('')||'—'}</td></tr>`).join(''):`<tr><td colspan="6">${empty('clock','No attendance records','')}</td></tr>`}</tbody></table></div>
  </div>`;
  return `<div class="fade">${hdr('Attendance','Clock in / out and view your attendance calendar')}
    ${selUser===S.uid?_clockWidget():''}
    ${canSwitch?`<div style="margin-bottom:14px"><select onchange="S.filters.attUser=this.value;rr()" class="bg-white border border-ink-200 rounded-xl px-3 py-2.5 text-sm rf" style="max-width:280px">${viewUsers.map(u=>`<option value="${u.id}"${u.id===selUser?' selected':''}>${esc(fullName(u))}${u.id===S.uid?' (me)':''}</option>`).join('')}</select></div>`:''}
    <div class="grid md:grid-cols-2 gap-4 items-start">${_attCalendar(selUser,ym)}${logTable}</div>
  </div>`;
}

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window._clockWidget=_clockWidget;window._attCalendar=_attCalendar;window._ymShift=_ymShift;window.attendancePage=attendancePage;
