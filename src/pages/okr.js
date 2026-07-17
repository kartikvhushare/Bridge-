/* ════════════════════════════════════════════════════════════════════════
   Evarca — OKR (ported wholesale from Bridge v3.9.2, replacing the old OKR)
   Features: annual → quarterly split (equal-share progress), Move objective,
   Close-for-record (reason required), target revisions (reason required,
   editable inline), compact one-line cards, Annual / Quarterly hierarchy
   views, Access-Control-scoped visibility (okr area: view scope + create /
   edit / checkin / manage / delete).
   Engine + UI live together in this module (the old src/engine/okr.js is a
   stub); every symbol other modules use is exported on window at the bottom.
   ════════════════════════════════════════════════════════════════════════ */
/* ═══ PORTED: OKR helpers ═══ */
const OKR_METRICS=[['number','Number'],['percent','Percentage'],['currency','Currency'],['yesno','Yes / No (done or not)']];
const OKR_STATUSES=['On track','Off track','Achieved','Not achieved'];
const okrById=id=>(DB.okrs||[]).find(o=>o.id===id);
/* Children of a node. QUARTERLY SPLITS always group together FIRST (in date order) so the
   annual reads Q1, Q2, Q3, Q4 in a block — regular sub-objectives follow after, whatever
   their raw sort number is (fixes quarters interleaving with other children). */
function okrChildren(id){
  const base=(a,b)=>((a.sort||0)-(b.sort||0))||String(a.createdAt||'').localeCompare(String(b.createdAt||''));
  return(DB.okrs||[]).filter(o=>o.parentId===id).sort((a,b)=>{
    const qa=a.quarterLabel?0:1,qb=b.quarterLabel?0:1;
    if(qa!==qb)return qa-qb;
    if(!qa)return String(a.periodStart||'').localeCompare(String(b.periodStart||''))||base(a,b);
    return base(a,b);
  });
}
/* Level of an objective. A QUARTERLY SPLIT is the same objective time-boxed, not a sub-objective:
   the step from a quarter (quarterLabel set) up to its annual doesn't count as a level — so an
   L0 annual's quarters read “L0 · Q1”, their children read L1, and so on down the tree. */
function okrLevel(o){
  let l=0,cur=o,g=0;
  while(cur&&cur.parentId&&g++<15){
    const p=okrById(cur.parentId);
    if(!p)break;
    if(!cur.quarterLabel)l++; // quarter → annual is a sideways step, not down
    cur=p;
  }
  return l;
}
function okrDescendants(id,_seen){_seen=_seen||new Set();if(_seen.has(id))return[];_seen.add(id);return okrChildren(id).flatMap(c=>[c,...okrDescendants(c.id,_seen)]);}
function okrRootOf(o){let cur=o,g=0;while(cur&&cur.parentId&&g++<15){const p=okrById(cur.parentId);if(!p)break;cur=p;}return cur;}
function okrCheckinsOf(id){return(DB.okrCheckins||[]).filter(c=>c.okrId===id).sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));}
function okrLatestCheckin(id){const cs=okrCheckinsOf(id);return cs.length?cs[cs.length-1]:null;}
// Leaf progress %: how far the latest reported value moved from startValue toward targetValue.
// Works for direction 'down' too (target < start flips the sign naturally). Capped 0–150.
/* ── Revisions: a revised target OVERLAYS the same objective. The original target and every
   check-in stay untouched — one input stream feeds both numbers, so the two can be compared. ── */
function okrHasRevision(o){return !!o&&o.revisedTarget!==null&&o.revisedTarget!==undefined&&o.metricType!=='yesno';}
function _okrTargetEff(o){return okrHasRevision(o)?Number(o.revisedTarget):((o.targetValue===null||o.targetValue===undefined)?null:Number(o.targetValue));}
function _okrPctVs(o,t){
  const v0=okrCurrentOf(o);if(v0===null||v0===undefined)return null;
  if(o.metricType==='yesno')return Number(v0)>=1?100:0;
  const s=Number(o.startValue||0),v=Number(v0);
  if(t===null||t===undefined||!isFinite(t))return null;
  if(t===s)return(o.direction==='down'?(v<=t):(v>=t))?100:0;
  const pct=((v-s)/(t-s))*100;
  return Math.round(Math.max(0,Math.min(150,pct))*10)/10;
}
/* When a revision is active, the OPERATIVE progress/status track the revised target;
   okrProgressOrig() keeps the original number for the side-by-side comparison. */
function _okrLeafPct(o){return _okrPctVs(o,_okrTargetEff(o));}
function okrProgressOrig(o){return _okrPctVs(o,(o.targetValue===null||o.targetValue===undefined)?null:Number(o.targetValue));}
// Node progress %: children average (roll-up) if it has children, else its own check-ins. Cycle-safe.
/* ── ANNUAL progress = combined progress of its QUARTERS, each counting equally ──
   L0 Q1 at 10% with three untouched quarters → the annual reads 2.5% ("out of all progress").
   Only quarter-tagged children feed an annual — regular L1 sub-objectives never do. */
function _okrQKids(o){return okrChildren(o.id).filter(k=>k.quarterLabel);}
function _okrQProgressAvg(o){
  const qs=_okrQKids(o);
  if(!qs.length)return null;
  let any=false;
  const ps=qs.map(k=>{const p=_okrLeafPct(k);if(p===null)return 0;any=true;return Math.max(0,Math.min(100,p));});
  if(!any)return null;
  return Math.round((ps.reduce((a,b)=>a+b,0)/qs.length)*10)/10;
}
function okrProgress(o,_seen){
  // Both toggles are MANUAL and independent. Precedence when reading the number:
  //   roll-up ON            → level-below aggregation (explicit override, even on an annual)
  //   annual ON, roll-up OFF → equal-weighted progress of its quarters (quarters or nothing)
  //   both OFF              → the objective's own check-ins
  if(o&&o.isAnnual&&!o.rollup)return _okrQProgressAvg(o);
  return _okrLeafPct(o);
}
function _okrExpectedPct(o){
  if(!o.periodStart||!o.periodEnd)return null;
  const t=todayISO();
  if(t<=o.periodStart)return 0;if(t>=o.periodEnd)return 100;
  const s=new Date(o.periodStart+'T00:00:00').getTime(),e=new Date(o.periodEnd+'T00:00:00').getTime(),n=new Date(t+'T00:00:00').getTime();
  return e>s?Math.round(((n-s)/(e-s))*100):100;
}
// Status: a manual mark (statusMode 'manual') wins; otherwise derived from progress vs expected pace.
//   ≥100% → Achieved · period over & <100% → Not achieved · within 10 pts of pace → On track · else Off track.
function _okrExpectedForNode(o,_seen){
  if(o.periodStart&&o.periodEnd)return _okrExpectedPct(o);
  const eff=_okrEffPeriod(o);
  if(eff.ps&&eff.pe)return _okrExpectedPct({periodStart:eff.ps,periodEnd:eff.pe});
  return _okrExpectedPct(o);
}
function okrStatusOf(o){
  if(o.closed)return 'Closed'; // closed beats everything — frozen for record
  if(o.statusMode==='manual'&&o.statusManual)return o.statusManual;
  const pct=okrProgress(o);
  if(pct===null)return 'No data';
  if(pct>=100)return 'Achieved';
  if(o.periodEnd&&todayISO()>o.periodEnd)return 'Not achieved';
  const exp=_okrExpectedForNode(o);
  if(exp===null)return pct>=50?'On track':'Off track';
  return pct>=exp-15?'On track':'Off track';
}
const OKR_ST_META={'Achieved':{bg:'#D1FAE5',fg:'#065F46',dot:'#10B981'},'On track':{bg:'#ECFDF5',fg:'#0B7A55',dot:'#22C55E'},'Off track':{bg:'#FFF1F2',fg:'#BE123C',dot:'#EF4444'},'Not achieved':{bg:'#FEF2F2',fg:'#991B1B',dot:'#B91C1C'},'No data':{bg:'#F6F7F8',fg:'#6B7280',dot:'#9CA3AF'},'Closed':{bg:'#E5E7EB',fg:'#374151',dot:'#6B7280'}};
function okrStatusChip(st,sm){const m=OKR_ST_META[st]||OKR_ST_META['No data'];return`<span style="display:inline-flex;align-items:center;gap:5px;padding:${sm?'2px 8px':'3px 10px'};border-radius:20px;font-size:${sm?'10.5':'11.5'}px;font-weight:800;background:${m.bg};color:${m.fg};white-space:nowrap"><span style="width:6px;height:6px;border-radius:50%;background:${m.dot};flex-shrink:0"></span>${esc(st)}</span>`;}
function _okrBarColor(st){return(OKR_ST_META[st]||OKR_ST_META['No data']).dot;}
/* Abbreviate big values: 1000 → 1k · 10000 → 10k · 1000000 → 1M (2 decimals max: 1.25M) */
function _fmtAbbr(v){
  const n=Number(v);if(!isFinite(n))return String(v);
  const neg=n<0,a=Math.abs(n);
  const r2=x=>String(Math.round(x*100)/100);
  let out;
  if(a>=1e9)out=r2(a/1e9)+'B';
  else if(a>=1e6)out=r2(a/1e6)+'M';
  else if(a>=1e3)out=r2(a/1e3)+'k';
  else out=r2(a);
  return(neg?'-':'')+out;
}
function _okrFmtVal(o,v){
  if(v===null||v===undefined||v==='')return '—';
  if(o.metricType==='yesno')return Number(v)>=1?'Yes':'No';
  const n=Math.round(Number(v)*100)/100;
  if(o.metricType==='percent')return n+'%';
  if(o.metricType==='currency')return(o.unit?o.unit+' ':'')+_fmtAbbr(n);
  return _fmtAbbr(n)+(o.unit?(' '+o.unit):'');
}
function _okrFreqLabel(o){
  if(o&&o.rollup)return 'Auto · '+_okrModeLabel(o.rollupMode)+' of level below';
  if(o&&o.isAnnual)return 'Auto · progress of its quarters';
  const f=o.frequency||{};
  if(f.type==='weekly')return 'Weekly · every '+(f.day||'Mon');
  if(f.type==='monthly')return 'Monthly · day '+(f.day||1);
  if(f.type==='custom')return 'Custom · '+((f.dates||[]).length)+' date'+((f.dates||[]).length===1?'':'s');
  return 'No schedule';
}
/* ── Check-in scheduling: is this OKR's update due on `date`? ── */
function okrDueOn(o,date){
  if(o.closed)return false; // closed — no reminders, no tasks
  if(o.isAnnual)return false; // auto-updates from its quarters — nothing to ask the owner
  if(o.rollup)return false; // auto-updates from the level below — nothing to ask the owner
  const f=o.frequency||{};
  if(!f.type)return false;
  if(o.periodStart&&date<o.periodStart)return false;
  if(o.periodEnd&&date>o.periodEnd)return false;
  if(f.type==='weekly')return dayAbbr(date)===(f.day||'Mon');
  if(f.type==='monthly'){
    const d=new Date(date+'T00:00:00');
    const want=Math.min(Number(f.day||1),new Date(d.getFullYear(),d.getMonth()+1,0).getDate());
    return d.getDate()===want;
  }
  if(f.type==='custom')return(f.dates||[]).includes(date);
  return false;
}
// Every OKR whose scheduled check-in lands on `date` for `uid2` — the OWNER gets the task.
// This is the "combined checklist": all of a user's OKR tasks for one day, in one list.
function okrDueForUser(uid2,date){return(DB.okrs||[]).filter(o=>o.ownerId===uid2&&okrDueOn(o,date));}
function okrCheckinFor(okrId,uid2,date){return(DB.okrCheckins||[]).find(c=>c.okrId===okrId&&c.userId===uid2&&c.date===date);}
/* ── Visibility — fully driven by ACCESS CONTROL (role's OKR scope, or a per-person override) ──
   The area's "sees" scope decides WHOSE objectives are visible:
     everyone → all OKRs · team → own + owned by their team · department → own + owned by
     people in their department + OKRs assigned to their department · location → own + owned
     at their office · self / none → only their own.
   Two rules always apply on top:
     1) OWNERSHIP FLOOR — you always see objectives you own or created (you must update them).
     2) SUBTREE RULE — everything below a visible node is visible ("their level and below"). */
function okrVisible(){
  const all=DB.okrs||[];
  if(!S.uid||!can('okr','view'))return[];
  const sc=scopeOf('okr');
  if(sc==='everyone')return all;
  const mine=new Set();
  // 1) ownership floor
  all.forEach(o=>{if(o.ownerId===S.uid||o.createdBy===S.uid)mine.add(o.id);});
  // 2) scope extension — owner-based, resolved by the same scopeFilter every other area uses
  if(sc==='team'||sc==='department'||sc==='location'){
    const f=scopeFilter('okr');
    all.forEach(o=>{if(o.ownerId&&f(o.ownerId))mine.add(o.id);});
    if(sc==='department'){
      // an OKR ASSIGNED to my department is departmental work — visible even if its owner sits elsewhere
      const myDept=(me()||{}).department;
      const dRow=myDept?(DB.departments||[]).find(d=>d.name===myDept):null;
      if(dRow)all.forEach(o=>{const r=okrRootOf(o);if(r&&(r.departmentId===dRow.id||r.subDepartmentId===dRow.id))mine.add(o.id);});
    }
  }
  // 3) subtree rule
  [...mine].forEach(id=>okrDescendants(id).forEach(d=>mine.add(d.id)));
  return all.filter(o=>mine.has(o.id));
}
// Visible roots: a visible node whose parent is missing or not visible renders as top level.
function okrVisibleRoots(){const vis=okrVisible();const ids=new Set(vis.map(o=>o.id));return vis.filter(o=>!o.parentId||!ids.has(o.parentId)).sort((a,b)=>((a.sort||0)-(b.sort||0))||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));}
/* ── Per-OKR activity trail + targeted Supabase writers ── */
function okrLog(okrId,action,details){
  const entry={id:uid('okl'),okrId:okrId,actorId:S.uid,action:action,details:details||{},createdAt:new Date().toISOString()};
  DB.okrLogs=DB.okrLogs||[];DB.okrLogs.unshift(entry);
  sb.from('okr_logs').insert({id:entry.id,okr_id:okrId,actor_id:entry.actorId,action:action,details:entry.details,created_at:entry.createdAt}).then(()=>{}).catch(()=>{});
}
function _okrPush(o){sb.from('okrs').upsert(_okrRow(o),{onConflict:'id'}).then(({error})=>{if(error)_syncErr('OKR')(error);}).catch(_syncErr('OKR'));}
function _okrPushCheckin(c){sb.from('okr_checkins').upsert(_okrCheckinRow(c),{onConflict:'id'}).then(({error})=>{if(error)_syncErr('OKR update')(error);}).catch(_syncErr('OKR update'));}

/* ===== OKR TAB (UI) — hierarchical objectives =====
   One tab. Summary cards on top → "due today" combined check-in panel → the L0 tree.
   Every node expands to its children (L1 under L0, L2 under L1, …) and carries TWO
   dropdown panels: ① Rules & Target (goal, metric, start→target, schedule, period, owner)
   ② Progress & Updates (current value, roll-up graph, check-ins with comments & photos,
   manual status marking, per-OKR activity log). Every change writes an okr_logs entry. */
let _OKR_EXP={},_OKR_PANEL={},_OKR_LOGS={},_OKRED=null,_OKRCI=null,_OKRCIALL=null,_OKR_QVK={};
/* Quarterly-view hierarchy: a quarter's virtual parent is the SAME-LABEL quarter of its
   nearest ancestor annual — so "B2C Growth — Q1" (L1) nests under "Domestic Growth — Q1" (L0). */
function _okrQParent(qn){
  if(!qn||!qn.quarterLabel||!qn.parentId)return null;
  const lbl=String(qn.quarterLabel).trim().toLowerCase();
  let cur=okrById(qn.parentId),g=0;
  while(cur&&g++<15){
    if(!cur.parentId)return null;
    const anc=okrById(cur.parentId);
    if(!anc)return null;
    if(anc.isAnnual){
      const m=okrChildren(anc.id).find(k=>k.quarterLabel&&String(k.quarterLabel).trim().toLowerCase()===lbl);
      if(m)return m;
    }
    cur=anc;
  }
  return null;
}
const _OKR_LVL_C=['#1C212B','#0EA5E9','#0E9F6E','#8B5CF6','#F59E0B','#EC4899'];
function _okrCanManage(){return can('okr','manage');}
function _okrCanCreate(){return can('okr','create')||_okrCanManage();}
function _okrCanEditNode(o){return can('okr','edit')||_okrCanManage()||o.createdBy===S.uid;}
function _okrCanCheckin(o){if(o&&(o.rollup||o.isAnnual||o.closed))return false;return o.ownerId===S.uid||_okrCanEditNode(o);}
function _okrLvlChip(lvl){const c=_OKR_LVL_C[lvl%_OKR_LVL_C.length];return`<span style="flex-shrink:0;display:inline-flex;align-items:center;font-size:10px;font-weight:800;line-height:1;padding:4px 7px;border-radius:6px;background:${c};color:#fff;letter-spacing:.03em">L${lvl}</span>`;}
/* Annual / quarter tags shown next to the level chip — keeps the tree readable at a glance. */
function _okrAnnualChip(){return`<span title="Annual objective — updates automatically from its quarterly objectives" style="flex-shrink:0;display:inline-flex;align-items:center;font-size:10px;font-weight:800;line-height:1;padding:3px 7px;border-radius:6px;background:#EEF2FF;color:#4338CA;border:1px solid #C7D2FE;letter-spacing:.04em">ANNUAL</span>`;}
function _okrQtrChip(label){return`<span title="Quarterly objective — feeds its annual objective" style="flex-shrink:0;display:inline-flex;align-items:center;font-size:10px;font-weight:800;line-height:1;padding:3px 7px;border-radius:6px;background:#FEF3C7;color:#92400E;border:1px solid #FDE68A;letter-spacing:.04em">${esc(label)}</span>`;}
I.move='<polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>';
/* TZ-safe date helpers (toISOString shifts a day in +TZ — use local fields like todayISO does) */
const _okrISO=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function _okrDateAddD(iso,n){const d=new Date(iso+'T00:00:00');d.setDate(d.getDate()+n);return _okrISO(d);}
function _okrDateAddM(iso,m){const d=new Date(iso+'T00:00:00');d.setMonth(d.getMonth()+m);return _okrISO(d);}

