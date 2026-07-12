

App._clearOperational=()=>{
  const cats=[
    {key:'submissions',  label:'Submissions',    icon:'check', desc:'All checklist submission records',    count:()=>DB.submissions.length},
    {key:'checklists',   label:'Checklists',     icon:'list', desc:'All checklist configurations',        count:()=>DB.checklists.length},
    {key:'tickets',      label:'Tickets',        icon:'ticket', desc:'All escalation tickets',              count:()=>(DB.tickets||[]).length},
    {key:'approvals',    label:'Approvals',      icon:'approve', desc:'All approval requests',               count:()=>DB.approvals.length},
    {key:'notifications',label:'Notifications',  icon:'bell', desc:'All in-app notifications',            count:()=>DB.notifications.length},
    {key:'feedback',     label:'Feedback',       icon:'msg', desc:'All manager feedback',                count:()=>(DB.feedback||[]).length},
    {key:'questions',    label:'Questions',      icon:'help', desc:'Question library',                    count:()=>(DB.questions||[]).length},
    {key:'documents',    label:'Documents',      icon:'doc', desc:'Documents and folders',               count:()=>(DB.documents||[]).length},
    {key:'audit',        label:'Audit logs',     icon:'audit', desc:'System audit trail',                  count:()=>(DB.audit||[]).length},
    {key:'users',        label:'Users (except you)', icon:'users', desc:'All user accounts except yours', count:()=>DB.users.filter(u=>u.id!==S.uid).length},
  ];
  const rows=cats.map(cat=>{
    const n=cat.count();
    return '<label id="lbl-clr-'+cat.key+'" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:12px;cursor:pointer;border:1.5px solid #F3F4F6;margin-bottom:6px;transition:all .12s" onmouseover="this.style.background=\'#FAFAFA\'" onmouseout="this.style.background=\'\'">'
      +'<input type="checkbox" id="clr-'+cat.key+'" onchange="this.closest(\'label\').style.borderColor=this.checked?\'#EF4444\':\'#F3F4F6\'" style="width:17px;height:17px;accent-color:#EF4444;cursor:pointer;flex-shrink:0"/>'
      +'<span style="display:grid;place-items:center;color:#6B7280;flex-shrink:0">'+ic(cat.icon,'w-5 h-5')+'</span>'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-size:13px;font-weight:700;color:#15171C">'+cat.label+'</div>'
      +'<div style="font-size:11px;color:#9CA3AF;margin-top:1px">'+cat.desc+'</div>'
      +'</div>'
      +'<span style="font-size:12px;font-weight:800;background:'+(n?'#FEF2F2':'#F6F7F8')+';color:'+(n?'#DC2626':'#9CA3AF')+';padding:3px 9px;border-radius:20px;flex-shrink:0">'+n+' records</span>'
      +'</label>';
  }).join('');

  openModal(
    '<div style="display:flex;flex-direction:column;max-height:88vh">'
    +'<div style="padding:18px 20px 14px;border-bottom:1px solid #F3F4F6;flex-shrink:0">'
    +'<div style="display:flex;align-items:center;justify-content:space-between">'
    +'<div><div style="display:flex;align-items:center;gap:7px;font-size:17px;font-weight:800;font-family:var(--font-display)">'+ic('broom','w-5 h-5')+'Clear Data</div>'
    +'<div style="font-size:12px;color:#9CA3AF;margin-top:2px">Select categories to permanently delete</div></div>'
    +'<button onclick="App.closeModal()" style="width:28px;height:28px;display:grid;place-items:center;border-radius:8px;border:none;background:transparent;cursor:pointer;color:#9CA3AF">'+ic('x')+'</button>'
    +'</div>'
    +'<div style="display:flex;gap:8px;margin-top:12px">'
    +'<button onclick="document.querySelectorAll(\'[id^=clr-]\').forEach(c=>{c.checked=true;document.getElementById(\'lbl-\'+c.id).style.borderColor=\'#EF4444\';})" style="padding:5px 14px;border-radius:8px;border:1.5px solid #E5E7EB;background:#fff;font-size:12px;font-weight:600;cursor:pointer">Select all</button>'
    +'<button onclick="document.querySelectorAll(\'[id^=clr-]\').forEach(c=>{c.checked=false;document.getElementById(\'lbl-\'+c.id).style.borderColor=\'#F3F4F6\';})" style="padding:5px 14px;border-radius:8px;border:1.5px solid #E5E7EB;background:#fff;font-size:12px;font-weight:600;cursor:pointer">Deselect all</button>'
    +'</div>'
    +'</div>'
    +'<div style="overflow-y:auto;flex:1;padding:14px 20px">'+rows+'</div>'
    +'<div style="padding:14px 20px;border-top:1px solid #F3F4F6;flex-shrink:0;display:flex;gap:10px">'
    +'<button onclick="App.closeModal()" style="flex:1;padding:12px;border-radius:12px;border:1.5px solid #E5E7EB;background:#fff;font-weight:600;font-size:14px;cursor:pointer">Cancel</button>'
    +'<button onclick="App._execClear()" style="flex:2;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:12px;border-radius:12px;background:#EF4444;color:#fff;font-weight:700;font-size:14px;border:none;cursor:pointer">'+ic('trash','w-4 h-4')+'Delete selected</button>'
    +'</div>'
    +'</div>',
    'max-w-md'
  );
};

