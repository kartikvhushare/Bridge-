/* ── PERFORMANCE REVIEWS (Phase 4) — appraisal cycles on the survey-engine pattern.
   A CYCLE = period + question set + audience (dynamic: self review on/off, manager review on/off).
   Ratings use a 1..scale scale (default 10). Answers are one row per (cycle, byUser, aboutUser, role).
   All writes are TARGETED (OKR pattern) — these tables never join the whole-table _sync batch. ── */

/* mappers: local camelCase ⟷ supabase snake_case */
function _mRC(r){return(r||[]).map(c=>({id:c.id,name:c.name||'',start:c.start_date||null,end:c.end_date||null,status:c.status||'Active',scale:Number(c.scale)||10,audience:c.audience||{self:true,manager:true},questions:c.questions||[],createdBy:c.created_by||null,createdAt:c.created_at,closedAt:c.closed_at||null}));}
function _rcRow(c){return{id:c.id,name:c.name||'',start_date:c.start||null,end_date:c.end||null,status:c.status||'Active',scale:c.scale||10,audience:c.audience||{self:true,manager:true},questions:c.questions||[],created_by:c.createdBy||null,created_at:c.createdAt||new Date().toISOString(),closed_at:c.closedAt||null};}
function _mRA(r){return(r||[]).map(a=>({id:a.id,cycleId:a.cycle_id,byUser:a.by_user,aboutUser:a.about_user,role:a.role||'self',answers:a.answers||[],score:a.score==null?null:Number(a.score),submittedAt:a.submitted_at}));}
function _raRow(a){return{id:a.id,cycle_id:a.cycleId,by_user:a.byUser,about_user:a.aboutUser,role:a.role||'self',answers:a.answers||[],score:a.score==null?null:a.score,submitted_at:a.submittedAt||new Date().toISOString()};}
function _applyReviewCycles(rows){DB.reviewCycles=_mRC(rows);}
function _applyReviewAnswers(rows){DB.reviewAnswers=_mRA(rows);}

const rcById=id=>(DB.reviewCycles||[]).find(c=>c.id===id);
function _rcActive(){return(DB.reviewCycles||[]).filter(c=>c.status==='Active');}
function _rcClosed(){return(DB.reviewCycles||[]).filter(c=>c.status==='Closed');}
function _rcAnswerOf(cid,byId,role,aboutId){return(DB.reviewAnswers||[]).find(x=>x.cycleId===cid&&x.byUser===byId&&x.role===role&&x.aboutUser===aboutId);}

/* Pending forms for a user across active cycles: their self review (if the cycle asks for it)
   + one manager review per active direct report (if the cycle asks for it). */
function _rcMyTasks(u){
  if(!u)return[];
  const out=[];
  _rcActive().forEach(c=>{
    const a=c.audience||{};
    if(a.self!==false&&!_rcAnswerOf(c.id,u.id,'self',u.id))out.push({cycle:c,role:'self',about:u.id});
    if(a.manager!==false)(DB.users||[]).filter(x=>x.status==='Active'&&x.managerId===u.id&&x.id!==u.id)
      .forEach(d=>{if(!_rcAnswerOf(c.id,u.id,'manager',d.id))out.push({cycle:c,role:'manager',about:d.id});});
  });
  return out;
}
/* Expected number of forms in a cycle (progress denominator). */
function _rcParticipants(c){
  const a=c.audience||{};const act=(DB.users||[]).filter(u=>u.status==='Active');let n=0;
  if(a.self!==false)n+=act.length;
  if(a.manager!==false)n+=act.filter(u=>u.managerId&&u.managerId!==u.id&&act.some(m=>m.id===u.managerId)).length;
  return n;
}
function _rcSubmitted(c){return(DB.reviewAnswers||[]).filter(x=>x.cycleId===c.id).length;}
/* Average of the RATING questions in an answers array (1..scale), 1dp; null when nothing rated. */
function _rcAvgAnswers(c,ans){
  const qs=(c.questions||[]).filter(q=>q.type!=='answer');if(!qs.length)return null;
  const vals=qs.map(q=>Number(((ans||[]).find(x=>x.qid===q.id)||{}).value)).filter(v=>isFinite(v)&&v>0);
  return vals.length?Math.round((vals.reduce((s,v)=>s+v,0)/vals.length)*10)/10:null;
}
/* Result for one person in one cycle: {self, manager, gap} (gap = manager − self, 1dp). */
function _rcResultFor(c,uid2){
  const s=(DB.reviewAnswers||[]).find(x=>x.cycleId===c.id&&x.aboutUser===uid2&&x.role==='self');
  const m=(DB.reviewAnswers||[]).find(x=>x.cycleId===c.id&&x.aboutUser===uid2&&x.role==='manager');
  const sv=s&&s.score!=null?s.score:null,mv=m&&m.score!=null?m.score:null;
  return{self:sv,manager:mv,gap:(sv!=null&&mv!=null)?Math.round((mv-sv)*10)/10:null,selfAns:s?s.answers:null,mgrAns:m?m.answers:null};
}
/* Who has at least one answer about them in a cycle (results-table rows). */
function _rcPeopleIn(c){const ids=new Set();(DB.reviewAnswers||[]).filter(x=>x.cycleId===c.id).forEach(x=>ids.add(x.aboutUser));return[...ids].map(uById).filter(Boolean);}

/* targeted supabase writers (OKR pattern) */
function _rcPush(c){sb.from('review_cycles').upsert(_rcRow(c),{onConflict:'id'}).then(({error})=>{if(error)_syncErr('review cycle')(error);}).catch(_syncErr('review cycle'));}
function _raPush(a){sb.from('review_answers').upsert(_raRow(a),{onConflict:'id'}).then(({error})=>{if(error)_syncErr('review')(error);}).catch(_syncErr('review'));}

/* — auto: expose on window (Phase 3/4 convention; original was one classic <script>) — */
window._mRC=_mRC;window._rcRow=_rcRow;window._mRA=_mRA;window._raRow=_raRow;window._applyReviewCycles=_applyReviewCycles;window._applyReviewAnswers=_applyReviewAnswers;window.rcById=rcById;window._rcActive=_rcActive;window._rcClosed=_rcClosed;window._rcAnswerOf=_rcAnswerOf;window._rcMyTasks=_rcMyTasks;window._rcParticipants=_rcParticipants;window._rcSubmitted=_rcSubmitted;window._rcAvgAnswers=_rcAvgAnswers;window._rcResultFor=_rcResultFor;window._rcPeopleIn=_rcPeopleIn;window._rcPush=_rcPush;window._raPush=_raPush;