/* ═══ Move an objective to another parent / level — the WHOLE subtree moves with it ═══ */
let _OKRMV=null; // {id, targetId(''=top level), deptId, subDeptId}
function _okrMoveOptions(excl){
  const out=[];
  const walk=(o,depth)=>{
    if(excl.has(o.id))return;
    out.push([o.id,' '.repeat(depth*3)+'L'+okrLevel(o)+' · '+(o.title||'Untitled')+(o.quarterLabel?' ['+o.quarterLabel+']':'')]);
    okrChildren(o.id).forEach(k=>walk(k,depth+1));
  };
  okrVisibleRoots().forEach(r=>walk(r,0));
  return out;
}
App._okrMove=(id)=>{
  const o=okrById(id);if(!o)return;
  if(!_okrCanEditNode(o))return toast('You can\'t move this OKR','err');
  const root=okrRootOf(o);
  _OKRMV={id:id,targetId:o.parentId||'',deptId:o.departmentId||(root?root.departmentId:null)||'',subDeptId:o.subDepartmentId||''};
  App._renderOKRMove();
};
App._okrMvSetTarget=(v)=>{if(_OKRMV){_OKRMV.targetId=v;App._renderOKRMove();}};
App._renderOKRMove=()=>{
  const d=_OKRMV;if(!d)return;
  const o=okrById(d.id);if(!o)return;
  const excl=new Set([o.id,...okrDescendants(o.id).map(x=>x.id)]);
  const opts=_okrMoveOptions(excl);
  const desc=okrDescendants(o.id);
  const target=d.targetId?okrById(d.targetId):null;
  const newLvl=target?(okrLevel(target)+(o.quarterLabel?0:1)):0; // a quarterly split lands AT the target's level, not below it
  const curParent=o.parentId?okrById(o.parentId):null;
  const L='display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px';
  const deptOpts=(topDepts()||[]).map(x=>[x.id,x.name]);
  const subOpts=d.deptId?(subDepts(d.deptId)||[]).map(s=>[s.id,s.name]):[];
  const same=(d.targetId||'')===(o.parentId||'');
  modalShell({title:'Move objective',sub:o.title||'',size:'max-w-md',key:'okr-move',
    body:`<div style="display:flex;flex-direction:column;gap:14px">
      <div style="font-size:12px;color:var(--c-text-2);background:var(--c-surface-2);border-radius:10px;padding:9px 12px;line-height:1.5">Currently <b>L${okrLevel(o)}</b>${curParent?' under “'+esc(curParent.title||'—')+'”':' (top level)'}${desc.length?` · its <b>${desc.length}</b> sub-objective${desc.length===1?'':'s'} move with it`:''}.</div>
      <div><label style="${L}">New parent</label>
        <select class="ui-select rf" onchange="App._okrMvSetTarget(this.value)">
          <option value="" ${!d.targetId?'selected':''}>◎ Top level (becomes an L0 objective)</option>
          ${opts.map(([id2,label])=>`<option value="${esc(id2)}" ${d.targetId===id2?'selected':''}>${esc(label)}</option>`).join('')}
        </select>
        <div style="font-size:11px;color:var(--c-text-3);margin-top:6px">You can pick any objective at any level — its own branch is excluded so a loop can't be created.</div>
      </div>
      ${!d.targetId?`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label style="${L}">Department *</label><select class="ui-select rf" onchange="_OKRMV.deptId=this.value||'';_OKRMV.subDeptId='';App._renderOKRMove()"><option value="">— Select department —</option>${deptOpts.map(x=>`<option value="${esc(x[0])}" ${d.deptId===x[0]?'selected':''}>${esc(x[1])}</option>`).join('')}</select></div>
        <div><label style="${L}">Sub-department</label><select class="ui-select rf" ${subOpts.length?'':'disabled'} onchange="_OKRMV.subDeptId=this.value||''"><option value="">${subOpts.length?'— All / none —':'No sub-departments'}</option>${subOpts.map(s=>`<option value="${esc(s[0])}" ${d.subDeptId===s[0]?'selected':''}>${esc(s[1])}</option>`).join('')}</select></div>
      </div>`:''}
      <div style="display:flex;gap:8px;align-items:center;background:${same?'var(--c-surface-2)':'var(--c-info-soft)'};border:1px solid ${same?'var(--c-border)':'#BFDBFE'};border-radius:10px;padding:9px 12px;font-size:12px;color:${same?'var(--c-text-3)':'#1E40AF'}">${ic('move','w-3.5 h-3.5')}${same?'No change yet — pick a different parent above.':`Will become <b>&nbsp;L${newLvl}&nbsp;</b>${target?' under “'+esc(target.title||'—')+'”':' at the top level'}${desc.length?' — sub-objectives shift level with it':''}.`}</div>
      ${o.quarterLabel&&!same?`<div style="font-size:11.5px;color:#92400E;background:#FEF3C7;border-radius:9px;padding:8px 11px">This is a quarterly objective — moving it away from its annual objective stops it feeding that annual number.</div>`:''}
    </div>`,
    footer:btnG('Cancel','_OKRMV=null;App.closeModal()')+btnP('Move here','App._okrMoveSave()')});
};
App._okrMoveSave=()=>{
  const d=_OKRMV;if(!d)return;
  const o=okrById(d.id);if(!o)return;
  if(!_okrCanEditNode(o))return toast('You can\'t move this OKR','err');
  const newParentId=d.targetId||null;
  if((newParentId||'')===(o.parentId||''))return toast('Pick a different parent first','warn');
  if(newParentId){
    const t=okrById(newParentId);
    if(!t)return toast('That parent no longer exists','err');
    if(newParentId===o.id||okrDescendants(o.id).some(x=>x.id===newParentId))return toast('You can\'t move an objective under its own sub-objective','err');
  }else{
    if(!d.deptId)return toast('Assign the objective to a department — top-level objectives need one','err');
  }
  const oldParent=o.parentId?okrById(o.parentId):null;
  const oldLvl=okrLevel(o);
  const newParent=newParentId?okrById(newParentId):null;
  o.parentId=newParentId;
  if(newParentId){o.departmentId=null;o.subDepartmentId=null;}
  else{o.departmentId=d.deptId||null;o.subDepartmentId=d.subDeptId||null;}
  o.sort=okrChildren(newParentId).filter(x=>x.id!==o.id).length;
  const desc=okrDescendants(o.id);
  okrLog(o.id,'Moved objective',{changes:[
    {field:'Parent',from:oldParent?(oldParent.title||'—'):'Top level',to:newParent?(newParent.title||'—'):'Top level'},
    {field:'Level',from:'L'+oldLvl,to:'L'+okrLevel(o)}
  ].concat(desc.length?[{field:'Moved with it',from:'',to:desc.length+' sub-objective'+(desc.length===1?'':'s')}]:[])});
  if(newParentId)_OKR_EXP[newParentId]=true;
  _okrPush(o);
  _OKRMV=null;saveDB();closeModal();toast('Objective moved — now L'+okrLevel(o));rr();
};

/* ═══ Close / Reopen — freeze an objective for the record (reason required) ═══
   Closed = no updates, no check-in reminders, no revisions; the card stays in the list
   (greyed, "Closed" status) with its full history + the reason, and can be reopened. */
App._okrCloseAsk=(id)=>{
  const o=okrById(id);if(!o)return;
  if(!_okrCanEditNode(o))return toast('You can\'t close this OKR','err');
  const desc=okrDescendants(id);
  modalShell({title:'Close objective',sub:o.title||'',size:'max-w-md',key:'okr-close',
    body:`<div style="display:flex;flex-direction:column;gap:12px">
      <div style="font-size:12.5px;color:var(--c-text-2);line-height:1.55">Closing freezes this objective — no more updates, check-ins or reminders. It stays in the list with its full history so the record is kept, and it can be reopened anytime.</div>
      ${desc.length?`<div style="font-size:11.5px;color:#92400E;background:#FEF3C7;border-radius:9px;padding:8px 11px">Its ${desc.length} sub-objective${desc.length===1?'':'s'} stay open — close them separately if needed.</div>`:''}
      <div><label class="ui-label">Reason for closing *</label>
      <textarea id="okr-close-reason" rows="2" class="ui-input rf" placeholder="e.g. Deprioritised after the H2 strategy review" style="resize:vertical"></textarea></div>
    </div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Close objective',`App._okrCloseGo('${id}')`)});
};
App._okrCloseGo=(id)=>{
  const o=okrById(id);if(!o)return;
  if(!_okrCanEditNode(o))return toast('You can\'t close this OKR','err');
  const reason=($('#okr-close-reason')?.value||'').trim();
  if(!reason)return toast('Add the reason — it\'s kept on the record','err');
  o.closed=true;o.closedReason=reason;o.closedAt=new Date().toISOString();o.closedBy=S.uid;
  okrLog(id,'Closed objective',{reason:reason});
  _okrPush(o);saveDB();closeModal();toast('Objective closed — kept for record');rr();
};
App._okrReopen=(id)=>{
  const o=okrById(id);if(!o)return;
  if(!_okrCanEditNode(o))return toast('You can\'t reopen this OKR','err');
  if(!confirm('Reopen "'+(o.title||'this objective')+'"?\n\nUpdates and reminders resume. The closing reason stays in the activity log.'))return;
  okrLog(id,'Reopened objective',{was:o.closedReason||''});
  o.closed=false;o.closedReason='';o.closedAt=null;o.closedBy=null;
  _okrPush(o);saveDB();toast('Objective reopened');rr();
};
/* ── Revise targets: the node + its DIRECT sub-objectives in one compact screen.
   Originals are never modified; entering the original value removes that revision. ── */
App._okrRevise=(id)=>{
  const o=okrById(id);if(!o)return;
  if(!_okrCanEditNode(o))return toast('You can\'t revise this OKR','err');
  if(o.closed)return toast('This objective is closed — reopen it first','err');
  const rows=[o,...okrChildren(o.id)].filter(x=>x.metricType!=='yesno');
  if(!rows.length)return toast('Yes/No objectives can\'t be revised','err');
  const inp=(x)=>`<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--c-border)">
      ${_okrLvlChip(okrLevel(x))}
      <div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:700;color:var(--c-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.title||'Untitled')}</div>
      <div style="font-size:10.5px;color:var(--c-text-3)">Original ${esc(_okrFmtVal(x,x.targetValue))}${okrHasRevision(x)?' · currently revised to '+esc(_okrFmtVal(x,x.revisedTarget)):''}</div></div>
      <input type="number" step="any" data-rev-id="${x.id}" value="${okrHasRevision(x)?x.revisedTarget:(x.targetValue!==null&&x.targetValue!==undefined?x.targetValue:'')}" class="ui-input" style="width:128px;min-height:36px;padding:6px 9px;font-size:12.5px;flex-shrink:0"/>
    </div>`;
  modalShell({title:'Revise targets',sub:'Originals stay untouched — the same updates feed both, so you can compare growth.',size:'max-w-md',key:'okr-rev',
    body:`<div style="font-size:11.5px;color:var(--c-text-3);margin-bottom:6px">Set the new target per objective. Enter the <b>original</b> value to remove a revision.</div>
      <div>${rows.map(inp).join('')}</div>
      <div style="margin-top:14px"><label class="ui-label">Reason *  <span style="font-weight:500;color:var(--c-text-3)">(kept on record — shown next to the revised target)</span></label>
      <input id="okr-rev-note" class="ui-input rf" value="${esc(o.revisedNote||'')}" placeholder="e.g. Market slowdown — H2 targets adjusted"/></div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Save revision','App._okrReviseSave()')});
};
App._okrReviseSave=()=>{
  const note=($('#okr-rev-note')?.value||'').trim();
  const at=new Date().toISOString();
  // Pre-pass: collect what would change, so the reason can be REQUIRED before anything is written.
  const ops=[];
  document.querySelectorAll('[data-rev-id]').forEach(el=>{
    const o=okrById(el.getAttribute('data-rev-id'));if(!o)return;
    const raw=String(el.value||'').trim();if(raw==='')return;
    const v=parseFloat(raw);if(!isFinite(v))return;
    const orig=(o.targetValue===null||o.targetValue===undefined)?null:Number(o.targetValue);
    const had=okrHasRevision(o);
    if(orig!==null&&v===orig){if(had)ops.push({o:o,type:'clear',orig:orig});return;}
    if(had&&Number(o.revisedTarget)===v&&(o.revisedNote||'')===note)return;
    ops.push({o:o,type:'set',v:v,had:had,orig:orig});
  });
  if(!ops.length){closeModal();return toast('No changes','ok');}
  if(ops.some(x=>x.type==='set')&&!note)return toast('Add the reason for this revision — it\'s kept and shown next to the revised target','err');
  let changed=0,cleared=0;
  ops.forEach(op=>{
    const o=op.o;
    if(op.type==='clear'){
      okrLog(o.id,'Revision removed',{changes:[{field:'Revised target',from:o.revisedTarget,to:'(original '+op.orig+')'}]});
      o.revisedTarget=null;o.revisedNote='';o.revisedAt=null;o.revisedBy=null;cleared++;_okrPush(o);
    }else{
      okrLog(o.id,op.had?'Revision updated':'Target revised',{reason:note,changes:[{field:'Revised target',from:op.had?o.revisedTarget:op.orig,to:op.v}]});
      o.revisedTarget=op.v;o.revisedNote=note;o.revisedAt=at;o.revisedBy=S.uid;changed++;_okrPush(o);
    }
  });
  saveDB();closeModal();rr();
  toast('Revision saved ✓ — '+changed+' target'+(changed===1?'':'s')+' revised'+(cleared?', '+cleared+' restored to original':''),'ok');
};
App._okrTogQtr=(q)=>{const a=S.filters.okrQtr||[];S.filters.okrQtr=a.includes(q)?a.filter(x=>x!==q):[...a,q];S.filters.okrQtrOpen=true;rr();};
App._okrTogExp=(id)=>{const _qv=(S.filters.okrView==='quarter');const cur=_qv?(_OKR_EXP[id]!==false):!!_OKR_EXP[id];_OKR_EXP[id]=!cur;rr();};
App._okrNodeLogs=(id)=>{
  const o=okrById(id);if(!o)return;
  const logs=(DB.okrLogs||[]).filter(l=>l.okrId===id).slice(0,80);
  const fmtDetail=(d)=>{
    if(!d||typeof d!=='object'||!Object.keys(d).length)return'';
    if(Array.isArray(d.changes))return d.changes.map(c=>typeof c==='string'?c:(c.field?`${c.field}: ${c.from??'—'} → ${c.to??'—'}`:JSON.stringify(c))).join(' · ');
    return Object.entries(d).map(([k,v])=>`${k}: ${typeof v==='object'?JSON.stringify(v):v}`).join(' · ');
  };
  const rows=logs.map(l=>{const a=uById(l.actorId);const det=fmtDetail(l.details);
    return `<div style="display:flex;gap:10px;padding:9px 2px;border-bottom:1px solid var(--c-border)">
      <div style="flex-shrink:0;margin-top:1px">${a?avatar(a,'w-7 h-7','text-[10px]'):`<div style="width:28px;height:28px;border-radius:50%;background:var(--c-surface-2)"></div>`}</div>
      <div style="min-width:0;flex:1">
        <div style="font-size:12.5px;color:var(--c-text)"><b>${esc(a?fullName(a):'Someone')}</b> · ${esc(l.action||'')}</div>
        ${det?`<div style="font-size:11.5px;color:var(--c-text-2);margin-top:1px">${esc(det)}</div>`:''}
        <div style="font-size:11px;color:var(--c-text-3);margin-top:1px">${esc(l.createdAt?new Date(l.createdAt).toLocaleString():'')}</div>
      </div></div>`;}).join('');
  modalShell({title:'Change log',sub:o.title||'',size:'max-w-lg',
    body:rows||'<p style="font-size:13px;color:var(--c-text-3)">No changes logged yet.</p>'});
};
App._okrActivity=()=>{
  const rows=(DB.okrLogs||[]).slice(0,100).map(l=>{
    const o=okrById(l.okrId);const a=uById(l.actorId);
    const when=l.createdAt?new Date(l.createdAt).toLocaleString():'';
    return `<div style="display:flex;gap:10px;padding:9px 2px;border-bottom:1px solid var(--c-border)">
      <div style="flex-shrink:0;margin-top:1px">${a?avatar(a,'w-7 h-7','text-[10px]'):`<div style="width:28px;height:28px;border-radius:50%;background:var(--c-surface-2)"></div>`}</div>
      <div style="min-width:0;flex:1">
        <div style="font-size:12.5px;color:var(--c-text)"><b>${esc(a?fullName(a):'Someone')}</b> · ${esc(l.action||'')}</div>
        <div style="font-size:11.5px;color:var(--c-text-3)">${esc(o?o.title:'(deleted objective)')} — ${esc(when)}</div>
      </div></div>`;
  }).join('');
  modalShell({title:'OKR activity',sub:'All OKR changes — kept separate from the main audit log',size:'max-w-lg',
    body:rows||'<p style="font-size:13px;color:var(--c-text-3)">No OKR activity yet.</p>'});
};
function _okrPMRefresh(id){
  // If the Progress & Updates popup is open for this OKR, rebuild it so status/check-in
  // changes show IMMEDIATELY (page behind the modal already re-renders via rr()).
  try{const el=document.getElementById('okr-pm');if(el&&el.getAttribute('data-okr')===id)App._okrProgressModal(id);}catch(e){}
}
App._okrCkDel=(okrId,ckId)=>{
  const o=okrById(okrId);if(!o)return;
  const c=(DB.okrCheckins||[]).find(x=>x.id===ckId);if(!c)return;
  if(!(c.userId===S.uid||_okrCanManage()))return toast('Only the author or a manager can delete an update','err');
  // (was: an undefined `confirmModal` here threw a ReferenceError, so the delete button did nothing)
  if(!confirm('Delete this update?\n\nThe value '+_okrFmtVal(o,c.value)+' from '+fmtS(c.date)+' will be removed. This is logged.'))return;
  App._okrCkDelGo(okrId,ckId);
};
App._okrCkDelGo=(okrId,ckId)=>{
  const c=(DB.okrCheckins||[]).find(x=>x.id===ckId);if(!c)return;
  DB.okrCheckins=DB.okrCheckins.filter(x=>x.id!==ckId);
  okrLog(okrId,'Deleted check-in',{date:c.date,value:c.value});
  sb.from('okr_checkins').delete().eq('id',ckId).then(({error})=>{if(error)_syncErr('OKR update delete')(error);}).catch(_syncErr('OKR update delete'));
  saveDB();toast('Update deleted');rr();_okrPMRefresh(okrId);
};
App._okrProgressModal=(id)=>{
  const o=okrById(id);if(!o)return;
  // An annual's progress panel lists ONLY what feeds it — its quarters. Regular sub-objectives
  // (L1s etc.) have their own cards and panels. With the roll-up override on, all children feed it.
  const kids=(o.isAnnual&&!o.rollup)?okrChildren(o.id).filter(k=>k.quarterLabel):okrChildren(o.id);
  const pct=okrProgress(o),st=okrStatusOf(o);
  modalShell({title:'Progress & Updates',sub:(o.title||'')+' — '+(pct===null?'no data yet':pct+'%'),size:'max-w-2xl',key:'okr-pm',
    body:`<div id="okr-pm" data-okr="${o.id}" style="margin:-6px -2px 0">${_okrProgressPanel(o,kids,pct,st)}</div>`});
  setTimeout(()=>{try{_drawOKRCharts();}catch(e){}},80);
};
App._okrTogPanel=(id,which)=>{_OKR_PANEL[id]=_OKR_PANEL[id]===which?null:which;rr();};
App._okrTogLogs=(id)=>{_OKR_LOGS[id]=!_OKR_LOGS[id];rr();};