App._execClear=async()=>{
  const catMap={
    submissions: {local:()=>{DB.submissions=[];Object.keys(RUN).forEach(k=>delete RUN[k]);},table:'submissions'},
    checklists:  {local:()=>{DB.checklists=[];DB.checklists_deleted=[];},table:'checklists'},
    tickets:     {local:()=>{DB.tickets=[];},table:'tickets'},
    approvals:   {local:()=>{DB.approvals=[];},table:'approvals'},
    notifications:{local:()=>{DB.notifications=[];_invalidateNotifCache();},table:'notifications'},
    feedback:    {local:()=>{DB.feedback=[];},table:'feedback'},
    questions:   {local:()=>{DB.questions=[];DB.questions_deleted=[];},table:'questions'},
    documents:   {local:()=>{DB.documents=[];DB.folders=[];DB.documents_deleted=[];DB.folders_deleted=[];},table:'documents'},
    audit:       {local:()=>{DB.audit=[];},table:'audit_logs'},
    users:       {local:()=>{DB.users=DB.users.filter(u=>u.id===S.uid);},table:'profiles'},
  };
  const sel=Object.keys(catMap).filter(k=>document.getElementById('clr-'+k)?.checked);
  if(!sel.length){toast('Select at least one category','warn');return;}
  const labels=sel.map(k=>catMap[k].table).join(', ');
  if(!confirm('Permanently delete: '+labels+'?\n\nThis cannot be undone.'))return;
  closeModal();
  // Local deletion
  sel.forEach(k=>catMap[k].local());
  // Supabase deletion in background
  await Promise.allSettled(
    sel.map(k=>sb.from(catMap[k].table).delete().neq('id','00000000-0000-0000-0000-000000000000').then(()=>{}).catch(()=>{}))
  );
  log(fullName(me()),'Cleared data',labels);
  toast('Deleted: '+sel.length+' categor'+(sel.length===1?'y':'ies')+'','ok');
  saveDB();S.route='dashboard';render();
};

// ── Notification Settings (NS) — stored in workspace_settings table ──
const NS_LS='shiftly_ns_v2';

// Default templates — subject + body for every event type
// Variables: {{user_name}} {{checklist_name}} {{date}} {{status}} {{manager_name}} {{action_url}} {{app_url}}
const EMAIL_EVENTS=[
  {key:'checklist_assigned',label:'Checklist assigned',  vars:'{{user_name}}, {{checklist_name}}, {{action_url}}'},
  {key:'submission_late',  label:'Submission late',       vars:'{{user_name}}, {{checklist_name}}, {{action_url}}'},
  {key:'submission_approved',label:'Submission approved',vars:'{{user_name}}, {{checklist_name}}, {{action_url}}'},
  {key:'submission_rejected',label:'Submission rejected',vars:'{{user_name}}, {{checklist_name}}, {{action_url}}'},
  {key:'approval_requested',label:'Approval requested',  vars:'{{user_name}}, {{checklist_name}}, {{action_url}}'},
  {key:'approval_decided', label:'Approval decided',     vars:'{{user_name}}, {{checklist_name}}, {{action_url}}'},
  {key:'feedback_received',label:'Feedback received',    vars:'{{user_name}}, {{checklist_name}}, {{action_url}}'},
  {key:'deadline_reminder',label:'Deadline reminder',    vars:'{{user_name}}, {{checklist_name}}, {{action_url}}'},
  {key:'escalation',       label:'Escalation raised',    vars:'{{submitter}}, {{checklist_name}}, {{question}}, {{answer}}, {{action_url}}'},
  {key:'announcement',     label:'Announcement',         vars:'{{title}}, {{body}}, {{action_url}}'},
  // ── HRM (Attendance & Leave) templates — gated by the HR-email master switch + per-event toggle. ──
  {key:'hrm_leave_submitted',label:'HR · Leave — approval needed',vars:'{{approver_name}}, {{user_name}}, {{leave_type}}, {{start_date}}, {{end_date}}, {{working_days}}, {{reason}}, {{action_url}}'},
  {key:'hrm_leave_approved', label:'HR · Leave — approved',       vars:'{{user_name}}, {{leave_type}}, {{start_date}}, {{end_date}}, {{working_days}}, {{approver_name}}, {{balance}}, {{action_url}}'},
  {key:'hrm_leave_rejected', label:'HR · Leave — rejected',       vars:'{{user_name}}, {{leave_type}}, {{start_date}}, {{end_date}}, {{approver_name}}, {{reason}}, {{action_url}}'},
  {key:'hrm_leave_escalated',label:'HR · Leave — escalated',      vars:'{{user_name}}, {{leave_type}}, {{start_date}}, {{end_date}}, {{working_days}}, {{action_url}}'},
  {key:'review_cycle_opened',label:'Reviews · Cycle opened',     vars:'{{user_name}}, {{cycle_name}}, {{end_date}}, {{action_url}}'},
  {key:'review_results_ready',label:'Reviews · Results ready',   vars:'{{user_name}}, {{cycle_name}}, {{action_url}}'},
  {key:'hrm_late',           label:'HR · Attendance — late',      vars:'{{user_name}}, {{date}}, {{time}}, {{action_url}}'},
  {key:'hrm_early',          label:'HR · Attendance — early out', vars:'{{user_name}}, {{date}}, {{time}}, {{action_url}}'},
  {key:'hrm_auto_closed',    label:'HR · Attendance — missed clock-out',vars:'{{user_name}}, {{date}}, {{action_url}}'},
  {key:'hrm_comp_off',       label:'HR · Comp-off granted',       vars:'{{user_name}}, {{days}}, {{reason}}, {{expiry}}, {{approver_name}}, {{action_url}}'},
];

