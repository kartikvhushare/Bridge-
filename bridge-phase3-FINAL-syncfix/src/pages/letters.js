
function _fillLetter(tpl,u){
  const sal=u.hrm?.salary||{};const cur=sal.currency||'AED';
  return String(tpl||'')
    .replace(/\{name\}/g,fullName(u)).replace(/\{position\}/g,u.position||'—').replace(/\{department\}/g,u.department||'—')
    .replace(/\{joined\}/g,u.hrm?.joiningDate?fmtD(u.hrm.joiningDate):'—').replace(/\{salary\}/g,(sal.basic?cur+' '+(Number(sal.basic||0)+Number(sal.allow||0)):'—'))
    .replace(/\{company\}/g,'BloomingBox').replace(/\{date\}/g,fmtD(todayISO()));
}
function _printHTML(title,inner,opts){
  const w=window.open('','_blank','width=760,height=900');if(!w)return toast('Allow pop-ups to print','err');
  const B0=(DB.hrmConfig&&DB.hrmConfig.branding)||{};
  const B={...B0,headerImg:(opts&&opts.headerImg)||B0.headerImg,footerImg:(opts&&opts.footerImg)||B0.footerImg};
  const head=B.headerImg?'<img src="'+B.headerImg+'" style="width:100%;display:block;margin-bottom:24px" alt="Letterhead"/>'
    :(B.header?'<div style="border-bottom:2px solid #1a1d24;padding-bottom:12px;margin-bottom:26px"><div style="font:800 22px system-ui,sans-serif;letter-spacing:-.5px">'+esc(B.header)+'</div>'+(B.sub?'<div style="font:12px system-ui,sans-serif;color:#666;margin-top:2px">'+esc(B.sub)+'</div>':'')+'</div>':'');
  const foot=B.footerImg?'<img src="'+B.footerImg+'" style="width:100%;display:block;margin-top:30px" alt="Footer"/>'
    :(B.footer?'<div style="border-top:1px solid #ddd;margin-top:34px;padding-top:10px;font:10.5px system-ui,sans-serif;color:#999;text-align:center">'+esc(B.footer)+'</div>':'');
  w.document.write('<html><head><title>'+esc(title)+'</title><style>@page{margin:18mm}body{font:14px/1.7 Georgia,serif;color:#1a1d24;max-width:640px;margin:34px auto;padding:0 24px;white-space:pre-wrap}h2{font-family:system-ui,sans-serif;letter-spacing:-.4px}</style></head><body>'+head+'<h2>'+esc(title)+'</h2>'+inner+foot+'<script>window.onload=()=>window.print()<\/script></body></html>');
  w.document.close();
}