function okrPage(){
  const vis=okrVisible(),canCreate=_okrCanCreate();
  const today=todayISO();
  const head=hdr('OKRs','Objectives & key results — inputs roll up L2 → L1 → L0',btn('Activity','App._okrActivity()',{variant:'ghost',icon:'audit'})+(canCreate?btn('New L0 objective','App._okrEdit(null,null)',{variant:'primary',icon:'plus'}):''));
  // ── Summary cards ──
  const sts=vis.map(o=>okrStatusOf(o));
  const cnt=x=>sts.filter(s=>s===x).length;
  const scard=(label,n,bg,fg,icon)=>`<div style="flex:1;min-width:108px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:11px;padding:7px 10px;display:flex;align-items:center;gap:8px"><span style="width:30px;height:30px;border-radius:9px;background:${bg};color:${fg};display:grid;place-items:center;flex-shrink:0">${ic(icon,'w-4 h-4')}</span><span style="min-width:0"><span class="fd" style="display:block;font-size:17px;font-weight:800;line-height:1;color:var(--c-text)">${n}</span><span style="display:block;font-size:10.5px;color:var(--c-text-2);margin-top:2px;white-space:nowrap">${label}</span></span></div>`;
  const summary=`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
    ${scard('Total OKRs',vis.length,'var(--c-brand-soft)','var(--c-brand-ink)','chart')}
    ${scard('Achieved',cnt('Achieved'),'#D1FAE5','#065F46','check')}
    ${scard('On track',cnt('On track'),'#ECFDF5','#0B7A55','approve')}
    ${scard('Off track',cnt('Off track'),'#FFF1F2','#BE123C','alert')}
    ${scard('Not achieved',cnt('Not achieved'),'#FEF2F2','#991B1B','x')}
    ${cnt('Closed')?scard('Closed',cnt('Closed'),'#E5E7EB','#374151','lock'):''}
  </div>`;
  // ── My check-ins due today (combined task list) ──
  const due=okrDueForUser(S.uid,today);
  const pendDue=due.filter(o=>!okrCheckinFor(o.id,S.uid,today));
  const duePanel=due.length?`<div style="background:${pendDue.length?'var(--c-warn-soft)':'var(--c-success-soft)'};border:1px solid ${pendDue.length?'#FDE68A':'#BBF7D0'};border-radius:14px;padding:14px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <span style="width:38px;height:38px;border-radius:11px;background:var(--c-surface);color:${pendDue.length?'var(--c-warn-ink)':'var(--c-success-ink)'};display:grid;place-items:center;flex-shrink:0">${ic('clock','w-5 h-5')}</span>
      <div style="flex:1;min-width:180px">
        <div class="fd" style="font-size:14px;font-weight:800;color:var(--c-text)">OKR check-ins due today</div>
        <div style="font-size:12.5px;color:var(--c-text-2);margin-top:2px">${due.length-pendDue.length}/${due.length} updated · ${pendDue.length?esc(pendDue.slice(0,3).map(o=>o.title).join(', '))+(pendDue.length>3?' +'+(pendDue.length-3)+' more':''):'all done for today'}</div>
      </div>
      ${btn(pendDue.length?('Update now ('+pendDue.length+')'):'Review / edit',`App._okrCheckinAll('${today}')`,{variant:pendDue.length?'primary':'ghost',icon:'edit'})}
    </div>`:'';
  // ── Filters (department / owner / status / level / search) ──
  const F=S.filters;
  // Two views only: 'annual' (default — quarterly splits hidden, clean annual tree) and
  // 'quarter' (a TREE of quarters that mirrors the annual hierarchy: L1 Q1 nests under L0 Q1).
  const _view=(F.okrView==='quarter')?'quarter':'annual';
  const fActive=!!(F.okrDept||F.okrSub||F.okrOwner||F.okrStatus||F.okrLvl||F.okrQ||(F.okrQtr||[]).length);
  const deptIds=[...new Set(vis.map(o=>okrRootOf(o).departmentId).filter(Boolean))];
  const subIds=F.okrDept?[...new Set(vis.map(o=>okrRootOf(o)).filter(r=>r.departmentId===F.okrDept&&r.subDepartmentId).map(r=>r.subDepartmentId))]:[];
  const ownerIds=[...new Set(vis.map(o=>o.ownerId).filter(Boolean))];
  const maxLvl=vis.reduce((m,o)=>Math.max(m,okrLevel(o)),0);
  const selSt='font-size:12px;padding:6px 26px 6px 10px;min-height:0;height:32px;width:auto';
  const _qy2=Number(F.okrQtrYear)||new Date().getFullYear();
  const _qsel=F.okrQtr||[];
  const _QR=_okrQuarterRanges(_qy2);
  const _qLabel=(_view==='quarter'?'Quarterly':'Annual')+(_qsel.length?' · '+_qsel.slice().sort().join(', ')+' · '+_qy2:'');
  const _navB='width:26px;height:26px;border-radius:8px;border:1px solid var(--c-border-2);background:var(--c-surface);color:var(--c-text-2);cursor:pointer;font-size:14px;font-weight:800;display:grid;place-items:center';
  const _fOn=!!(_qsel.length||_view==='quarter');
  const _vBtn=(v,label)=>{const on=_view===v;return`<button onclick="S.filters.okrView='${v}';S.filters.okrQtrOpen=true;rr()" style="flex:1;padding:5px 4px;border-radius:7px;border:none;background:${on?'var(--c-ink)':'transparent'};color:${on?'#fff':'var(--c-text-2)'};font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap">${label}</button>`;};
  const qtrDrop=`<div style="position:relative">
      <button onclick="S.filters.okrQtrOpen=!S.filters.okrQtrOpen;rr()" style="display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 11px;border-radius:9px;border:1.5px solid ${_fOn?'var(--c-text)':'var(--c-border-2)'};background:${_fOn?'var(--c-ink)':'var(--c-surface)'};color:${_fOn?'#fff':'var(--c-text-2)'};font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">${ic('calendar','w-3.5 h-3.5')}${esc(_qLabel)}${ic('chevD','w-3 h-3')}</button>
      ${F.okrQtrOpen?`<div style="position:absolute;top:37px;left:0;z-index:60;background:var(--c-surface);border:1px solid var(--c-border);border-radius:12px;box-shadow:var(--sh-md);padding:10px;width:238px">
        <div style="display:flex;gap:3px;background:var(--c-surface-2);border-radius:9px;padding:3px;margin-bottom:9px">
          ${_vBtn('annual','Annual')}${_vBtn('quarter','Quarterly')}
        </div>
        ${_view==='annual'?`<div style="font-size:10.5px;color:var(--c-text-3);margin:-3px 0 8px;line-height:1.45">The clean annual tree — quarterly splits are tucked away in the Quarterly view.</div>`:''}
        ${_view==='quarter'?`<div style="font-size:10.5px;color:var(--c-text-3);margin:-3px 0 8px;line-height:1.45">Quarters keep the annual hierarchy — an L1's Q1 sits under the L0's Q1. Tick quarters below to narrow.</div>`:''}
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <button onclick="S.filters.okrQtrYear=${_qy2-1};rr()" style="${_navB}" aria-label="Previous year">‹</button>
          <span class="fd" style="font-size:13.5px;font-weight:800">${_qy2}</span>
          <button onclick="S.filters.okrQtrYear=${_qy2+1};rr()" style="${_navB}" aria-label="Next year">›</button>
        </div>
        ${['Q1','Q2','Q3','Q4'].map(q=>{const on=_qsel.includes(q);const r=_QR[q];return`<div role="checkbox" aria-checked="${on}" onclick="App._okrTogQtr('${q}')" style="display:flex;align-items:center;gap:9px;padding:7px 8px;border-radius:8px;cursor:pointer;${on?'background:var(--c-brand-soft);':''}" onmouseover="if(!${on})this.style.background='var(--c-surface-2)'" onmouseout="this.style.background='${on?'var(--c-brand-soft)':'transparent'}'">
          <span style="width:16px;height:16px;border-radius:5px;border:1.5px solid ${on?'var(--c-brand)':'var(--c-border-2)'};background:${on?'var(--c-brand)':'#fff'};display:grid;place-items:center;color:#fff;flex-shrink:0">${on?ic('check','w-3 h-3'):''}</span>
          <span style="flex:1;font-size:12.5px;font-weight:800;color:var(--c-text)">${q}</span>
          <span style="font-size:10.5px;color:var(--c-text-3)">${fmtS(r[0])} – ${fmtS(r[1])}</span>
        </div>`;}).join('')}
        <div style="display:flex;gap:6px;margin-top:9px">
          ${_fOn?`<button onclick="S.filters.okrQtr=[];S.filters.okrView='';rr()" class="ui-btn ui-btn-ghost ui-btn-sm" style="flex:1">Clear</button>`:''}
          <button onclick="S.filters.okrQtrOpen=false;rr()" class="ui-btn ui-btn-primary ui-btn-sm" style="flex:1">Done</button>
        </div>
        <div style="font-size:10.5px;color:var(--c-text-3);margin-top:8px;line-height:1.5">Shows every OKR whose period overlaps a selected quarter — a 6-month OKR appears in both. OKRs without dates are hidden while filtering.</div>
      </div>`:''}
    </div>`;
  const fBar=vis.length?`<div class="ui-card" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:10px 12px;margin-bottom:14px;overflow:visible">
      ${qtrDrop}
      <input id="okr-q" value="${esc(F.okrQ||'')}" oninput="S.filters.okrQ=this.value;App._searchRR('okr-q')" placeholder="Search objectives…" class="ui-input" style="flex:1;min-width:150px;height:32px;min-height:0;padding:4px 12px;font-size:12.5px"/>
      <select onchange="S.filters.okrDept=this.value;S.filters.okrSub='';rr()" class="ui-select" style="${selSt}"><option value="">All departments</option>${deptIds.map(id=>{const d=(DB.departments||[]).find(x=>x.id===id);return`<option value="${id}" ${F.okrDept===id?'selected':''}>${esc(d?d.name:id)}</option>`;}).join('')}</select>
      ${subIds.length?`<select onchange="S.filters.okrSub=this.value;rr()" class="ui-select" style="${selSt}"><option value="">All sub-departments</option>${subIds.map(id=>{const d=(DB.departments||[]).find(x=>x.id===id);return`<option value="${id}" ${F.okrSub===id?'selected':''}>${esc(d?d.name:id)}</option>`;}).join('')}</select>`:''}
      <select onchange="S.filters.okrOwner=this.value;rr()" class="ui-select" style="${selSt}"><option value="">All owners</option>${ownerIds.map(id=>{const u2=uById(id);return`<option value="${id}" ${F.okrOwner===id?'selected':''}>${esc(u2?fullName(u2):id)}</option>`;}).join('')}</select>
      <select onchange="S.filters.okrStatus=this.value;rr()" class="ui-select" style="${selSt}"><option value="">Any status</option>${['Achieved','On track','Off track','Not achieved','No data','Closed'].map(s=>`<option ${F.okrStatus===s?'selected':''}>${s}</option>`).join('')}</select>
      <select onchange="S.filters.okrLvl=this.value;rr()" class="ui-select" style="${selSt}"><option value="">Any level</option>${Array.from({length:maxLvl+1},(_,i)=>`<option value="${i}" ${F.okrLvl===String(i)?'selected':''}>L${i}</option>`).join('')}</select>
      ${fActive||_view==='quarter'?`<button onclick="S.filters.okrQ='';S.filters.okrDept='';S.filters.okrSub='';S.filters.okrOwner='';S.filters.okrStatus='';S.filters.okrLvl='';S.filters.okrQtr=[];S.filters.okrView='';S.filters.okrQtrOpen=false;rr()" class="ui-btn ui-btn-ghost ui-btn-sm">Clear</button>`:''}
    </div>`:'';
  // ── Three renderings: quarterly hierarchy tree · flat filtered list · the annual tree ──
  let tree;
  if(_view==='quarter'){
    // QUARTERLY VIEW — quarters keep the SAME hierarchy as their annuals: each quarter nests
    // under the matching quarter (same label) of its nearest ancestor annual (L1 Q1 → under L0 Q1).
    const q2=(F.okrQ||'').toLowerCase();
    const _qy=Number(F.okrQtrYear)||new Date().getFullYear();
    const qNodes=vis.filter(o=>o.quarterLabel).filter(o=>{
      if((F.okrQtr||[]).length&&!_okrInQuarters(o,F.okrQtr,_qy))return false;
      if(F.okrDept&&okrRootOf(o).departmentId!==F.okrDept)return false;
      if(F.okrSub&&okrRootOf(o).subDepartmentId!==F.okrSub)return false;
      if(F.okrOwner&&o.ownerId!==F.okrOwner)return false;
      if(F.okrStatus&&okrStatusOf(o)!==F.okrStatus)return false;
      if(F.okrLvl!==''&&F.okrLvl!==undefined&&okrLevel(o)!==Number(F.okrLvl))return false;
      if(q2&&!((o.title||'').toLowerCase().includes(q2)||(o.description||'').toLowerCase().includes(q2)))return false;
      return true;
    });
    const qSet=new Set(qNodes.map(o=>o.id));
    _OKR_QVK={};
    const qRoots=[];
    qNodes.forEach(qn=>{
      const p=_okrQParent(qn);
      if(p&&qSet.has(p.id))(_OKR_QVK[p.id]=_OKR_QVK[p.id]||[]).push(qn);
      else qRoots.push(qn);
    });
    const byAnnual=(a,b)=>{const pa=okrById(a.parentId),pb=okrById(b.parentId);return(((pa&&pa.sort)||0)-((pb&&pb.sort)||0))||String(a.periodStart||'').localeCompare(String(b.periodStart||''))||((a.sort||0)-(b.sort||0));};
    Object.keys(_OKR_QVK).forEach(k=>_OKR_QVK[k].sort(byAnnual));
    qRoots.sort(byAnnual);
    tree=qRoots.length?`<div style="font-size:11.5px;color:var(--c-text-3);margin-bottom:8px">Quarterly view — quarters keep their annual hierarchy${(F.okrQtr||[]).length?'':' · tick quarters in the filter to focus on one'}</div>`+qRoots.map(o=>_okrNodeHTML(o,0)).join('')
      :empty('chart','No quarterly objectives','Turn on the “Annual objective” toggle on an objective to split it into quarters.');
  }else if(fActive){
    const q=(F.okrQ||'').toLowerCase();
    const _qy=Number(F.okrQtrYear)||new Date().getFullYear();
    const hits=vis.filter(o=>{
      if(o.quarterLabel)return false; // annual view: the quarterly splits live in the Quarterly view
      if((F.okrQtr||[]).length&&!_okrInQuarters(o,F.okrQtr,_qy))return false;
      if(F.okrDept&&okrRootOf(o).departmentId!==F.okrDept)return false;
      if(F.okrSub&&okrRootOf(o).subDepartmentId!==F.okrSub)return false;
      if(F.okrOwner&&o.ownerId!==F.okrOwner)return false;
      if(F.okrStatus&&okrStatusOf(o)!==F.okrStatus)return false;
      if(F.okrLvl!==''&&F.okrLvl!==undefined&&okrLevel(o)!==Number(F.okrLvl))return false;
      if(q&&!((o.title||'').toLowerCase().includes(q)||(o.description||'').toLowerCase().includes(q)))return false;
      return true;
    });
    // Flat list follows TREE order (pre-order walk) — an annual's quarters stay together, then
    // its other sub-objectives, instead of raw creation order interleaving them confusingly.
    const _ord={};let _oi=0;
    const _walkOrd=(o)=>{_ord[o.id]=_oi++;okrChildren(o.id).forEach(_walkOrd);};
    (DB.okrs||[]).filter(o=>!o.parentId||!okrById(o.parentId)).sort((a,b)=>((a.sort||0)-(b.sort||0))||String(a.createdAt||'').localeCompare(String(b.createdAt||''))).forEach(_walkOrd);
    hits.sort((a,b)=>((_ord[a.id]!==undefined?_ord[a.id]:1e9)-(_ord[b.id]!==undefined?_ord[b.id]:1e9)));
    tree=hits.length?`<div style="font-size:11.5px;color:var(--c-text-3);margin-bottom:8px">${hits.length} match${hits.length===1?'':'es'} — showing flat list</div>`+hits.map(o=>_okrNodeHTML(o,0)).join('')
      :empty('chart','Nothing matches','Try clearing a filter.');
  }else{
    // Annual tree (default) — quarterly splits live in the Quarterly view
    const roots=okrVisibleRoots().filter(o=>!o.quarterLabel);
    tree=roots.length?roots.map(o=>_okrNodeHTML(o,0)).join('')
      :empty('chart','No OKRs yet',canCreate?'Create your first L0 objective, assign it to a department and an owner, then add L1 / L2 sub-objectives under it.':'No OKRs have been assigned to you yet. Your manager creates them.');
  }
  return `<div class="fade">${head}${_howBar('okr')}${summary}${duePanel}${fBar}<div>${tree}</div></div>`;
}