function _defaultTemplates(){
  return{
    checklist_assigned:{subject:'📋 Checklist assigned: {{checklist_name}}',   body:'Hi {{user_name}},\n\nA checklist has been assigned to you: {{checklist_name}}\n\nOpen Evarca to complete it.\n\n{{action_url}}'},
    submission_late:  {subject:'⏰ Overdue checklist: {{checklist_name}}',        body:'Hi {{user_name}},\n\n{{employee_name}} has not submitted "{{checklist_name}}" and the deadline has now passed. Please follow up.\n\n{{action_url}}'},
    submission_approved:{subject:'✅ Submission approved: {{checklist_name}}',  body:'Hi {{user_name}},\n\nYour submission for {{checklist_name}} has been approved.\n\n{{action_url}}'},
    submission_rejected:{subject:'❌ Submission rejected: {{checklist_name}}',  body:'Hi {{user_name}},\n\nYour submission for {{checklist_name}} has been rejected. Please review and resubmit.\n\n{{action_url}}'},
    approval_requested:{subject:'🔔 Approval needed: {{checklist_name}}',      body:'Hi {{user_name}},\n\nAn approval is pending for {{checklist_name}}.\n\n{{action_url}}'},
    approval_decided: {subject:'Approval update: {{checklist_name}}',          body:'Hi {{user_name}},\n\nYour approval request for {{checklist_name}} has been decided.\n\n{{action_url}}'},
    feedback_received:{subject:'💬 New feedback received',                      body:'Hi {{user_name}},\n\nYou have received new feedback on {{checklist_name}}.\n\n{{action_url}}'},
    deadline_reminder:{subject:'⏳ Reminder: {{checklist_name}} deadline soon', body:'Hi {{user_name}},\n\nYour checklist {{checklist_name}} deadline is approaching soon. Please complete it before the cutoff.\n\n{{action_url}}'},
    escalation:{subject:'⚠️ Escalation: {{checklist_name}}',                    body:'An escalation was raised on {{checklist_name}}.\n\nQuestion: {{question}}\nAnswer: {{answer}}\nRaised by: {{submitter}}\n\nOpen Evarca to follow up.\n\n{{action_url}}'},
    announcement:{subject:'📣 {{title}}',                                       body:'{{body}}\n\n{{action_url}}'},
    // ── HRM templates — consistent subject + clean body with resolved variables. ──
    hrm_leave_submitted:{subject:'🔔 Leave approval needed: {{user_name}} — {{leave_type}}',
      body:'Hi {{approver_name}},\n\n{{user_name}} has requested {{leave_type}} and needs your approval.\n\nDates: {{start_date}} → {{end_date}} ({{working_days}})\nReason: {{reason}}\n\nReview and decide in Evarca.\n\n{{action_url}}'},
    hrm_leave_approved:{subject:'✅ Leave approved: {{leave_type}} ({{start_date}} → {{end_date}})',
      body:'Hi {{user_name}},\n\nYour {{leave_type}} request has been approved.\n\nDates: {{start_date}} → {{end_date}} ({{working_days}})\nApproved by: {{approver_name}}\nRemaining balance: {{balance}}\n\n{{action_url}}'},
    hrm_leave_rejected:{subject:'❌ Leave rejected: {{leave_type}} ({{start_date}} → {{end_date}})',
      body:'Hi {{user_name}},\n\nYour {{leave_type}} request for {{start_date}} → {{end_date}} was not approved.\n\nDecided by: {{approver_name}}\nReason: {{reason}}\n\nPlease reach out to your approver if you have questions.\n\n{{action_url}}'},
    review_cycle_opened:{subject:'⭐ Review cycle open: {{cycle_name}}',
      body:'Hi {{user_name}},\n\nThe review cycle "{{cycle_name}}" is open — please fill in your review(s) before {{end_date}}.\n\nOpen Evarca: {{action_url}}'},
    review_results_ready:{subject:'⭐ Your review results are ready — {{cycle_name}}',
      body:'Hi {{user_name}},\n\nYour results for "{{cycle_name}}" are now visible in the Reviews tab.\n\nOpen Evarca: {{action_url}}'},
    hrm_leave_escalated:{subject:'⚠️ Leave needs review: {{user_name}} — {{leave_type}}',
      body:'Hi,\n\n{{user_name}}\'s {{leave_type}} request ({{start_date}} → {{end_date}}, {{working_days}}) has no configured approver and has been escalated to HR / Admin for review.\n\n{{action_url}}'},
    hrm_late:{subject:'⚠️ Late clock-in on {{date}}',
      body:'Hi {{user_name}},\n\nOur records show you clocked in late at {{time}} on {{date}}.\n\nIf this is incorrect, please contact HR.\n\n{{action_url}}'},
    hrm_early:{subject:'⚠️ Early clock-out on {{date}}',
      body:'Hi {{user_name}},\n\nOur records show you clocked out early at {{time}} on {{date}}.\n\nIf this is incorrect, please contact HR.\n\n{{action_url}}'},
    hrm_auto_closed:{subject:'⏱ Missed clock-out on {{date}}',
      body:'Hi {{user_name}},\n\nYou didn\'t clock out on {{date}}, so your shift was auto-closed at midnight. Please remember to clock out at the end of your shift.\n\n{{action_url}}'},
    hrm_comp_off:{subject:'🎁 Comp-off granted: {{days}}',
      body:'Hi {{user_name}},\n\nYou\'ve been granted {{days}} of comp-off leave.\n\nReason: {{reason}}\nExpiry: {{expiry}}\nGranted by: {{approver_name}}\n\n{{action_url}}'},
  };
}

function _nsDefault(){return{
  email_enabled:false,email_from_name:'Evarca',email_from_address:'',email_reminder_minutes:15,
  inapp_checklist_assigned:true,inapp_submission_submitted:true,
  inapp_submission_late:true,inapp_submission_approved:true,inapp_submission_rejected:true,
  inapp_approval_requested:true,inapp_approval_decided:true,
  inapp_feedback_received:true,inapp_deadline_reminder:true,
  email_checklist_assigned:true,email_submission_submitted:false,
  email_submission_late:true,email_submission_approved:true,email_submission_rejected:true,
  email_approval_requested:true,email_approval_decided:true,
  email_feedback_received:false,email_deadline_reminder:true,email_escalation:true,
  templates:{},
};}
window._ns=null;
async function _loadNS(){
  if(_ns)return _ns;
  try{const r=localStorage.getItem(NS_LS);if(r)_ns={..._nsDefault(),...JSON.parse(r)};}catch(e){}
  if(!_ns)_ns=_nsDefault();
  try{const{data,error:wsErr}=await sb.from('workspace_settings').select('value').eq('key','notification_settings').single();
      if(wsErr&&(wsErr.code==='42P01'||wsErr.message?.includes('does not exist'))){console.warn('workspace_settings table missing — using defaults');return _ns;}
    if(data?.value){
      const saved=data.value;
      _ns={..._nsDefault(),...saved};
      // Deep-merge templates — spread would overwrite entire templates obj with saved one, which is correct
      // but if saved has no templates key at all, restore empty object
      if(!_ns.templates)_ns.templates={};
      localStorage.setItem(NS_LS,JSON.stringify(_ns));
    }}catch(e){}
  return _ns;
}
async function _saveNS(){
  if(!_ns)return;
  localStorage.setItem(NS_LS,JSON.stringify(_ns));
  try{await sb.from('workspace_settings').upsert({key:'notification_settings',value:_ns,updated_at:new Date().toISOString()},{onConflict:'key'});}catch(e){console.warn('NS sync:',e.message);}
}

