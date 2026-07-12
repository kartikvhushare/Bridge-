

/* ===== USERS ===== */
function _disableBtn(u){
  if(!can('employees','deactivate')||!scopeFilter('employees')(u.id))return''; // C2: gate enable/disable button to the dedicated permission
  if(u.role==='Admin'&&!isAdmin())return''; // never offer to disable a Super Admin to a non-admin
  const isActive=u.status==='Active';
  const bg=isActive?'transparent':'#FEF3C7';
  const col=isActive?'#9CA3AF':'#D97706';
  const tip=isActive?'Disable user':'Enable user';
  return '<button onclick="App.togUser(\''+u.id+'\')" title="'+tip+'" style="width:32px;height:32px;display:grid;place-items:center;border-radius:8px;color:'+col+';background:'+bg+';border:none;cursor:pointer">'+ic(isActive?'lock':'unlock','w-4 h-4')+'</button>';
}

function usersPage(){
  // Directory scoped by the resolver (employees area). Keep Super Admin out of the people list
  // for non-admins exactly as before — scopeFilter('employees') handles that. For unassigned
  // users _baseScope yields today's behavior (Admin/SubAdmin → everyone, manager → team).
  const _canEdit=can('employees','edit'),_canDel=can('employees','delete');
  let list=scopedUsers('employees');const q=S.search.toLowerCase();
  if(q)list=list.filter(u=>fullName(u).toLowerCase().includes(q)||u.email.toLowerCase().includes(q));
  if(S.filters.dep)list=list.filter(u=>u.department===S.filters.dep);
  if(S.filters.stat)list=list.filter(u=>u.status===S.filters.stat);
  return`<div class="fade">${hdr('Users',scopedUsers('employees').length+' people',can('employees','create')?btnP('Add user','App.editUser()','plus'):'')}
  <div class="flex gap-2 mb-4 flex-wrap">
    <div class="relative flex-1 min-w-[160px] md:hidden"><span class="absolute left-3 top-1/2 -translate-y-1/2" style="color:var(--c-text-3)">${ic('search','w-4 h-4')}</span><input oninput="S.search=this.value;rr()" value="${esc(S.search)}" placeholder="Search…" class="ui-input" style="padding-left:36px"/></div>
    <select onchange="S.filters.dep=this.value;rr()" class="ui-select" style="width:auto"><option value="">All depts</option>${DB.departments.map(d=>`<option ${S.filters.dep===d.name?'selected':''}>${esc(d.name)}</option>`).join('')}</select>
    <select onchange="S.filters.stat=this.value;rr()" class="ui-select" style="width:auto"><option value="">Any status</option><option ${S.filters.stat==='Active'?'selected':''}>Active</option><option ${S.filters.stat==='Inactive'?'selected':''}>Inactive</option></select>
  </div>
  <div class="hidden md:block bg-white rounded-2xl border border-ink-100 shadow-soft overflow-hidden">
    <table class="w-full text-sm"><thead><tr class="text-[10px] text-ink-400 uppercase tracking-wide border-b border-ink-100 text-left"><th class="px-5 py-3 font-semibold">Name</th><th class="px-5 py-3 font-semibold">Department</th><th class="px-5 py-3 font-semibold">Role</th><th class="px-5 py-3 font-semibold">Reports to</th><th class="px-5 py-3 font-semibold">Status</th><th class="px-5 py-3"></th></tr></thead>
    <tbody class="divide-y divide-ink-50">${list.map(u=>{const mgr=u.managerId?uById(u.managerId):null;const isMgrUser=subTree(u.id).length>0;return`<tr class="hover:bg-ink-50/50"><td class="px-5 py-3"><div class="flex items-center gap-3">${avatar(u,'w-9 h-9','text-xs')}<div><div class="font-semibold">${esc(fullName(u))}</div><div class="text-xs text-ink-400">${esc(u.email)}</div></div></div></td><td class="px-5 py-3">${esc(u.department)}<div class="text-xs text-ink-400">${esc(u.position)}</div></td><td class="px-5 py-3">${u.role==='Admin'?'<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:#15171C;color:#fff">Super Admin</span>':u.role==='SubAdmin'?'<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:#EEF2FF;color:#4338CA">Admin</span>':isMgrUser?'<span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">Manager</span>':'<span class="text-xs text-ink-400">User</span>'}</td><td class="px-5 py-3 text-sm">${mgr?esc(fullName(mgr)):'<span class="text-ink-300">—</span>'}</td><td class="px-5 py-3">${chip(u.status)}</td><td class="px-5 py-3"><div class="flex gap-1 justify-end">${(_canEdit||_canDel)?`${_canEdit?`<button onclick="App.editUser('${u.id}')" style="width:32px;height:32px;display:grid;place-items:center;border-radius:8px;color:#9CA3AF;background:transparent;border:none;cursor:pointer" onmouseover="this.style.background='#F3F4F6'" onmouseout="this.style.background='transparent'">${ic('edit','w-4 h-4')}</button><button onclick="App.resetPw('${u.id}')" style="width:32px;height:32px;display:grid;place-items:center;border-radius:8px;color:#9CA3AF;background:transparent;border:none;cursor:pointer" onmouseover="this.style.background='#F3F4F6'" onmouseout="this.style.background='transparent'" title="Reset password">${ic('key','w-4 h-4')}</button>${_disableBtn(u)}`:''}${(_canDel&&u.role!=='Admin')?`<button onclick="App.delUser('${u.id}')" style="width:32px;height:32px;display:grid;place-items:center;border-radius:8px;color:#9CA3AF;background:transparent;border:none;cursor:pointer" onmouseover="this.style.background='#FFF1F2';this.style.color='#BE123C'" onmouseout="this.style.background='transparent';this.style.color='#9CA3AF'">${ic('trash','w-4 h-4')}</button>`:''}`:'<span class="text-ink-200">—</span>'}</div></td></tr>`;}).join('')}</tbody></table>
    ${list.length?'':empty('users','No users','')}
  </div>
  <div class="md:hidden space-y-2">${list.map(u=>{const mgr=u.managerId?uById(u.managerId):null;return`<div class="bg-white rounded-2xl border border-ink-100 shadow-soft p-4" ${_canEdit?`onclick="App.editUser('${u.id}')" style="cursor:pointer"`:''}>
    <div class="flex items-center gap-3">${avatar(u,'w-10 h-10','text-sm')}<div class="min-w-0 flex-1"><div class="font-semibold truncate">${esc(fullName(u))}</div><div class="text-xs text-ink-400">${esc(u.position)} · ${esc(u.department)}</div></div>${chip(u.status)}</div>
    ${mgr?`<div class="text-xs text-ink-400 mt-2.5 pt-2.5 border-t border-ink-50">Reports to <strong>${esc(fullName(mgr))}</strong></div>`:''}</div>`;}).join('')}</div>
</div>`;}
function _hrmUserSection(u){
  _ensureHrm(u||{hrm:{}});
  const h=(u&&u.hrm)||{schedule:{in:'09:00',out:'18:00',hours:9,workWeek:5,offDays:['Sun']},reportPerms:{}};
  const s=h.schedule||{in:'09:00',out:'18:00',hours:9,workWeek:5,offDays:['Sun']};
  const off=new Set(s.offDays||[]);
  return `<div class="bg-ink-50 rounded-2xl p-4 space-y-3"><p class="text-[10px] font-bold text-ink-400 uppercase tracking-wide">HRM — Attendance &amp; Leave</p>
    <div class="grid grid-cols-2 gap-3">${fld('Date of birth','u-dob',h.dob||'','date')}${fld('Joining date','u-join',h.joiningDate||'','date')}</div>
    <div class="grid grid-cols-3 gap-3">${fld('Clock-in','u-cin',s.in||'09:00','time')}${fld('Clock-out','u-cout',s.out||'18:00','time')}${fld('Total hours','u-chrs',s.hours??9,'number')}</div>
    <div>${selF('Work week','u-ww',[['5','5-day week'],['6','6-day week']],String(s.workWeek||5))}</div>
    ${selF('Office location (geofence)','u-loc',[['','— None —'],...DB.locations.filter(l=>l.status==='Active').map(l=>[l.id,l.name])],h.locationId||'')}
    <div><label class="block text-xs font-semibold text-ink-500 mb-1.5">Weekly off-days</label><div style="display:flex;gap:6px;flex-wrap:wrap">${DAYS3.map(d=>`<button type="button" class="dchip${off.has(d)?' on':''}" onclick="this.classList.toggle('on')" data-day="${d}">${d}</button>`).join('')}</div></div>
    ${mkTog('u-wfh',h.wfhEligible===true,'Eligible for Work-from-Home')}
    ${fld('Probation ends','u-probend',h.probationEnd||'','date')}
    ${can('payroll','view')?`<div style="border-top:1px dashed #E5E7EB;padding-top:10px"><p class="text-[10px] font-bold text-ink-400 uppercase tracking-wide mb-2">Payroll (visible to payroll roles only)</p>
      <div class="grid grid-cols-3 gap-3">${fld('Basic salary','u-salb',(h.salary||{}).basic??0,'number')}${fld('Allowances','u-sala',(h.salary||{}).allow??0,'number')}${fld('Currency','u-salc',(h.salary||{}).currency||'AED')}</div>
      <div class="mt-2">${fld('IBAN (for the WPS / bank file)','u-iban',h.iban||'')}</div></div>`:''}
  </div>`;
  /* perms v2: the HR toggle + role-profile picker moved to the Access Control tab. */
}
function _readHrmFromForm(prev){
  const g=i=>($('#'+i)?.value||'').trim();
  const offDays=$$('.dchip.on[data-day]').map(b=>b.dataset.day);
  const p=prev&&typeof prev==='object'?prev:{};
  return {
    // perms v2: HR flag, role profile and the baked toggle map are managed in Access Control —
    // preserve them verbatim here so saving a user's identity can never change their access.
    isHR:p.isHR===true,
    dob:g('u-dob')||null,
    joiningDate:g('u-join')||null,
    locationId:$('#u-loc')?.value||null,
    schedule:{in:g('u-cin')||'09:00',out:g('u-cout')||'18:00',hours:Number(g('u-chrs'))||9,workWeek:Number($('#u-ww')?.value)||5,offDays:offDays.length?offDays:[]},
    profileId:$('#u-prof')?.value||(DB.hrmConfig?.activeProfile||'UAE'),
    roleProfileId:p.roleProfileId||null,
    probationEnd:$('#u-probend')?($('#u-probend').value||null):(p.probationEnd??null),
    wfhEligible:$('#u-wfh')?togV('u-wfh'):(p.wfhEligible===true), // WFH eligibility (default: not eligible)
    assets:Array.isArray(p.assets)?p.assets:[], // asset records are managed by their own buttons — preserve verbatim on save

    salary:$('#u-salb')?{basic:parseFloat($('#u-salb').value)||0,allow:parseFloat($('#u-sala')?.value)||0,currency:($('#u-salc')?.value||'AED').trim()||'AED'}:(p.salary||{basic:0,allow:0,currency:'AED'}),
    iban:$('#u-iban')?($('#u-iban').value||'').trim():(p.iban||''),
    payrollHold:p.payrollHold===true,
    perms:(p.perms&&typeof p.perms==='object')?p.perms:undefined,
    permsBaked:p.permsBaked||0,
    reportPerms:(p.reportPerms&&typeof p.reportPerms==='object')?p.reportPerms:undefined
  };
}
/* ── ASSETS — company equipment assigned to a person (laptop, phone, access card…).
      Stored on u.hrm.assets (rides the user_hrm sync like personalDocs — no new table).
      Managed inline in the user editor; the employee sees a read-only list on their Profile.
      An 'Assigned' asset blocks user deletion (refcheck) until returned or removed. ── */
