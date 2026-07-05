/* ── PAYROLL COMPLIANCE (Phase 4) — per-country rules your accountant sets ONCE + filing-ready exports.
   DISPLAY-ONLY by design: nothing here ever changes net pay. Gratuity/EOSB is an accrual ESTIMATE
   shown on payslips and exported as a liability report. Config lives on hrm_config.compliance
   (jsonb) and is written only by hrSettings.edit holders (existing hc_w RLS). ── */

function _compCfg(){
  DB.hrmConfig=DB.hrmConfig||{};
  const c=DB.hrmConfig.compliance=DB.hrmConfig.compliance||{};
  if(!c.countries||!Object.keys(c.countries).length)c.countries=_compDefaults();
  c.locationCountry=c.locationCountry||{};
  return c;
}
function _compDefaults(){return{
  AE:{label:'United Arab Emirates',currency:'AED',wps:{employerId:'',bankCode:''},
      gratuity:{basis:'basic',dailyDivisor:30,tiers:[{uptoYears:5,daysPerYear:21},{uptoYears:null,daysPerYear:30}]},
      notes:'UAE end-of-service: 21 days of basic pay per year for the first 5 years, 30 days/year after.'},
  SA:{label:'Saudi Arabia',currency:'SAR',wps:{employerId:'',bankCode:''},
      gratuity:{basis:'basic',dailyDivisor:30,tiers:[{uptoYears:5,daysPerYear:15},{uptoYears:null,daysPerYear:30}]},
      notes:'KSA end-of-service: half a month per year for the first 5 years, a full month/year after.'},
  XX:{label:'Custom country',currency:'',wps:{employerId:'',bankCode:''},
      gratuity:{basis:'basic',dailyDivisor:30,tiers:[{uptoYears:null,daysPerYear:0}]},
      notes:'Blank template — copy for any new market and let your accountant fill the rules.'}};}

/* Which country's rules apply to a user: their location's mapping, else the workspace default (UAE). */
function _countryKeyForUser(u){const c=_compCfg();const loc=u&&u.hrm&&u.hrm.locationId;return(loc&&c.locationCountry[loc])||'AE';}
function _serviceYears(u,asOf){
  const j=u&&u.hrm&&u.hrm.joiningDate;if(!j)return 0;
  const ms=new Date((asOf||todayISO())+'T00:00:00')-new Date(j+'T00:00:00');
  return Math.max(0,ms/(365.25*24*3600*1000));
}
/* Tiered end-of-service accrual to date. Returns {amount, years, country, currency} or null (no rules). */
function _gratuityAccrued(u,asOf){
  const key=_countryKeyForUser(u);const cc=_compCfg().countries[key];
  if(!cc||!cc.gratuity)return null;
  const g=cc.gratuity;const basic=Number(u&&u.hrm&&u.hrm.salary&&u.hrm.salary.basic||0);
  const yrs=_serviceYears(u,asOf);
  const daily=basic/(Number(g.dailyDivisor)||30);
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
