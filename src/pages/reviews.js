/* ===== REVIEWS PAGE (Phase 4) — fill what's pending, see your results, run cycles (managers of the feature) ===== */
let _RVD=null; // working copy for the new-cycle modal (state-driven, same pattern as _OKRED/_SVF)

function _rvRatingRow(q,scale,val,cid,role,about){
  const btns=Array.from({length:scale},(_,i)=>i+1).map(n=>`<button type="button" onclick="App._rvSet('${q.id}',${n})" data-rv-q="${q.id}" data-rv-v="${n}" class="rv-num ${Number(val)===n?'on':''}" style="width:34px;height:34px;border-radius:10px;border:1.5px solid ${Number(val)===n?'var(--c-brand)':'var(--c-border)'};background:${Number(val)===n?'#ECFDF5':'#fff'};font-weight:800;font-size:13px;cursor:pointer">${n}</button>`).join('');
  return`<div style="margin-bottom:14px"><div style="font-size:13.5px;font-weight:600;margin-bottom:6px">${esc(q.text)}</div><div style="display:flex;gap:6px;flex-wrap:wrap">${btns}</div></div>`;
}
App._rvSet=(qid,v)=>{if(!window.__RVANS)window.__RVANS={};window.__RVANS[qid]=v;
  document.querySelectorAll(`[data-rv-q="${qid}"]`).forEach(b=>{const on=Number(b.getAttribute('data-rv-v'))===v;b.classList.toggle('on',on);b.style.borderColor=on?'var(--c-brand)':'var(--c-border)';b.style.background=on?'#ECFDF5':'#fff';});};

App._rvOpen=(cid,role,aboutId)=>{
  const c=rcById(cid);if(!c)return;
  const about=uById(aboutId);window.__RVANS={};
  const qs=(c.questions||[]);
  const body=`<div>
    <p style="font-size:12px;color:var(--c-text-3);margin-bottom:12px">${role==='self'?'Rate yourself honestly — your manager answers the same questions about you, and you’ll see both side by side once the cycle closes.':'You’re reviewing <b>'+esc(fullName(about))+'</b>. They see the result after the cycle closes.'} Ratings are 1 (poor) to ${c.scale||10} (outstanding).</p>
    ${qs.map(q=>q.type==='answer'
      ?`<div style="margin-bottom:14px"><div style="font-size:13.5px;font-weight:600;margin-bottom:6px">${esc(q.text)}</div><textarea id="rv-txt-${q.id}" class="ui-input rf" rows="2" placeholder="Optional comment…"></textarea></div>`
      :_rvRatingRow(q,c.scale||10,null,cid,role,aboutId)).join('')}
  </div>`;
  modalShell({title:(role==='self'?'Self review':'Review — '+esc(fullName(about)))+' · '+esc(c.name),sub:'',body,
    footer:`<button onclick="App.closeModal()" class="ui-btn ui-btn-subtle">Cancel</button><button onclick="App._rvSubmit('${cid}','${role}','${aboutId}')" class="ui-btn ui-btn-primary">Submit review</button>`,size:'max-w-xl'});
};
App._rvSubmit=(cid,role,aboutId)=>{
  const c=rcById(cid);if(!c)return;const u=me();
  if(_rcAnswerOf(cid,u.id,role,aboutId)){toast('Already submitted','err');return;}
  const ans=[];let missing=null;
  (c.questions||[]).forEach(q=>{
    if(q.type==='answer'){const t=(document.getElementById('rv-txt-'+q.id)||{}).value||'';if(t.trim())ans.push({qid:q.id,text:t.trim().slice(0,1000)});}
    else{const v=(window.__RVANS||{})[q.id];if(!v){missing=missing||q.text;}else ans.push({qid:q.id,value:v});}
  });
  if(missing){toast('Rate: "'+missing.slice(0,40)+'…"','err');return;}
  const a={id:uid('ra'),cycleId:cid,byUser:u.id,aboutUser:aboutId,role,answers:ans,score:_rcAvgAnswers(c,ans),submittedAt:new Date().toISOString()};
  DB.reviewAnswers=DB.reviewAnswers||[];DB.reviewAnswers.push(a);_raPush(a);
  log(fullName(u),'Review submitted',c.name+' · '+(role==='self'?'self':'about '+fullName(uById(aboutId))));
  saveDB();closeModal();toast('Review submitted');rr();
};