// ── Resolve template variables ──
function _fillTemplate(str, vars){
  return str.replace(/\{\{(\w+)\}\}/g,(_,k)=>vars[k]||'');
}

// ── Render plain text body as HTML — {{action_url}} line becomes a CTA button ──
function _bodyToHtml(fromName, bodyText, actionUrl=''){
  const safeName=String(fromName||'Evarca').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
  const rawLines = bodyText.split('\n').map(l=>l.trim());
  // ctaUrl is passed in as 3rd arg — already the resolved URL
  let ctaUrl = actionUrl||'';
  // Strip: the {{action_url}} placeholder, the resolved URL itself (already a button), and any bare https line
  const lines = rawLines
    .filter(l=>l!=='{{action_url}}' && l!==ctaUrl && !/^https?:\/\//.test(l))
    .map(l=>l.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c])));
  const ctaLabel=ctaUrl.includes('approvals')?'View Approvals'
    :ctaUrl.includes('mychecklists')?'Open My Checklists'
    :ctaUrl.includes('notifications')?'View Notifications'
    :ctaUrl.includes('settings')?'Open Settings'
    :ctaUrl.includes('analytics')?'View Analytics'
    :ctaUrl.includes('leave')?'View Leave'
    :ctaUrl.includes('attendance')?'View Attendance'
    :'Open Evarca';
  return`<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F7F6F2;font-family:sans-serif">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;border:1px solid #ECEDF0;overflow:hidden">
    <div style="background:#15171C;padding:20px 28px;display:flex;align-items:center;gap:10px">
      <div style="width:28px;height:28px;border-radius:8px;background:#0E9F6E;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:#fff">B</div>
      <span style="font-weight:700;font-size:16px;color:#fff">${safeName}</span>
    </div>
    <div style="padding:28px">
      ${lines.filter(Boolean).map((l,i)=>i===0
        ?`<p style="font-size:15px;color:#374151;margin:0 0 16px">${l}</p>`
        :`<p style="font-size:14px;color:#6B7280;margin:0 0 8px;line-height:1.6">${l}</p>`
      ).join('')}
      ${ctaUrl?`<div style="margin-top:24px">
        <a href="${ctaUrl}" style="display:inline-block;background:#15171C;color:#fff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none">${ctaLabel} →</a>
        <p style="margin:10px 0 0;font-size:11px;color:#B8B5AC">Or copy: ${ctaUrl}</p>
      </div>`:''}
    </div>
    <div style="padding:16px 28px;background:#F9F8F5;border-top:1px solid #ECEDF0;font-size:11px;color:#9CA3AF">
      ${safeName} · Automated notification · Do not reply
    </div>
  </div></body></html>`;
}

// ── sendEmail: FAST — calls edge function directly, no queue, no extra DB round trip ──
async function sendEmail(eventType, userId, vars){
  const user = userId ? uById(userId) : null;
  if(!user?.email){console.warn('sendEmail: no email for user',userId);return;}
  // Requirement #4: per-user opt-out — skip if this user has email notifications turned off.
  if(user.emailEnabled===false){console.log('sendEmail: user opted out of emails',userId);return;}
  if(!_ns) await _loadNS();
  if(!_ns.email_enabled) return;
  if(_ns['email_'+eventType]===false) return;
  // Build app URL from current window location
  const appUrl = window.location.origin;
  // Each event type links to the most relevant page
  const routeMap = {
    checklist_assigned:'mychecklists',
    submission_late:'teamview', submission_approved:'mychecklists',
    submission_rejected:'mychecklists', approval_requested:'approvals',
    approval_decided:'mychecklists', /* employee-facing: their submission result lives in My Checklists */ feedback_received:'notifications',
    deadline_reminder:'mychecklists', escalation:'tickets', announcement:'announcements',
    // HRM: approval-needed → approvals; everything else for the employee → leave page.
    hrm_leave_submitted:'approvals', hrm_leave_escalated:'approvals',
    review_cycle_opened:'reviews', review_results_ready:'reviews',
    hrm_leave_approved:'leave', hrm_leave_rejected:'leave', hrm_comp_off:'leave',
    hrm_late:'attendance', hrm_early:'attendance', hrm_auto_closed:'attendance',
  };
  const actionUrl = appUrl + '/#' + (routeMap[eventType]||'');
  const allVars = {user_name:fullName(user), from_name:_ns.email_from_name||'Evarca', app_url:appUrl, action_url:actionUrl, ...vars};
  const defaults = _defaultTemplates();
  const tpl = {
    subject:(_ns.templates?.[eventType]?.subject)||defaults[eventType]?.subject||eventType,
    body:   (_ns.templates?.[eventType]?.body)   ||defaults[eventType]?.body   ||'',
  };
  const subject  = _fillTemplate(tpl.subject, allVars);
  const bodyHtml = _bodyToHtml(_ns.email_from_name, _fillTemplate(tpl.body, allVars), actionUrl);
  sb.functions.invoke('send-notification',{body:{
    to:user.email, from_name:_ns.email_from_name||'Evarca', subject, html:bodyHtml,
  }}).catch(e=>console.warn('sendEmail invoke failed:',e.message));
}


function _nsTogRow(key,label,desc){
  const on=_ns?(_ns[key]!==false):true;
  return`<div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid #F5F4F0">
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:600;color:#15171C">${label}</div>
      ${desc?`<div style="font-size:11px;color:#B8B5AC;margin-top:1px">${desc}</div>`:''}
    </div>
    <button role="switch" aria-checked="${on?'true':'false'}" aria-label="${esc(label)}" class="tog ${on?'on':'off'}" onclick="App._nsTog(this,'${key}')"><span></span></button>
  </div>`;}