function _okrNodeHTML(o,depth){
  if(depth>10)return'';
  // Annual view: quarterly splits hidden (they live in the Quarterly view).
  // Quarterly view: children = the node's regular children + the matching child-annual quarters.
  const _qv=(S.filters.okrView==='quarter');
  const kids=_qv?[...okrChildren(o.id).filter(k=>!k.quarterLabel),...((_OKR_QVK&&_OKR_QVK[o.id])||[])]
              :okrChildren(o.id).filter(k=>!k.quarterLabel);
  const lvl=okrLevel(o);
  const exp=_qv?(_OKR_EXP[o.id]!==false):!!_OKR_EXP[o.id]; // quarterly hierarchy opens expanded
  const panel=_OKR_PANEL[o.id]||null;
  const pct=okrProgress(o);
  const st=okrStatusOf(o);
  const barC=_okrBarColor(st);
  const owner=uById(o.ownerId);
  const dept=(DB.departments||[]).find(d=>d.id===o.departmentId);
  const subDept=(DB.departments||[]).find(d=>d.id===o.subDepartmentId);
  const canEdit=_okrCanEditNode(o),canCk=_okrCanCheckin(o),canCreate=_okrCanCreate();
  const icBtn='width:22px;height:22px;display:grid;place-items:center;border-radius:6px;color:var(--c-text-3);background:transparent;border:none;cursor:pointer;flex-shrink:0';
  const meta='font-size:10px;color:var(--c-text-2);display:inline-flex;align-items:center;gap:3px';
  const pTab=(which,label,icon)=>`<button onclick="App._okrTogPanel('${o.id}','${which}')" style="display:inline-flex;align-items:center;gap:4px;padding:1px 7px;border-radius:6px;min-height:20px;border:1px solid ${panel===which?'var(--c-text)':'var(--c-border)'};background:${panel===which?'var(--c-ink)':'var(--c-surface)'};color:${panel===which?'#fff':'var(--c-text-2)'};font-size:10px;font-weight:700;cursor:pointer">${ic(icon,'w-3 h-3')}${label}<span style="font-size:7px;transform:${panel===which?'rotate(180deg)':'none'};display:inline-block">▼</span></button>`;
  /* Compact card: ONE header line (chips · title · slim meta), plain "current / target" numbers,
     a small inline meter next to the % — no full-width bar row — and one tight action strip. */
  const curTgt=o.metricType==='yesno'?((okrLatestCheckin(o.id)||{}).value>=1?'Done':'Not done'):`${_okrFmtVal(o,_okrOwnCur(o))} / ${okrHasRevision(o)?`<s style="opacity:.55">${_okrFmtVal(o,o.targetValue)}</s> ${_okrFmtVal(o,o.revisedTarget)}`:_okrFmtVal(o,o.targetValue)}`;
  const card=`<div style="background:var(--c-surface);border:1px solid var(--c-border);border-radius:10px;margin-bottom:4px;${depth?'margin-left:'+Math.min(depth,5)*14+'px;':''}${o.closed?'opacity:.72;':''}overflow:hidden">
    <div style="padding:6px 10px 5px">
      <div style="display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap;row-gap:3px">
        ${kids.length?`<button onclick="App._okrTogExp('${o.id}')" title="${exp?'Collapse':'Expand'} sub-objectives" style="${icBtn};transform:${exp?'rotate(90deg)':'none'}">${ic('chevR','w-4 h-4')}</button>`:`<span style="width:22px;flex-shrink:0;display:grid;place-items:center;margin-top:6px"><span style="width:4px;height:4px;border-radius:50%;background:var(--c-border)"></span></span>`}
        <div style="flex:1;min-width:180px">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0;row-gap:2px">
            ${_okrLvlChip(lvl)}${o.quarterLabel?_okrQtrChip(o.quarterLabel):''}${o.isAnnual?_okrAnnualChip():''}<span class="fd" style="font-size:12.5px;font-weight:800;color:var(--c-text);line-height:1.3;min-width:0">${esc(o.title||'Untitled')}</span>
            ${owner?`<span title="Owner: ${esc(fullName(owner))}" style="flex-shrink:0;display:inline-flex;cursor:default">${avatar(owner,'w-4 h-4','text-[8px]')}</span>`:''}
            ${dept?`<span style="${meta}">${ic('dept','w-3 h-3')}${esc(dept.name)}${subDept?' › '+esc(subDept.name):''}</span>`:''}
            ${o.periodStart||o.periodEnd?`<span style="${meta}">${ic('doc','w-3 h-3')}${fmtS(o.periodStart)} → ${fmtS(o.periodEnd)}</span>`:''}
            ${kids.length?`<span style="${meta}">${ic('tree','w-3 h-3')}${kids.length} sub</span>`:''}
            ${okrHasRevision(o)?`<span style="${meta};color:#B45309;font-weight:800" title="Target was revised — original kept for comparison">${ic('edit','w-3 h-3')}Revised</span>`:''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:7px;flex-shrink:0;margin-left:auto;margin-top:1px">
          <span style="font-size:10px;font-weight:600;color:var(--c-text-3);white-space:nowrap">${curTgt}</span>
          <div title="${pct===null?'No data yet':pct+'% of target'}" style="width:52px;height:3px;background:var(--c-border);border-radius:2px;overflow:hidden;flex-shrink:0"><div style="height:100%;width:${pct===null?0:Math.max(0,Math.min(100,pct))}%;background:${barC};border-radius:2px;transition:width .3s"></div></div>
          <span class="fd" style="font-size:11.5px;font-weight:800;color:var(--c-text);min-width:32px;text-align:right">${pct===null?'—':pct+'%'}</span>
          ${o.closed?`<span title="Closed${o.closedReason?': '+esc(o.closedReason):''}" style="display:inline-flex;cursor:default">${okrStatusChip(st,true)}</span>`:okrStatusChip(st,true)}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:5px;margin-top:4px;flex-wrap:wrap">
        ${pTab('rules','Rules & Target','cog')}
        <button onclick="App._okrProgressModal('${o.id}')" style="display:inline-flex;align-items:center;gap:4px;padding:1px 7px;border-radius:6px;min-height:20px;border:1px solid var(--c-border);background:var(--c-surface);color:var(--c-text-2);font-size:10px;font-weight:700;cursor:pointer">${ic('chart','w-3 h-3')}Progress & Updates</button>
        <span style="flex:1"></span>
        ${canCreate?`<button onclick="App._okrEdit(null,'${o.id}')" title="Add sub-objective (L${lvl+1})" style="${icBtn}">${ic('plus','w-4 h-4')}</button>`:''}
        ${canEdit?`<button onclick="App._okrMove('${o.id}')" title="Move to another parent or level — sub-objectives move with it" style="${icBtn}">${ic('move','w-3.5 h-3.5')}</button>`:''}
        ${canEdit&&!o.closed&&o.metricType!=='yesno'?`<button onclick="App._okrRevise('${o.id}')" title="Revise targets — the original stays for comparison" style="${icBtn}">${ic('refresh','w-3.5 h-3.5')}</button>`:''}
        ${canEdit?(o.closed?`<button onclick="App._okrReopen('${o.id}')" title="Reopen this objective (closed${o.closedReason?': '+esc(o.closedReason):''})" style="${icBtn};color:#B45309">${ic('unlock','w-3.5 h-3.5')}</button>`:`<button onclick="App._okrCloseAsk('${o.id}')" title="Close — freeze updates but keep it on record" style="${icBtn}">${ic('lock','w-3.5 h-3.5')}</button>`):''}${canEdit?`<button onclick="App._okrEdit('${o.id}')" title="Edit" style="${icBtn}">${ic('edit','w-3.5 h-3.5')}</button><button onclick="App._okrDelete('${o.id}')" title="Delete" style="${icBtn}">${ic('trash','w-3.5 h-3.5')}</button>`:''}
      </div>
    </div>
    ${panel==='rules'?_okrRulesPanel(o):''}
  </div>`;
  return card+(exp?kids.map(k=>_okrNodeHTML(k,depth+1)).join(''):'');
}

