

/* ── PAYROLL — verify → run → approve → finalize · payslips · WPS CSV · rollback · variance ── */
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
function _payCompute(u,month){
  const sal=u.hrm?.salary||{};const basic=Number(sal.basic||0),allow=Number(sal.allow||0);
  const{working,total}=_workingDaysIn(u,month);
  const{start:mStart,end:mEnd}=_payPeriod(month);
  const offs=new Set(u.hrm?.schedule?.offDays||['Sun']);const hol=new Set((DB.holidays||[]).map(h=>h.date));
  let present=0,wfh=0,leaveDays=0,unpaid=0,absent=0;
  const lastCheck=mEnd<todayISO()?mEnd:todayISO();
  let iso=mStart,_g2=0;
  for(;iso<=mEnd&&_g2++<62;iso=_isoAdd(iso,1)){
    if(offs.has(DAYS3[new Date(iso+'T00:00:00').getDay()])||hol.has(iso))continue;
    const rec=(DB.attendance||[]).find(a=>a.userId===u.id&&a.date===iso&&a.clockIn);
    if(rec){present++;if((rec.flags||[]).includes('WFH'))wfh++;continue;}
    const lv=(DB.leaveRequests||[]).find(r=>r.userId===u.id&&r.status==='Approved'&&r.start<=iso&&iso<=r.end);
    if(lv){leaveDays++;const lt=(DB.leaveTypes||[]).find(t=>t.id===lv.leaveTypeId);if(lt&&(lt.unpaid===true||/unpaid/i.test(lt.name||'')))unpaid++;continue;}
    if(iso<=lastCheck)absent++;
  }
  const perDay=working?(basic+allow)/working:0;
  const hourly=working?(basic+allow)/(working*8):0;
  /* R22 (UAE Art 19): each approved entry is paid at ITS OWN rate — normal / night 22:00–04:00 / rest-day.
     The rate frozen at approval time (o.rate) wins; legacy entries without kind fall back to the normal multiplier. */
  const otRows=(DB.overtime||[]).filter(o=>o.userId===u.id&&o.status==='Approved'&&o.comp==='pay'&&o.date>=mStart&&o.date<=mEnd);
  const otHours=otRows.reduce((a,o)=>a+o.hours,0);
  const otSplit={normal:0,night:0,rest:0};otRows.forEach(o=>{otSplit[o.kind==='night'?'night':o.kind==='rest'?'rest':'normal']+=o.hours;});
  const otAmount=Math.round(otRows.reduce((a,o)=>a+o.hours*hourly*_otRateOf(o),0)*100)/100;
  const unpaidDays=unpaid+absent;
  const deduction=Math.round(unpaidDays*perDay*100)/100;
  /* R22 (UAE Art 39 + 25): disciplinary FINES decided inside this salary period land here —
     capped at 5 days' wage per month (Art 39-3) and never past 50% of the wage (Art 25 guard). */
  const fineRows=(DB.discipline||[]).filter(d=>d.userId===u.id&&d.penalty&&d.penalty.type==='fine'&&d.decidedAt&&String(d.decidedAt).slice(0,10)>=mStart&&String(d.decidedAt).slice(0,10)<=mEnd);
  const fineDaysRaw=fineRows.reduce((a,d)=>a+(Number(d.penalty.days)||0),0);
  const fineDays=Math.min(fineDaysRaw,5);
  let fineAmount=Math.round(fineDays*perDay*100)/100;
  const maxFine=Math.round((basic+allow)*0.5*100)/100;
  const fineCapped=fineDaysRaw>5||fineAmount>maxFine;
  if(fineAmount>maxFine)fineAmount=maxFine;
  const net=Math.round((basic+allow+otAmount-deduction-fineAmount)*100)/100;
  return{basic,allowances:allow,otAmount,deductions:Math.round((deduction+fineAmount)*100)/100,unpaidDays,net,detail:{month,working,total,present,wfh,leaveDays,unpaid,absent,otHours,otSplit,perDay:Math.round(perDay*100)/100,absenceDed:deduction,fineDays,fineAmount,fineCapped:fineCapped||undefined,hold:u.hrm?.payrollHold===true,period:{start:mStart,end:mEnd}}};
}
/* ── R22 — UAE overtime floors (Art 19). Config can pay MORE, never less:
   normal ≥ ×1.25 · night 22:00–04:00 ≥ ×1.5 · rest-day / public holiday ≥ ×1.5. ── */
function _otMults(){const a=DB.hrmConfig?.alerts||{};return{normal:Math.max(Number(a.otMultiplier)||1.25,1.25),night:Math.max(Number(a.otNightMultiplier)||1.5,1.5),rest:Math.max(Number(a.otRestMultiplier)||1.5,1.5)};}
function _otRateOf(o){if(Number(o&&o.rate)>=1)return Number(o.rate);const m=_otMults();return o&&o.kind==='night'?m.night:o&&o.kind==='rest'?m.rest:m.normal;}
/* Auto-classify a date for a user: their off-day or a public holiday → rest-day overtime. */
function _otKindFor(u,date){const offs=new Set(u?.hrm?.schedule?.offDays||['Sun']);const hol=new Set((DB.holidays||[]).map(h=>h.date));return(offs.has(DAYS3[new Date(date+'T00:00:00').getDay()])||hol.has(date))?'rest':'normal';}
/* WPS (MOHRE Res 340/2026): wages for a month are due through WPS by the 1st of the NEXT month. */
function _wpsDueDate(month){const[y,m]=month.split('-').map(Number);const d=new Date(y,m,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01';}

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window._workingDaysIn=_workingDaysIn;window._payCompute=_payCompute;window._payPeriod=_payPeriod;window._payCycleStartDay=_payCycleStartDay;window._otMults=_otMults;window._otRateOf=_otRateOf;window._otKindFor=_otKindFor;window._wpsDueDate=_wpsDueDate;