App._nsTog=async(btn,key)=>{
  if(!_ns)_ns=_nsDefault();
  const nowOn=btn.classList.contains('off');
  btn.classList.toggle('on',nowOn);btn.classList.toggle('off',!nowOn);
  btn.setAttribute('aria-checked',nowOn?'true':'false');
  _ns[key]=nowOn;await _saveNS();
};
App._nsSaveEmail=async()=>{
  if(!_ns)_ns=_nsDefault();
  const name=($('#ns-from-name')?.value||'').trim();
  const addr=($('#ns-from-addr')?.value||'').trim();
  const mins=parseInt($('#ns-reminder-mins')?.value||'15',10)||15;
  if(!addr){toast('Enter a from email address','err');return;}
  if(!addr.includes('@')){toast('Enter a valid email address','err');return;}
  _ns.email_from_name=name||'Evarca';_ns.email_from_address=addr;
  _ns.email_reminder_minutes=Math.max(5,Math.min(120,mins));
  await _saveNS();toast('Saved');
};
App._testEmail=async()=>{
  if(!_ns) await _loadNS();
  const u=me();
  if(!u?.email){toast('Your user profile has no email address','err');return;}
  const btn=document.getElementById('ns-test-btn');
  if(btn){btn.disabled=true;btn.textContent='Sending…';}
  try{
    const appUrl=window.location.origin;
    const {error}=await sb.functions.invoke('send-notification',{body:{
      to: u.email,
      from_name: _ns.email_from_name||'Evarca',
      subject: '✅ Evarca test email',
      html: _bodyToHtml(_ns.email_from_name||'Evarca',
        'Hi '+u.firstName+',\n\nThis is a test email from Evarca.\n\nIf you received this, your email setup is working correctly. SMTP is connected and emails will be delivered to users based on their profile email address.',
        appUrl+'/#mychecklists'),
    }});
    if(error)throw new Error(error.message||'Function error');
    toast('Test email sent to '+u.email+'','ok');
  }catch(e){
    toast('Failed: '+e.message,'err');
    console.error('Test email error:',e);
  }finally{
    if(btn){btn.disabled=false;btn.textContent='Send test email';}
  }
};