/* ── Panel ①: Rules & Target ── */
function _okrRulesPanel(o){
  const owner=uById(o.ownerId),creator=uById(o.createdBy);
  const dept=(DB.departments||[]).find(d=>d.id===o.departmentId);
  const subDept=(DB.departments||[]).find(d=>d.id===o.subDepartmentId);
  const kids=okrChildren(o.id);
  const mLabel=(OKR_METRICS.find(m=>m[0]===o.metricType)||['','Number'])[1];
  const row=(l,v)=>`<div style="display:flex;flex-direction:column;gap:2px;min-width:130px"><span style="font-size:10px;font-weight:700;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em">${l}</span><span style="font-size:13px;font-weight:600;color:var(--c-text)">${v}</span></div>`;
  return `<div style="border-top:1px solid var(--c-border);background:var(--c-surface-2);padding:14px 16px">
    ${o.description?`<div style="font-size:13px;color:var(--c-text-2);line-height:1.55;margin-bottom:12px"><b style="color:var(--c-text)">Goal:</b> ${esc(o.description)}</div>`:''}
    <div style="display:flex;flex-wrap:wrap;gap:16px 26px">
      ${row('Measured as',esc(mLabel))}
      ${o.metricType==='yesno'?row('Target','Done (Yes)'):row('Start → Target',esc(_okrFmtVal(o,o.startValue))+' → '+esc(_okrFmtVal(o,o.targetValue)))}
      ${o.metricType!=='yesno'?row('Better when',o.direction==='down'?'Lower ↓':'Higher ↑'):''}
      ${row('Check-in schedule',esc(_okrFreqLabel(o)))}
      ${row('Period',(o.periodStart||o.periodEnd)?(fmtS(o.periodStart)+' → '+fmtS(o.periodEnd)):'Ongoing')}
      ${row('Owner',owner?esc(fullName(owner)):'—')}
      ${dept?row('Department',esc(dept.name)):''}
      ${subDept?row('Sub-department',esc(subDept.name)):''}
      ${row('Progress source',o.rollup?('Auto · '+esc(_okrModeLabel(o.rollupMode))+' of direct sub-objectives (roll-up override)'):(o.isAnnual?'Auto · combined progress of its quarters (equal weight)':'Own check-ins'))}
      ${row('Status',o.statusMode==='manual'?('Marked manually ('+esc(o.statusManual||'—')+')'):'Automatic')}
      ${creator?row('Created by',esc(fullName(creator))+(o.createdAt?' · '+fmtS(String(o.createdAt).slice(0,10)):'')):''}
    </div>
    ${(o.frequency||{}).type==='custom'&&((o.frequency||{}).dates||[]).length?`<div style="margin-top:10px;font-size:12px;color:var(--c-text-2)"><b>Check-in dates:</b> ${(o.frequency.dates||[]).map(d=>esc(fmtS(d))).join(', ')}</div>`:''}
    ${okrHasRevision(o)?`<div style="margin-top:10px;font-size:12px;color:#92400E;background:#FEF3C7;border:1px solid #FDE68A;border-radius:9px;padding:8px 11px;line-height:1.5"><b>Revised</b> ${o.revisedAt?esc(fmtS(String(o.revisedAt).slice(0,10))):''}${o.revisedBy&&uById(o.revisedBy)?' by '+esc(fullName(uById(o.revisedBy))):''}: ${esc(_okrFmtVal(o,o.targetValue))} → <b>${esc(_okrFmtVal(o,o.revisedTarget))}</b>${o.revisedNote?' — “'+esc(o.revisedNote)+'”':''} · same updates feed both numbers</div>`:''}
    ${o.closed?`<div style="margin-top:10px;font-size:12px;color:#374151;background:#E5E7EB;border-radius:9px;padding:8px 11px;line-height:1.5"><b>Closed</b> ${o.closedAt?esc(fmtS(String(o.closedAt).slice(0,10))):''}${o.closedBy&&uById(o.closedBy)?' by '+esc(fullName(uById(o.closedBy))):''}${o.closedReason?' — “'+esc(o.closedReason)+'”':''} · frozen for record, no further updates</div>`:''}
    ${_okrCanEditNode(o)?`<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">${btn('Edit rules & target',`App._okrEdit('${o.id}')`,{variant:'ghost',size:'sm',icon:'edit'})}${o.metricType!=='yesno'&&!o.closed?btn(okrHasRevision(o)?'Edit revision':'Revise targets',`App._okrRevise('${o.id}')`,{variant:'ghost',size:'sm',icon:'refresh'}):''}${o.closed?btn('Reopen',`App._okrReopen('${o.id}')`,{variant:'ghost',size:'sm',icon:'unlock'}):btn('Close for record',`App._okrCloseAsk('${o.id}')`,{variant:'ghost',size:'sm',icon:'lock'})}</div>`:''}
  </div>`;
}

/* ── Panel ②: Progress & Updates ── */
function _okrProgressPanel(o,kids,pct,st){
  const last=okrLatestCheckin(o.id);
  const canCk=_okrCanCheckin(o);
  const lab='font-size:10px;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.05em;font-weight:700';
  const big='font-size:20px;font-weight:800;color:var(--c-text)';
  const _ownCur=_okrOwnCur(o);
  const cur=esc(_okrFmtVal(o,_okrOwnCur(o)));
  const tgt=o.metricType==='yesno'?'Yes':esc(_okrFmtVal(o,o.targetValue));
  const strt=o.metricType==='yesno'?'No':esc(_okrFmtVal(o,o.startValue));
  // manual status marking (owner / manager) — every mark is logged
  const markRow=canCk?`<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:10px">
      <span style="font-size:11px;font-weight:700;color:var(--c-text-3)">MARK:</span>
      ${OKR_STATUSES.map(s=>{const on=o.statusMode==='manual'&&o.statusManual===s;const m=OKR_ST_META[s];return`<button onclick="App._okrMarkStatus('${o.id}','${s}')" style="padding:4px 10px;border-radius:20px;border:1.5px solid ${on?m.dot:'var(--c-border)'};background:${on?m.bg:'var(--c-surface)'};color:${on?m.fg:'var(--c-text-2)'};font-size:11px;font-weight:700;cursor:pointer">${s}</button>`;}).join('')}
      <button onclick="App._okrMarkStatus('${o.id}','auto')" title="Let progress decide the status" style="padding:4px 10px;border-radius:20px;border:1.5px solid ${o.statusMode!=='manual'?'var(--c-text)':'var(--c-border)'};background:${o.statusMode!=='manual'?'var(--c-ink)':'var(--c-surface)'};color:${o.statusMode!=='manual'?'#fff':'var(--c-text-2)'};font-size:11px;font-weight:700;cursor:pointer">Auto</button>
    </div>`:'';
  const cmpBars=okrHasRevision(o)?(function(){
    const pr=okrProgress(o),po=okrProgressOrig(o);
    const bar=(lbl,pct,col)=>`<div style="display:flex;align-items:center;gap:8px"><span style="width:88px;font-size:10.5px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.03em">${lbl}</span><div style="flex:1;height:6px;background:var(--c-border);border-radius:3px;overflow:hidden"><div style="height:100%;width:${pct===null?0:Math.max(0,Math.min(100,pct))}%;background:${col}"></div></div><span style="width:46px;text-align:right;font-size:11.5px;font-weight:800;color:var(--c-text)">${pct===null?'—':pct+'%'}</span></div>`;
    const who=o.revisedBy&&uById(o.revisedBy)?fullName(uById(o.revisedBy)):'';
    return `<div style="background:var(--c-surface);border:1px solid var(--c-border);border-radius:12px;padding:11px 13px;margin-top:12px">
      <div style="display:flex;flex-direction:column;gap:6px">${bar('vs revised',pr,'#F59E0B')}${bar('vs original',po,'#0E9F6E')}</div>
      <div style="font-size:11px;color:var(--c-text-3);margin-top:8px">Revised${o.revisedAt?' '+fmtS(String(o.revisedAt).slice(0,10)):''}${who?' by '+esc(who):''}${o.revisedNote?' — “'+esc(o.revisedNote)+'”':''} · same updates feed both numbers</div>
    </div>`;})():'';
  const rollupNote=(o.rollup||o.isAnnual)?`<div style="display:flex;gap:8px;align-items:center;background:var(--c-info-soft);border:1px solid #BFDBFE;border-radius:10px;padding:8px 12px;margin-top:10px;font-size:12px;color:#1E40AF">${ic('refresh','w-3.5 h-3.5')}${o.rollup?`This objective updates automatically — its current value is the <b>&nbsp;${esc(_okrModeLabel(o.rollupMode))}&nbsp;</b> of its direct sub-objectives${o.isAnnual?' (roll-up override — turn it off in the editor for quarters-progress instead)':''}.`:`This annual objective updates automatically — its progress is the <b>&nbsp;combined progress of its quarters&nbsp;</b> (each quarter counts equally; the level below doesn't feed it).`}</div>`:'';
  // check-in feed (latest first)
  const feed=okrCheckinsOf(o.id).slice().reverse().slice(0,30).map(c=>{
    const u=uById(c.userId);
    const photos=(c.photos||[]).filter(p=>typeof p==='string'&&p!=='[photo]');
    const canEditCk=c.userId===S.uid||_okrCanManage();
    return `<div style="display:flex;gap:10px;padding:10px 0;border-top:1px solid var(--c-border)">
      <div style="width:64px;flex-shrink:0;font-size:11.5px;color:var(--c-text-2);font-weight:600">${esc(fmtS(c.date))}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
          <span style="font-size:13px;font-weight:800;color:var(--c-brand-ink)">${esc(_okrFmtVal(o,c.value))}</span>
          ${c.statusMark?okrStatusChip(c.statusMark,true):''}
          <span style="font-size:11px;color:var(--c-text-3)">${u?esc(fullName(u)):'—'}</span>
          ${(c.editCount||0)>0?`<span style="font-size:9.5px;font-weight:800;background:#FEF3C7;color:#92400E;padding:1px 6px;border-radius:10px">edited ×${c.editCount}</span>`:''}
          ${canEditCk?`<button onclick="App._okrCheckin('${o.id}','${c.date}')" title="Edit this update (logged)" style="width:22px;height:22px;display:grid;place-items:center;border-radius:6px;color:var(--c-text-3);background:transparent;border:none;cursor:pointer">${ic('edit','w-3 h-3')}</button>`:''}${canEditCk?`<button onclick="App._okrCkDel('${o.id}','${c.id}')" title="Delete this update (logged)" style="width:22px;height:22px;display:grid;place-items:center;border-radius:6px;color:var(--c-text-3);background:transparent;border:none;cursor:pointer" onmouseover="this.style.color='#BE123C'" onmouseout="this.style.color='var(--c-text-3)'">${ic('trash','w-3 h-3')}</button>`:''}
        </div>
        ${c.comment?`<div style="font-size:12px;color:var(--c-text-2);font-style:italic;margin-top:3px">"${esc(c.comment)}"</div>`:''}
        ${photos.length?`<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">${photos.map(p=>`<img src="${esc(p)}" onclick="App._bigImg('${esc(p)}')" alt="Check-in photo" style="width:44px;height:44px;object-fit:cover;border-radius:8px;cursor:pointer;border:1px solid var(--c-border)"/>`).join('')}</div>`:''}
      </div>
    </div>`;
  }).join('')||`<div style="padding:12px 0;color:var(--c-text-3);font-size:12.5px;border-top:1px solid var(--c-border)">No updates yet${canCk?' — add the first one.':'.'}</div>`;
  // children breakdown (roll-up view)
  const kidRows=kids.length?`<div style="margin-top:12px">
      <div style="${lab};margin-bottom:6px">${o.rollup?('Sub-objectives — feeding this objective ('+esc(_okrModeLabel(o.rollupMode))+')'):o.isAnnual?'Quarterly objectives — feeding this annual (other sub-objectives have their own panels)':'Sub-objectives (each tracks its own progress)'}</div>
      ${kids.map(k=>{const kp=okrProgress(k),ks=okrStatusOf(k);return`<div style="display:flex;align-items:center;gap:9px;padding:6px 0">
        ${_okrLvlChip(okrLevel(k))}${k.quarterLabel?_okrQtrChip(k.quarterLabel):''}
        <span style="flex:1;min-width:0;font-size:12.5px;font-weight:600;color:var(--c-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(k.title)}</span>
        <div style="width:90px;height:5px;background:var(--c-border);border-radius:3px;overflow:hidden"><div style="height:100%;width:${kp===null?0:Math.max(0,Math.min(100,kp))}%;background:${_okrBarColor(ks)}"></div></div>
        <span style="font-size:10.5px;color:var(--c-text-3);white-space:nowrap">${k.metricType==='yesno'?((okrLatestCheckin(k.id)||{}).value>=1?'Done':'Not done'):esc(_okrFmtVal(k,_okrOwnCur(k)))+' / '+esc(_okrFmtVal(k,k.targetValue))}</span><span style="font-size:12px;font-weight:800;color:var(--c-text);width:44px;text-align:right">${kp===null?'—':kp+'%'}</span>
        ${okrStatusChip(ks,true)}
      </div>`;}).join('')}
    </div>`:'';
  const logs=(DB.okrLogs||[]).filter(l=>l.okrId===o.id);
  return `<div style="border-top:1px solid var(--c-border);background:var(--c-surface-2);padding:14px 16px">
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div style="display:flex;gap:22px;flex-wrap:wrap">
        <div><div style="${lab}">Start</div><div style="${big}">${strt}</div></div>
        <div><div style="${lab}">Current${(o.rollup||o.isAnnual)?' · auto':''}</div><div style="${big}">${cur}</div></div>
        <div><div style="${lab}">${okrHasRevision(o)?'Original target':'Target'}</div><div style="${big}${okrHasRevision(o)?';text-decoration:line-through;opacity:.6':''}">${tgt}</div></div>
        ${okrHasRevision(o)?`<div><div style="${lab};color:#B45309">Revised target</div><div style="${big};color:#B45309">${esc(_okrFmtVal(o,o.revisedTarget))}</div></div>`:''}
        <div><div style="${lab}">Status</div><div style="margin-top:3px">${okrStatusChip(st)}</div></div>
      </div>
      ${canCk?btn(kids.length?'Add note / update':'Add update',`App._okrCheckin('${o.id}','${todayISO()}')`,{variant:'primary',size:'sm',icon:'plus'}):''}
    </div>
    ${markRow}
    ${cmpBars}
    ${o.closed?`<div style="display:flex;gap:8px;align-items:center;background:#E5E7EB;border-radius:10px;padding:8px 12px;margin-top:10px;font-size:12px;color:#374151">${ic('lock','w-3.5 h-3.5')}<b>Closed</b>&nbsp;${o.closedAt?esc(fmtS(String(o.closedAt).slice(0,10))):''}${o.closedBy&&uById(o.closedBy)?' by '+esc(fullName(uById(o.closedBy))):''}${o.closedReason?' — “'+esc(o.closedReason)+'”':''} · kept for record, updates are frozen</div>`:''}
    ${rollupNote}
    <div style="height:190px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:12px;padding:10px;margin-top:12px;position:relative">
      <div style="position:absolute;top:10px;right:12px;z-index:2;display:flex;align-items:baseline;gap:4px;background:var(--c-surface);padding:1px 8px;border-radius:8px;border:1px solid var(--c-border)"><span style="font-size:15px;font-weight:800;color:var(--c-text)">${pct===null?'—':pct+'%'}</span><span style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--c-text-3)">progress</span></div>
      <canvas data-okr-chart="${o.id}"></canvas>
    </div>
    ${kidRows}
    <div style="margin-top:12px">
      <div style="${lab};margin-bottom:2px">Updates & inputs</div>
      <div style="max-height:300px;overflow-y:auto">${feed}</div>
    </div>
    ${logs.length?`<button onclick="App._okrNodeLogs('${o.id}')" style="margin-top:10px;display:inline-flex;align-items:center;gap:6px;background:transparent;border:none;cursor:pointer;font-size:11.5px;font-weight:700;color:var(--c-text-3)">${ic('audit','w-3.5 h-3.5')}${logs.length} logged changes — view →</button>`:''}
  </div>`;
}

/* ── Node editor (create / edit any level) ── */
App._okrEdit=(id,parentId)=>{
  const existing=id?okrById(id):null;
  if(existing&&!_okrCanEditNode(existing))return toast('You can\'t edit this OKR','err');
  if(!existing&&!_okrCanCreate())return toast('You can\'t create OKRs','err');
  _OKRED=existing?JSON.parse(JSON.stringify(existing)):{id:uid('okr'),parentId:parentId||null,title:'',description:'',departmentId:null,subDepartmentId:null,ownerId:S.uid,metricType:'number',startValue:0,targetValue:null,unit:'',direction:'up',frequency:{type:'weekly',day:'Mon'},periodStart:null,periodEnd:null,statusMode:'auto',statusManual:null,isAnnual:false,quarterLabel:null,sort:okrChildren(parentId||null).length,createdBy:S.uid,createdAt:new Date().toISOString()};
  delete _OKRED._qRows;delete _OKRED._qEdit;
  if(existing&&existing.isAnnual)_OKRED._qEdit=_okrBuildQEdit(existing.id); // live quarter values — edits made on the quarters themselves show up here
  App._renderOKREdit();
};
/* Editable snapshot of the EXISTING quarterly objectives, always read fresh from the tree
   (so a change made on a quarter directly is what the annual's editor shows — and edits made
   here write back to those same quarter objectives on Save). */
function _okrBuildQEdit(id){return okrChildren(id).filter(k=>k.quarterLabel).map(k=>({id:k.id,label:k.quarterLabel,start:k.periodStart,end:k.periodEnd,startVal:(k.startValue===null||k.startValue===undefined)?0:k.startValue,target:(k.targetValue===null||k.targetValue===undefined)?null:k.targetValue}));}
App._okrEdQESet=(i,field,val)=>{
  const o=_OKRED;if(!o||!o._qEdit||!o._qEdit[i])return;
  if(field==='startVal'||field==='target')o._qEdit[i][field]=val===''?null:parseFloat(val);
  else o._qEdit[i][field]=val;
};
/* ── Annual objective → quarterly split (editor-side helpers) ──
   _OKRED._qRows holds the NEW quarterly periods being defined: [{label,start,end,startVal,target}].
   Fully flexible: keep 2, add 6, change any date — the defaults are only a starting point. */
function _okrCalQuarters(ps,pe){
  const y=ps.slice(0,4);
  if(ps===y+'-01-01'&&pe===y+'-12-31'){const R=_okrQuarterRanges(Number(y));return['Q1','Q2','Q3','Q4'].map(q=>({label:q,start:R[q][0],end:R[q][1]}));}
  const t0=new Date(ps+'T00:00:00'),t1=new Date(pe+'T00:00:00');
  if(isNaN(t0)||isNaN(t1)||t1<=t0)return[];
  const days=Math.round((t1-t0)/86400000)+1,slice=days/4,out=[];
  for(let i=0;i<4;i++){
    const s=i===0?ps:_okrDateAddD(ps,Math.round(slice*i));
    const e=i===3?pe:_okrDateAddD(ps,Math.round(slice*(i+1))-1);
    out.push({label:'Q'+(i+1),start:s,end:e});
  }
  return out;
}
function _okrGenQRows(o){
  let ps=o.periodStart,pe=o.periodEnd;
  if(!ps||!pe){const y=new Date().getFullYear();ps=y+'-01-01';pe=y+'-12-31';o.periodStart=ps;o.periodEnd=pe;}
  const qs=_okrCalQuarters(ps,pe);
  const s=Number(o.startValue||0),t=(o.targetValue===null||o.targetValue===undefined)?null:Number(o.targetValue);
  const n=qs.length||1,round=x=>Math.round(x*100)/100;
  const mode=o.rollupMode||'latest';
  return qs.map((q,i)=>{
    let sv=0,tv=null;
    if(t!==null&&isFinite(t)){
      if(mode==='sum'){sv=0;tv=round(t/n);}                                    // each quarter contributes its share; year total = sum
      else if(mode==='avg'){sv=s;tv=t;}                                        // every quarter aims at the same rate; year = average
      else{sv=round(s+(t-s)*i/n);tv=round(s+(t-s)*(i+1)/n);}                   // latest/max/min: staircase from start → target
    }else{sv=(mode==='sum')?0:s;}
    return{label:q.label,start:q.start,end:q.end,startVal:sv,target:tv};
  });
}
App._okrEdTogAnnual=()=>{
  const o=_OKRED;if(!o)return;
  o.isAnnual=!o.isAnnual; // NEVER touches the roll-up toggle — both are manual and independent
  if(o.isAnnual){
    const hasQKids=okrById(o.id)&&okrChildren(o.id).some(k=>k.quarterLabel);
    o._qRows=hasQKids?[]:_okrGenQRows(o);
    o._qEdit=hasQKids?_okrBuildQEdit(o.id):null;
  }else{delete o._qRows;delete o._qEdit;}
  App._renderOKREdit();
};
App._okrEdReQ=()=>{const o=_OKRED;if(!o||!o.isAnnual)return;o._qRows=_okrGenQRows(o);App._renderOKREdit();};
App._okrEdQAdd=()=>{
  const o=_OKRED;if(!o)return;o._qRows=o._qRows||[];
  const last=o._qRows[o._qRows.length-1];
  const nQKids=okrById(o.id)?okrChildren(o.id).filter(k=>k.quarterLabel).length:0;
  const start=last?_okrDateAddD(last.end,1):(o.periodStart||todayISO());
  o._qRows.push({label:'Q'+(o._qRows.length+nQKids+1),start:start,end:_okrDateAddD(_okrDateAddM(start,3),-1),startVal:last?(last.target!==null&&last.target!==undefined?last.target:0):Number(o.startValue||0),target:null});
  App._renderOKREdit();
};
App._okrEdQRm=(i)=>{const o=_OKRED;if(o&&o._qRows){o._qRows.splice(i,1);App._renderOKREdit();}};
App._okrEdQSet=(i,field,val)=>{
  const o=_OKRED;if(!o||!o._qRows||!o._qRows[i])return;
  if(field==='startVal'||field==='target')o._qRows[i][field]=val===''?null:parseFloat(val);
  else o._qRows[i][field]=val;
};
App._okrEdSetFreqType=(t)=>{const o=_OKRED;if(!o)return;if(t==='none')o.frequency={};else if(t==='weekly')o.frequency={type:'weekly',day:(o.frequency||{}).day&&WKDAYS.includes(o.frequency.day)?o.frequency.day:'Mon'};else if(t==='monthly')o.frequency={type:'monthly',day:Number((o.frequency||{}).day)||1};else o.frequency={type:'custom',dates:Array.isArray((o.frequency||{}).dates)?o.frequency.dates:[]};App._renderOKREdit();};
App._okrEdAddDate=()=>{const el=document.getElementById('okrEdCustomDate');if(!el||!el.value)return;const o=_OKRED;o.frequency=o.frequency||{type:'custom',dates:[]};o.frequency.dates=o.frequency.dates||[];if(!o.frequency.dates.includes(el.value)){o.frequency.dates.push(el.value);o.frequency.dates.sort();}App._renderOKREdit();};
App._okrEdRmDate=(i)=>{const o=_OKRED;if(o&&o.frequency&&Array.isArray(o.frequency.dates)){o.frequency.dates.splice(i,1);App._renderOKREdit();}};
/* The "Annual objective" block of the editor: toggle → flexible quarterly periods. */
function _okrEdAnnualSection(o,L){
  const isExisting=!!okrById(o.id);
  const qKids=isExisting?okrChildren(o.id).filter(k=>k.quarterLabel):[];
  const rows=o._qRows||[];
  const inp='class="ui-input" style="min-height:34px;padding:5px 8px;font-size:12px"';
  const rowHTML=(r,i)=>`<div style="display:grid;grid-template-columns:64px 1fr 1fr 86px 86px 26px;gap:6px;align-items:center;margin-top:6px">
      <input type="text" value="${esc(r.label||'')}" oninput="App._okrEdQSet(${i},'label',this.value)" ${inp} placeholder="Q${i+1}"/>
      <input type="date" value="${r.start||''}" onchange="App._okrEdQSet(${i},'start',this.value)" ${inp}/>
      <input type="date" value="${r.end||''}" onchange="App._okrEdQSet(${i},'end',this.value)" ${inp}/>
      <input type="number" step="any" value="${r.startVal!==null&&r.startVal!==undefined?r.startVal:''}" oninput="App._okrEdQSet(${i},'startVal',this.value)" ${inp} placeholder="Start"/>
      <input type="number" step="any" value="${r.target!==null&&r.target!==undefined?r.target:''}" oninput="App._okrEdQSet(${i},'target',this.value)" ${inp} placeholder="Target"/>
      <button type="button" onclick="App._okrEdQRm(${i})" title="Remove this period" style="width:24px;height:24px;border-radius:7px;border:none;background:var(--c-surface-2);color:var(--c-text-3);cursor:pointer;font-size:13px;line-height:1">×</button>
    </div>`;
  const qEdit=o._qEdit||[];
  const gridHead=`<div style="display:grid;grid-template-columns:64px 1fr 1fr 86px 86px 26px;gap:6px;font-size:10px;font-weight:800;color:var(--c-text-3);text-transform:uppercase;letter-spacing:.04em;margin-top:4px"><span>Label</span><span>From</span><span>To</span><span>Start</span><span>Target</span><span></span></div>`;
  const eRow=(r,i)=>`<div style="display:grid;grid-template-columns:64px 1fr 1fr 86px 86px 26px;gap:6px;align-items:center;margin-top:6px">
      <input type="text" value="${esc(r.label||'')}" oninput="App._okrEdQESet(${i},'label',this.value)" ${inp}/>
      <input type="date" value="${r.start||''}" onchange="App._okrEdQESet(${i},'start',this.value)" ${inp}/>
      <input type="date" value="${r.end||''}" onchange="App._okrEdQESet(${i},'end',this.value)" ${inp}/>
      <input type="number" step="any" value="${r.startVal!==null&&r.startVal!==undefined?r.startVal:''}" oninput="App._okrEdQESet(${i},'startVal',this.value)" ${inp}/>
      <input type="number" step="any" value="${r.target!==null&&r.target!==undefined?r.target:''}" oninput="App._okrEdQESet(${i},'target',this.value)" ${inp}/>
      <span title="Existing quarterly objective — your edits save with this form" style="display:grid;place-items:center;color:#0B7A55">${ic('check','w-3.5 h-3.5')}</span>
    </div>`;
  return `<div style="border-top:1px dashed var(--c-border);padding-top:12px">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
      <div style="min-width:0"><label style="${L}">Annual objective — split into quarterly targets</label>
      <div style="font-size:11px;color:var(--c-text-3);margin-top:2px;line-height:1.5">Creates one linked objective per period below — <b>same owner, same metric</b>, only dates and targets differ. Their updates automatically drive this annual number; the owner never fills it in by hand.</div></div>
      <button type="button" role="switch" aria-checked="${o.isAnnual?'true':'false'}" class="tog ${o.isAnnual?'on':'off'}" style="margin-top:2px" onclick="App._okrEdTogAnnual()"><span></span></button>
    </div>
    ${o.isAnnual?`
      <div style="margin-top:10px;font-size:11px;color:#1E40AF;background:var(--c-info-soft);border:1px solid #BFDBFE;border-radius:9px;padding:8px 11px;line-height:1.5">${o.rollup?`<b>Note:</b> the “Auto-update from the level below” toggle (below) is also on and takes over the number. Turn it off for the quarters rule:`:''} This annual's progress = the <b>combined progress of its quarters</b>, each counting equally — e.g. Q1 done 10% and the rest untouched → annual shows 2.5%. Regular sub-objectives never feed it.</div>
      ${qEdit.length?`<div style="margin-top:12px"><label style="${L}">Quarterly objectives (${qEdit.length}) — edit them right here</label>
        ${gridHead}
        ${qEdit.map(eRow).join('')}
        <div style="font-size:11px;color:var(--c-text-3);margin-top:6px;line-height:1.45">Label, dates, start and target save onto each quarterly objective when you press <b>Save</b> — their check-in history is never touched. Edits made on a quarter from the tree show up here too.</div>
      </div>`:''}
      <div style="margin-top:12px">
        <label style="${L}">${qKids.length?'Add more periods':'Quarterly periods & targets'}</label>
        ${rows.length?gridHead:''}
        ${rows.map(rowHTML).join('')||(qKids.length?'':'<div style="font-size:11.5px;color:var(--c-text-3);margin-top:4px">No periods yet — add one below.</div>')}
        <div style="display:flex;gap:8px;margin-top:9px;flex-wrap:wrap">
          <button type="button" onclick="App._okrEdQAdd()" class="ui-btn ui-btn-ghost ui-btn-sm">${ic('plus','w-3.5 h-3.5')}Add period</button>
          ${!qKids.length?`<button type="button" onclick="App._okrEdReQ()" class="ui-btn ui-btn-ghost ui-btn-sm" title="Re-split the annual period into 4 suggested quarters">${ic('refresh','w-3.5 h-3.5')}Reset to 4 quarters</button>`:''}
        </div>
        <div style="font-size:11px;color:var(--c-text-3);margin-top:8px;line-height:1.5">Fully flexible — keep 2 periods, add 6, rename them, shift any date. Defaults split the annual period into 4 quarters with suggested values.</div>
      </div>`:''}
  </div>`;
}
App._renderOKREdit=()=>{
  const o=_OKRED;if(!o)return;
  const isExisting=!!okrById(o.id);
  const parent=o.parentId?okrById(o.parentId):null;
  const lvl=isExisting?okrLevel(o):(parent?okrLevel(parent)+1:0); // existing nodes show their real (display) level — a quarter reads L0, not L1
  const L='display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px';
  const users=visU().filter(u=>u&&u.status==='Active');
  const f=o.frequency||{};
  const fType=f.type||'none';
  // Department (top level) + separate Sub-department select (children of the chosen department)
  const deptOpts=(topDepts()||[]).map(d=>[d.id,d.name]);
  const subOpts=o.departmentId?(subDepts(o.departmentId)||[]).map(s=>[s.id,s.name]):[];
  const dayChip=d=>`<button type="button" onclick="_OKRED.frequency.day='${d}';App._renderOKREdit()" style="padding:6px 11px;border-radius:9px;border:1.5px solid ${f.day===d?'var(--c-text)':'var(--c-border)'};background:${f.day===d?'var(--c-ink)':'var(--c-surface)'};color:${f.day===d?'#fff':'var(--c-text-2)'};font-size:12px;font-weight:700;cursor:pointer">${d}</button>`;
  modalShell({title:(isExisting?'Edit':'New')+' L'+lvl+' objective',sub:parent?('Under: '+(parent.title||'—')):('Top-level objective — assigned to a department'),size:'max-w-lg',key:'okr-edit',
    body:`<div style="display:flex;flex-direction:column;gap:14px">
      <div><label style="${L}">Objective title *</label><input type="text" value="${esc(o.title||'')}" oninput="_OKRED.title=this.value" placeholder="e.g. Increase monthly revenue" class="ui-input rf"/></div>
      <div><label style="${L}">Goal / description</label><textarea rows="2" oninput="_OKRED.description=this.value" placeholder="What does success look like? Why does it matter?" class="ui-input rf" style="resize:vertical">${esc(o.description||'')}</textarea></div>
      ${!o.parentId?`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label style="${L}">Department *</label><select class="ui-select rf" onchange="_OKRED.departmentId=this.value||null;_OKRED.subDepartmentId=null;App._renderOKREdit()"><option value="">— Select department —</option>${deptOpts.map(d=>`<option value="${esc(d[0])}" ${o.departmentId===d[0]?'selected':''}>${esc(d[1])}</option>`).join('')}</select></div>
        <div><label style="${L}">Sub-department</label><select class="ui-select rf" ${subOpts.length?'':'disabled'} onchange="_OKRED.subDepartmentId=this.value||null"><option value="">${subOpts.length?'— All / none —':'No sub-departments'}</option>${subOpts.map(s=>`<option value="${esc(s[0])}" ${o.subDepartmentId===s[0]?'selected':''}>${esc(s[1])}</option>`).join('')}</select></div>
      </div>`:''}
      <div><label style="${L}">Owner (does the check-ins) *</label><select class="ui-select rf" onchange="_OKRED.ownerId=this.value||null"><option value="">— Select owner —</option>${users.map(u=>`<option value="${u.id}" ${o.ownerId===u.id?'selected':''}>${esc(fullName(u))}</option>`).join('')}</select></div>
      <div style="border-top:1px dashed var(--c-border);padding-top:12px"><label style="${L}">Rules & target — how is this measured?</label>
        <select class="ui-select rf" onchange="_OKRED.metricType=this.value;App._renderOKREdit()">${OKR_METRICS.map(m=>`<option value="${m[0]}" ${o.metricType===m[0]?'selected':''}>${m[1]}</option>`).join('')}</select>
      </div>
      ${o.metricType!=='yesno'?`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label style="${L}">Start value</label><input type="number" step="any" value="${o.startValue!==null&&o.startValue!==undefined?o.startValue:''}" oninput="_OKRED.startValue=this.value===''?0:parseFloat(this.value)" placeholder="0" class="ui-input rf"/></div>
        <div><label style="${L}">${okrHasRevision(o)?'Original target *':'Target value *'}</label><input type="number" step="any" value="${o.targetValue!==null&&o.targetValue!==undefined?o.targetValue:''}" oninput="_OKRED.targetValue=this.value===''?null:parseFloat(this.value)" placeholder="e.g. 100" class="ui-input rf"/></div>
      </div>
      ${okrHasRevision(o)?`<div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:11px;padding:10px 12px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:end">
          <div><label style="${L};color:#92400E">Revised target (drives progress)</label><input type="number" step="any" value="${o.revisedTarget!==null&&o.revisedTarget!==undefined?o.revisedTarget:''}" oninput="_OKRED.revisedTarget=this.value===''?null:parseFloat(this.value)" class="ui-input rf" style="border-color:#FDE68A"/></div>
          <div style="font-size:11px;color:#92400E;line-height:1.5;padding-bottom:4px">Revised ${o.revisedAt?esc(fmtS(String(o.revisedAt).slice(0,10))):''}${o.revisedBy&&uById(o.revisedBy)?' by '+esc(fullName(uById(o.revisedBy))):''}${o.revisedNote?' — “'+esc(o.revisedNote)+'”':''}</div>
        </div>
        <div style="font-size:11px;color:#B45309;margin-top:6px">This number is what progress is measured against; the original stays for comparison. Clear it (or set it back to the original) to remove the revision.</div>
      </div>`:''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label style="${L}">${o.metricType==='currency'?'Currency':'Unit'} ${o.metricType==='percent'?'(auto: %)':''}</label><input type="text" value="${esc(o.unit||'')}" oninput="_OKRED.unit=this.value" placeholder="${o.metricType==='currency'?'e.g. AED / $':'e.g. orders, hrs'}" class="ui-input rf" ${o.metricType==='percent'?'disabled':''}/></div>
        <div><label style="${L}">Better when</label><select class="ui-select rf" onchange="_OKRED.direction=this.value"><option value="up" ${o.direction!=='down'?'selected':''}>Higher is better</option><option value="down" ${o.direction==='down'?'selected':''}>Lower is better</option></select></div>
      </div>`:`<div style="font-size:12px;color:var(--c-text-3);background:var(--c-surface-2);border-radius:9px;padding:9px 12px">Yes / No objective — a check-in of "Yes" counts as 100%, "No" as 0%.</div>`}
      ${o.metricType!=='yesno'?_okrEdAnnualSection(o,L):''}
      ${o.metricType!=='yesno'?`<div style="border-top:1px dashed var(--c-border);padding-top:12px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
          <div style="min-width:0"><label style="${L}">Auto-update from the level below</label>
          <div style="font-size:11px;color:var(--c-text-3);margin-top:2px;line-height:1.5">L${lvl} takes its current value from its <b>direct L${lvl+1} sub-objectives only</b> — the owner never enters it by hand. Progress is still measured against this objective's own start → target.</div></div>
          <button type="button" role="switch" aria-checked="${o.rollup?'true':'false'}" class="tog ${o.rollup?'on':'off'}" style="margin-top:2px" onclick="_OKRED.rollup=!_OKRED.rollup;App._renderOKREdit()"><span></span></button>
        </div>
        ${o.isAnnual&&o.rollup?`<div style="margin-top:8px;font-size:11px;color:#92400E;background:#FEF3C7;border:1px solid #FDE68A;border-radius:9px;padding:7px 10px;line-height:1.5"><b>Both toggles are on</b> — this level-below roll-up drives the number and overrides the quarters-progress rule. Turn it off to go back to quarters-only.</div>`:''}
        ${o.isAnnual&&!o.rollup?`<div style="margin-top:8px;font-size:11px;color:var(--c-text-3);line-height:1.5">Off — this annual currently updates from its <b>quarterly objectives</b>. Turning this on makes the level below drive it instead.</div>`:''}
        ${o.rollup?`<div style="margin-top:10px"><label style="${L}">How to combine the L${lvl+1} values</label>
          <select class="ui-select rf" onchange="_OKRED.rollupMode=this.value">
            <option value="sum" ${!o.rollupMode||o.rollupMode==='sum'?'selected':''}>Total (sum of all)</option>
            <option value="avg" ${o.rollupMode==='avg'?'selected':''}>Average</option>
            <option value="max" ${o.rollupMode==='max'?'selected':''}>Highest value</option>
            <option value="min" ${o.rollupMode==='min'?'selected':''}>Lowest value</option>
            <option value="latest" ${o.rollupMode==='latest'?'selected':''}>Latest update (most recent value reported below)</option>
          </select>
          <div style="font-size:11px;color:var(--c-text-3);margin-top:6px">Works best when the L${lvl+1} sub-objectives measure the same thing in the same unit.</div></div>`:''}
      </div>`:''}
      ${(o.rollup&&!o.isAnnual)?'':`<div style="border-top:1px dashed var(--c-border);padding-top:12px"><label style="${L}">Check-in frequency — ${o.isAnnual?'when is the owner asked to update each quarterly objective?':'when is the owner asked for an update?'}</label>
        <select class="ui-select rf" onchange="App._okrEdSetFreqType(this.value)">
          <option value="weekly" ${fType==='weekly'?'selected':''}>Weekly · on a chosen day</option>
          <option value="monthly" ${fType==='monthly'?'selected':''}>Monthly · on a chosen date</option>
          <option value="custom" ${fType==='custom'?'selected':''}>Custom dates</option>
          <option value="none" ${fType==='none'?'selected':''}>No schedule (manual updates only)</option>
        </select>
        ${fType==='weekly'?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:9px">${WKDAYS.map(dayChip).join('')}</div><div style="font-size:11px;color:var(--c-text-3);margin-top:6px">Every ${esc(f.day||'Mon')}, this OKR joins the owner's combined check-in list.</div>`:''}
        ${fType==='monthly'?`<div style="display:flex;align-items:center;gap:8px;margin-top:9px"><span style="font-size:12.5px;color:var(--c-text-2)">Day of month</span><input type="number" min="1" max="31" value="${Number(f.day)||1}" oninput="_OKRED.frequency.day=Math.max(1,Math.min(31,parseInt(this.value)||1))" class="ui-input rf" style="width:80px"/><span style="font-size:11px;color:var(--c-text-3)">shorter months use their last day</span></div>`:''}
        ${fType==='custom'?`<div style="margin-top:9px"><div style="display:flex;gap:8px"><input type="date" id="okrEdCustomDate" class="ui-input rf" style="flex:1"/><button type="button" onclick="App._okrEdAddDate()" class="ui-btn ui-btn-ghost ui-btn-sm">Add</button></div>
          ${(f.dates||[]).length?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${(f.dates||[]).map((d,i)=>`<span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;background:var(--c-surface-2);border:1px solid var(--c-border);border-radius:20px;padding:3px 6px 3px 10px">${esc(fmtS(d))}<button type="button" onclick="App._okrEdRmDate(${i})" style="width:16px;height:16px;border-radius:50%;border:none;background:var(--c-border);color:var(--c-text-2);cursor:pointer;font-size:10px;line-height:1">×</button></span>`).join('')}</div>`:'<div style="font-size:11px;color:var(--c-text-3);margin-top:6px">No dates added yet.</div>'}</div>`:''}
      </div>`}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label style="${L}">Period start</label><input type="date" value="${o.periodStart||''}" oninput="_OKRED.periodStart=this.value||null" class="ui-input rf"/></div>
        <div><label style="${L}">Period end</label><input type="date" value="${o.periodEnd||''}" oninput="_OKRED.periodEnd=this.value||null" class="ui-input rf"/></div>
      </div>
      <div style="font-size:11px;color:var(--c-text-3)">The period drives the automatic On track / Off track pace and stops check-in reminders after it ends.</div>
    </div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP(isExisting?'Save changes':'Create objective','App._okrSave()')});
};
App._okrSave=()=>{
  const o=_OKRED;if(!o)return;
  if(!(o.title||'').trim())return toast('Add an objective title','err');
  if(!o.ownerId)return toast('Pick an owner','err');
  if(!o.parentId&&!o.departmentId)return toast('Assign the L0 objective to a department','err');
  if(o.metricType!=='yesno'&&(o.targetValue===null||o.targetValue===undefined||!isFinite(o.targetValue)))return toast('Set a target value','err');
  if(o.metricType==='percent')o.unit='%';
  const f=o.frequency||{};
  if(o.rollup&&o.metricType==='yesno')o.rollup=false;
  if(o.isAnnual&&o.metricType==='yesno')o.isAnnual=false;
  // ── Annual objective: enforce the auto-update link + validate the quarterly rows ──
  //    (qRows = NEW periods to create · qEdit = EXISTING quarterly objectives edited inline)
  const qRows=(o.isAnnual&&Array.isArray(o._qRows))?o._qRows:null;
  const qEdit=(o.isAnnual&&Array.isArray(o._qEdit))?o._qEdit:null;
  if(o.isAnnual){
    // o.rollup is left exactly as the user set it — both toggles are manual and independent.
    if(!o.periodStart||!o.periodEnd)return toast('Set the annual period (start & end dates)','err');
    const hasQKids=okrChildren(o.id).some(k=>k.quarterLabel);
    if(!hasQKids&&(!qRows||!qRows.length))return toast('Add at least one quarterly period (or turn the annual toggle off)','err');
    for(let i=0;i<(qRows||[]).length;i++){
      const r=qRows[i];
      if(!(r.label||'').trim())return toast('Period '+(i+1)+': give it a label (e.g. Q'+(i+1)+')','err');
      if(!r.start||!r.end)return toast(String(r.label||'Period '+(i+1))+': set both dates','err');
      if(r.end<r.start)return toast(String(r.label)+': end date is before its start','err');
      if(r.target===null||r.target===undefined||!isFinite(r.target))return toast(String(r.label)+': set a target value','err');
      if(r.startVal===null||r.startVal===undefined||!isFinite(r.startVal))r.startVal=0;
    }
    for(let i=0;i<(qEdit||[]).length;i++){
      const r=qEdit[i];if(!r||!okrById(r.id))continue; // quarter deleted meanwhile — just skip it
      if(!(r.label||'').trim())return toast('Quarterly objective '+(i+1)+': give it a label','err');
      if(!r.start||!r.end)return toast(String(r.label)+': set both dates','err');
      if(r.end<r.start)return toast(String(r.label)+': end date is before its start','err');
      if(r.target===null||r.target===undefined||!isFinite(r.target))return toast(String(r.label)+': set a target value','err');
      if(r.startVal===null||r.startVal===undefined||!isFinite(r.startVal))r.startVal=0;
    }
  }
  if(!o.rollup||o.isAnnual){
  if(f.type==='weekly'&&!WKDAYS.includes(f.day))return toast('Pick the weekday for check-ins','err');
  if(f.type==='monthly'&&!(Number(f.day)>=1&&Number(f.day)<=31))return toast('Pick a day of month (1–31)','err');
  if(f.type==='custom'&&!(f.dates||[]).length)return toast('Add at least one check-in date','err');
  }
  if(o.periodStart&&o.periodEnd&&o.periodEnd<o.periodStart)return toast('Period end is before its start','err');
  delete o._qRows;delete o._qEdit; // editor-only — dropped AFTER validation so a failed save keeps the rows on screen
  if(o.metricType==='yesno'){o.startValue=0;o.targetValue=1;o.direction='up';}
  const idx=(DB.okrs||[]).findIndex(x=>x.id===o.id);
  if(idx>-1){
    const prev=DB.okrs[idx];
    const fields=[['title','Title'],['description','Goal'],['departmentId','Department'],['subDepartmentId','Sub-department'],['ownerId','Owner'],['metricType','Metric'],['startValue','Start value'],['targetValue','Target'],['unit','Unit'],['direction','Direction'],['rollup','Auto roll-up'],['rollupMode','Roll-up mode'],['isAnnual','Annual objective'],['periodStart','Period start'],['periodEnd','Period end']];
    const changes=[];
    fields.forEach(([k,label])=>{const a=prev[k],b=o[k];if(String(a===null||a===undefined?'':a)!==String(b===null||b===undefined?'':b)){
      let from=a,to=b;
      if(k==='ownerId'){const ua=uById(a),ub=uById(b);from=ua?fullName(ua):a;to=ub?fullName(ub):b;}
      if(k==='departmentId'||k==='subDepartmentId'){const da=(DB.departments||[]).find(d=>d.id===a),db2=(DB.departments||[]).find(d=>d.id===b);from=da?da.name:(a||'—');to=db2?db2.name:(b||'—');}
      changes.push({field:label,from:from,to:to});
    }});
    if(JSON.stringify(prev.frequency||{})!==JSON.stringify(o.frequency||{}))changes.push({field:'Frequency',from:_okrFreqLabel(prev),to:_okrFreqLabel(o)});
    // Revised target edited inline in this form: keep the revision coherent —
    // clearing it or setting it back to the original REMOVES the revision.
    if(String(prev.revisedTarget??'')!==String(o.revisedTarget??'')){
      const orig=(o.targetValue===null||o.targetValue===undefined)?null:Number(o.targetValue);
      if(o.revisedTarget===null||o.revisedTarget===undefined||(orig!==null&&Number(o.revisedTarget)===orig)){
        changes.push({field:'Revised target',from:prev.revisedTarget,to:'(removed — back to original '+(orig??'—')+')'});
        o.revisedTarget=null;o.revisedNote='';o.revisedAt=null;o.revisedBy=null;
      }else{
        changes.push({field:'Revised target',from:(prev.revisedTarget===null||prev.revisedTarget===undefined)?'(none)':prev.revisedTarget,to:o.revisedTarget});
        o.revisedAt=new Date().toISOString();o.revisedBy=S.uid;
      }
    }
    DB.okrs[idx]=o;
    if(changes.length)okrLog(o.id,'Edited objective',{changes:changes});
    /* ── Annual ⇄ quarterly sync ──
       1) The inline rows from the annual's editor write back onto each quarterly objective.
       2) Shared fields changed on the annual (owner, goal, unit, direction, metric, schedule,
          auto-pattern title) follow onto quarters that still MATCH the annual's old value —
          a quarter you customised by hand keeps its own value. Check-ins are never touched. */
    if(o.isAnnual){
      const qeById={};(qEdit||[]).forEach(r=>{if(r&&r.id)qeById[r.id]=r;});
      okrChildren(o.id).filter(k=>k.quarterLabel).forEach(k=>{
        const kc=[];
        const oldLabel=k.quarterLabel;
        const qe=qeById[k.id];
        if(qe){
          const lbl=String(qe.label||'').trim();
          if(lbl&&lbl!==k.quarterLabel){kc.push({field:'Quarter label',from:k.quarterLabel,to:lbl});k.quarterLabel=lbl;}
          if(qe.start&&qe.start!==k.periodStart){kc.push({field:'Period start',from:k.periodStart,to:qe.start});k.periodStart=qe.start;}
          if(qe.end&&qe.end!==k.periodEnd){kc.push({field:'Period end',from:k.periodEnd,to:qe.end});k.periodEnd=qe.end;}
          if(qe.startVal!==null&&qe.startVal!==undefined&&isFinite(qe.startVal)&&Number(qe.startVal)!==Number(k.startValue||0)){kc.push({field:'Start value',from:k.startValue,to:qe.startVal});k.startValue=Number(qe.startVal);}
          if(qe.target!==null&&qe.target!==undefined&&isFinite(qe.target)&&Number(qe.target)!==Number(k.targetValue)){kc.push({field:'Target',from:k.targetValue,to:qe.target});k.targetValue=Number(qe.target);}
        }
        [['ownerId','Owner'],['description','Goal'],['unit','Unit'],['direction','Direction'],['metricType','Metric']].forEach(([fk,label])=>{
          if(String(prev[fk]??'')!==String(o[fk]??'')&&String(k[fk]??'')===String(prev[fk]??'')){kc.push({field:label,from:prev[fk],to:o[fk]});k[fk]=o[fk];}
        });
        if(JSON.stringify(prev.frequency||{})!==JSON.stringify(o.frequency||{})&&JSON.stringify(k.frequency||{})===JSON.stringify(prev.frequency||{})){kc.push({field:'Frequency',from:_okrFreqLabel(prev),to:_okrFreqLabel(o)});k.frequency=JSON.parse(JSON.stringify(o.frequency||{}));}
        const autoOld=(prev.title||'')+' — '+oldLabel;
        if(k.title===autoOld){
          const autoNew=(o.title||'')+' — '+k.quarterLabel;
          if(k.title!==autoNew){kc.push({field:'Title',from:k.title,to:autoNew});k.title=autoNew;}
        }
        if(kc.length){k.updatedAt=new Date().toISOString();okrLog(k.id,'Edited objective',{via:'annual editor',changes:kc});_okrPush(k);}
      });
    }
  }else{
    DB.okrs=DB.okrs||[];DB.okrs.push(o);
    okrLog(o.id,'Created objective',{level:'L'+(o.parentId?okrLevel(o):0)});
    if(o.parentId)_OKR_EXP[o.parentId]=true;
    if(o.ownerId&&o.ownerId!==S.uid&&(typeof _inappOn!=='function'||_inappOn('okr')))DB.notifications.unshift({id:uid('n'),userId:o.ownerId,text:'🎯 New OKR assigned to you: "'+o.title+'" — '+_okrFreqLabel(o),time:new Date().toISOString(),read:false,kind:'okr'});
  }
  _okrPush(o);
  // ── Generate the quarterly objectives: same owner / metric / unit / check-in schedule —
  //    only the dates and targets differ. Each is a normal objective nested under the annual. ──
  if(qRows&&qRows.length){
    const baseSort=okrChildren(o.id).length;
    qRows.forEach((r,i)=>{
      const q={id:uid('okr'),parentId:o.id,quarterLabel:String(r.label).trim(),title:(o.title||'').trim()+' — '+String(r.label).trim(),description:o.description||'',departmentId:null,subDepartmentId:null,ownerId:o.ownerId,metricType:o.metricType,startValue:Number(r.startVal||0),targetValue:Number(r.target),unit:o.unit||'',direction:o.direction||'up',frequency:JSON.parse(JSON.stringify(o.frequency||{})),periodStart:r.start,periodEnd:r.end,statusMode:'auto',statusManual:null,rollup:false,rollupMode:'sum',isAnnual:false,sort:baseSort+i,createdBy:S.uid,createdAt:new Date().toISOString()};
      DB.okrs.push(q);
      okrLog(q.id,'Created objective',{level:'L'+okrLevel(q),quarter:q.quarterLabel,from:'annual split of "'+(o.title||'')+'"'});
      _okrPush(q);
    });
    okrLog(o.id,'Quarterly objectives generated',{count:qRows.length,periods:qRows.map(r=>r.label).join(', ')});
    _OKR_EXP[o.id]=true;
  }
  saveDB();closeModal();toast(o.isAnnual&&qRows&&qRows.length?('OKR saved — '+qRows.length+' quarterly objective'+(qRows.length===1?'':'s')+' created'):'OKR saved');rr();
};
App._okrDelete=(id)=>{
  const o=okrById(id);if(!o)return;
  if(!_okrCanEditNode(o))return toast('You can\'t delete this OKR','err');
  const desc=okrDescendants(id);
  if(!confirm('Delete "'+(o.title||'this objective')+'"'+(desc.length?(' and its '+desc.length+' sub-objective'+(desc.length===1?'':'s')):'')+'? Check-in history and logs go with it.'))return;
  const ids=new Set([id,...desc.map(d=>d.id)]);
  DB.okrs=(DB.okrs||[]).filter(x=>!ids.has(x.id));
  DB.okrCheckins=(DB.okrCheckins||[]).filter(c=>!ids.has(c.okrId));
  DB.okrLogs=(DB.okrLogs||[]).filter(l=>!ids.has(l.okrId));
  sb.from('okrs').delete().eq('id',id).then(({error})=>{if(error)_syncErr('OKR delete')(error);}).catch(_syncErr('OKR delete'));
  saveDB();toast('OKR deleted','warn');rr();
};
App._okrMarkStatus=(id,st)=>{
  const o=okrById(id);if(!o)return;
  if(!_okrCanCheckin(o))return toast('Only the owner or a manager can mark status','err');
  if(st==='auto'){
    if(o.statusMode!=='auto'){o.statusMode='auto';o.statusManual=null;okrLog(id,'Status switched to automatic',{});_okrPush(o);}
  }else{
    if(!(o.statusMode==='manual'&&o.statusManual===st)){o.statusMode='manual';o.statusManual=st;okrLog(id,'Marked status',{to:st});_okrPush(o);}
  }
  saveDB();rr();

  rr();_okrPMRefresh(id);};

/* ── Single check-in modal (value + comment + photos + optional status mark) ── */
App._okrCheckin=(okrId,date)=>{
  {const _o=okrById(okrId);if(_o&&_o.closed)return toast('This objective is closed — reopen it to add updates','warn');if(_o&&_o.isAnnual)return toast('This annual objective updates automatically from its quarterly objectives','warn');if(_o&&_o.rollup)return toast('This objective updates automatically from its sub-objectives','warn');}
  const o=okrById(okrId);if(!o)return;
  if(!_okrCanCheckin(o))return toast('Only the owner or a manager can add updates','err');
  const d=date||todayISO();
  const ex=okrCheckinFor(okrId,S.uid,d)||((DB.okrCheckins||[]).find(c=>c.okrId===okrId&&c.date===d));
  _OKRCI={okrId:okrId,date:d,value:ex?ex.value:(o.metricType==='yesno'?null:null),comment:ex?ex.comment:'',photos:ex?(ex.photos||[]).filter(p=>typeof p==='string'&&p!=='[photo]').slice():[],statusMark:ex?ex.statusMark:null,existingId:ex?ex.id:null};
  App._renderOKRCheckin();
};
App._okrCISetDate=(v)=>{if(!v||!_OKRCI)return;App._okrCheckin(_OKRCI.okrId,v);};
App._okrCISetVal=(v)=>{if(_OKRCI){_OKRCI.value=v;App._renderOKRCheckin();}};
App._okrCIPhotoAdd=(input)=>{
  const files=[...(input.files||[])];if(!files.length)return;
  let pending=files.length;
  files.forEach(f=>{const r=new FileReader();r.onload=e=>{_OKRCI&&_OKRCI.photos.push(e.target.result);if(--pending===0)App._renderOKRCheckin();};r.onerror=()=>{if(--pending===0)App._renderOKRCheckin();};r.readAsDataURL(f);});
  input.value='';
};
App._okrCIPhotoRm=(i)=>{if(_OKRCI){_OKRCI.photos.splice(i,1);App._renderOKRCheckin();}};
App._renderOKRCheckin=()=>{
  const d=_OKRCI;if(!d)return;
  const o=okrById(d.okrId);if(!o)return;
  const L='display:block;font-size:11px;font-weight:700;color:var(--c-text-2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px';
  const ynBtn=(v,label)=>`<button type="button" onclick="App._okrCISetVal(${v})" style="flex:1;padding:12px;border-radius:11px;border:2px solid ${Number(d.value)===v?(v===1?'#22C55E':'#EF4444'):'var(--c-border)'};background:${Number(d.value)===v?(v===1?'#ECFDF5':'#FFF1F2'):'var(--c-surface)'};color:${Number(d.value)===v?(v===1?'#047857':'#BE123C'):'var(--c-text-2)'};font-size:14px;font-weight:800;cursor:pointer">${label}</button>`;
  modalShell({title:(d.existingId?'Edit update':'Add update'),sub:(o.title||'')+' · target '+(o.metricType==='yesno'?'Yes':_okrFmtVal(o,o.targetValue)),size:'max-w-md',key:'okr-ci',
    body:`<div style="display:flex;flex-direction:column;gap:14px">
      <div><label style="${L}">Date</label><input type="date" value="${d.date}" onchange="App._okrCISetDate(this.value)" class="ui-input rf"/></div>
      ${o.metricType==='yesno'
        ?`<div><label style="${L}">Done?</label><div style="display:flex;gap:10px">${ynBtn(1,'Yes ✓')}${ynBtn(0,'No ✗')}</div></div>`
        :`<div><label style="${L}">Value ${o.unit?('('+esc(o.unit)+')'):''} *</label><input type="number" step="any" value="${d.value!==null&&d.value!==undefined?d.value:''}" oninput="_OKRCI.value=this.value===''?null:parseFloat(this.value)" placeholder="Latest measured value" class="ui-input rf"/></div>`}
      <div><label style="${L}">Comment</label><textarea rows="2" oninput="_OKRCI.comment=this.value" placeholder="Context, blockers, wins…" class="ui-input rf" style="resize:vertical">${esc(d.comment||'')}</textarea></div>
      <div><label style="${L}">Photos</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${d.photos.map((p,i)=>`<span style="position:relative;display:inline-block"><img src="${esc(p)}" alt="Attached photo" style="width:52px;height:52px;object-fit:cover;border-radius:9px;border:1px solid var(--c-border)"/><button type="button" onclick="App._okrCIPhotoRm(${i})" style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;border:none;background:#1C212B;color:#fff;font-size:10px;cursor:pointer;line-height:1">×</button></span>`).join('')}
          <label style="width:52px;height:52px;border:1.5px dashed var(--c-border);border-radius:9px;display:grid;place-items:center;color:var(--c-text-3);cursor:pointer">${ic('cam','w-4 h-4')}<input type="file" accept="image/*" multiple hidden onchange="App._okrCIPhotoAdd(this)"/></label>
        </div>
      </div>
      <div><label style="${L}">Mark status (optional)</label><div style="display:flex;gap:6px;flex-wrap:wrap">
        ${OKR_STATUSES.map(s=>{const on=d.statusMark===s;const m=OKR_ST_META[s];return`<button type="button" onclick="_OKRCI.statusMark=_OKRCI.statusMark==='${s}'?null:'${s}';App._renderOKRCheckin()" style="padding:5px 11px;border-radius:20px;border:1.5px solid ${on?m.dot:'var(--c-border)'};background:${on?m.bg:'var(--c-surface)'};color:${on?m.fg:'var(--c-text-2)'};font-size:11.5px;font-weight:700;cursor:pointer">${s}</button>`;}).join('')}
      </div><div style="font-size:11px;color:var(--c-text-3);margin-top:6px">Marking a status here also sets it on the objective (logged). Leave empty to keep the automatic status.</div></div>
      ${d.existingId?`<div style="font-size:11.5px;color:#92400E;background:#FEF3C7;border-radius:9px;padding:8px 11px">You're editing an existing update — the change is recorded in the activity log.</div>`:''}
    </div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP(d.existingId?'Save changes':'Save update','App._okrCheckinSave()')});
};
// Shared apply: used by the single modal AND the combined "due today" modal. Logs everything.
function _okrApplyCheckin(okrId,date,d){
  const o=okrById(okrId);if(!o)return false;
  if(d.value===null||d.value===undefined||!isFinite(d.value))return false;
  const ex=d.existingId?(DB.okrCheckins||[]).find(c=>c.id===d.existingId):null;
  if(ex){
    const changes=[];
    if(String(ex.value)!==String(d.value))changes.push({field:'value',from:ex.value,to:d.value});
    if((ex.comment||'')!==(d.comment||''))changes.push({field:'comment',from:(ex.comment||'').slice(0,80),to:(d.comment||'').slice(0,80)});
    ex.value=d.value;ex.comment=d.comment||'';
    if(d.photos)ex.photos=d.photos;
    ex.statusMark=d.statusMark||null;
    if(changes.length){ex.editCount=(ex.editCount||0)+1;okrLog(okrId,'Edited check-in',{date:date,changes:changes});}
    ex.updatedAt=new Date().toISOString();
    _okrPushCheckin(ex);
  }else{
    const c={id:uid('okc'),okrId:okrId,userId:S.uid,date:date,value:d.value,comment:String(d.comment||'').slice(0,2000),photos:d.photos||[],statusMark:d.statusMark||null,editCount:0,createdAt:new Date().toISOString()};
    DB.okrCheckins=DB.okrCheckins||[];DB.okrCheckins.push(c);
    okrLog(okrId,'Check-in',{date:date,value:d.value});
    _okrPushCheckin(c);
  }
  if(d.statusMark&&!(o.statusMode==='manual'&&o.statusManual===d.statusMark)){
    o.statusMode='manual';o.statusManual=d.statusMark;
    okrLog(okrId,'Marked status',{to:d.statusMark});_okrPush(o);
  }
  return true;
}
App._okrCheckinSave=()=>{
  const d=_OKRCI;if(!d)return;
  const o=okrById(d.okrId);if(!o)return;
  if(d.value===null||d.value===undefined||!isFinite(d.value))return toast(o.metricType==='yesno'?'Pick Yes or No':'Enter the value','err');
  _okrApplyCheckin(d.okrId,d.date,d);
  _OKRCI=null;saveDB();closeModal();toast('Update saved');rr();
};

