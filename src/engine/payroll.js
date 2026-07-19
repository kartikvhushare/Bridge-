

/* ── PAYROLL — verify → run → approve → finalize · payslips · WPS SIF · rollback · variance ──
   R23: full UAE engine. Salary structure (Basic + Housing + Transport + Other), MOHRE 30-day
   conventions, statutory OT base, sick/maternity paid tiers from the leave types themselves,
   GPSSA pension (old/new law auto), and a per-person adjustments ledger — every rule is a
   setting in HR Config → Payroll, pre-set to UAE law so it's correct out of the box. */
/* ── Salary-month cycle ─────────────────────────────────────────────────────
   Many companies don't pay calendar months: their "July salary" covers 21 Jun → 20 Jul and is
   processed in the remaining days. DB.hrmConfig.payroll.cycleStartDay sets the day the salary
   month STARTS (1 = plain calendar month, the default — existing runs are unaffected).
   A run labeled 2026-07 with cycleStartDay 21 covers 2026-06-21 → 2026-07-20. */
function _payCycleStartDay(){const n=Number(DB.hrmConfig?.payroll?.cycleStartDay);return(n>=1&&n<=28)?Math.floor(n):1;}
function _payPeriod(month){
  const d=_payCycleStartDay();const [y,m]=month.split('-').map(Number);
  const f=x=>x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');
  if(d===1){const last=new Date(y,m,0).getDate();return{start:month+'-01',end:y+'-'+String(m).padStart(2,'0')+'-'+String(last).padStart(2,'0')};}
  return{start:f(new Date(y,m-2,d)),end:f(new Date(y,m-1,d-1))};
}
function _workingDaysIn(u,month){
  const{start,end}=_payPeriod(month);
  const offs=new Set(u.hrm?.schedule?.offDays||['Sun']);const hol=new Set((DB.holidays||[]).map(h=>h.date));
  let n=0,total=0,iso=start,guard=0;
  while(iso<=end&&guard++<62){total++;if(!offs.has(DAYS3[new Date(iso+'T00:00:00').getDay()])&&!hol.has(iso))n++;iso=_isoAdd(iso,1);}
  return{working:n,total};
}
/* ── R23 — UAE salary structure. Basic drives statutory amounts (OT, gratuity); housing/transport/
   other are fixed monthly allowances. Old data ({basic,allow}) keeps working — allow = "Other". ── */
function _salParts(u){const s=u?.hrm?.salary||{};const basic=Number(s.basic||0),housing=Number(s.housing||0),transport=Number(s.transport||0),other=Number(s.allow||0);return{basic,housing,transport,other,gross:basic+housing+transport+other};}
/* Central payroll policy — every value editable in HR Config → Payroll, DEFAULTS = UAE law/convention:
   dayDivisor 'fixed30' (MOHRE 30-day month) · otBase 'basic' (statutory) · GPSSA 5%/11% emp (old/new law), 15% employer, AED 3k–70k band. */
function _payCfg(){const p=DB.hrmConfig?.payroll||{};return{
  dayDivisor:p.dayDivisor==='working'?'working':'fixed30',
  otBase:p.otBase==='gross'?'gross':'basic',
  pensionEmpOld:isFinite(Number(p.pensionEmpOld))?Number(p.pensionEmpOld):5,
  pensionEmpNew:isFinite(Number(p.pensionEmpNew))?Number(p.pensionEmpNew):11,
  pensionEr:isFinite(Number(p.pensionEr))?Number(p.pensionEr):15,
  pensionMin:Number(p.pensionMin)||3000,pensionMax:Number(p.pensionMax)||70000};}