/* ── manage: create / close / export a cycle ── */
const _RV_DEFAULT_QS=['Quality of work','Ownership & reliability','Collaboration & communication','Growth since last cycle'];
App._rvNew=()=>{
  if(!can('reviews','create'))return toast('You need Reviews → Create','err');
  window._RVD={name:'',start:todayISO(),end:_isoAdd(todayISO(),14),audience:{self:true,manager:true},
    questions:_RV_DEFAULT_QS.map(t=>({id:uid('rq'),text:t,type:'rating'})).concat([{id:uid('rq'),text:'Anything else to add?',type:'answer'}])};
  App._rvRenderNew();
};
App._rvRenderNew=()=>{
  const d=window._RVD;if(!d)return;
  const body=`<div>
    ${fld('Cycle name','rv-name',d.name||'','text')}
    <div class="grid grid-cols-2 gap-3 mt-3">${fld('Starts','rv-start',d.start,'date')}${fld('Ends','rv-end',d.end,'date')}</div>
    <div style="margin:14px 0 4px;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase">Who fills it in</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <label style="display:flex;align-items:center;gap:8px;padding:9px 12px;border:1.5px solid var(--c-border);border-radius:12px;cursor:pointer;font-size:13px;font-weight:600"><input type="checkbox" id="rv-aud-self" ${d.audience.self?'checked':''}/> Self review (everyone rates themselves)</label>
      <label style="display:flex;align-items:center;gap:8px;padding:9px 12px;border:1.5px solid var(--c-border);border-radius:12px;cursor:pointer;font-size:13px;font-weight:600"><input type="checkbox" id="rv-aud-mgr" ${d.audience.manager?'checked':''}/> Manager review (managers rate each direct report)</label>
    </div>
    <div style="margin:14px 0 4px;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase">Questions <span style="font-weight:500;text-transform:none;color:var(--c-text-3)">(ratings are 1–10; “comment” rows are free text)</span></div>
    <div id="rv-qs">${d.questions.map((q,i)=>`<div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
      <input class="ui-input rf" style="flex:1" value="${esc(q.text)}" oninput="window._RVD.questions[${i}].text=this.value"/>
      <select class="ui-select rf" style="width:110px" onchange="window._RVD.questions[${i}].type=this.value">${[['rating','Rating'],['answer','Comment']].map(o=>`<option value="${o[0]}" ${q.type===o[0]?'selected':''}>${o[1]}</option>`).join('')}</select>
      <button onclick="window._RVD.questions.splice(${i},1);App._rvRenderNew()" class="ui-btn ui-btn-subtle ui-btn-sm" style="color:var(--c-danger-ink)">✕</button></div>`).join('')}</div>
    <button onclick="window._RVD.questions.push({id:uid('rq'),text:'',type:'rating'});App._rvRenderNew()" class="ui-btn ui-btn-subtle ui-btn-sm">+ Add question</button>
  </div>`;
  modalShell({title:'New review cycle',sub:'Opens for everyone the moment you create it',body,
    footer:`<button onclick="App.closeModal()" class="ui-btn ui-btn-subtle">Cancel</button><button onclick="App._rvCreate()" class="ui-btn ui-btn-primary">Create & open cycle</button>`,size:'max-w-xl'});
};
App._rvCreate=()=>{
  if(!can('reviews','create'))return toast('You need Reviews → Create','err');
  const d=window._RVD;if(!d)return;
  d.name=($('#rv-name')||{}).value||d.name;d.start=($('#rv-start')||{}).value||d.start;d.end=($('#rv-end')||{}).value||d.end;
  d.audience={self:!!($('#rv-aud-self')||{}).checked,manager:!!($('#rv-aud-mgr')||{}).checked};
  if(!d.name.trim())return toast('Give the cycle a name','err');
  if(!d.audience.self&&!d.audience.manager)return toast('Pick at least one: self or manager review','err');
  d.questions=d.questions.filter(q=>q.text&&q.text.trim());
  if(!d.questions.some(q=>q.type!=='answer'))return toast('Add at least one rating question','err');
  const c={id:uid('rc'),name:d.name.trim(),start:d.start,end:d.end,status:'Active',scale:10,audience:d.audience,questions:d.questions,createdBy:S.uid,createdAt:new Date().toISOString(),closedAt:null};
  DB.reviewCycles=DB.reviewCycles||[];DB.reviewCycles.unshift(c);_rcPush(c);
  // tell everyone who has a form to fill (in-app; email honours §4 toggles + master switch)
  const told=new Set();
  (DB.users||[]).filter(u=>u.status==='Active').forEach(u=>{
    const hasSelf=d.audience.self,hasTeam=d.audience.manager&&(DB.users||[]).some(x=>x.status==='Active'&&x.managerId===u.id&&x.id!==u.id);
    if((hasSelf||hasTeam)&&!told.has(u.id)){told.add(u.id);
      if(_hnp('inapp_review_opened')!==false)_hrmNotify(u.id,'⭐ Review cycle "'+c.name+'" is open — fill yours in Reviews by '+fmtD(c.end)+'.','review','reviews');
      if(_hnpEmail('email_review_cycle_opened'))queueEmail('review_cycle_opened',u.id,null,c.start,{cycle_name:c.name,end_date:fmtD(c.end)});
    }});
  log(fullName(me()),'Review cycle opened',c.name);
  saveDB();closeModal();toast('Cycle opened for '+told.size+' people');rr();
};
App._rvClose=(cid)=>{
  if(!can('reviews','close'))return toast('You need Reviews → Open / Close','err');
  const c=rcById(cid);if(!c||c.status!=='Active')return;
  confirmModal({title:'Close this review cycle?',body:'"'+esc(c.name)+'" — people can no longer submit, and everyone reviewed sees their own result.',confirmLabel:'Close cycle',onConfirm:"App._rvCloseGo('"+cid+"')"});
};
App._rvCloseGo=(cid)=>{
  if(!can('reviews','close'))return;
  const c=rcById(cid);if(!c||c.status!=='Active')return;
  c.status='Closed';c.closedAt=new Date().toISOString();_rcPush(c);
  _rcPeopleIn(c).forEach(u=>{
    if(_hnp('inapp_review_results')!==false)_hrmNotify(u.id,'⭐ Your review results for "'+c.name+'" are ready.','review','reviews');
    if(_hnpEmail('email_review_results_ready'))queueEmail('review_results_ready',u.id,null,null,{cycle_name:c.name});
  });
  log(fullName(me()),'Review cycle closed',c.name);
  saveDB();toast('Cycle closed — results visible');rr();
};
App._rvCSV=(cid)=>{
  if(!can('reviews','export'))return toast('You need Reviews → Export','err');
  const c=rcById(cid);if(!c)return;
  const qs=(c.questions||[]).filter(q=>q.type!=='answer');
  const rows=[['Employee','Department','Self avg','Manager avg','Gap',...qs.map(q=>'Self · '+q.text),...qs.map(q=>'Mgr · '+q.text)]];
  _rcPeopleIn(c).forEach(u=>{const r=_rcResultFor(c,u.id);
    const pick=(ans,q)=>{const f=(ans||[]).find(x=>x.qid===q.id);return f&&f.value!=null?f.value:'';};
    rows.push([fullName(u),u.department||'',r.self??'',r.manager??'',r.gap??'',...qs.map(q=>pick(r.selfAns,q)),...qs.map(q=>pick(r.mgrAns,q))]);});
  _csvDownload(rows,'Review_'+c.name.replace(/[^a-z0-9]+/gi,'_'));
  log(fullName(me()),'Review results exported',c.name);
};