/* ── Combined "all OKR tasks due that day" modal — the scheduled checklist ── */
App._okrCheckinAll=(date)=>{
  const d=date||todayISO();
  const due=okrDueForUser(S.uid,d);
  if(!due.length)return toast('No OKR check-ins scheduled for this day','warn');
  _OKRCIALL={date:d,items:due.map(o=>{const ex=okrCheckinFor(o.id,S.uid,d);return{okrId:o.id,value:ex?ex.value:null,comment:ex?ex.comment:'',statusMark:ex?ex.statusMark:null,existingId:ex?ex.id:null,photos:ex?(ex.photos||[]).slice():[]};})};
  App._renderOKRCheckinAll();
};
App._okrCIAllVal=(i,v)=>{const it=_OKRCIALL&&_OKRCIALL.items[i];if(it){it.value=v;App._renderOKRCheckinAll();}};
App._renderOKRCheckinAll=()=>{
  const A=_OKRCIALL;if(!A)return;
  const rows=A.items.map((it,i)=>{
    const o=okrById(it.okrId);if(!o)return'';
    const done=it.existingId?'<span style="font-size:10px;font-weight:800;background:#ECFDF5;color:#0B7A55;padding:2px 8px;border-radius:10px">already updated — editing</span>':'';
    const ynBtn=(v,label)=>`<button type="button" onclick="App._okrCIAllVal(${i},${v})" style="flex:1;padding:8px;border-radius:9px;border:2px solid ${Number(it.value)===v?(v===1?'#22C55E':'#EF4444'):'var(--c-border)'};background:${Number(it.value)===v?(v===1?'#ECFDF5':'#FFF1F2'):'var(--c-surface)'};color:${Number(it.value)===v?(v===1?'#047857':'#BE123C'):'var(--c-text-2)'};font-size:12.5px;font-weight:800;cursor:pointer">${label}</button>`;
    return `<div style="border:1px solid var(--c-border);border-radius:12px;padding:12px;margin-bottom:10px;background:var(--c-surface)">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
        ${_okrLvlChip(okrLevel(o))}
        <span style="flex:1;min-width:0;font-size:13.5px;font-weight:800;color:var(--c-text)">${esc(o.title)}</span>
        ${done}
        <button type="button" title="Open full form (photos)" onclick="App.closeModal();App._okrCheckin('${o.id}','${A.date}')" style="width:26px;height:26px;display:grid;place-items:center;border-radius:7px;border:1px solid var(--c-border);background:var(--c-surface);color:var(--c-text-3);cursor:pointer">${ic('cam','w-3.5 h-3.5')}</button>
      </div>
      <div style="font-size:11px;color:var(--c-text-3);margin-bottom:7px">Target: ${o.metricType==='yesno'?'Yes':esc(_okrFmtVal(o,o.targetValue))}${o.metricType!=='yesno'?' · currently '+esc(_okrFmtVal(o,(okrLatestCheckin(o.id)||{}).value)):''}</div>
      ${o.metricType==='yesno'
        ?`<div style="display:flex;gap:8px;margin-bottom:8px">${ynBtn(1,'Yes ✓')}${ynBtn(0,'No ✗')}</div>`
        :`<input type="number" step="any" value="${it.value!==null&&it.value!==undefined?it.value:''}" oninput="_OKRCIALL.items[${i}].value=this.value===''?null:parseFloat(this.value)" placeholder="Value ${o.unit?('('+esc(o.unit)+')'):''}" class="ui-input rf" style="margin-bottom:8px"/>`}
      <input type="text" value="${esc(it.comment||'')}" oninput="_OKRCIALL.items[${i}].comment=this.value" placeholder="Comment (optional)" class="ui-input rf"/>
    </div>`;
  }).join('');
  modalShell({title:'OKR check-ins · '+fmtD(A.date),sub:A.items.length+' scheduled update'+(A.items.length===1?'':'s')+' — fill what you have, save once',size:'max-w-lg',key:'okr-ciall',
    body:`<div>${rows}</div>`,
    footer:btnG('Cancel','App.closeModal()')+btnP('Save all','App._okrCheckinAllSave()')});
};
App._okrCheckinAllSave=()=>{
  const A=_OKRCIALL;if(!A)return;
  let n=0;
  A.items.forEach(it=>{if(it.value!==null&&it.value!==undefined&&isFinite(it.value)){if(_okrApplyCheckin(it.okrId,A.date,it))n++;}});
  if(!n)return toast('Enter at least one value','err');
  _OKRCIALL=null;saveDB();closeModal();toast(n+' update'+(n===1?'':'s')+' saved');rr();
};