function _payCompute(u,month){
  const P=_payCfg();
  const{basic,housing,transport,other,gross}=_salParts(u);
  const{working,total}=_workingDaysIn(u,month);
  const{start:mStart,end:mEnd}=_payPeriod(month);
  const offs=new Set(u.hrm?.schedule?.offDays||['Sun']);const hol=new Set((DB.holidays||[]).map(h=>h.date));
  const _isWork=iso=>!offs.has(DAYS3[new Date(iso+'T00:00:00').getDay()])&&!hol.has(iso);
  const _ltOf=r=>(DB.leaveTypes||[]).find(t=>t.id===r.leaveTypeId);
  const _isSick=lt=>!!lt&&(lt.key==='sick'||/sick/i.test(lt.name||''));
  const _isMat=lt=>!!lt&&(lt.key==='maternity'||/matern/i.test(lt.name||''));
  /* Art 31 sick tiers count PER YEAR — start from the sick working-days already taken this year before the period. */
  const yr=mStart.slice(0,4);let sickYTD=0;
  (DB.leaveRequests||[]).filter(r=>r.userId===u.id&&r.status==='Approved'&&_isSick(_ltOf(r))).forEach(r=>{
    let iso=r.start<yr+'-01-01'?yr+'-01-01':r.start;const end=r.end<mStart?r.end:_isoAdd(mStart,-1);let g=0;
    for(;iso<=end&&g++<400;iso=_isoAdd(iso,1))if(_isWork(iso))sickYTD++;
  });
  let present=0,wfh=0,leaveDays=0,unpaid=0,absent=0,halfDays=0;
  const lastCheck=mEnd<todayISO()?mEnd:todayISO();
  let iso=mStart,_g2=0;
  for(;iso<=mEnd&&_g2++<62;iso=_isoAdd(iso,1)){
    if(!_isWork(iso))continue;
    const rec=(DB.attendance||[]).find(a=>a.userId===u.id&&a.date===iso&&a.clockIn);
    if(rec){present++;if((rec.flags||[]).includes('WFH'))wfh++;continue;}
    const lv=(DB.leaveRequests||[]).find(r=>r.userId===u.id&&r.status==='Approved'&&r.start<=iso&&iso<=r.end);
    if(lv){leaveDays++;
      const lt=_ltOf(lv);let factor=1;
      if(lt&&(lt.unpaid===true||/unpaid/i.test(lt.name||'')))factor=0;
      else if(_isSick(lt)){                       // Art 31: 15 full · 30 half · 45 unpaid per year (tiers live ON the leave type)
        const t=lt.paidTiers||{full:15,half:30,unpaid:45};sickYTD++;
        factor=sickYTD<=(t.full||0)?1:sickYTD<=(t.full||0)+(t.half||0)?0.5:0;
      }else if(_isMat(lt)){                        // Art 30: 45 full + 15 half, by calendar offset inside the leave
        const t=lt.paidTiers||{full:45,half:15};
        const off=Math.round((new Date(iso+'T00:00:00')-new Date(lv.start+'T00:00:00'))/864e5);
        factor=off<(t.full||0)?1:off<(t.full||0)+(t.half||0)?0.5:0;
      }
      if(factor===0)unpaid++;else if(factor===0.5)halfDays++;
      continue;}
    if(iso<=lastCheck)absent++;
  }
  /* Day & hour rates — MOHRE convention: monthly wage ÷ 30; OT hourly on the BASIC wage (statutory floor). */
  const perDay=P.dayDivisor==='fixed30'?gross/30:(working?gross/working:0);
  const otWage=P.otBase==='gross'?gross:basic;
  const hourly=P.dayDivisor==='fixed30'?otWage/240:(working?otWage/(working*8):0);
  const otRows=(DB.overtime||[]).filter(o=>o.userId===u.id&&o.status==='Approved'&&o.comp==='pay'&&o.date>=mStart&&o.date<=mEnd);
  const otHours=otRows.reduce((a,o)=>a+o.hours,0);
  const otSplit={normal:0,night:0,rest:0};otRows.forEach(o=>{otSplit[o.kind==='night'?'night':o.kind==='rest'?'rest':'normal']+=o.hours;});
  const otAmount=Math.round(otRows.reduce((a,o)=>a+o.hours*hourly*_otRateOf(o),0)*100)/100;
  const unpaidDays=unpaid+absent;
  const deduction=Math.round((unpaidDays*perDay+halfDays*0.5*perDay)*100)/100;
  /* Art 39 + 25: disciplinary fines — ≤5 days' wage/month, and the discretionary bucket (fines +
     other deductions below) can never pass 50% of the wage. */
  const fineRows=(DB.discipline||[]).filter(d=>d.userId===u.id&&d.penalty&&d.penalty.type==='fine'&&d.decidedAt&&String(d.decidedAt).slice(0,10)>=mStart&&String(d.decidedAt).slice(0,10)<=mEnd);
  const fineDaysRaw=fineRows.reduce((a,d)=>a+(Number(d.penalty.days)||0),0);
  const fineDays=Math.min(fineDaysRaw,5);
  let fineAmount=Math.round(fineDays*perDay*100)/100;
  const maxFine=Math.round(gross*0.5*100)/100;
  const fineCapped=fineDaysRaw>5||fineAmount>maxFine;
  if(fineAmount>maxFine)fineAmount=maxFine;
  /* R23 — adjustments ledger (u.hrm.payAdjust): one-off or recurring earnings & deductions.
     Deductions share the Art 25 50% cap with fines; earnings are simply added. */
  const adj=(u.hrm?.payAdjust||[]).filter(e=>e&&(e.month===month||e.recurring===true));
  const additions=Math.round(adj.filter(e=>e.kind!=='deduct').reduce((a,e)=>a+(Number(e.amount)||0),0)*100)/100;
  const adjDedRaw=Math.round(adj.filter(e=>e.kind==='deduct').reduce((a,e)=>a+(Number(e.amount)||0),0)*100)/100;
  const remain50=Math.max(0,Math.round((gross*0.5-fineAmount)*100)/100);
  const adjDed=Math.min(adjDedRaw,remain50);
  const adjCapped=adjDedRaw>adjDed;
  /* R23 — GPSSA pension (UAE/GCC nationals, per-person toggle). Law picked from joining date:
     before 2 Oct 2023 → old law (5% emp) · after → FL 57/2023 (11% emp); employer 15%; base =
     full fixed salary clamped to the AED 3,000–70,000 band. Statutory — outside the 50% cap. */
  let pensionEmp=0,pensionEr=0,pensionRate=0;
  if(u.hrm?.pensionOn&&gross>0){
    const newLaw=String(u.hrm?.joiningDate||'')>='2023-10-02';
    pensionRate=newLaw?P.pensionEmpNew:P.pensionEmpOld;
    const base=Math.min(Math.max(gross,P.pensionMin),P.pensionMax);
    pensionEmp=Math.round(base*pensionRate)/100;
    pensionEr=Math.round(base*P.pensionEr)/100;
  }
  const net=Math.round((gross+otAmount+additions-deduction-fineAmount-adjDed-pensionEmp)*100)/100;
  return{basic,allowances:Math.round((housing+transport+other)*100)/100,otAmount,
    deductions:Math.round((deduction+fineAmount+adjDed+pensionEmp)*100)/100,unpaidDays,net,
    detail:{month,working,total,present,wfh,leaveDays,unpaid,absent,halfDays,sickYTD,otHours,otSplit,
      perDay:Math.round(perDay*100)/100,hourly:Math.round(hourly*100)/100,
      salary:{basic,housing,transport,other,gross},dayDivisor:P.dayDivisor,otBase:P.otBase,
      absenceDed:deduction,fineDays,fineAmount,fineCapped:fineCapped||undefined,
      adjAdds:additions,adjDed,adjCapped:adjCapped||undefined,
      pensionEmp,pensionEr,pensionRate,
      hold:u.hrm?.payrollHold===true,period:{start:mStart,end:mEnd}}};
}
/* ── R22 — UAE overtime floors (Art 19). Config can pay MORE, never less:
   normal ≥ ×1.25 · night 22:00–04:00 ≥ ×1.5 · rest-day / public holiday ≥ ×1.5. ── */