const ASSET_CATS=['Laptop','Phone','Monitor','Access card','SIM','Vehicle','Uniform','Tools','Other'];
function _assetsSection(u){
  if(!u)return'';
  if(!can('employees','edit')||!scopeFilter('employees')(u.id))return'';
  _ensureHrm(u);if(!Array.isArray(u.hrm.assets))u.hrm.assets=[];
  const list=u.hrm.assets.slice().sort((a,b)=>(b.assignedDate||'').localeCompare(a.assignedDate||''));
  const rows=list.length?list.map(a=>{
    const ret=a.status==='Returned';
    return'<div style="display:flex;align-items:center;gap:10px;background:#F6F7F8;border-radius:10px;padding:10px;flex-wrap:wrap">'
      +'<div style="flex:1;min-width:140px"><div style="font-size:13px;font-weight:600">'+esc(a.name)+'</div>'
      +'<div style="font-size:11px;color:#9CA3AF">'+esc(a.category||'Other')+(a.serial?' · '+esc(a.serial):'')+' · assigned '+fmtD(a.assignedDate||'')+(ret&&a.returnDate?' · returned '+fmtD(a.returnDate):'')+(a.notes?'<br>'+esc(a.notes):'')+'</div></div>'
      +'<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:'+(ret?'#F3F4F6':'#ECFDF5')+';color:'+(ret?'#6B7280':'#065F46')+';flex-shrink:0">'+(ret?'Returned':'Assigned')+'</span>'
      +(!ret?'<button type="button" onclick="App._assetReturn(\''+u.id+'\',\''+a.id+'\')" style="padding:5px 10px;border-radius:8px;border:1px solid #E5E7EB;background:#fff;font-size:12px;font-weight:600;cursor:pointer;flex-shrink:0">Mark returned</button>':'')
      +'<button type="button" onclick="App._assetDel(\''+u.id+'\',\''+a.id+'\')" style="width:28px;height:28px;display:grid;place-items:center;border-radius:8px;border:none;background:#FEF2F2;color:#DC2626;cursor:pointer;flex-shrink:0">'+ic('trash','w-3.5 h-3.5')+'</button>'
      +'</div>';
  }).join(''):'<p style="font-size:12px;color:#9CA3AF;text-align:center;padding:10px">No assets on record.</p>';
  return'<div id="assets-sec" style="border-top:1px solid #ECEDF0;margin-top:14px;padding-top:14px">'
    +'<p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9CA3AF;margin-bottom:8px">Assets assigned</p>'
    +'<div style="display:flex;flex-direction:column;gap:6px">'+rows+'</div>'
    +'<div style="background:#F9FAFB;border:1px dashed #E5E7EB;border-radius:12px;padding:10px;margin-top:8px">'
    +'<div class="grid grid-cols-1 sm:grid-cols-2 gap-2" style="margin-bottom:8px">'
    +'<input id="ast-n" placeholder="Asset name (e.g. MacBook Pro 14)" class="ui-input" style="font-size:13px"/>'
    +'<select id="ast-c" class="ui-select" style="font-size:13px">'+ASSET_CATS.map(c=>'<option>'+c+'</option>').join('')+'</select>'
    +'<input id="ast-s" placeholder="Serial / tag no. (optional)" class="ui-input" style="font-size:13px"/>'
    +'<input id="ast-d" type="date" value="'+todayISO()+'" class="ui-input" style="font-size:13px"/>'
    +'</div>'
    +'<input id="ast-no" placeholder="Condition & notes (optional)" class="ui-input" style="font-size:13px;margin-bottom:8px"/>'
    +'<button type="button" onclick="App._assetAdd(\''+u.id+'\')" class="ui-btn ui-btn-ghost ui-btn-sm" style="width:100%">'+ic('plus','w-3.5 h-3.5')+'Add asset</button>'
    +'</div></div>';
}
App._assetAdd=(userId)=>{
  const u=uById(userId);if(!u)return;
  if(!can('employees','edit')||!scopeFilter('employees')(userId)){toast('Not allowed','err');return;}
  const name=($('#ast-n')?.value||'').trim();
  if(!name){toast('Asset name required','err');return;}
  _ensureHrm(u);if(!Array.isArray(u.hrm.assets))u.hrm.assets=[];
  u.hrm.assets.push({id:uid('ast'),name,category:$('#ast-c')?.value||'Other',serial:($('#ast-s')?.value||'').trim(),assignedDate:$('#ast-d')?.value||todayISO(),notes:($('#ast-no')?.value||'').trim(),status:'Assigned',returnDate:null,assignedBy:S.uid,createdAt:new Date().toISOString()});
  log(fullName(me()),'Asset assigned',name+' → '+fullName(u));
  saveDB();toast('Asset added');
  if(document.getElementById('u-role'))App.editUser(userId);else rr();
};
App._assetReturn=(userId,assetId)=>{
  const u=uById(userId);if(!u)return;
  if(!can('employees','edit')||!scopeFilter('employees')(userId)){toast('Not allowed','err');return;}
  const a=(u.hrm?.assets||[]).find(x=>x.id===assetId);if(!a)return;
  a.status='Returned';a.returnDate=todayISO();
  log(fullName(me()),'Asset returned',a.name+' ← '+fullName(u));
  saveDB();toast('Marked returned');
  if(document.getElementById('u-role'))App.editUser(userId);else rr();
};
App._assetDel=(userId,assetId)=>{
  const u=uById(userId);if(!u)return;
  if(!can('employees','edit')||!scopeFilter('employees')(userId)){toast('Not allowed','err');return;}
  const a=(u.hrm?.assets||[]).find(x=>x.id===assetId);if(!a)return;
  if(!confirm('Remove "'+a.name+'" from '+fullName(u)+'\'s asset record?'))return;
  u.hrm.assets=(u.hrm.assets||[]).filter(x=>x.id!==assetId);
  log(fullName(me()),'Asset record removed',a.name+' ('+fullName(u)+')');
  saveDB();toast('Removed','warn');
  if(document.getElementById('u-role'))App.editUser(userId);else rr();
};
// City (location) scope checkboxes for the user modal — requirement #6.
function _cityScopeChips(u){
  const active=(DB.locations||[]).filter(l=>l.status==='Active');
  if(!active.length)return'<p style="font-size:12px;color:#9CA3AF">No cities/locations defined yet. Add them in the Locations tab.</p>';
  const sel=new Set(Array.isArray(u&&u.cities)?u.cities:[]);
  return'<div style="display:flex;flex-wrap:wrap;gap:8px">'+active.map(l=>`<label style="display:inline-flex;align-items:center;gap:6px;background:#fff;border:1.5px solid ${sel.has(l.id)?'#6EE7B7':'#E5E7EB'};border-radius:10px;padding:6px 11px;font-size:12px;font-weight:600;color:#374151;cursor:pointer"><input type="checkbox" class="city-chk" data-id="${esc(l.id)}" ${sel.has(l.id)?'checked':''} onchange="this.closest('label').style.borderColor=this.checked?'#6EE7B7':'#E5E7EB'"> ${esc(l.name)}</label>`).join('')+'</div>';
}