/* ── result card (self vs manager, per question) ── */
function _rvResultHTML(c,uid2){
  const r=_rcResultFor(c,uid2);const qs=(c.questions||[]).filter(q=>q.type!=='answer');const sc=c.scale||10;
  const bar=(v,color)=>v==null?'<span style="font-size:11px;color:var(--c-text-3)">—</span>':`<div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:7px;background:var(--c-surface-2);border-radius:4px;overflow:hidden"><div style="width:${Math.min(100,v/sc*100)}%;height:100%;background:${color}"></div></div><b style="font-size:12px;min-width:26px;text-align:right">${v}</b></div>`;
  const rowFor=q=>{const sv=((r.selfAns||[]).find(x=>x.qid===q.id)||{}).value??null;const mv=((r.mgrAns||[]).find(x=>x.qid===q.id)||{}).value??null;
    return`<div style="margin-bottom:10px"><div style="font-size:12.5px;font-weight:600;margin-bottom:4px">${esc(q.text)}</div>
      <div class="grid grid-cols-2 gap-3"><div><div style="font-size:10px;color:var(--c-text-3);margin-bottom:2px">SELF</div>${bar(sv,'#94A3B8')}</div><div><div style="font-size:10px;color:var(--c-text-3);margin-bottom:2px">MANAGER</div>${bar(mv,'var(--c-brand)')}</div></div></div>`;};
  const comments=[...(r.selfAns||[]),...(r.mgrAns||[])].filter(x=>x.text).map(x=>`<div style="font-size:12px;background:var(--c-surface-2);border-radius:10px;padding:8px 10px;margin-top:6px">${esc(x.text)}</div>`).join('');
  return`<div style="background:#fff;border:1px solid var(--c-border);border-radius:16px;padding:16px;margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b class="fd" style="font-size:14px">${esc(c.name)}</b>
      <span style="font-size:12px;color:var(--c-text-3)">Self <b>${r.self??'—'}</b> · Manager <b>${r.manager??'—'}</b>${r.gap!=null?' · Gap <b style="color:'+(r.gap>=0?'#0B7A55':'#BE123C')+'">'+(r.gap>0?'+':'')+r.gap+'</b>':''}</span></div>
    ${qs.map(rowFor).join('')}${comments}</div>`;
}

