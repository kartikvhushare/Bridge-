

/* ===== OKR v2 — HIERARCHY ENGINE =====
   OKRs form a tree: multiple L0 roots (each assigned to a department) → L1 → L2 → … any depth.
   Every node has an owner, its own metric (number / percent / currency / yes-no), a check-in
   frequency (weekly on a day / monthly on a date / custom dates) and an optional period window.
   INDEPENDENT LEVELS (owner request): every node — L0, L1, L2 — is measured ONLY from its
   OWN check-ins against its OWN start → target… UNLESS the node's AUTO ROLL-UP toggle (R21)
   is on: then its current value is combined from its DIRECT children (one level below) by
   rollupMode (sum / avg / max / min) and the owner never enters it by hand.
   R21 also adds TARGET REVISIONS: a revised target overlays the same node — the original
   target and every check-in stay untouched, one input stream feeds both numbers.
   All helpers here are read-only (no DOM, no writes), except okrLog/_okrPush/_okrPushCheckin. */
const OKR_METRICS=[['number','Number'],['percent','Percentage'],['currency','Currency'],['yesno','Yes / No (done or not)']];
const OKR_STATUSES=['On track','Off track','Achieved','Not achieved'];
const okrById=id=>(DB.okrs||[]).find(o=>o.id===id);
function okrChildren(id){return(DB.okrs||[]).filter(o=>o.parentId===id).sort((a,b)=>((a.sort||0)-(b.sort||0))||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));}
function okrLevel(o){let l=0,cur=o,g=0;while(cur&&cur.parentId&&g++<15){cur=okrById(cur.parentId);if(cur)l++;}return l;}
function okrDescendants(id,_seen){_seen=_seen||new Set();if(_seen.has(id))return[];_seen.add(id);return okrChildren(id).flatMap(c=>[c,...okrDescendants(c.id,_seen)]);}
function okrRootOf(o){let cur=o,g=0;while(cur&&cur.parentId&&g++<15){const p=okrById(cur.parentId);if(!p)break;cur=p;}return cur;}
function okrCheckinsOf(id){return(DB.okrCheckins||[]).filter(c=>c.okrId===id).sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));}
function okrLatestCheckin(id){const cs=okrCheckinsOf(id);return cs.length?cs[cs.length-1]:null;}
/* ── R21 · Revisions: a revised target OVERLAYS the node. Original target + check-ins stay
      untouched; the same inputs feed both numbers so growth can be compared side by side. ── */
function okrHasRevision(o){return !!o&&o.revisedTarget!==null&&o.revisedTarget!==undefined&&o.metricType!=='yesno';}
function _okrTargetEff(o){return okrHasRevision(o)?Number(o.revisedTarget):((o.targetValue===null||o.targetValue===undefined)?null:Number(o.targetValue));}
/* ── R21 · Auto roll-up: value combined from DIRECT children only (one level below). ── */
const _OKR_MODE_LABEL={sum:'total',avg:'average',max:'highest',min:'lowest'};
function _okrModeLabel(m){return _OKR_MODE_LABEL[m]||'total';}
function _okrAgg(vals,mode){
  if(!vals.length)return null;
  if(mode==='avg')return Math.round((vals.reduce((a,b)=>a+b,0)/vals.length)*100)/100;
  if(mode==='max')return Math.max(...vals);
  if(mode==='min')return Math.min(...vals);
  return Math.round(vals.reduce((a,b)=>a+b,0)*100)/100; // sum (default)
}
/* Effective current value: aggregated for roll-up nodes (cycle-safe), latest own check-in otherwise. */
function okrCurrentOf(o,_seen){
  if(!o)return null;
  _seen=_seen||new Set();
  if(_seen.has(o.id))return null;
  _seen.add(o.id);
  if(o.rollup){
    const vals=okrChildren(o.id).map(k=>okrCurrentOf(k,_seen)).filter(v=>v!==null&&v!==undefined&&isFinite(v));
    return _okrAgg(vals,o.rollupMode||'sum');
  }
  const last=okrLatestCheckin(o.id);
  return(last&&last.value!==null&&last.value!==undefined)?Number(last.value):null;
}
// Progress % of the effective current value against a given target. Capped 0–150.
function _okrPctVs(o,t){
  const v0=okrCurrentOf(o);if(v0===null||v0===undefined)return null;
  if(o.metricType==='yesno')return Number(v0)>=1?100:0;
  const s=Number(o.startValue||0),v=Number(v0);
  if(t===null||t===undefined||!isFinite(t))return null;
  if(t===s)return(o.direction==='down'?(v<=t):(v>=t))?100:0;
  const pct=((v-s)/(t-s))*100;
  return Math.round(Math.max(0,Math.min(150,pct))*10)/10;
}
/* Operative progress tracks the REVISED target when one exists; okrProgressOrig() keeps the
   original number for the side-by-side comparison. */