function settingsPage(){
  // Workflow tab removed — its 4 toggles were never read by any code. Approval/edit behavior is
  // governed per-checklist and by Access Control. Stale stab==='workflow' falls back to 'inapp'.
  const stab=(S.filters.stab&&S.filters.stab!=='workflow')?S.filters.stab:'inapp';
  if(!_ns){_loadNS().then(()=>rr());return`<div class="fade">${hdr('Settings','')}${loadingState('Loading settings…')}</div>`;}
  const ns=_ns;
  const TABS=[['inapp','In-App'],['email','Email']];
  if(can('settings','edit'))TABS.push(['hrmemail','HR Email']); // §4 (FRONTEND-ONLY prefs)
  TABS.push(['templates','Templates']);
  const tabBar=`<div class="ui-tabs" style="margin-bottom:20px">${TABS.map(([k,ll])=>`<button class="ui-tab${stab===k?' on':''}" onclick="App._setSTab('${k}')">${ll}</button>`).join('')}</div>`;

  // ONE complete in-app surface (owner request): checklist events + approvals/feedback + ALL the
  // HR events (leave, attendance, announcements, reviews, WFH). HR rows ride DB.hrmNotifPrefs
  // via _hnpRow2 (same keys as before — they were previously buried in the HR Email tab).
  const _hnpRow2=(key,label,desc)=>{const on=_hnp(key);return`<div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid #F5F4F0"><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:#15171C">${label}</div>${desc?`<div style="font-size:11px;color:#B8B5AC;margin-top:1px">${desc}</div>`:''}</div><button role="switch" aria-checked="${on?'true':'false'}" aria-label="${esc(label)}" class="tog ${on?'on':'off'}" onclick="App._hnpTog(this,'${key}')"><span></span></button></div>`;};
  const inappTab=`<div class="space-y-4">
    <div class="bg-white rounded-2xl border border-ink-100 shadow-soft" style="overflow:hidden">
      <div style="padding:14px 20px;background:#F9F8F5;border-bottom:1px solid #F0EEE9">
        <div style="font-size:14px;font-weight:700">In-app notifications — every event</div>
        <div style="font-size:12px;color:#9CA3AF;margin-top:2px">Bell icon — shown only to the relevant user. Per-feature master switches (Leave, Payroll, OKRs…) live in <strong>HR Config → Alerts</strong>, like email.</div>
      </div>
      <div style="padding:4px 20px 12px">
        <div style="font-size:10px;font-weight:800;color:#B8B5AC;letter-spacing:.06em;text-transform:uppercase;padding:12px 0 4px">Checklists</div>
        ${_nsTogRow('inapp_checklist_assigned','Checklist assigned','Sent to the user the checklist is assigned to')}
        ${_nsTogRow('inapp_submission_submitted','Submission submitted','Sent to the manager when their team submits')}
        ${_nsTogRow('inapp_submission_late','Submission late','Sent to the manager when a submission is overdue')}
        ${_nsTogRow('inapp_submission_approved','Submission approved','Sent to the user whose submission was approved')}
        ${_nsTogRow('inapp_submission_rejected','Submission rejected','Sent to the user whose submission was rejected')}
        ${_nsTogRow('inapp_deadline_reminder','Deadline reminder','Sent to the user before their task cutoff')}
        <div style="font-size:10px;font-weight:800;color:#B8B5AC;letter-spacing:.06em;text-transform:uppercase;padding:14px 0 4px">Approvals & Feedback</div>
        ${_nsTogRow('inapp_approval_requested','Approval requested','Sent to admin when an approval is pending')}
        ${_nsTogRow('inapp_approval_decided','Approval decided','Sent to the user when their approval is approved/rejected')}
        ${_nsTogRow('inapp_feedback_received','Feedback received','Sent to the user when their manager sends feedback')}
        <div style="font-size:10px;font-weight:800;color:#B8B5AC;letter-spacing:.06em;text-transform:uppercase;padding:14px 0 4px">Leave</div>
        ${_hnpRow2('inapp_hrm_leave_submitted','Leave submitted','Approvers notified when leave is requested')}
        ${_hnpRow2('inapp_hrm_leave_approved','Leave approved','Employee notified when their leave is approved')}
        ${_hnpRow2('inapp_hrm_leave_rejected','Leave rejected','Employee notified when their leave is rejected')}
        <div style="font-size:10px;font-weight:800;color:#B8B5AC;letter-spacing:.06em;text-transform:uppercase;padding:14px 0 4px">Attendance</div>
        ${_hnpRow2('inapp_hrm_late','Late clock-in','Employee notified when they clock in late')}
        ${_hnpRow2('inapp_hrm_missed_clockout','Didn’t clock out','Employee notified when the day auto-closes at midnight')}
        ${_hnpRow2('inapp_hrm_wfh','WFH marked','Manager notified when someone marks today as WFH')}
        <div style="font-size:10px;font-weight:800;color:#B8B5AC;letter-spacing:.06em;text-transform:uppercase;padding:14px 0 4px">Announcements & Reviews</div>
        ${_hnpRow2('inapp_announcement','Announcements','Targeted users notified of new announcements')}
        ${_hnpRow2('inapp_review_opened','Review cycle opened','Participants notified when a cycle opens')}
        ${_hnpRow2('inapp_review_results','Review results ready','Employee notified when results are visible')}
      </div>
    </div>
  </div>`;

  const emailOn=ns.email_enabled!==false;
  const emailTab=`<div class="space-y-4">
    <div class="bg-white rounded-2xl border border-ink-100 shadow-soft" style="overflow:hidden">
      <div style="padding:14px 20px;background:#F9F8F5;border-bottom:1px solid #F0EEE9;display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:14px;font-weight:700">Email notifications</div>
          <div style="font-size:12px;color:#9CA3AF;margin-top:2px">Sends to the email address set on each user's account</div>
        </div>
        <button role="switch" aria-checked="${emailOn?'true':'false'}" aria-label="Email notifications" class="tog ${emailOn?'on':'off'}" onclick="App._nsTog(this,'email_enabled')"><span></span></button>
      </div>
      <div style="padding:16px 20px;border-bottom:1px solid #F0EEE9">
        <div style="font-size:11px;font-weight:700;color:#9CA3AF;letter-spacing:.05em;text-transform:uppercase;margin-bottom:10px">Sender identity</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
          <div>
            <label for="ns-from-name" style="display:block;font-size:11px;font-weight:700;color:#6B7280;margin-bottom:4px">From name</label>
            <input id="ns-from-name" value="${esc(ns.email_from_name||'Evarca')}" placeholder="Evarca"
              style="width:100%;box-sizing:border-box;border:1.5px solid #E5E7EB;border-radius:10px;padding:8px 12px;font-size:13px;outline:none" class="rf"/>
          </div>
          <div>
            <label for="ns-from-addr" style="display:block;font-size:11px;font-weight:700;color:#6B7280;margin-bottom:4px">From address</label>
            <input id="ns-from-addr" type="email" value="${esc(ns.email_from_address||'')}" placeholder="you@company.com"
              style="width:100%;box-sizing:border-box;border:1.5px solid #E5E7EB;border-radius:10px;padding:8px 12px;font-size:13px;outline:none" class="rf"/>
          </div>
        </div>
        <div style="margin-bottom:12px">
          <label for="ns-reminder-mins" style="display:block;font-size:11px;font-weight:700;color:#6B7280;margin-bottom:4px">Reminder lead time (minutes before deadline)</label>
          <input id="ns-reminder-mins" type="number" min="5" max="120" value="${ns.email_reminder_minutes||15}"
            style="width:120px;border:1.5px solid #E5E7EB;border-radius:10px;padding:8px 12px;font-size:13px;outline:none" class="rf"/>
        </div>
        <div style="display:flex;gap:8px">
          ${btn('Save settings','App._nsSaveEmail()',{variant:'primary',attrs:'style="flex:1"'})}
          ${btn('Send test email','App._testEmail()',{variant:'ghost',attrs:'id="ns-test-btn"'})}
        </div>
      </div>
      <div style="padding:4px 20px 12px">
        <div style="font-size:10px;font-weight:800;color:#B8B5AC;letter-spacing:.06em;text-transform:uppercase;padding:12px 0 4px">Checklists</div>
        ${_nsTogRow('email_checklist_assigned','Checklist assigned','Email sent to the assigned user')}
        ${_nsTogRow('email_submission_late','Submission late','Email sent to the manager')}
        ${_nsTogRow('email_submission_approved','Submission approved','Email sent to the user')}
        ${_nsTogRow('email_submission_rejected','Submission rejected','Email sent to the user')}
        ${_nsTogRow('email_deadline_reminder','Deadline reminder','Email sent to the user before cutoff')}
        <div style="font-size:10px;font-weight:800;color:#B8B5AC;letter-spacing:.06em;text-transform:uppercase;padding:14px 0 4px">Approvals & Feedback</div>
        ${_nsTogRow('email_approval_requested','Approval requested','Email sent to admin')}
        ${_nsTogRow('email_approval_decided','Approval decided','Email sent to the user')}
        ${_nsTogRow('email_feedback_received','Feedback received','Email sent to the user')}
        ${_nsTogRow('email_escalation','Escalation raised','Email sent to the person it escalates to')}
      </div>
    </div>
  </div>`;

  // ── HR EMAIL TAB (§4, FRONTEND-ONLY — DB.hrmNotifPrefs, never synced) ──
  const _hnpRow=(key,label,desc)=>{const on=_hnp(key);return`<div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid #F5F4F0"><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:#15171C">${label}</div>${desc?`<div style="font-size:11px;color:#B8B5AC;margin-top:1px">${desc}</div>`:''}</div><button role="switch" aria-checked="${on?'true':'false'}" aria-label="${esc(label)}" class="tog ${on?'on':'off'}" onclick="App._hnpTog(this,'${key}')"><span></span></button></div>`;};
  const hrmMaster=_hnp('hrm_email_enabled');
  const hrmEmailTab=`<div class="space-y-4">
    <div class="bg-white rounded-2xl border border-ink-100 shadow-soft" style="overflow:hidden">
      <div style="padding:14px 20px;background:#F9F8F5;border-bottom:1px solid #F0EEE9;display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:14px;font-weight:700">HR email notifications</div>
          <div style="font-size:12px;color:#9CA3AF;margin-top:2px">Leave, attendance & announcement emails. Master switch gates all HR emails.</div>
        </div>
        <button role="switch" aria-checked="${hrmMaster?'true':'false'}" aria-label="HR email master switch" class="tog ${hrmMaster?'on':'off'}" onclick="App._hnpTog(this,'hrm_email_enabled')"><span></span></button>
      </div>
      <div style="padding:14px 20px;border-bottom:1px solid #F0EEE9">
        <div style="font-size:11px;font-weight:700;color:#9CA3AF;letter-spacing:.05em;text-transform:uppercase;margin-bottom:6px">Sender address</div>
        <div style="font-size:12px;color:#6B7280;line-height:1.5;background:#F9FAFB;border:1px solid #F0EEE9;border-radius:10px;padding:10px 12px">The HR sending address is configured by the backend email service (coming soon). Emails are not actually sent yet — these switches control what <em>will</em> be sent once the backend is connected. The in-app notifications below work today.</div>
      </div>
      <div style="padding:4px 20px 12px">
        <div style="font-size:11px;color:#9CA3AF;padding:10px 0 2px">In-app switches for these events moved to the <strong>In-App</strong> tab — this tab is email only.</div>
        <div style="font-size:10px;font-weight:800;color:#B8B5AC;letter-spacing:.06em;text-transform:uppercase;padding:14px 0 4px">Email notifications ${hrmMaster?'':'<span style="color:#D97706">(master switch off)</span>'}</div>
        ${_hnpRow('email_hrm_leave_submitted','Leave submitted','Email to approvers when leave is requested')}
        ${_hnpRow('email_hrm_leave_approved','Leave approved','Email to the employee on approval')}
        ${_hnpRow('email_hrm_leave_rejected','Leave rejected','Email to the employee on rejection')}
        ${_hnpRow('email_hrm_late','Late clock-in','Email to the employee on a late clock-in')}
        ${_hnpRow('email_hrm_missed_clockout','Missed clock-out','Email on an auto-closed clock-out')}
        ${_hnpRow('email_announcement','Announcements','Email to targeted users on new announcements')}
      </div>
    </div>
  </div>`;

  // ── TEMPLATES TAB ──
  const defaults=_defaultTemplates();
  const expandedTpl=S.filters.tplKey||null;
  const templatesTab=`<div class="space-y-2">
    <div style="padding:4px 0 10px">
      <div style="font-size:13px;color:#9CA3AF;line-height:1.6">
        Customise the subject and body for each email. Use these variables anywhere in your text:
        <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">
          ${['{{user_name}}','{{checklist_name}}','{{date}}','{{status}}','{{manager_name}}','{{action_url}}','{{app_url}}'].map(v=>`<code style="background:#F5F4F0;border-radius:6px;padding:2px 8px;font-size:12px;color:#374151">${v}</code>`).join('')}
        </div>
      </div>
    </div>
    ${EMAIL_EVENTS.map(ev=>{
      const tpl={...(defaults[ev.key]||{}), ...(ns.templates?.[ev.key]||{})};
      const open=expandedTpl===ev.key;
      return`<div style="background:#fff;border-radius:14px;border:1.5px solid ${open?'#0E9F6E':'#ECEDF0'};overflow:hidden;transition:border-color .15s">
        <button onclick="S.filters.tplKey='${open?'':ev.key}';rr()"
          style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:13px 16px;background:transparent;border:none;cursor:pointer;text-align:left">
          <div>
            <div style="font-size:13px;font-weight:700;color:#15171C">${ev.label}</div>
            <div style="font-size:11px;color:#B8B5AC;margin-top:1px">${ev.vars}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            ${(ns.templates?.[ev.key])?`<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:#ECFDF5;color:#065F46">Custom</span>`:''}
            <span style="color:#B8B5AC;font-size:16px">${open?'▲':'▼'}</span>
          </div>
        </button>
        ${open?`<div style="padding:0 16px 16px;border-top:1px solid #F5F4F0">
          <div style="margin-bottom:10px">
            <label for="tpl-subj-${ev.key}" style="display:block;font-size:11px;font-weight:700;color:#6B7280;margin-bottom:4px;margin-top:12px">Subject</label>
            <input id="tpl-subj-${ev.key}" value="${esc(tpl.subject||'')}" placeholder="Email subject…"
              style="width:100%;box-sizing:border-box;border:1.5px solid #E5E7EB;border-radius:10px;padding:8px 12px;font-size:13px;outline:none" class="rf"/>
          </div>
          <div>
            <label for="tpl-body-${ev.key}" style="display:block;font-size:11px;font-weight:700;color:#6B7280;margin-bottom:4px">Body</label>
            <textarea id="tpl-body-${ev.key}" rows="6"
              style="width:100%;box-sizing:border-box;border:1.5px solid #E5E7EB;border-radius:10px;padding:8px 12px;font-size:13px;outline:none;resize:vertical;font-family:monospace;line-height:1.6" class="rf">${esc(tpl.body||'')}</textarea>
            <div style="font-size:11px;color:#B8B5AC;margin-top:4px">Tip: each line in the body becomes a paragraph in the email.</div>
          </div>
          <div style="display:flex;gap:8px;margin-top:12px">
            ${btn('Reset to default',`App._resetTpl('${ev.key}')`,{variant:'ghost',size:'sm'})}
            ${btn('Save template',`App._saveTpl('${ev.key}')`,{variant:'primary',attrs:'style="flex:1"'})}
          </div>
        </div>`:''}
      </div>`;
    }).join('')}
  </div>`;

  App._saveTpl=async(key)=>{
    if(!_ns)_ns=_nsDefault();
    if(!_ns.templates)_ns.templates={};
    const subj=($('#tpl-subj-'+key)?.value||'').trim();
    const body=($('#tpl-body-'+key)?.value||'').trim();
    if(!subj||!body){toast('Subject and body required','err');return;}
    _ns.templates[key]={subject:subj,body};
    await _saveNS();
    toast('Template saved');rr();
  };
  App._resetTpl=async(key)=>{
    if(!_ns)_ns=_nsDefault();
    if(_ns.templates)delete _ns.templates[key];
    await _saveNS();
    toast('Reset to default');rr();
  };

  const dataTab=`<div class="space-y-4">
    <div class="bg-white rounded-2xl border border-ink-100 shadow-soft p-5">
      <h3 class="fd font-semibold text-sm mb-3">Export & Reset</h3>
      <div class="flex gap-3 flex-wrap">
        ${btnG('Export CSV','App._exportCSV()','download')}
        <button onclick="App._clearOperational()" style="flex:1;min-width:140px;padding:10px;border-radius:12px;border:1.5px solid #FED7AA;color:#C2410C;background:#fff;font-weight:600;font-size:14px;cursor:pointer" onmouseover="this.style.background='#FFF7ED'" onmouseout="this.style.background='#fff'"><span style="display:inline-flex;align-items:center;gap:7px;justify-content:center">${ic('broom','w-4 h-4')}Clear data</span></button>
        <button onclick="if(confirm('Reset ALL workspace data?')){localStorage.removeItem(window.LS_KEY||'shiftly_v3');location.reload();}" style="flex:1;min-width:140px;padding:10px;border-radius:12px;border:1.5px solid #FECACA;color:#BE123C;background:#fff;font-weight:600;font-size:14px;cursor:pointer" onmouseover="this.style.background='#FFF1F2'" onmouseout="this.style.background='#fff'">Reset workspace</button>
      </div>
    </div>
    <div class="bg-white rounded-2xl border border-ink-100 shadow-soft p-5">
      <h3 class="fd font-semibold text-sm mb-3">Workspace stats</h3>
      <div class="grid grid-cols-4 gap-2 text-center">${[['Users',DB.users.length],['Checklists',DB.checklists.length],['Locations',DB.locations.length],['Submissions',DB.submissions.length]].map(([k,v])=>`<div class="bg-ink-50 rounded-xl p-3"><div class="fd text-xl font-bold">${v}</div><div class="text-[10px] text-ink-400 font-medium">${k}</div></div>`).join('')}</div>
    </div>
  </div>`;

  const content=stab==='inapp'?inappTab:stab==='email'?emailTab:stab==='hrmemail'?hrmEmailTab:stab==='templates'?templatesTab:dataTab;
  return`<div class="fade">${hdr('Settings','')}${tabBar}${content}</div>`;
}