function reviewsPage(){
  const u=me();const tasks=_rcMyTasks(u);
  const manage=can('reviews','create')||can('reviews','close')||can('reviews','export');
  const f=scopeFilter('reviews');
  const closedMine=_rcClosed().filter(c=>(DB.reviewAnswers||[]).some(x=>x.cycleId===c.id&&x.aboutUser===u.id));
  let body='';
  // 1 · pending forms
  body+=`<div style="margin-bottom:18px"><div class="fd font-bold" style="font-size:14px;margin-bottom:8px">To fill now ${tasks.length?countBadge(tasks.length):''}</div>`;
  body+=tasks.length?tasks.map(t=>`<div style="background:#fff;border:1.5px solid ${t.role==='self'?'var(--c-border)':'#D1FAE5'};border-radius:16px;padding:14px 16px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:10px">
      <div><b style="font-size:13.5px">${t.role==='self'?'Your self review':'Review '+esc(fullName(uById(t.about)))}</b>
      <div style="font-size:11.5px;color:var(--c-text-3)">${esc(t.cycle.name)} · closes ${fmtD(t.cycle.end)}</div></div>
      <button onclick="App._rvOpen('${t.cycle.id}','${t.role}','${t.about}')" class="ui-btn ui-btn-primary ui-btn-sm">Fill now</button></div>`).join('')
    :`<div style="font-size:12.5px;color:var(--c-text-3);background:var(--c-surface-2);border-radius:12px;padding:12px 14px">Nothing pending — you're all caught up.</div>`;
  body+='</div>';
  // 2 · my results (closed cycles)
  if(closedMine.length){body+=`<div style="margin-bottom:18px"><div class="fd font-bold" style="font-size:14px;margin-bottom:8px">My results</div>${closedMine.map(c=>_rvResultHTML(c,u.id)).join('')}</div>`;}
  // 3 · team results for scope-holders (managers see directs; HR/admin see all)
  const visible=(DB.users||[]).filter(x=>x.status==='Active'&&x.id!==u.id&&f(x.id));
  const cyclesForTeam=_rcClosed().filter(c=>visible.some(v=>(DB.reviewAnswers||[]).some(a=>a.cycleId===c.id&&a.aboutUser===v.id)));
  if(visible.length&&cyclesForTeam.length){
    body+=`<div style="margin-bottom:18px"><div class="fd font-bold" style="font-size:14px;margin-bottom:8px">Team results</div>`;
    cyclesForTeam.forEach(c=>{
      body+=`<div style="background:#fff;border:1px solid var(--c-border);border-radius:16px;padding:14px 16px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b class="fd">${esc(c.name)}</b>${manage?`<button onclick="App._rvCSV('${c.id}')" class="ui-btn ui-btn-subtle ui-btn-sm">CSV</button>`:''}</div>
        <div class="tbl-scroll"><table style="width:100%;font-size:12.5px"><tr style="color:var(--c-text-3);font-size:10.5px;text-transform:uppercase"><td style="padding:4px 6px">Person</td><td style="padding:4px 6px;text-align:right">Self</td><td style="padding:4px 6px;text-align:right">Manager</td><td style="padding:4px 6px;text-align:right">Gap</td></tr>
        ${visible.map(v=>{const r=_rcResultFor(c,v.id);if(r.self==null&&r.manager==null)return'';return`<tr style="border-top:1px solid var(--c-border)"><td style="padding:6px">${esc(fullName(v))}</td><td style="padding:6px;text-align:right">${r.self??'—'}</td><td style="padding:6px;text-align:right;font-weight:700">${r.manager??'—'}</td><td style="padding:6px;text-align:right;color:${r.gap>0?'#0B7A55':r.gap<0?'#BE123C':'inherit'}">${r.gap!=null?(r.gap>0?'+':'')+r.gap:'—'}</td></tr>`;}).join('')}</table></div></div>`;});
    body+='</div>';
  }
  // 4 · cycle management
  if(manage){
    body+=`<div><div class="fd font-bold" style="font-size:14px;margin-bottom:8px">Cycles</div>`;
    body+=(DB.reviewCycles||[]).length?(DB.reviewCycles||[]).map(c=>{
      const done=_rcSubmitted(c),total=_rcParticipants(c),pct=total?Math.round(done/total*100):0;
      return`<div style="background:#fff;border:1px solid var(--c-border);border-radius:16px;padding:14px 16px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:12px">
        <div style="flex:1"><b style="font-size:13.5px">${esc(c.name)}</b> ${chip(c.status,c.status==='Active'?'ok':'off')}
          <div style="font-size:11.5px;color:var(--c-text-3)">${fmtD(c.start)} → ${fmtD(c.end)} · ${done}/${total} submitted</div>
          <div style="height:6px;background:var(--c-surface-2);border-radius:3px;margin-top:6px;overflow:hidden"><div style="width:${pct}%;height:100%;background:var(--c-brand)"></div></div></div>
        <div style="display:flex;gap:6px">${c.status==='Active'?`<button onclick="App._rvClose('${c.id}')" class="ui-btn ui-btn-subtle ui-btn-sm">Close cycle</button>`:`<button onclick="App._rvCSV('${c.id}')" class="ui-btn ui-btn-subtle ui-btn-sm">CSV</button>`}</div></div>`;}).join('')
      :`<div style="font-size:12.5px;color:var(--c-text-3);background:var(--c-surface-2);border-radius:12px;padding:12px 14px">No cycles yet — create the first one.</div>`;
    body+='</div>';
  }
  return`<div class="fade">${hdr('Reviews','Appraisals — self and manager ratings, side by side',manage?`<button onclick="App._rvNew()" class="ui-btn ui-btn-primary">+ New cycle</button>`:'')}${_howBar('reviews')}${body}</div>`;
}

/* — auto: expose on window — */
window._RVD=_RVD;window._rvRatingRow=_rvRatingRow;window._rvResultHTML=_rvResultHTML;window.reviewsPage=reviewsPage;window._RV_DEFAULT_QS=_RV_DEFAULT_QS;