/* ── Virtual "OKR Check-ins" card shown inside My Checklists on due days ── */
function _okrClCard(due,date){
  const today=todayISO();
  const doneN=due.filter(o=>okrCheckinFor(o.id,S.uid,date)).length;
  const allDone=doneN===due.length;
  const isFuture=date>today;
  const rows=due.slice(0,6).map(o=>{
    const ck=okrCheckinFor(o.id,S.uid,date);
    return `<div style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--c-text-2);padding:3px 0">
      ${ck?`<span style="color:#0B7A55;flex-shrink:0">${ic('check','w-3.5 h-3.5')}</span>`:`<span style="width:6px;height:6px;border-radius:50%;background:#F59E0B;flex-shrink:0;margin:0 5px"></span>`}
      <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(o.title)}</span>
      ${ck?`<span style="font-weight:800;color:var(--c-success-ink);font-size:12px">${esc(_okrFmtVal(o,ck.value))}</span>`:''}
    </div>`;
  }).join('');
  return `<div class="ui-card" style="padding:14px;border-left:3px solid ${allDone?'#22C55E':'#F59E0B'}">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <span style="width:36px;height:36px;border-radius:10px;background:var(--c-brand-soft);color:var(--c-brand-ink);display:grid;place-items:center;flex-shrink:0">${ic('chart','w-4.5 h-4.5')}</span>
      <div style="flex:1;min-width:0">
        <div class="fd" style="font-size:14px;font-weight:800;color:var(--c-text)">OKR Check-ins <span style="font-size:10px;font-weight:800;padding:1px 7px;border-radius:20px;background:var(--c-brand-soft);color:var(--c-brand-ink);vertical-align:middle;margin-left:4px">OKR</span></div>
        <div style="font-size:12px;color:var(--c-text-2)">${doneN}/${due.length} updated · combined from all your scheduled OKRs</div>
      </div>
      <span style="font-size:12px;font-weight:800;padding:3px 10px;border-radius:20px;background:${allDone?'var(--c-success-soft)':'var(--c-warn-soft)'};color:${allDone?'var(--c-success-ink)':'var(--c-warn-ink)'}">${allDone?'Done':(due.length-doneN)+' to do'}</span>
    </div>
    ${rows}${due.length>6?`<div style="font-size:11px;color:var(--c-text-3);padding:3px 0">+${due.length-6} more…</div>`:''}
    <div style="display:flex;justify-content:flex-end;margin-top:9px">
      ${isFuture?'<span style="font-size:12px;color:#9CA3AF;font-weight:600">Scheduled for this date</span>':btn(allDone?'Review / edit':'Update now',`App._okrCheckinAll('${date}')`,{variant:allDone?'ghost':'primary',size:'sm',icon:'edit'})}
    </div>
  </div>`;
}

/* ── Per-node charts v2: TWO lines in one graph — “Ideal” (how it should go, a straight pace
   line from start → target across the period) and “Actual” (what the owner really reported).
   Leaves plot metric values; parents plot roll-up progress % over time vs the 0→100% pace. ── */
