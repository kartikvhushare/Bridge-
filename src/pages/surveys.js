
const SV_KINDS={company:'Company feedback (everyone answers)',rate_manager:'Rate your manager (everyone rates their own manager)',rate_team:'Manager rates the team (one form per team member)'};
// Who owes what: [{aboutUser|null,label}] for the current user on a survey
function _svTargetsFor(sv,uid2){
  const u=uById(uid2);if(!u||sv.status!=='Active'||!sv.runDate||sv.runDate>todayISO())return[];
  if(sv.kind==='company')return[{about:null,label:'the company'}];
  if(sv.kind==='rate_manager'){const m=u.managerId?uById(u.managerId):null;return m?[{about:m.id,label:fullName(m)}]:[];}
  if(sv.kind==='rate_team')return DB.users.filter(x=>x.managerId===uid2&&x.id!==uid2&&x.status==='Active').map(x=>({about:x.id,label:fullName(x)}));
  return[];
}
function _svPendingFor(uid2){
  const out=[];
  (DB.surveys||[]).forEach(sv=>{_svTargetsFor(sv,uid2).forEach(t=>{
    if(!(DB.surveyAnswers||[]).some(a=>a.surveyId===sv.id&&a.byUser===uid2&&(a.aboutUser||null)===(t.about||null)))out.push({sv,about:t.about,label:t.label});
  });});
  return out;
}
window._SVF=null; // fill draft {svId,about,vals:{qid:val}}
function surveysPage(){
  const pend=_svPendingFor(S.uid);
  const mineDone=(DB.surveyAnswers||[]).filter(a=>a.byUser===S.uid);
  const form=(item)=>{
    const sv=item.sv;
    if(!_SVF||_SVF.svId!==sv.id||(_SVF.about||null)!==(item.about||null))return `<div class="ui-card" style="padding:14px;margin-bottom:8px;display:flex;align-items:center;gap:10px">
      <span style="width:36px;height:36px;border-radius:10px;background:var(--c-brand-soft);color:var(--c-brand-ink);display:grid;place-items:center">${ic('msg','w-4 h-4')}</span>
      <div style="flex:1;min-width:0"><div class="fd" style="font-size:13.5px;font-weight:800;color:var(--c-text)">${esc(sv.title)}</div>
      <div style="font-size:11.5px;color:var(--c-text-2)">About ${esc(item.label)} · ${sv.questions.length} question${sv.questions.length===1?'':'s'}</div></div>
      ${btn('Fill now',`_SVF={svId:'${sv.id}',about:${item.about?`'${item.about}'`:'null'},vals:{}};rr()`,{variant:'primary',size:'sm'})}
    </div>`;
    const qs=sv.questions.map(q=>{
      if(q.type==='text')return `<div style="margin-bottom:12px"><div style="font-size:13px;font-weight:700;color:var(--c-text);margin-bottom:6px">${esc(q.text)}</div><textarea rows="2" class="ui-input rf" style="resize:vertical" oninput="_SVF.vals['${q.id}']=this.value"></textarea></div>`;
      return `<div style="margin-bottom:12px"><div style="font-size:13px;font-weight:700;color:var(--c-text);margin-bottom:6px">${esc(q.text)}</div>
        <div style="display:flex;gap:6px">${[1,2,3,4,5].map(n=>`<button onclick="_SVF.vals['${q.id}']=${n};rr()" style="width:40px;height:40px;border-radius:10px;border:2px solid ${_SVF.vals[q.id]===n?'#0E9F6E':'var(--c-border)'};background:${_SVF.vals[q.id]===n?'#ECFDF5':'var(--c-surface)'};color:${_SVF.vals[q.id]===n?'#047857':'var(--c-text-2)'};font-weight:800;cursor:pointer">${n}</button>`).join('')}</div></div>`;
    }).join('');
    return `<div class="ui-card" style="padding:16px;margin-bottom:8px">
      <div class="fd" style="font-size:14px;font-weight:800;color:var(--c-text);margin-bottom:2px">${esc(sv.title)} — about ${esc(item.label)}</div>
      <div style="font-size:11px;color:var(--c-text-3);margin-bottom:12px">Ratings are 1 (poor) to 5 (excellent). Your answers go to the People team.</div>
      ${qs}
      <div style="display:flex;gap:8px;justify-content:flex-end">${btnG('Cancel','_SVF=null;rr()')}${btnP('Submit',`App._svSubmit()`)}</div>
    </div>`;
  };
  return `<div class="fade">${hdr('Surveys','Answer what\'s assigned to you — results feed performance reports')}
    ${pend.length?pend.map(form).join(''):empty('msg','Nothing to answer right now','Surveys appear here on their run date — company feedback, rating your manager, or rating your team.')}
    ${mineDone.length?`<div style="font-size:11px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;margin:14px 0 8px">Submitted (${mineDone.length})</div>${mineDone.slice(0,10).map(a=>{const sv=(DB.surveys||[]).find(s=>s.id===a.surveyId);const ab=a.aboutUser?uById(a.aboutUser):null;return `<div style="font-size:12px;color:var(--c-text-2);padding:4px 0">✓ ${esc(sv?sv.title:'—')} — ${ab?esc(fullName(ab)):'the company'}${a.score!=null?' · avg '+a.score:''}</div>`;}).join('')}`:''}
  </div>`;
}
App._svSubmit=()=>{
  const d=_SVF;if(!d)return;
  const sv=(DB.surveys||[]).find(s=>s.id===d.svId);if(!sv)return;
  const missing=sv.questions.some(q=>q.type!=='text'&&!(d.vals[q.id]>=1));
  if(missing)return toast('Answer every rating','err');
  const answers=sv.questions.map(q=>({qid:q.id,value:typeof d.vals[q.id]==='string'?d.vals[q.id].slice(0,4000):(d.vals[q.id]??'')}));
  const nums=answers.filter(a=>typeof a.value==='number');
  const score=nums.length?Math.round(nums.reduce((x,y)=>x+y.value,0)/nums.length*10)/10:null;
  const row={id:uid('sva'),surveyId:sv.id,byUser:S.uid,aboutUser:d.about||null,answers,score,createdAt:new Date().toISOString()};
  DB.surveyAnswers.push(row);_pushRow('survey_answers',_svARow(row),'survey');
  log(fullName(me()),'Survey submitted',sv.title);
  _SVF=null;saveDB();toast('Thanks — submitted');rr();
};
App._svNew=()=>{
  if(!can('surveys','create'))return toast('You need Surveys → Create','err');
  window._SVN={kind:'company',qs:[{id:uid('q'),text:'How satisfied are you overall?',type:'rating'}]};
  App._svRenderNew();
};
App._svRenderNew=()=>{
  const d=window._SVN;if(!d)return;
  modalShell({title:'New survey',size:'max-w-md',
    body:`<div style="display:flex;flex-direction:column;gap:12px">
      <div><label style="display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;margin-bottom:6px">Title *</label><input id="sv-title" value="${esc(d.title||'')}" oninput="window._SVN.title=this.value" class="ui-input rf" placeholder="e.g. Q3 pulse survey"/></div>
      <div><label style="display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;margin-bottom:6px">Who answers about whom</label><select class="ui-select rf" onchange="window._SVN.kind=this.value">${Object.keys(SV_KINDS).map(k=>`<option value="${k}" ${d.kind===k?'selected':''}>${SV_KINDS[k]}</option>`).join('')}</select></div>
      <div><label style="display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;margin-bottom:6px">Run date *</label><input id="sv-date" type="date" value="${d.date||todayISO()}" onchange="window._SVN.date=this.value" class="ui-input rf"/></div>
      <div><label style="display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;margin-bottom:6px">Questions</label>
        ${d.qs.map((q,i)=>`<div style="display:flex;gap:6px;margin-bottom:6px"><input value="${esc(q.text)}" oninput="window._SVN.qs[${i}].text=this.value" class="ui-input rf" style="flex:1"/><select onchange="window._SVN.qs[${i}].type=this.value" class="ui-select rf" style="width:96px">${['rating','text'].map(t=>`<option ${q.type===t?'selected':''}>${t}</option>`).join('')}</select><button onclick="window._SVN.qs.splice(${i},1);App._svRenderNew()" style="border:none;background:transparent;color:var(--c-text-3);cursor:pointer">${ic('trash','w-3.5 h-3.5')}</button></div>`).join('')}
        <button onclick="window._SVN.qs.push({id:uid('q'),text:'',type:'rating'});App._svRenderNew()" class="ui-btn ui-btn-ghost ui-btn-sm">${ic('plus','w-3.5 h-3.5')}Add question</button>
      </div>
    </div>`,
    footer:btnG('Cancel','window._SVN=null;App.closeModal()')+btnP('Create survey','App._svCreate()')});
};
App._svCreate=()=>{
  if(!can('surveys','create'))return toast('You need Surveys → Create','err');
  const d=window._SVN;if(!d)return;
  if(!(d.title||'').trim())return toast('Give it a title','err');
  const qs=d.qs.filter(q=>(q.text||'').trim());
  if(!qs.length)return toast('Add at least one question','err');
  const sv={id:uid('sv'),kind:d.kind,title:d.title.trim(),questions:qs,runDate:d.date||todayISO(),status:'Active',createdBy:S.uid,createdAt:new Date().toISOString()};
  DB.surveys.push(sv);_pushRow('surveys',_svRow(sv),'survey');
  log(fullName(me()),'Survey created',sv.title);
  window._SVN=null;saveDB();closeModal();toast('Survey created — people are notified on the run date');rr();
};
App._svToggle=(id)=>{if(!can('surveys','close'))return toast('You need Surveys → Open / Close','err');const sv=(DB.surveys||[]).find(s=>s.id===id);if(!sv)return;sv.status=sv.status==='Active'?'Closed':'Active';_pushRow('surveys',_svRow(sv),'survey');log(fullName(me()),'Survey '+sv.status.toLowerCase(),sv.title);saveDB();rr();};
App._svDel=(id)=>{if(!can('surveys','delete'))return toast('You need Surveys → Delete','err');const sv=(DB.surveys||[]).find(s=>s.id===id);if(!sv)return;if(!confirm('Remove this survey from the list? Responses stay in the database and the deletion is logged.'))return;sv.status='Deleted';_pushRow('surveys',_svRow(sv),'survey');log(fullName(me()),'Deleted survey',sv.title);saveDB();toast('Removed (kept in database + audit)','warn');rr();};
App._svCSV=(id)=>{
  if(!can('surveys','export'))return toast('You need Surveys → Export','err');
  const sv=(DB.surveys||[]).find(s=>s.id===id);if(!sv)return;
  const rows=[['By','About','Score',...sv.questions.map(q=>q.text)]];
  (DB.surveyAnswers||[]).filter(a=>a.surveyId===id).forEach(a=>{
    const by=uById(a.byUser),ab=a.aboutUser?uById(a.aboutUser):null;
    rows.push([by?fullName(by):a.byUser,ab?fullName(ab):'Company',a.score==null?'':a.score,...sv.questions.map(q=>{const x=(a.answers||[]).find(y=>y.qid===q.id);return x?x.value:'';})]);
  });
  _csvDownload(rows,'survey_'+(sv.title||'export').replace(/\W+/g,'_'));
};

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.SV_KINDS=SV_KINDS;window._svTargetsFor=_svTargetsFor;window._svPendingFor=_svPendingFor;window.surveysPage=surveysPage;