/* ── LETTERS — request → approve → issue (print/PDF via browser) ── */
App._letterNew=(userId)=>{
  if(!can('letters','create'))return toast('You need Letters → Create','err');
  _seedHRMPlan();
  const tpls=DB.hrmConfig.letterTemplates;
  const users=can('letters','approve')?DB.users.filter(u=>u.status==='Active'):[me()];
  const uid0=userId&&users.some(u=>u.id===userId)?userId:S.uid;
  modalShell({title:'Request a letter',size:'max-w-md',
    body:`<div style="display:flex;flex-direction:column;gap:12px">
      <div><label style="display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;margin-bottom:6px">For</label><select id="lt-user" class="ui-select rf">${users.map(u=>`<option value="${u.id}" ${u.id===uid0?'selected':''}>${esc(fullName(u))}</option>`).join('')}</select></div>
      <div><label style="display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;margin-bottom:6px">Letter type</label><select id="lt-type" class="ui-select rf">${Object.keys(tpls).map(k=>`<option value="${k}">${esc(tpls[k].name)}</option>`).join('')}</select></div>
      <div><label style="display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;margin-bottom:6px">Note to HR (optional)</label><input id="lt-note" class="ui-input rf" placeholder="Purpose, addressee, anything specific…"/></div>
    </div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Request','App._letterReq()')});
};
App._letterReq=()=>{
  const uid2=document.getElementById('lt-user')?.value,type=document.getElementById('lt-type')?.value,note=document.getElementById('lt-note')?.value||'';
  const u=uById(uid2);const tpl=DB.hrmConfig.letterTemplates[type];if(!u||!tpl)return;
  const l={id:uid('ltr'),userId:uid2,type,title:tpl.name,body:_fillLetter(tpl.body,u),status:'Requested',requestedBy:S.uid,approverId:null,decidedAt:null,issuedAt:null,note,createdAt:new Date().toISOString()};
  DB.letters.push(l);_pushRow('letters',_letterRow(l),'letter');
  _hrUsers().forEach(h=>notify(h.id,'📨 Letter requested: '+tpl.name+' for '+fullName(u),'letter','letters'));
  log(fullName(me()),'Requested letter',tpl.name+' · '+fullName(u));
  saveDB();closeModal();toast('Letter requested');rr();
};
App._letterDecide=(id,action)=>{
  if(!can('letters','approve'))return toast('You need Letters → Approve','err');
  const l=(DB.letters||[]).find(x=>x.id===id);if(!l)return;
  l.status=action==='approve'?'Approved':'Rejected';l.approverId=S.uid;l.decidedAt=new Date().toISOString();
  _pushRow('letters',_letterRow(l),'letter');
  notify(l.requestedBy,'📨 Letter '+l.status.toLowerCase()+': '+l.title,'letter','letters');
  log(fullName(me()),'Letter '+l.status.toLowerCase(),l.title);
  saveDB();rr();
};
App._letterIssue=(id)=>{
  if(!can('letters','issue'))return toast('You need Letters → Issue','err');
  const l=(DB.letters||[]).find(x=>x.id===id);if(!l)return;
  l.status='Issued';l.issuedAt=new Date().toISOString();
  _pushRow('letters',_letterRow(l),'letter');
  notify(l.userId,'📄 Your letter is issued: '+l.title,'letter','letters');
  log(fullName(me()),'Letter issued',l.title);
  saveDB();rr();App._letterPrint(id);
};
App._letterSoftDel=(id)=>{
  const l=(DB.letters||[]).find(x=>x.id===id);if(!l)return;
  if(!confirm('Remove this rejected letter from the list? It stays in the database and the deletion is logged.'))return;
  l.status='Deleted';_pushRow('letters',_letterRow(l),'letter');
  log(fullName(me()),'Deleted rejected letter',l.title+' · '+(uById(l.userId)?fullName(uById(l.userId)):''));
  saveDB();toast('Removed (kept in database + audit)','warn');rr();
};
App._letterPrint=(id)=>{const l=(DB.letters||[]).find(x=>x.id===id);if(!l)return;_printHTML(l.title,'<div>'+esc(l.body).replace(/\n/g,'<br>')+'</div>');};
App._letterEdit=(id,val)=>{const l=(DB.letters||[]).find(x=>x.id===id);if(!l)return;l.body=String(val||'').slice(0,20000);clearTimeout(App._ltT);App._ltT=setTimeout(()=>{_pushRow('letters',_letterRow(l),'letter');saveDB();},1200);};
function lettersPage(){
  _seedHRMPlan();
  const canAppr=can('letters','approve'),canIssue=can('letters','issue');
  const f=scopeFilter('letters');
  const mine=(DB.letters||[]).filter(l=>l.status!=='Deleted'&&(canAppr||l.userId===S.uid||l.requestedBy===S.uid||f(l.userId))).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  const stChip=s=>({Requested:['#FFFBEB','#B45309'],Approved:['#ECFDF5','#047857'],Issued:['#EFF6FF','#1D4ED8'],Rejected:['#FFF1F2','#9F1239']}[s]||['#F6F7F8','#6B7280']);
  const rows=mine.map(l=>{
    const u=uById(l.userId);const [bg,fg]=stChip(l.status);
    const open=S.filters.ltOpen===l.id;
    return `<div class="ui-card" style="padding:14px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:10px;cursor:pointer" onclick="S.filters.ltOpen=S.filters.ltOpen==='${l.id}'?null:'${l.id}';rr()">
        <span style="width:36px;height:36px;border-radius:10px;background:var(--c-surface-2);display:grid;place-items:center;color:var(--c-text-2);flex-shrink:0">${ic('doc','w-4 h-4')}</span>
        <div style="flex:1;min-width:0">
          <div class="fd" style="font-size:13.5px;font-weight:800;color:var(--c-text)">${esc(l.title)} — ${u?esc(fullName(u)):'—'}</div>
          <div style="font-size:11px;color:var(--c-text-3)">requested by ${esc(fullName(uById(l.requestedBy))||'—')} · ${fmtS(String(l.createdAt).slice(0,10))}${l.note?' · "'+esc(l.note)+'"':''}</div>
        </div>
        <span style="font-size:10.5px;font-weight:800;padding:3px 10px;border-radius:20px;background:${bg};color:${fg}">${l.status}</span>
      </div>
      ${open?`<div style="margin-top:10px;border-top:1px solid var(--c-border);padding-top:10px">
        ${(canAppr&&l.status!=='Issued')?`<textarea rows="7" oninput="App._letterEdit('${l.id}',this.value)" class="ui-input rf" style="font-family:Georgia,serif;font-size:13px;line-height:1.6;resize:vertical">${esc(l.body)}</textarea>`:`<div style="font:13px/1.65 Georgia,serif;color:var(--c-text);white-space:pre-wrap;background:var(--c-surface-2);border-radius:10px;padding:14px">${esc(l.body)}</div>`}
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
          ${l.status==='Requested'&&canAppr?btn('Approve',`App._letterDecide('${l.id}','approve')`,{variant:'primary',size:'sm',icon:'check'})+btn('Reject',`App._letterDecide('${l.id}','reject')`,{variant:'danger',size:'sm'}):''}
          ${l.status==='Approved'&&canIssue?btn('Issue & print',`App._letterIssue('${l.id}')`,{variant:'primary',size:'sm',icon:'doc'}):''}
          ${l.status==='Issued'?btn('Print / PDF',`App._letterPrint('${l.id}')`,{variant:'ghost',size:'sm'}):''}
          ${l.status==='Rejected'&&canAppr?btn('Delete',`App._letterSoftDel('${l.id}')`,{variant:'danger',size:'sm',icon:'trash'}):''}
        </div>
      </div>`:''}
    </div>`;
  }).join('');
  return `<div class="fade">${hdr('Letters','Request → approve → issue, from templates',can('letters','create')?btnP('Request letter','App._letterNew()','plus'):'')}
    ${_howBar('letters')}
    ${rows||empty('doc','No letters yet','Request a salary certificate, NOC, confirmation and more — HR approves and issues.')}
  </div>`;
}

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window._fillLetter=_fillLetter;window._printHTML=_printHTML;window.lettersPage=lettersPage;
