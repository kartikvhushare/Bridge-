

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
  const otHours=(DB.overtime||[]).filter(o=>o.userId===u.id&&o.status==='Approved'&&o.comp==='pay'&&o.date>=mStart&&o.date<=mEnd).reduce((a,o)=>a+o.hours,0);
  const hourly=working?(basic+allow)/(working*8):0;
  const mult=Number(DB.hrmConfig?.alerts?.otMultiplier)||1.25;
  const otAmount=Math.round(otHours*hourly*mult*100)/100;
  const unpaidDays=unpaid+absent;
  const deduction=Math.round(unpaidDays*perDay*100)/100;
  const net=Math.round((basic+allow+otAmount-deduction)*100)/100;
  return{basic,allowances:allow,otAmount,deductions:deduction,unpaidDays,net,detail:{month,working,total,present,wfh,leaveDays,unpaid,absent,otHours,perDay:Math.round(perDay*100)/100,hold:u.hrm?.payrollHold===true,period:{start:mStart,end:mEnd}}};
}

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window._workingDaysIn=_workingDaysIn;window._payCompute=_payCompute;window._payPeriod=_payPeriod;window._payCycleStartDay=_payCycleStartDay;
