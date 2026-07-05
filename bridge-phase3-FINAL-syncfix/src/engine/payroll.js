

/* ── PAYROLL — verify → run → approve → finalize · payslips · WPS CSV · rollback · variance ── */
function _workingDaysIn(u,month){
  const [y,m]=month.split('-').map(Number);const last=new Date(y,m,0).getDate();
  const offs=new Set(u.hrm?.schedule?.offDays||['Sun']);const hol=new Set((DB.holidays||[]).map(h=>h.date));
  let n=0;for(let d2=1;d2<=last;d2++){const iso=y+'-'+String(m).padStart(2,'0')+'-'+String(d2).padStart(2,'0');if(!offs.has(DAYS3[new Date(iso+'T00:00:00').getDay()])&&!hol.has(iso))n++;}
  return{working:n,total:last};
}
function _payCompute(u,month){
  const sal=u.hrm?.salary||{};const basic=Number(sal.basic||0),allow=Number(sal.allow||0);
  const{working,total}=_workingDaysIn(u,month);
  const [y,m]=month.split('-').map(Number);const mStart=month+'-01',mEnd=y+'-'+String(m).padStart(2,'0')+'-'+String(total).padStart(2,'0');
  const offs=new Set(u.hrm?.schedule?.offDays||['Sun']);const hol=new Set((DB.holidays||[]).map(h=>h.date));
  let present=0,wfh=0,leaveDays=0,unpaid=0,absent=0;
  const lastCheck=mEnd<todayISO()?mEnd:todayISO();
  for(let d2=1;d2<=total;d2++){
    const iso=y+'-'+String(m).padStart(2,'0')+'-'+String(d2).padStart(2,'0');
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
  return{basic,allowances:allow,otAmount,deductions:deduction,unpaidDays,net,detail:{month,working,total,present,wfh,leaveDays,unpaid,absent,otHours,perDay:Math.round(perDay*100)/100,hold:u.hrm?.payrollHold===true}};
}

/* — auto: expose on window (Phase 3 split; original was one classic <script>) — */
window._workingDaysIn=_workingDaysIn;window._payCompute=_payCompute;
