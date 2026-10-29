export type Status='full'|'half'|'absent'|'weekoff';
export interface Worker{id:string;code:string;name:string;phone?:string;title:string;joinDate:string;payType:'monthly'|'daily';rate:number;halfRate:number;otRate:number;hours:number;payInfo?:string;active:boolean}
export interface Rules{divisor:'30'|'26'|'calendar';paidWeekOffDaily:boolean}
export const defaultRules:Rules={divisor:'30',paidWeekOffDaily:false};
export const r2=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export const daysIn=(m:string)=>{const [y,mo]=m.split('-').map(Number);return new Date(y,mo,0).getDate()};
export const dateOf=(m:string,d:number)=>`${m}-${String(d).padStart(2,'0')}`;
export const dow=(d:string)=>new Date(d+'T00:00:00').getDay();
export const todayStr=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
/** Effective status: explicit record wins; Sundays default to week off; unmarked days are NOT absent. */
export function effStatus(date:string,rec:Status|undefined,joinDate:string):Status|null{
  if(date<joinDate)return null;if(rec)return rec;return dow(date)===0?'weekoff':null}
export function counts(month:string,att:Record<string,Status>,joinDate:string){
  const c={full:0,half:0,absent:0,weekoff:0};
  for(let d=1;d<=daysIn(month);d++){const dt=dateOf(month,d);const s=effStatus(dt,att[dt],joinDate);if(s)c[s]++}
  return c}
export interface Line{label:string;amount:number;note?:string}
export function calcSalary(w:Worker,c:{full:number;half:number;absent:number;weekoff:number},month:string,rules:Rules,x:{otHours:number;bonus:number}){
  const lines:Line[]=[];let earned=0;
  if(w.payType==='monthly'){
    const div=rules.divisor==='calendar'?daysIn(month):Number(rules.divisor);const perDay=w.rate/div;
    const half=w.halfRate>0?w.halfRate:perDay/2;
    lines.push({label:'Monthly salary',amount:w.rate});
    const ab=c.absent*perDay;const hd=c.half*(perDay-half);
    lines.push({label:`Absence deduction (${c.absent} × ${r2(perDay)})`,amount:-r2(ab),note:'Per-day = salary ÷ '+div});
    lines.push({label:`Half-day deduction (${c.half} × ${r2(perDay-half)})`,amount:-r2(hd),note:'Only the unpaid part of a half day'});
    earned=Math.max(0,w.rate-ab-hd)}
  else{
    const half=w.halfRate>0?w.halfRate:w.rate/2;
    lines.push({label:`Full days (${c.full} × ${w.rate})`,amount:r2(c.full*w.rate)});
    lines.push({label:`Half days (${c.half} × ${half})`,amount:r2(c.half*half)});
    if(rules.paidWeekOffDaily)lines.push({label:`Paid week-offs (${c.weekoff} × ${w.rate})`,amount:r2(c.weekoff*w.rate)});
    lines.push({label:'Absences',amount:0,note:'Daily wage: not paid, so nothing is deducted again'});
    earned=c.full*w.rate+c.half*half+(rules.paidWeekOffDaily?c.weekoff*w.rate:0)}
  earned=r2(earned);const ot=r2(x.otHours*w.otRate);const bonus=r2(x.bonus);
  lines.push({label:`Overtime (${x.otHours} h × ${w.otRate})`,amount:ot},{label:'Additional payments',amount:bonus});
  return{lines,earned,ot,bonus,total:r2(earned+ot+bonus)}}
/** Outstanding = Earned + Additional − Salary Payments − Advances deducted (each advance counted once). */
export const outstanding=(total:number,payments:number,advDeducted:number)=>r2(total-payments-advDeducted);
export type Data={attendance:any[];monthinfo:any[];advances:any[];payments:any[]};
/** Everything for one worker + month. An advance counts against salary only in the single month stored in its deductedMonth. */
export function summarize(D:Data,w:Worker,month:string,rules:Rules){
  const att:Record<string,Status>={};D.attendance.filter(a=>a.workerId===w.id&&a.date.startsWith(month)).forEach(a=>att[a.date]=a.status);
  const c=counts(month,att,w.joinDate);const mi=D.monthinfo.find(m=>m.key===w.id+'|'+month)||{otHours:0,bonus:0};
  const sal=calcSalary(w,c,month,rules,mi);
  const sum=(l:any[])=>r2(l.reduce((s,a)=>s+a.amount,0));
  const advances=sum(D.advances.filter(a=>a.workerId===w.id&&a.date.startsWith(month)));
  const advDed=sum(D.advances.filter(a=>a.workerId===w.id&&a.deductedMonth===month));
  const paid=sum(D.payments.filter(p=>p.workerId===w.id&&p.month===month));
  return{c,sal,advances,advDed,paid,bal:outstanding(sal.total,paid,advDed),mi}}