function _okrLeafPct(o){return _okrPctVs(o,_okrTargetEff(o));}
function okrProgressOrig(o){return _okrPctVs(o,(o.targetValue===null||o.targetValue===undefined)?null:Number(o.targetValue));}
/* ── R21 · Quarter filter: an OKR belongs to every quarter its period OVERLAPS (a 6-month OKR
      falls into two). Own period first; parents without dates use their subtree's span. ── */
function _okrQuarterRanges(year){return{Q1:[year+'-01-01',year+'-03-31'],Q2:[year+'-04-01',year+'-06-30'],Q3:[year+'-07-01',year+'-09-30'],Q4:[year+'-10-01',year+'-12-31']};}
function _okrEffPeriod(o){
  let ps=o.periodStart||null,pe=o.periodEnd||null;
  if(!ps||!pe){okrDescendants(o.id).forEach(k=>{if(k.periodStart&&(!ps||k.periodStart<ps))ps=k.periodStart;if(k.periodEnd&&(!pe||k.periodEnd>pe))pe=k.periodEnd;});}
  return{ps,pe};
}
function _okrInQuarters(o,quarters,year){
  if(!quarters||!quarters.length)return true;
  const eff=_okrEffPeriod(o);
  const ps=eff.ps||eff.pe,pe=eff.pe||eff.ps;
  if(!ps||!pe)return false; // no dates → hidden while a quarter filter is on
  const R=_okrQuarterRanges(year);
  return quarters.some(q=>{const r=R[q];return r&&ps<=r[1]&&pe>=r[0];});
}
// Node progress %: OWN check-ins only — levels are independent (no children roll-up).
// Signature keeps the old (o,_seen) shape so every call site stays valid.
function okrProgress(o,_seen){
  if(!o)return null;
  return _okrLeafPct(o);
}
/* ── Relationship helpers (permissions): the owner chain above a node ── */
function okrAncestors(o){const out=[];let cur=o,g=0;while(cur&&cur.parentId&&g++<15){const p=okrById(cur.parentId);if(!p)break;out.push(p);cur=p;}return out;}
// True when uid2 (default: me) owns ANY level above this node — "owner of the upper level".
function okrIsUpOwner(o,uid2){uid2=uid2||S.uid;return okrAncestors(o).some(a=>a.ownerId===uid2);}
// Expected pace: % of the period window elapsed today (null when no window is set).
function _okrExpectedPct(o){
  if(!o.periodStart||!o.periodEnd)return null;
  const t=todayISO();
  if(t<=o.periodStart)return 0;if(t>=o.periodEnd)return 100;
  const s=new Date(o.periodStart+'T00:00:00').getTime(),e=new Date(o.periodEnd+'T00:00:00').getTime(),n=new Date(t+'T00:00:00').getTime();
  return e>s?Math.round(((n-s)/(e-s))*100):100;
}
// Status: a manual mark (statusMode 'manual') wins; otherwise derived from progress vs expected pace.
//   ≥100% → Achieved · period over & <100% → Not achieved · within 10 pts of pace → On track · else Off track.
function okrStatusOf(o){
  if(o.statusMode==='manual'&&o.statusManual)return o.statusManual;
  const pct=okrProgress(o);
  if(pct===null)return 'No data';
  if(pct>=100)return 'Achieved';
  if(o.periodEnd&&todayISO()>o.periodEnd)return 'Not achieved';
  const exp=_okrExpectedPct(o);
  if(exp===null)return pct>=70?'On track':'Off track';
  return pct>=exp-10?'On track':'Off track';
}
const OKR_ST_META={'Achieved':{bg:'#D1FAE5',fg:'#065F46',dot:'#10B981'},'On track':{bg:'#ECFDF5',fg:'#0B7A55',dot:'#22C55E'},'Off track':{bg:'#FFF1F2',fg:'#BE123C',dot:'#EF4444'},'Not achieved':{bg:'#FEF2F2',fg:'#991B1B',dot:'#B91C1C'},'No data':{bg:'#F6F7F8',fg:'#6B7280',dot:'#9CA3AF'}};
function okrStatusChip(st,sm){const m=OKR_ST_META[st]||OKR_ST_META['No data'];return`<span style="display:inline-flex;align-items:center;gap:5px;padding:${sm?'2px 8px':'3px 10px'};border-radius:20px;font-size:${sm?'10.5':'11.5'}px;font-weight:800;background:${m.bg};color:${m.fg};white-space:nowrap"><span style="width:6px;height:6px;border-radius:50%;background:${m.dot};flex-shrink:0"></span>${esc(st)}</span>`;}
function _okrBarColor(st){return(OKR_ST_META[st]||OKR_ST_META['No data']).dot;}
/* R21: abbreviate big values — 1000 → 1k · 10000 → 10k · 1000000 → 1M (max 2 decimals: 1.25M) */
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
  const f=o.frequency||{};
  if(f.type==='weekly')return 'Weekly · every '+(f.day||'Mon');
  if(f.type==='monthly')return 'Monthly · day '+(f.day||1);
  if(f.type==='custom')return 'Custom · '+((f.dates||[]).length)+' date'+((f.dates||[]).length===1?'':'s');
  return 'No schedule';
}
/* ── Check-in scheduling: is this OKR's update due on `date`? ── */
function okrDueOn(o,date){
  if(o.rollup)return false; // R21: auto-updates from the level below — nothing to ask the owner
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
/* ── Visibility ──
   okr.viewAll (Access Control toggle; the superadmin/admin bundles carry it) → everything.
   Manager → own + team-owned nodes + everything below those.
   Everyone else → nodes they own + everything below them ("his level and below him"). */
function okrVisible(){
  const all=DB.okrs||[];
  if(isAdmin()||can('okr','viewAll'))return all;
  const mine=new Set();
  const team=isMgr()?new Set([S.uid,...subTree(S.uid).map(u=>u.id)]):new Set([S.uid]);
  all.forEach(o=>{if(team.has(o.ownerId)||o.createdBy===S.uid)mine.add(o.id);});
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

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window.OKR_METRICS=OKR_METRICS;window.OKR_STATUSES=OKR_STATUSES;window.okrById=okrById;window.okrChildren=okrChildren;window.okrLevel=okrLevel;window.okrDescendants=okrDescendants;window.okrRootOf=okrRootOf;window.okrCheckinsOf=okrCheckinsOf;window.okrLatestCheckin=okrLatestCheckin;window._okrLeafPct=_okrLeafPct;window.okrProgress=okrProgress;window.okrAncestors=okrAncestors;window.okrIsUpOwner=okrIsUpOwner;window._okrExpectedPct=_okrExpectedPct;window.okrStatusOf=okrStatusOf;window.OKR_ST_META=OKR_ST_META;window.okrStatusChip=okrStatusChip;window._okrBarColor=_okrBarColor;window._okrFmtVal=_okrFmtVal;window._okrFreqLabel=_okrFreqLabel;window.okrDueOn=okrDueOn;window.okrDueForUser=okrDueForUser;window.okrCheckinFor=okrCheckinFor;window.okrVisible=okrVisible;window.okrVisibleRoots=okrVisibleRoots;window.okrHasRevision=okrHasRevision;window._okrTargetEff=_okrTargetEff;window._okrModeLabel=_okrModeLabel;window._okrAgg=_okrAgg;window.okrCurrentOf=okrCurrentOf;window._okrPctVs=_okrPctVs;window.okrProgressOrig=okrProgressOrig;window._fmtAbbr=_fmtAbbr;window._okrQuarterRanges=_okrQuarterRanges;window._okrEffPeriod=_okrEffPeriod;window._okrInQuarters=_okrInQuarters;window.okrLog=okrLog;window._okrPush=_okrPush;window._okrPushCheckin=_okrPushCheckin;