function _otMults(){const a=DB.hrmConfig?.alerts||{};return{normal:Math.max(Number(a.otMultiplier)||1.25,1.25),night:Math.max(Number(a.otNightMultiplier)||1.5,1.5),rest:Math.max(Number(a.otRestMultiplier)||1.5,1.5)};}
function _otRateOf(o){if(Number(o&&o.rate)>=1)return Number(o.rate);const m=_otMults();return o&&o.kind==='night'?m.night:o&&o.kind==='rest'?m.rest:m.normal;}
/* Auto-classify a date for a user: their off-day or a public holiday → rest-day overtime. */
function _otKindFor(u,date){const offs=new Set(u?.hrm?.schedule?.offDays||['Sun']);const hol=new Set((DB.holidays||[]).map(h=>h.date));return(offs.has(DAYS3[new Date(date+'T00:00:00').getDay()])||hol.has(date))?'rest':'normal';}
/* WPS (MOHRE Res 340/2026): wages for a month are due through WPS by the 1st of the NEXT month. */
function _wpsDueDate(month){const[y,m]=month.split('-').map(Number);const d=new Date(y,m,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01';}
/* ── R23 — WPS SIF rows (EDR per employee + SCR control), pure & testable.
   fixed = net − variable · variable = OT + additions · MOL ID & routing come from the profile. ── */
function _sifRows(run,items){
  const w=((typeof _compCfg==='function'?_compCfg().countries:null)||{}).AE?.wps||{};
  const pp=_payPeriod(run.month);
  const rows=[];let totalNet=0;
  items.forEach(i=>{
    const u=uById(i.userId);if(!u)return;const d2=i.detail||{};
    const variable=Math.round((i.otAmount+(d2.adjAdds||0))*100)/100;
    const fixed=Math.max(0,Math.round((i.net-variable)*100)/100);
    totalNet+=i.net;
    rows.push(['EDR',u.hrm?.molId||'',u.hrm?.bankRouting||'',u.hrm?.iban||'',pp.start,pp.end,String(d2.total||''),fixed.toFixed(2),variable.toFixed(2),String(i.unpaidDays||0)]);
  });
  rows.push(['SCR',w.employerId||'',w.bankCode||'',todayISO(),new Date().toTimeString().slice(0,5),run.month.replace('-',''),String(rows.length),(Math.round(totalNet*100)/100).toFixed(2),'AED']);
  return rows;
}

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window._workingDaysIn=_workingDaysIn;window._payCompute=_payCompute;window._payPeriod=_payPeriod;window._payCycleStartDay=_payCycleStartDay;window._otMults=_otMults;window._otRateOf=_otRateOf;window._otKindFor=_otKindFor;window._wpsDueDate=_wpsDueDate;window._salParts=_salParts;window._payCfg=_payCfg;window._sifRows=_sifRows;