App._exportCSV=()=>{
  let subs=DB.submissions;if(!isAdmin()){const _sc=_reportScopeIds();subs=subs.filter(s=>_sc.has(s.userId));}
  const f=S.filters;const fArr=k=>Array.isArray(f[k])?f[k]:(f[k]?[f[k]]:[]);
  if(fArr('users').length)subs=subs.filter(s=>fArr('users').includes(s.userId));
  if(fArr('deps').length)subs=subs.filter(s=>{const c=clById(s.checklistId);return fArr('deps').includes(c?.department);});
  if(fArr('locs').length)subs=subs.filter(s=>{const c=clById(s.checklistId);return fArr('locs').some(l=>(c?.locationIds||[]).includes(l));});
  if(fArr('stats').length)subs=subs.filter(s=>fArr('stats').includes(s.status));
  if(f.dr1)subs=subs.filter(s=>s.date>=f.dr1);if(f.dr2)subs=subs.filter(s=>s.date<=f.dr2);
  const summaryRows=[['#','User','Email','Phone','Department','Position','Checklist','Dept','Location(s)','Date','Status','Submitted At','Edit Count','Pending Approval','Compliance','Escalations']];
  subs.forEach((s,i)=>{const u=uById(s.userId),c=clById(s.checklistId);if(!u)return;if(!c&&!s.checklistDeleted)return;const clName=c?c.name:'[Deleted checklist]';const clDept=c?c.department||'':'';const clLocs=c?(c.locationIds||[]).map(id=>DB.locations.find(l=>l.id===id)?.name||'').join('; '):'';const _escN=(c&&(c.questionIds||[]).length)?_subEscalationCount(c,s):0;const _compTxt=(c&&(c.questionIds||[]).length)?(_escN>0?'Non-compliant':'Compliant'):'N/A';summaryRows.push([i+1,fullName(u),u.email||'',u.phone||'',u.department||'',u.position||'',clName,clDept,clLocs,s.date,s.status,s.submittedAt?new Date(s.submittedAt).toLocaleString('en-GB'):'',s.editCount||0,s.status==='Pending Approval'?'Yes':'No',_compTxt,_escN]);});
  // Also export question responses as a second sheet
  const qRows=[['Sub #','User','Email','Checklist','Date','Status','Question','Response','Comment','Escalated']];
  subs.forEach((s,si)=>{const u=uById(s.userId),c=clById(s.checklistId);if(!u)return;(s.questionResponses||[]).forEach((qr,qi)=>{const q=(DB.questions||[]).find(x=>x.id===qr.questionId);const _esc=(c&&q&&_qrEscalates(c,q,qr))?'Yes':'';qRows.push([si+1,fullName(u),u.email||'',c?c.name:'[Deleted]',s.date,s.status,q?q.text:'Q'+(qi+1),qr.response!==null&&qr.response!==undefined?String(qr.response):'',qr.comment||'',_esc]);});});
  const all=[...summaryRows,[],['=== QUESTION RESPONSES (one row per response) ==='],[],...qRows];
  const csv=all.map(r=>r.map(v=>{let cell=String(v??'');
    // Neutralize CSV formula injection: cells that begin with = + - @ (or tab/CR)
    // are prefixed with a single quote so spreadsheet apps treat them as text.
    if(/^[=+\-@\t\r]/.test(cell))cell="'"+cell;
    return '"'+cell.replace(/"/g,'""')+'"';}).join(',')).join('\n');
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,﻿'+encodeURIComponent(csv);a.download='evarca_export_'+todayISO()+'.csv';a.click();
  toast('Exported '+subs.length+' submissions ('+(qRows.length-1)+' question responses)');
};

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.NS_LS=NS_LS;window.EMAIL_EVENTS=EMAIL_EVENTS;window._defaultTemplates=_defaultTemplates;window._nsDefault=_nsDefault;window._loadNS=_loadNS;window._saveNS=_saveNS;window._fillTemplate=_fillTemplate;window._bodyToHtml=_bodyToHtml;window.sendEmail=sendEmail;window._nsTogRow=_nsTogRow;window.settingsPage=settingsPage;
