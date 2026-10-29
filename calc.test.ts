import {calcSalary,counts,outstanding,defaultRules,effStatus,summarize} from './calc.ts';
let n=0;const eq=(a:any,b:any,m:string)=>{if(a!==b)throw new Error(`FAIL ${m}: got ${a}, expected ${b}`);n++};
const w:any={rate:30000,halfRate:0,otRate:100,payType:'monthly',joinDate:'2020-01-01'};
// Nov 2026: Sundays 1,8,15,22,29 => auto week off
const att:any={'2026-11-02':'absent','2026-11-03':'half'};
const c=counts('2026-11',att,'2020-01-01');
eq(c.weekoff,5,'sundays auto week-off');eq(c.absent,1,'absent');eq(c.full,0,'unmarked is not full');
const s=calcSalary(w,c,'2026-11',defaultRules,{otHours:5,bonus:200});
eq(s.earned,30000-1000-500,'monthly earned (no double deduction)');eq(s.ot,500,'overtime');eq(s.total,29200,'total');
// advance 5000 deducted once + payment 10000
eq(outstanding(s.total,10000,5000),14200,'outstanding with advance once');
eq(outstanding(s.total,10000,0),19200,'advance not yet deducted does not reduce');
const d:any={rate:800,halfRate:0,otRate:0,payType:'daily'};
const s2=calcSalary(d,{full:10,half:2,absent:3,weekoff:4},'2026-11',defaultRules,{otHours:0,bonus:0});
eq(s2.earned,10*800+2*400,'daily earnings');
eq(effStatus('2099-01-01',undefined,'2020-01-01'),null,'future not absent');
eq(effStatus('2026-11-01','full','2020-01-01'),'full','manual override of Sunday');
// --- advance is deducted exactly once, only in its chosen month ---
const W:any={...w,id:'w1'};const base={attendance:[{workerId:'w1',date:'2026-11-02',status:'absent'}],monthinfo:[],payments:[{workerId:'w1',month:'2026-11',amount:10000}]};
const adv:any={workerId:'w1',date:'2026-11-05',amount:5000,deductedMonth:null};
let s3=summarize({...base,advances:[adv]},W,'2026-11',defaultRules);
eq(s3.advances,5000,'advance listed in month it was given');eq(s3.advDed,0,'undeducted advance not subtracted');
const earned=s3.sal.total;eq(s3.bal,earned-10000,'balance before deduction');
adv.deductedMonth='2026-11';s3=summarize({...base,advances:[adv]},W,'2026-11',defaultRules);eq(s3.bal,earned-10000-5000,'balance after deduction');
const dec=summarize({...base,attendance:[],payments:[],advances:[adv]},W,'2026-12',defaultRules);eq(dec.advDed,0,'advance not deducted again in December');
const adv2:any={...adv,deductedMonth:'2026-12'};const nov=summarize({...base,advances:[adv2]},W,'2026-11',defaultRules);eq(nov.advDed,0,'advance deducted in Dec does not affect Nov');
eq(summarize({...base,attendance:[],payments:[],advances:[adv2]},W,'2026-12',defaultRules).advDed,5000,'advance deducted in Dec counted once in Dec');
console.log(`All ${n} checks passed`);
