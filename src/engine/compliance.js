/* ── PAYROLL COMPLIANCE (Phase 4) — per-country rules your accountant sets ONCE + filing-ready exports.
   DISPLAY-ONLY by design: nothing here ever changes net pay. Gratuity/EOSB is an accrual ESTIMATE
   shown on payslips and exported as a liability report. Config lives on hrm_config.compliance
   (jsonb) and is written only by hrSettings.edit holders (existing hc_w RLS). ── */

/* R26 — UAE ONLY. The tab used to ship three fixed country cards (AE / SA / a blank template) plus a
   per-office country mapping, and the gratuity form was hard-wired to exactly two tiers. Evarca runs
   in the UAE, so: one country, and every rule is data the accountant edits — tiers are an editable
   list (add / remove), and the divisor and basis are fields rather than constants.
   Old configs are migrated in place, never dropped (see _compCfg). */
const COMP_KEY='AE';
function _compCfg(){
  DB.hrmConfig=DB.hrmConfig||{};
  const c=DB.hrmConfig.compliance=DB.hrmConfig.compliance||{};
  if(!c.countries||typeof c.countries!=='object')c.countries={};
  // migrate: keep whatever AE the workspace already had, seed it if absent, drop the other markets
  if(!c.countries[COMP_KEY])c.countries[COMP_KEY]=_compDefaults()[COMP_KEY];
  Object.keys(c.countries).forEach(k=>{if(k!==COMP_KEY)delete c.countries[k];});
  const cc=c.countries[COMP_KEY];
  cc.label=cc.label||'United Arab Emirates';
  cc.currency=cc.currency||'AED';
  cc.wps=cc.wps||{employerId:'',bankCode:''};
  cc.gratuity=cc.gratuity||{};
  cc.gratuity.basis=cc.gratuity.basis||'basic';
  cc.gratuity.dailyDivisor=Number(cc.gratuity.dailyDivisor)||30;
  if(!Array.isArray(cc.gratuity.tiers)||!cc.gratuity.tiers.length)cc.gratuity.tiers=_compDefaults()[COMP_KEY].gratuity.tiers.slice();
  cc.gratuity.tiers=_compNormalizeTiers(cc.gratuity.tiers);
  // every office follows UAE now — the per-location mapping is gone, but the key is kept (harmless)
  c.locationCountry=c.locationCountry||{};
  return c;
}
function _compDefaults(){return{
  AE:{label:'United Arab Emirates',currency:'AED',wps:{employerId:'',bankCode:''},
      gratuity:{basis:'basic',dailyDivisor:30,tiers:[{uptoYears:5,daysPerYear:21},{uptoYears:null,daysPerYear:30}]},
      notes:'UAE end-of-service (Federal Decree-Law 33/2021, Art 51): 21 days of basic pay per year for the first 5 years, 30 days/year after.'}};}
/* Tiers are user-editable, so normalise defensively: sort by boundary, coerce numbers, and make sure
   exactly ONE open-ended (uptoYears:null) tier exists and it is last — otherwise the accrual loop,
   which breaks on the first open tier, would silently ignore later rows. */
function _compNormalizeTiers(tiers){
  const list=(tiers||[]).map(t=>({
    uptoYears:(t.uptoYears==null||t.uptoYears===''||!isFinite(Number(t.uptoYears)))?null:Math.max(0,Number(t.uptoYears)),
    daysPerYear:Math.max(0,Number(t.daysPerYear)||0),
  }));
  const capped=list.filter(t=>t.uptoYears!=null).sort((a,b)=>a.uptoYears-b.uptoYears);
  const open=list.filter(t=>t.uptoYears==null);
  // keep the LAST open-ended row the user entered; if there is none, the final capped tier becomes it
  let tail=open.length?open[open.length-1]:null;
  if(!tail){ if(!capped.length)return[{uptoYears:null,daysPerYear:0}]; tail={uptoYears:null,daysPerYear:capped[capped.length-1].daysPerYear}; }
  return[...capped,tail];
}
/* Which country's rules apply to a user — always UAE now (kept as a function so callers don't change). */
function _countryKeyForUser(u){_compCfg();return COMP_KEY;}
function _serviceYears(u,asOf){
  const j=u&&u.hrm&&u.hrm.joiningDate;if(!j)return 0;
  const ms=new Date((asOf||todayISO())+'T00:00:00')-new Date(j+'T00:00:00');
  return Math.max(0,ms/(365.25*24*3600*1000));
}
/* Tiered end-of-service accrual to date. Returns {amount, years, country, currency} or null (no rules). */
function _gratuityAccrued(u,asOf){
  const key=_countryKeyForUser(u);const cc=_compCfg().countries[key];
  if(!cc||!cc.gratuity)return null;
  const g=cc.gratuity;
  // R26: the basis is now an editable rule, not a constant. UAE law (Art 51) is BASIC — that stays
  // the default; 'gross' is available for workspaces whose contracts define EOSB on total pay.
  const parts=(typeof _salParts==='function')?_salParts(u):{basic:Number(u&&u.hrm&&u.hrm.salary&&u.hrm.salary.basic||0),gross:0};
  const base=g.basis==='gross'?(parts.gross||0):(parts.basic||0);
  const yrs=_serviceYears(u,asOf);
  const daily=base/(Number(g.dailyDivisor)||30);
  let amount=0,prev=0;
  for(const t of(g.tiers||[])){
    const cap=(t.uptoYears==null)?yrs:Math.min(yrs,Number(t.uptoYears));
    amount+=Math.max(0,cap-prev)*(Number(t.daysPerYear)||0)*daily;
    prev=Math.max(prev,cap);
    if(t.uptoYears==null)break;
  }
  return{amount:Math.round(amount*100)/100,years:Math.round(yrs*100)/100,countryKey:key,country:cc.label,currency:cc.currency||''};
}
/* Filing-ready export: gratuity/EOSB liability per active employee. */
App._compGratuityCSV=()=>{
  if(!(can('payroll','download')||can('hrSettings','view')))return toast('You need Payroll → Download','err');
  const rows=[['Employee','Department','Country','Joined','Service (yrs)','Basic salary','Accrued gratuity','Currency']];
  (DB.users||[]).filter(u=>u.status==='Active').forEach(u=>{
    const g=_gratuityAccrued(u);if(!g)return;
    rows.push([fullName(u),u.department||'',g.country,u.hrm&&u.hrm.joiningDate||'',g.years,Number(u.hrm&&u.hrm.salary&&u.hrm.salary.basic||0),g.amount,g.currency]);
  });
  _csvDownload(rows,'Gratuity_liability_'+todayISO());
  log(fullName(me()),'Gratuity liability exported',todayISO());
};

/* — auto: expose on window — */
window._compCfg=_compCfg;window._compDefaults=_compDefaults;window._countryKeyForUser=_countryKeyForUser;window._serviceYears=_serviceYears;window._gratuityAccrued=_gratuityAccrued;
window.COMP_KEY=COMP_KEY;window._compNormalizeTiers=_compNormalizeTiers;