App.editUser=(id=null)=>{
  // SEC-2: re-check action + scope (buttons are hidden but the handler must not trust that).
  if(id){
    if(!can('employees','edit')||!scopeFilter('employees')(id)){toast('Not allowed','err');return;}
  }else if(!can('employees','create')){toast('Not allowed','err');return;}
  const u=id?uById(id):null;
  // ONE ROLE CONCEPT: the access role (Access Control → People) is the only role anyone sets.
  // The legacy base-role field is derived from it automatically and shown read-only here.
  const roleSelHtml=(()=>{const rid=u?.hrm?.roleProfileId;const rname=(DB.roleProfiles?.[rid]||{}).name||(u?roleLabel(u.role):'Basic Employee');
    return `<div><label class="block text-xs font-semibold text-ink-500 mb-1">Access role</label><div class="w-full bg-ink-50 border border-ink-200 rounded-xl px-3 py-2.5 text-sm text-ink-500">${esc(rname)}</div><input type="hidden" id="u-role" value="${esc(u?.role||'User')}"><p style="font-size:11px;color:#9CA3AF;margin-top:4px">Set in <strong>Access Control → People</strong> — one dropdown decides everything this person sees.</p></div>`;})();
  const mgrOpts=DB.users.filter(x=>!u||x.id!==u.id&&!isDesc(x.id,u.id));
  const v=(f,d='')=>esc(u?u[f]??d:d);
  modalShell({title:`${u?'Edit':'New'} user`,size:'max-w-2xl',
  body:`<div class="space-y-3">
    <div class="grid grid-cols-2 gap-3">${fld('First name','u-fn',v('firstName'))}${fld('Last name','u-ln',v('lastName'))}</div>
    <div class="grid grid-cols-2 gap-3">${fld('Email','u-email',v('email'),'email')}${fld('Phone','u-phone',v('phone'))}</div>
    <div class="grid grid-cols-2 gap-3">${fld('Position','u-pos',v('position'))}${selF('Department','u-dep',DB.departments.map(d=>d.name),u?.department||'')}</div>
    <div class="grid grid-cols-3 gap-3">${roleSelHtml}${selF('Status','u-status',['Active','Inactive'],u?.status||'Active')}<div><label for="u-mgr" class="block text-xs font-semibold text-ink-500 mb-1">Reports to</label>${can('employees','assignManager')
      ?`<select id="u-mgr" class="w-full bg-white border border-ink-200 rounded-xl px-3 py-2.5 text-sm rf"><option value="">— None —</option>${mgrOpts.map(m=>`<option value="${m.id}"${u?.managerId===m.id?' selected':''}>${esc(fullName(m))}</option>`).join('')}</select>`
      // C2: no assignManager permission → current manager read-only + hidden input so saveUser preserves it.
      :`<div class="w-full bg-ink-50 border border-ink-200 rounded-xl px-3 py-2.5 text-sm text-ink-500">${esc(u?.managerId?fullName(uById(u.managerId)):'— None —')}</div><input type="hidden" id="u-mgr" value="${esc(u?.managerId||'')}">`}</div></div>
    ${!u?fld('Password','u-pw','','password','Set a password'):''}
    <div class="bg-ink-50 rounded-2xl p-4"><p class="text-[10px] font-bold text-ink-400 uppercase tracking-wide mb-2">Notifications</p>${mkTog('u-em',u?.emailEnabled??true,'Receive email notifications')}</div>
    ${_hrmUserSection(u)}
    ${u?_personalDocsSection(u):''}
    ${u?_assetsSection(u):''}
    <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:14px;padding:12px 14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap"><p style="flex:1;min-width:200px;font-size:11.5px;color:#1E40AF;line-height:1.5;margin:0"><strong>All access &amp; permissions</strong> — tabs, submission rules, approvals, HR powers, document/city access — are managed per person in <strong>Access Control</strong>.</p>${(u&&can('accessControl','view'))?`<button type="button" onclick="App.closeModal();S.filters.acUser='${u.id}';App.go('accesscontrol')" class="ui-btn ui-btn-ghost ui-btn-sm">${ic('shield','w-4 h-4')}Open Access Control</button>`:''}</div>
  </div>`,
  footer:btnG('Cancel','App.closeModal()')+`<button type="button" id="save-user-btn" onclick="if(this.disabled)return;this.disabled=true;this.textContent=this.textContent==='Save'?'Saving…':'Creating…';App.saveUser('${id||''}').catch(()=>{}).finally(()=>{const b=document.getElementById('save-user-btn');if(b){b.disabled=false;b.textContent='${u?'Save':'Create'}';}})" class="ui-btn ui-btn-primary">${u?'Save':'Create'}</button>`});
};
App.saveUser=async(id)=>{
  // SEC-2: re-check action + scope before mutating (handler must not trust hidden buttons).
  if(id){
    if(!can('employees','edit')||!scopeFilter('employees')(id)){toast('Not allowed','err');return;}
  }else if(!can('employees','create')){toast('Not allowed','err');return;}
  const g=i=>($('#'+i)?.value||'').trim();
  const fn=g('u-fn'),ln=g('u-ln'),email=g('u-email');
  if(!fn||!ln||!email){toast('Name & email required','err');return;}
  const _existingU=id?uById(id):null;
  // C2: assignManager is a dedicated gate. If the user lacks it, preserve the existing manager
  //   (or force none on create) so a deep-link/console call can't re-parent someone out of scope.
  let mId=$('#u-mgr')?.value||null;
  if(!can('employees','assignManager')){
    const cur=_existingU?(_existingU.managerId||null):null;
    if((mId||null)!==(cur||null)){toast('Not permitted to change reporting manager','err');return;}
    mId=cur;
  }
  if(id&&mId&&(mId===id||isDesc(mId,id))){toast('Circular hierarchy!','err');return;}

  // ── Access (docAccess / questionsAccess) is now governed by Role profiles (Access Control tab).
  //    The per-user toggles were removed from this form, so preserve any existing values verbatim
  //    rather than reading them from the (now-absent) DOM controls. ──
  const docAccess=(_existingU&&_existingU.docAccess)?_existingU.docAccess:{departments:{},locations:{}};

  // ── Read ALL toggles and DOM values NOW, before any async/closeModal ──
  const questionsAccess=_existingU?(_existingU.questionsAccess??false):false;
  // Email notifications opt-in (requirement #4) — default on.
  const email_enabled=$('#u-em')?togV('u-em'):true;
  // City (location) access scope (requirement #6) — empty array = all cities.
  // perms v2: rules / approval / city access moved to Access Control — preserve existing values here.
  const cities=_existingU?(_existingU.cities||[]):[];
  const rules=_existingU?(_existingU.rules||{past:true,future:true,edit:true}):{past:true,future:true,edit:true};
  const approval_settings=_existingU?(_existingU.approval||{past:false,future:false,edited:false}):{past:false,future:false,edited:false};
  // HRM fields — stored locally on u.hrm ONLY, never added to the Supabase upsert payload (pd)
  const hrm=_readHrmFromForm(id?uById(id)?.hrm:null);
  // C2: assignRole is a dedicated gate (it grants permission BUNDLES → privilege escalation risk).
  //   If the user lacks it, preserve the existing role profile (or none on create) — never let the
  //   form value change who the target can act as.
  if(!can('employees','assignRole')){
    const curRP=_existingU?.hrm?.roleProfileId??null;
    if((hrm.roleProfileId||null)!==(curRP||null)){toast('Not permitted to assign a role profile','err');return;}
    hrm.roleProfileId=curRP;
  }

  // SEC-1: never let a non-Super-Admin assign or change an elevated role.
  // Non-admins: force role 'User' on create, and preserve the existing role on edit.
  // Also: only a Super Admin may change a Super Admin's role.
  const reqRole=$('#u-role')?.value||'User';
  const existing=id?uById(id):null;
  let role;
  if(isAdmin()){
    role=reqRole;
  }else if(id){
    // preserve existing role verbatim; non-admins can never touch role on edit
    role=existing?existing.role:'User';
  }else{
    role='User';
  }
  if(existing&&existing.role==='Admin'&&!isAdmin())role=existing.role; // can't demote a Super Admin
  if(!isAdmin()&&(role==='Admin'||role==='SubAdmin')&&(!existing||existing.role!==role)){toast('Not allowed','err');return;}
  const pd={first_name:fn,last_name:ln,email,
    phone:g('u-phone'),position:g('u-pos'),
    department:$('#u-dep')?.value,role,
    status:$('#u-status')?.value,manager_id:mId||null,
    rules,approval_settings,
    doc_access:docAccess,questions_access:questionsAccess,
    email_enabled,cities};

  if(id){
    // Update local state immediately
    const u=uById(id);
    // ── Manager change: record history so dashboards can scope by date ──
    // Rule: dates BEFORE the change belong to the old manager; the change date onwards belongs to the new one
    if(u&&(u.managerId||null)!==(mId||null)){
      const chDate=todayISO();
      let h=Array.isArray(u.managerHistory)?JSON.parse(JSON.stringify(u.managerHistory)):[];
      if(!h.length)h.push({managerId:u.managerId||null,from:'0001-01-01',to:chDate});
      else{const open=h.find(p=>!p.to);if(open)open.to=chDate;}
      h.push({managerId:mId||null,from:chDate,to:null});
      u.managerHistory=h;
      pd.manager_history=h;
    }
    const _roleChanged=u&&u.role!==pd.role;
    if(u)Object.assign(u,{firstName:fn,lastName:ln,email,
      phone:pd.phone,position:pd.position,department:pd.department,
      role:pd.role,status:pd.status,managerId:mId,
      rules,approval:approval_settings,
      questionsAccess,emailEnabled:email_enabled,cities,
      docAccess,hrm});
    // perms v3: a base-role change assigns the matching built-in access ROLE and clears
    // per-user overrides (fine-tune afterwards in Access Control).
    if(_roleChanged&&u){_ensureHrm(u);u.hrm.roleProfileId=_roleIdForUser(u);u.hrm.perms=null;u.hrm.permsV3=1;log(fullName(me()),'Access role assigned (base-role change)',fn+' '+ln+' → '+u.hrm.roleProfileId);}
    log(fullName(me()),'Edited user',fn+' '+ln);
    toast('Saved');closeModal();saveDB();render();
    // Sync all fields including doc_access to Supabase in background
    sb.from('profiles').update(pd).eq('id',id).then(({error})=>{
      if(error)_syncErr('user changes')(error);
    }).catch(_syncErr('user changes'));
  } else {
    const pw=g('u-pw');if(!pw){toast('Password required','err');return;}
    const saveBtn=document.querySelector('[onclick*="saveUser"]');
    if(saveBtn){saveBtn.disabled=true;saveBtn.textContent='Creating…';}
    toast('Creating user…','ok');
    const{data:res,error}=await sb.functions.invoke('create-user',{body:{...pd,password:pw}});
    if(error||res?.error){
      let msg=error?.message||res?.error||'Failed';
      try{if(error?.context){const b=await error.context.json();msg=b.error||msg;}}catch(e){}
      toast(msg,'err');
      if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='Create';}
      return;
    }
    const newId=res?.id||res?.user?.id;
    if(!newId){toast('User created — reload to see them','ok');closeModal();render();return;}
    DB.users.push(_ensureHrm({id:newId,firstName:fn,lastName:ln,email,
      phone:pd.phone,position:pd.position,department:pd.department,
      role:pd.role,status:pd.status,managerId:mId,
      rules:pd.rules,approval:pd.approval_settings,
      questionsAccess,emailEnabled:email_enabled,cities,
      docAccess,hrm,password:'***'}));
    (()=>{const nu=uById(newId);if(nu){_ensureHrm(nu);nu.hrm.roleProfileId=_roleIdForUser(nu);nu.hrm.permsV3=1;}})(); // perms v3: assign role
    // Save doc_access + questions_access + email/cities for new user
    sb.from('profiles').update({doc_access:docAccess,questions_access:questionsAccess,email_enabled,cities}).eq('id',newId).then(()=>{}).catch(()=>{});
    log(fullName(me()),'Created user',fn+' '+ln);
    toast(fn+' '+ln+' created');
    closeModal();saveDB();render();
  }
};
App.resetPw=(id)=>{
  // SEC-2: require employees.edit + target in scope.
  if(!can('employees','edit')||!scopeFilter('employees')(id)){toast('Not allowed','err');return;}
  const u=uById(id);
  modalShell({title:'Reset password',sub:'New password for '+fullName(u),size:'max-w-sm',
    body:fld('New password','rp-pw','','password',''),
    footer:btnG('Cancel','App.closeModal()')
      +'<button type="button" id="rp-btn" onclick="if(this.disabled)return;this.disabled=true;this.textContent=\'Resetting…\';App._doResetPw(this.dataset.uid).finally(()=>{const b=document.getElementById(\'rp-btn\');if(b){b.disabled=false;b.textContent=\'Reset\';}})" data-uid="'+id+'" class="ui-btn ui-btn-primary">Reset</button>'});
};
App._doResetPw=async(uid)=>{
  // SEC-2: re-check action + scope (this is the actual privileged call).
  if(!can('employees','edit')||!scopeFilter('employees')(uid)){toast('Not allowed','err');return;}
  const pw=$('#rp-pw')?.value?.trim();
  if(!pw){toast('Enter a password','err');return;}
  const{error}=await sb.functions.invoke('reset-password',{body:{user_id:uid,password:pw}});
  if(error){toast(error.message,'err');return;}
  log(fullName(me()),'Reset password',fullName(uById(uid)));
  toast('Password reset');closeModal();
};
App.togUser=(id)=>{
  const u=uById(id);if(!u)return;
  // SEC-2/C2: require employees.deactivate (dedicated gate) + target in scope; never disable a Super Admin unless Super Admin.
  if(!can('employees','deactivate')||!scopeFilter('employees')(id)){toast('Not permitted','err');return;}
  if(u.role==='Admin'&&!isAdmin()){toast('Not permitted','err');return;}
  const enabling=u.status!=='Active';
  u.status=enabling?'Active':'Inactive';
  // M8: deactivating an employee must not strand their Pending leave / leak the reserved `pending` balance.
  if(!enabling){
    let released=0;
    (DB.leaveRequests||[]).filter(r=>r.userId===id&&r.status==='Pending').forEach(r=>{
      // DATA-2: release against the SAME balance row the reservation was placed on.
      if(!r.unpaid){const b=_balanceFor(r.userId,r.leaveTypeId,r.leaveYear||_leaveYearOf(u,r.start));b.pending=_r2(Math.max(0,(b.pending||0)-r.workingDays));}
      r.status='Rejected';r.hrNote='Auto-rejected — employee deactivated';released++;
    });
    if(released)hlog('Leave auto-rejected on deactivation',fullName(u)+' ('+released+')');
  }
  saveDB();render();
  toast(fullName(u)+' '+(enabling?'enabled':'disabled'),enabling?'ok':'warn');
  sb.from('profiles').update({status:u.status}).eq('id',id).then(({error})=>{if(error)_syncErr(enabling?'enable':'disable')(error);}).catch(_syncErr(enabling?'enable':'disable'));
};
App.delUser=async(id)=>{
  const u=uById(id);if(!u)return;
  // SEC-2: require employees.delete + target in scope; never delete a Super Admin unless Super Admin.
  if(!can('employees','delete')||!scopeFilter('employees')(id)){toast('Not allowed','err');return;}
  if(u.role==='Admin'&&!isAdmin()){toast('Not allowed','err');return;}
  const name=fullName(u);
  // Referential-integrity guard: block while they still have live links (direct reports, assigned
  // checklists/OKRs/assets, pending approvals/leave/letters/expenses, upcoming shifts, open flows,
  // open payroll). Pure history never blocks — Disable is the way to retire someone.
  if(!guardDelete('user',id,name))return;
  if(!confirm('Permanently delete '+name+'?\n\nThis will delete ALL their submissions and approvals. This cannot be undone.\n\nTo keep their data, use Disable instead.'))return;
  // Optimistic local cleanup first
  DB.users.filter(x=>x.managerId===id).forEach(x=>x.managerId=u.managerId);
  if(!DB.users_deleted)DB.users_deleted=[];
  if(!DB.users_deleted.includes(id))DB.users_deleted.push(id);
  DB.users=DB.users.filter(x=>x.id!==id);
  DB.checklists.forEach(c=>c.assignees=(c.assignees||[]).filter(a=>a!==id));
  DB.submissions=DB.submissions.filter(s=>s.userId!==id);
  DB.approvals=DB.approvals.filter(a=>a.requesterId!==id);
  DB.notifications=DB.notifications.filter(n=>n.userId!==id);
  DB.feedback=(DB.feedback||[]).filter(f=>f.userId!==id&&f.managerId!==id);
  // N2: also prune the deleted user's HRM data so their pending leave doesn't linger in
  // approver queues and their reserved balances/attendance/expenses/shifts/SOPs don't leak.
  DB.leaveRequests=(DB.leaveRequests||[]).filter(r=>r.userId!==id);
  DB.leaveBalances=(DB.leaveBalances||[]).filter(b=>b.userId!==id);
  DB.attendance=(DB.attendance||[]).filter(a=>a.userId!==id);
  DB.expenses=(DB.expenses||[]).filter(x=>x.userId!==id);
  DB.shifts=(DB.shifts||[]).filter(s=>s.userId!==id);
  DB.sopInstances=(DB.sopInstances||[]).filter(i=>i.userId!==id);
  // FIX: If ex-manager now has 0 direct reports, downgrade to User
  if(u.managerId){
    const exMgr=uById(u.managerId);
    if(exMgr&&exMgr.role==='Manager'){
      const stillHasTeam=DB.users.some(x=>x.managerId===exMgr.id);
      if(!stillHasTeam){
        exMgr.role='User';
        sb.from('profiles').update({role:'User'}).eq('id',exMgr.id).then(()=>{}).catch(()=>{});
        toast(fullName(exMgr)+' has no team — role changed to User','warn');
      }
    }
  }
  log(fullName(me()),'Deleted user',name);
  toast(name+' deleted','warn');
  render();saveDB();
  // Background Supabase deletion of all related data
  Promise.all([
    sb.from('submissions').delete().eq('user_id',id),
    sb.from('approvals').delete().eq('requester_id',id),
    sb.from('notifications').delete().eq('user_id',id),
    sb.from('feedback').delete().eq('user_id',id),
    sb.from('leave_requests').delete().eq('user_id',id),
    sb.from('leave_balances').delete().eq('user_id',id),
    sb.from('attendance').delete().eq('user_id',id),
    sb.from('expenses').delete().eq('user_id',id),
    sb.from('shifts').delete().eq('user_id',id),
    sb.from('sop_instances').delete().eq('user_id',id),
    sb.from('profiles').delete().eq('id',id),
  ]).then(()=>{}).catch(e=>console.warn('delUser cleanup:',e));
};

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window._disableBtn=_disableBtn;window.usersPage=usersPage;window._hrmUserSection=_hrmUserSection;window._readHrmFromForm=_readHrmFromForm;window._cityScopeChips=_cityScopeChips;window.ASSET_CATS=ASSET_CATS;window._assetsSection=_assetsSection;