const _OKR_MODE_LABEL={sum:'total',avg:'average',max:'highest',min:'lowest',latest:'latest update'};
function _okrModeLabel(m){return _OKR_MODE_LABEL[m]||'total';}
/* Which children feed a roll-up node: the classic rule — ALL direct children. (The roll-up
   toggle is a manual, explicit choice; if it's on, it means exactly what it says, even on an
   annual objective. Annuals with roll-up OFF use their quarters' progress instead.) */
function _okrRollupKids(o){
  return okrChildren(o.id);
}
/* 'latest' roll-up: the value of the MOST RECENT update on any feeding sub-objective (≤ date).
   Made for annual objectives fed by quarters — Q2's newest number supersedes Q1's. */
function _okrLatestChildValueAt(o,date){
  let best=null;
  _okrRollupKids(o).forEach(k=>{
    okrCheckinsOf(k.id).forEach(c=>{
      if(c.value===null||c.value===undefined||!isFinite(Number(c.value)))return;
      if(c.date>date)return;
      if(!best||c.date>best.date||(c.date===best.date&&String(c.createdAt||'')>String(best.createdAt||'')))best={date:c.date,createdAt:c.createdAt,value:Number(c.value)};
    });
  });
  return best?best.value:null;
}
function _okrAgg(vals,mode){
  if(!vals.length)return null;
  if(mode==='avg')return Math.round((vals.reduce((a,b)=>a+b,0)/vals.length)*100)/100;
  if(mode==='max')return Math.max(...vals);
  if(mode==='min')return Math.min(...vals);
  return Math.round(vals.reduce((a,b)=>a+b,0)*100)/100; // sum (default)
}
/* Value as it stood on `date`. Roll-up nodes take it from their DIRECT children
   (one level below) combined by rollupMode; leaves from their own check-ins. Cycle-safe. */
function _okrValueAt(o,date,_seen){
  _seen=_seen||new Set();
  if(_seen.has(o.id))return null;
  _seen.add(o.id);
  // Manual roll-up override wins; annual (roll-up off) maps its quarters' combined progress
  // as of `date` onto its own scale — quarters or nothing; else own check-ins.
  if(o.rollup){
    if((o.rollupMode||'sum')==='latest')return _okrLatestChildValueAt(o,date);
    const vals=_okrRollupKids(o).map(k=>_okrValueAt(k,date,_seen)).filter(v=>v!==null&&v!==undefined&&isFinite(v));
    return _okrAgg(vals,o.rollupMode||'sum');
  }
  if(o.isAnnual){
    const qs=okrChildren(o.id).filter(k=>k.quarterLabel);
    if(!qs.length)return null;
    let any=false;
    const ps=qs.map(k=>{const p=_okrLeafPctAt(k,date);if(p===null)return 0;any=true;return Math.max(0,Math.min(100,p));});
    if(!any)return null;
    const avg=ps.reduce((a,b)=>a+b,0)/qs.length;
    const s=Number(o.startValue||0),t=_okrTargetEff(o);
    if(t===null||!isFinite(t))return null;
    return Math.round((s+(t-s)*avg/100)*100)/100;
  }
  let v=null;
  okrCheckinsOf(o.id).forEach(c=>{if(c.date<=date&&c.value!==null&&c.value!==undefined)v=Number(c.value);});
  return v;
}
/* Effective current value: annuals map their quarters' combined progress onto their own
   start → target scale; other roll-up nodes aggregate; leaves use their latest check-in. */
function okrCurrentOf(o){
  if(o.rollup)return _okrValueAt(o,'9999-12-31'); // manual roll-up override wins
  if(o.isAnnual){ // annual (roll-up off): quarters or nothing
    const qp=_okrQProgressAvg(o);
    if(qp===null)return null;
    const s=Number(o.startValue||0),t=_okrTargetEff(o);
    if(t===null||!isFinite(t))return null;
    return Math.round((s+(t-s)*qp/100)*100)/100;
  }
  const last=okrLatestCheckin(o.id);
  return(last&&last.value!==null&&last.value!==undefined)?Number(last.value):null;
}
function _okrLeafPctAt(o,date){
  const v=_okrValueAt(o,date);if(v===null)return null;
  if(o.metricType==='yesno')return v>=1?100:0;
  const s=Number(o.startValue||0),t=_okrTargetEff(o);
  if(t===null||!isFinite(t))return null;
  if(t===s)return(o.direction==='down'?(v<=t):(v>=t))?100:0;
  return Math.round(Math.max(0,Math.min(150,((v-s)/(t-s))*100))*10)/10;
}
// Roll-up progress as it stood on `date` (only check-ins ≤ date count). Cycle-safe.
function _okrProgressAt(o,date,_seen){
  return _okrLeafPctAt(o,date); // own inputs only (matches okrProgress)
}
function _okrIdealAt(o,date,span,pctMode,tOverride){
  const ps=o.periodStart||span[0],pe=o.periodEnd||span[1];
  const lo=pctMode?0:Number(o.startValue||0);
  const hi=pctMode?100:Number(tOverride!==undefined&&tOverride!==null?tOverride:o.targetValue);
  if(!ps||!pe||!isFinite(hi))return null;
  if(date<=ps)return lo;if(date>=pe)return hi;
  const t0=new Date(ps+'T00:00:00').getTime(),t1=new Date(pe+'T00:00:00').getTime(),tn=new Date(date+'T00:00:00').getTime();
  if(t1<=t0)return hi;
  return Math.round((lo+(hi-lo)*((tn-t0)/(t1-t0)))*100)/100;
}
/* Current & target in the objective's OWN units.
   Leaf: latest check-in (or start). Parent WITH its own start→target (e.g. 98% → 99%):
   the roll-up % mapped onto that scale — rollup 20% of 98→99 = 98.2. */
function _okrHasOwnScale(o){return o.targetValue!==null&&o.targetValue!==undefined&&o.metricType!=='yesno';}
function _okrOwnCur(o){
  const v=okrCurrentOf(o);
  return(v===null||v===undefined)?Number(o.startValue||0):v;
}
/* ── Quarter filter: an OKR belongs to every quarter its period OVERLAPS
   (a 6-month OKR falls into both quarters). Uses the node's own period,
   falling back to the span of its descendants (_okrEffPeriod). ── */
function _okrQuarterRanges(year){return{Q1:[year+'-01-01',year+'-03-31'],Q2:[year+'-04-01',year+'-06-30'],Q3:[year+'-07-01',year+'-09-30'],Q4:[year+'-10-01',year+'-12-31']};}
function _okrInQuarters(o,quarters,year){
  if(!quarters||!quarters.length)return true;
  const eff=_okrEffPeriod(o);
  const ps=eff.ps||eff.pe,pe=eff.pe||eff.ps;
  if(!ps||!pe)return false; // no dates → hidden while a quarter filter is on
  const R=_okrQuarterRanges(year);
  return quarters.some(q=>{const r=R[q];return r&&ps<=r[1]&&pe>=r[0];});
}
function _okrEffPeriod(o){
  let ps=o.periodStart||null,pe=o.periodEnd||null;
  if(!ps||!pe){okrDescendants(o.id).forEach(k=>{if(k.periodStart&&(!ps||k.periodStart<ps))ps=k.periodStart;if(k.periodEnd&&(!pe||k.periodEnd>pe))pe=k.periodEnd;});}
  return{ps,pe};
}
function _drawOKRCharts(){
  if(typeof Chart==='undefined')return;
  _destroyACharts();
  const T=_aChartTheme();
  document.querySelectorAll('canvas[data-okr-chart]').forEach(cv=>{
    const o=okrById(cv.getAttribute('data-okr-chart'));if(!o)return;
    const kids=okrChildren(o.id);
    const fail=(msg)=>{const p=cv.parentElement;if(p)p.innerHTML='<div style="height:100%;display:grid;place-items:center;color:var(--c-text-3);font-size:12px;text-align:center;padding:0 14px">'+msg+'</div>';};
    try{
      let labels,dates,actual,ideal;
      const ds=[];
      // EVERY level plots its OWN check-ins (no roll-up, no child lines): just IDEAL vs ACTUAL
      // in the objective's own units, with the axis spanning its period (or its subtree's).
      const _tnow=todayISO();
      const _eff=_okrEffPeriod(o);
      const _addBounds=(ds2)=>{const s=new Set(ds2);if(_eff.ps)s.add(_eff.ps);if(_eff.pe)s.add(_eff.pe);if(!s.has(_tnow)&&(!_eff.pe||_tnow<=_eff.pe))s.add(_tnow);let arr=[...s].sort();
        if(arr.length<2){const d0=new Date((arr[0]||_tnow)+'T00:00:00');d0.setDate(d0.getDate()+60);arr.push(d0.toISOString().slice(0,10));arr.sort();}
        return arr;};
      // Roll-up nodes plot their AGGREGATED value on every date a child reported (v3.2 fix)
      const cs=(o.rollup||o.isAnnual)
        ?(function(){const src=o.rollup?_okrRollupKids(o):okrChildren(o.id).filter(k=>k.quarterLabel);const set=new Set();src.forEach(k=>okrCheckinsOf(k.id).forEach(c=>{if(c.value!==null&&c.value!==undefined)set.add(c.date);}));return[...set].sort().map(d=>({date:d,value:_okrValueAt(o,d)})).filter(x=>x.value!==null);})()
        :okrCheckinsOf(o.id).filter(c=>c.value!==null&&c.value!==undefined);
      const _hasPeriod=!!(_eff.ps&&_eff.pe);
      if(!cs.length&&!_hasPeriod)return fail(kids.length?'No check-ins on this objective yet — use “Add note / update” to record its own numbers.':'No updates yet — set a period (start & end date) or add the first update to see the graph.');
      // Build the X-axis across the WHOLE configured period (e.g. 1st → 31st) so the timeline is
      // there from day one, not only on the dates that already have an input.
      const _spanDates=(ps,pe)=>{
        const d=new Date(ps+'T00:00:00'),end=new Date(pe+'T00:00:00');
        if(isNaN(d)||isNaN(end)||end<d)return null;
        const days=Math.round((end-d)/86400000);
        const step=days<=45?1:days<=180?7:days<=550?30:90; // day / week / ~month / ~quarter granularity
        const out=[];for(let cur=new Date(d);cur<=end;cur.setDate(cur.getDate()+step))out.push(cur.toISOString().slice(0,10));
        if(out[out.length-1]!==pe)out.push(pe);
        return out;
      };
      const _span=_hasPeriod?_spanDates(_eff.ps,_eff.pe):null;
      if(_span){
        const s=new Set(_span);
        cs.forEach(c=>{if(c.date>=_eff.ps&&c.date<=_eff.pe)s.add(c.date);}); // land actual points on their exact date
        if(_tnow>=_eff.ps&&_tnow<=_eff.pe)s.add(_tnow);
        dates=[...s].sort();
      } else {
        dates=_addBounds(cs.map(c=>c.date));
      }
      const byDate={};cs.forEach(c=>byDate[c.date]=Number(c.value));
      actual=dates.map(d=>(d in byDate)?byDate[d]:null);
      ideal=o.metricType==='yesno'?null:dates.map(d=>_okrIdealAt(o,d,[dates[0],dates[dates.length-1]],false));
      labels=dates.map(d=>fmtS(d));
      // Daily granularity (period ≤45 days): show EVERY day on the x-axis (7,8,9…31), not just ~8.
      const _daily=_hasPeriod&&(Math.round((new Date(_eff.pe+'T00:00:00')-new Date(_eff.ps+'T00:00:00'))/86400000)<=45);
      if(ideal&&ideal.some(v=>v!==null))ds.push({label:okrHasRevision(o)?'Original pace':'Ideal (planned pace)',data:ideal,borderColor:'#94A3B8',borderDash:[7,5],pointRadius:0,fill:false,tension:0,borderWidth:2});
      if(okrHasRevision(o)&&o.metricType!=='yesno'){
        const idealRev=dates.map(d=>_okrIdealAt(o,d,[dates[0],dates[dates.length-1]],false,Number(o.revisedTarget)));
        if(idealRev.some(v=>v!==null))ds.push({label:'Revised pace',data:idealRev,borderColor:'#F59E0B',borderDash:[4,4],pointRadius:0,fill:false,tension:0,borderWidth:2});
      }
      ds.push({label:'Actual',data:actual,spanGaps:true,order:-1,borderColor:'#0E9F6E',backgroundColor:'rgba(14,159,110,.12)',fill:true,tension:.3,pointRadius:3,pointBackgroundColor:'#0E9F6E',borderWidth:2});
      const yOpts={beginAtZero:true,ticks:{color:T.tick,font:{size:10}},grid:{color:T.grid}};
      if(o.metricType!=='yesno'){
        // Y-axis baseline = the Start value; only drop lower if an actual input dips below it.
        const _act=actual.filter(v=>v!==null&&v!==undefined&&isFinite(v));
        const _start=Number(o.startValue||0);
        let _tgt=(o.targetValue===null||o.targetValue===undefined)?_start:Number(o.targetValue);
        if(okrHasRevision(o))_tgt=Math.abs(Number(o.revisedTarget)-_start)>Math.abs(_tgt-_start)?Number(o.revisedTarget):_tgt;
        // Include target so "reduce" goals (target below start) still show the whole line; for an
        // "increase" goal (target above start) this leaves the baseline sitting exactly on Start.
        const _lo=Math.min(_start,_tgt,...(_act.length?_act:[_start]));
        const _hi=Math.max(_start,_tgt,...(_act.length?_act:[_start]));
        yOpts.beginAtZero=false;
        yOpts.min=_lo;
        yOpts.suggestedMax=_hi+Math.max((_hi-_lo)*0.08,(_hi===_lo?1:0));
      }
      if(o.metricType==='yesno')yOpts.ticks.callback=function(v){return v===1?'Yes':v===0?'No':'';};
      _aCharts.push(new Chart(cv.getContext('2d'),{type:'line',data:{labels:labels,datasets:ds},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,labels:{color:T.tick,font:{size:10.5},boxWidth:14,padding:8}}},scales:{x:{ticks:{color:T.tick,font:{size:9},autoSkip:false,maxRotation:_daily?90:60,minRotation:0,padding:4,callback:function(v,i){const _iso=dates[i];if(!_iso)return '';if(_daily){const _dd=new Date(_iso+'T00:00:00');return (i===0||_dd.getDate()===1)?fmtS(_iso):String(_dd.getDate());}return fmtS(_iso);}},grid:{color:T.grid,drawOnChartArea:false}},y:yOpts}}}));
    }catch(e){fail("Couldn't draw chart.");}
  });
}

/* ── Compatibility shims (old Evarca callers/tests may still reference these) ── */
function okrAncestors(o){const out=[];let cur=o,g=0;while(cur&&cur.parentId&&g++<15){const p=okrById(cur.parentId);if(!p)break;out.push(p);cur=p;}return out;}
function okrIsUpOwner(o,uid2){uid2=uid2||S.uid;return okrAncestors(o).some(a=>a.ownerId===uid2);}

/* — expose on window (classic-script world; module scope is private otherwise) — */
window.OKR_METRICS=OKR_METRICS;window.OKR_STATUSES=OKR_STATUSES;window.OKR_ST_META=OKR_ST_META;window._OKRMV=_OKRMV;window._OKR_EXP=_OKR_EXP;window._OKR_LVL_C=_OKR_LVL_C;window._OKR_MODE_LABEL=_OKR_MODE_LABEL;window._drawOKRCharts=_drawOKRCharts;window._fmtAbbr=_fmtAbbr;window._okrAgg=_okrAgg;window._okrAnnualChip=_okrAnnualChip;window._okrApplyCheckin=_okrApplyCheckin;window._okrBarColor=_okrBarColor;window._okrBuildQEdit=_okrBuildQEdit;window._okrCalQuarters=_okrCalQuarters;window._okrCanCheckin=_okrCanCheckin;window._okrCanCreate=_okrCanCreate;window._okrCanEditNode=_okrCanEditNode;window._okrCanManage=_okrCanManage;window._okrClCard=_okrClCard;window._okrDateAddD=_okrDateAddD;window._okrDateAddM=_okrDateAddM;window._okrEdAnnualSection=_okrEdAnnualSection;window._okrEffPeriod=_okrEffPeriod;window._okrExpectedForNode=_okrExpectedForNode;window._okrExpectedPct=_okrExpectedPct;window._okrFmtVal=_okrFmtVal;window._okrFreqLabel=_okrFreqLabel;window._okrGenQRows=_okrGenQRows;window._okrHasOwnScale=_okrHasOwnScale;window._okrIdealAt=_okrIdealAt;window._okrInQuarters=_okrInQuarters;window._okrLatestChildValueAt=_okrLatestChildValueAt;window._okrLeafPct=_okrLeafPct;window._okrLeafPctAt=_okrLeafPctAt;window._okrLvlChip=_okrLvlChip;window._okrModeLabel=_okrModeLabel;window._okrMoveOptions=_okrMoveOptions;window._okrNodeHTML=_okrNodeHTML;window._okrOwnCur=_okrOwnCur;window._okrPMRefresh=_okrPMRefresh;window._okrPctVs=_okrPctVs;window._okrProgressAt=_okrProgressAt;window._okrProgressPanel=_okrProgressPanel;window._okrPush=_okrPush;window._okrPushCheckin=_okrPushCheckin;window._okrQKids=_okrQKids;window._okrQParent=_okrQParent;window._okrQProgressAvg=_okrQProgressAvg;window._okrQtrChip=_okrQtrChip;window._okrQuarterRanges=_okrQuarterRanges;window._okrRollupKids=_okrRollupKids;window._okrRulesPanel=_okrRulesPanel;window._okrTargetEff=_okrTargetEff;window._okrValueAt=_okrValueAt;window.okrById=okrById;window.okrCheckinFor=okrCheckinFor;window.okrCheckinsOf=okrCheckinsOf;window.okrChildren=okrChildren;window.okrCurrentOf=okrCurrentOf;window.okrDescendants=okrDescendants;window.okrDueForUser=okrDueForUser;window.okrDueOn=okrDueOn;window.okrHasRevision=okrHasRevision;window.okrLatestCheckin=okrLatestCheckin;window.okrLevel=okrLevel;window.okrLog=okrLog;window.okrPage=okrPage;window.okrProgress=okrProgress;window.okrProgressOrig=okrProgressOrig;window.okrRootOf=okrRootOf;window.okrStatusChip=okrStatusChip;window.okrStatusOf=okrStatusOf;window.okrVisible=okrVisible;window.okrVisibleRoots=okrVisibleRoots;window.okrAncestors=okrAncestors;window.okrIsUpOwner=okrIsUpOwner;window.okrAncestors=okrAncestors;window.okrIsUpOwner=okrIsUpOwner;window._OKR_EXP=_OKR_EXP;window._OKR_PANEL=_OKR_PANEL;window._OKR_QVK=_OKR_QVK;
