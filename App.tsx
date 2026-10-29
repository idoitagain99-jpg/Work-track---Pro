import {useEffect,useMemo,useState,useCallback} from 'react';
import jsPDF from 'jspdf';import autoTable from 'jspdf-autotable';import * as XLSX from 'xlsx';
import {loadAll,put,del,replaceAll,bulkDelete,bulkPut,validateBackup} from './db';
import {Worker,Rules,Status,defaultRules,summarize,counts,daysIn,dateOf,dow,todayStr,effStatus} from './calc';

const inr=(n:number)=>'₹'+(n||0).toLocaleString('en-IN',{maximumFractionDigits:2});
const uid=()=>crypto.randomUUID();const mon=()=>todayStr().slice(0,7);
const ST:Record<Status,{l:string;c:string}>={full:{l:'Full Day',c:'bg-green-500 text-white'},half:{l:'Half Day',c:'bg-amber-400 text-white'},absent:{l:'Absent',c:'bg-red-500 text-white'},weekoff:{l:'Week Off',c:'bg-sky-400 text-white'}};
const METHODS=['Cash','UPI','Bank Transfer'];
type D={workers:Worker[];attendance:any[];advances:any[];payments:any[];monthinfo:any[];meta:any[]};


export default function App(){
  const [D,setD]=useState<D|null>(null);const [page,setPage]=useState('dashboard');const [toast,setToast]=useState<{m:string;ok:boolean}|null>(null);
  const reload=useCallback(async()=>setD(await loadAll()),[]);useEffect(()=>{reload()},[reload]);
  const say=(m:string,ok=true)=>{setToast({m,ok});setTimeout(()=>setToast(null),3000)};
  if(!D)return <div className="p-8 text-center">Loading…</div>;
  const rules:Rules={...defaultRules,...(D.meta.find(m=>m.key==='rules')?.value||{})};
  const hasDemo=D.workers.some(w=>w.id.startsWith('demo-'));
  const ctx={D,rules,reload,say};
  const nav=[['dashboard','Home','🏠'],['workers','Workers','👷'],['attendance','Attendance','📅'],['advances','Advances','💸'],['salary','Salary','💰'],['reports','Reports','📊'],['settings','Settings','⚙️']];
  return <div className="min-h-screen md:flex">
    <aside className="hidden md:flex w-60 shrink-0 flex-col gap-1 bg-white p-4 shadow-lg sticky top-0 h-screen">
      <div className="text-xl font-bold text-brand-700 mb-4">WorkTrack Pro</div>
      {nav.map(([k,l,i])=><button key={k} onClick={()=>setPage(k)} className={`text-left rounded-xl px-3 py-2 text-sm font-medium ${page===k?'bg-brand-600 text-white':'hover:bg-brand-50'}`}>{i} {l}</button>)}
      <div className="mt-auto text-[11px] text-slate-400">Data is stored only on this device.</div></aside>
    <main className="flex-1 p-3 md:p-6 pb-24 md:pb-6 max-w-5xl w-full mx-auto">
      <header className="md:hidden bg-brand-600 text-white rounded-2xl p-4 mb-3 font-bold flex justify-between items-center">WorkTrack Pro<button aria-label="Settings" onClick={()=>setPage('settings')} className="text-xl">⚙️</button></header>
      {hasDemo&&<div className="mb-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm p-2">Demo data is loaded. <button className="underline font-semibold" onClick={()=>setPage('settings')}>Clear it in Settings</button></div>}
      {page==='dashboard'&&<Dashboard {...ctx}/>}{page==='workers'&&<Workers {...ctx}/>}{page==='attendance'&&<Attendance {...ctx}/>}
      {page==='advances'&&<Advances {...ctx}/>}{page==='salary'&&<SalaryPage {...ctx}/>}{page==='reports'&&<Reports {...ctx}/>}{page==='settings'&&<Settings {...ctx} hasDemo={hasDemo}/>}
    </main>
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white shadow-[0_-2px_12px_rgba(0,0,0,.08)] flex justify-around py-1 pb-[max(4px,env(safe-area-inset-bottom))] z-20">
      {nav.filter(n=>n[0]!=='settings').map(([k,l,i])=><button key={k} onClick={()=>setPage(k)} className={`flex flex-col items-center px-1 py-1 text-[10px] min-w-[48px] ${page===k?'text-brand-700 font-bold':'text-slate-500'}`}><span className="text-lg">{i}</span>{l}</button>)}</nav>
    {toast&&<div className={`fixed top-3 left-1/2 -translate-x-1/2 z-50 rounded-xl px-4 py-2 text-sm text-white shadow-lg ${toast.ok?'bg-brand-600':'bg-red-600'}`}>{toast.m}</div>}
  </div>}

const Stat=({l,v,sub}:{l:string;v:any;sub?:string})=><div className="card"><div className="text-xs text-slate-500">{l}</div><div className="text-xl font-bold text-brand-700">{v}</div>{sub&&<div className="text-[11px] text-slate-400">{sub}</div>}</div>;
const Empty=({t}:{t:string})=><div className="card text-center text-slate-400 py-8">{t}</div>;
const Field=({l,err,children}:any)=><div><label className="lbl">{l}</label>{children}{err&&<p className="text-xs text-red-600 mt-0.5">{err}</p>}</div>;
const Modal=({title,onClose,children}:any)=><div className="fixed inset-0 z-40 bg-black/40 flex items-end md:items-center justify-center p-2" onClick={onClose}><div className="bg-white rounded-2xl p-4 w-full max-w-lg max-h-[90vh] overflow-auto" onClick={e=>e.stopPropagation()}><div className="flex justify-between mb-3"><h3 className="font-bold">{title}</h3><button onClick={onClose}>✕</button></div>{children}</div></div>;
const MonthPick=({v,set}:any)=><input type="month" className="inp !w-auto" value={v} onChange={e=>e.target.value&&set(e.target.value)}/>;
const WorkerSel=({D,v,set,all}:any)=><select className="inp !w-auto" value={v} onChange={e=>set(e.target.value)}>{all&&<option value="">All workers</option>}{D.workers.map((w:Worker)=><option key={w.id} value={w.id}>{w.name} ({w.code}){w.active?'':' – inactive'}</option>)}</select>;

function Dashboard({D,rules}:any){
  const [m,setM]=useState(mon());const t=todayStr();const act=D.workers.filter((w:Worker)=>w.active);
  let tot=0,adv=0,paid=0,rem=0;act.forEach((w:Worker)=>{const s=summarize(D,w,m,rules);tot+=s.sal.total;adv+=s.advances;paid+=s.paid;rem+=s.bal});
  const td={full:0,half:0,absent:0,weekoff:0,unmarked:0};act.forEach((w:Worker)=>{const r=D.attendance.find((a:any)=>a.key===w.id+'|'+t)?.status;const s=effStatus(t,r,w.joinDate);s?td[s]++:td.unmarked++});
  return <div className="space-y-3"><div className="flex justify-between items-center"><h1 className="text-xl font-bold">Dashboard</h1><MonthPick v={m} set={setM}/></div>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3"><Stat l="Active workers" v={act.length} sub={`${D.workers.length} total`}/><Stat l="Monthly salary (earned)" v={inr(tot)}/><Stat l="Advances this month" v={inr(adv)}/><Stat l="Salary paid" v={inr(paid)}/><Stat l="Remaining salary" v={inr(rem)}/>
    <div className="card"><div className="text-xs text-slate-500 mb-1">Today's attendance</div><div className="text-sm">✅ {td.full} full · 🟡 {td.half} half · ❌ {td.absent} absent · 🔵 {td.weekoff} off{td.unmarked>0&&<> · ⚪ {td.unmarked} unmarked</>}</div></div></div>
    {!D.workers.length&&<Empty t="No workers yet. Add one in Workers, or load demo data in Settings."/>}</div>}

function Workers({D,reload,say,rules}:any){
  const [q,setQ]=useState('');const [edit,setEdit]=useState<any>(null);const [view,setView]=useState<Worker|null>(null);
  const list=D.workers.filter((w:Worker)=>(w.name+' '+w.code).toLowerCase().includes(q.toLowerCase()));
  return <div className="space-y-3"><div className="flex gap-2"><input className="inp" placeholder="Search by name or worker ID" value={q} onChange={e=>setQ(e.target.value)}/><button className="btn whitespace-nowrap" onClick={()=>setEdit({})}>+ Add</button></div>
    {!list.length?<Empty t="No workers found."/>:<div className="grid md:grid-cols-2 gap-3">{list.map((w:Worker)=><div key={w.id} className="card">
      <div className="flex justify-between"><div><div className="font-semibold">{w.name} <span className="text-xs text-slate-400">{w.code}</span></div><div className="text-xs text-slate-500">{w.title} · {w.payType==='monthly'?inr(w.rate)+'/month':inr(w.rate)+'/day'}</div></div>
      <span className={`text-xs rounded-full px-2 py-0.5 h-fit ${w.active?'bg-brand-100 text-brand-700':'bg-slate-100 text-slate-500'}`}>{w.active?'Active':'Inactive'}</span></div>
      <div className="flex gap-2 mt-3"><button className="btn2" onClick={()=>setView(w)}>View</button><button className="btn2" onClick={()=>setEdit(w)}>Edit</button>
      <button className="btn2" onClick={async()=>{if(confirm(w.active?`Deactivate ${w.name}? History is kept.`:`Reactivate ${w.name}?`)){await put('workers',{...w,active:!w.active});await reload();say('Updated')}}}>{w.active?'Deactivate':'Activate'}</button></div></div>)}</div>}
    {edit&&<WorkerForm w={edit} D={D} onClose={()=>setEdit(null)} done={async(x:Worker)=>{await put('workers',x);await reload();setEdit(null);say('Worker saved')}}/>}
    {view&&<Modal title={view.name} onClose={()=>setView(null)}><dl className="text-sm grid grid-cols-2 gap-2">{[['ID',view.code],['Phone',view.phone||'—'],['Job',view.title],['Joined',view.joinDate],['Pay type',view.payType],['Rate',inr(view.rate)],['Half-day rate',inr(view.halfRate)],['Overtime/hr',inr(view.otRate)],['Hours/day',view.hours],['Payment details',view.payInfo||'—']].map(([a,b])=><div key={a as string}><dt className="text-xs text-slate-500">{a}</dt><dd>{b}</dd></div>)}</dl>
      <h4 className="font-semibold mt-4 mb-1 text-sm">Salary history</h4><table className="w-full"><thead><tr><th className="th">Month</th><th className="th">Earned</th><th className="th">Balance</th></tr></thead><tbody>
      {[...new Set<string>([...D.attendance.filter((a:any)=>a.workerId===view.id).map((a:any)=>a.date.slice(0,7)),...D.payments.filter((a:any)=>a.workerId===view.id).map((a:any)=>a.month)])].sort().reverse().map(mm=>{const s=summarize(D,view,mm,rules);return <tr key={mm}><td className="td">{mm}</td><td className="td">{inr(s.sal.total)}</td><td className="td">{inr(s.bal)}</td></tr>})}</tbody></table></Modal>}</div>}

function WorkerForm({w,D,onClose,done}:any){
  const [f,setF]=useState<any>({code:'',name:'',phone:'',title:'',joinDate:todayStr(),payType:'monthly',rate:'',halfRate:'0',otRate:'0',hours:'8',payInfo:'',active:true,...w});
  const [e,setE]=useState<any>({});const s=(k:string)=>(ev:any)=>setF({...f,[k]:ev.target.value});
  const go=()=>{const er:any={};if(!f.name.trim())er.name='Required';if(!f.code.trim())er.code='Required';
    else if(D.workers.some((x:Worker)=>x.code.toLowerCase()===f.code.trim().toLowerCase()&&x.id!==w.id))er.code='ID already used';
    if(f.phone&&!/^[0-9+\- ]{7,15}$/.test(f.phone))er.phone='Invalid phone';if(!f.title.trim())er.title='Required';if(!f.joinDate)er.joinDate='Required';
    for(const k of ['rate','halfRate','otRate','hours']){if(f[k]===''||isNaN(+f[k])||+f[k]<0)er[k]='Enter a valid number'}
    if(+f.rate<=0)er.rate='Must be above 0';if(+f.hours<=0||+f.hours>24)er.hours='1–24';
    setE(er);if(Object.keys(er).length)return;
    done({...f,id:w.id||uid(),code:f.code.trim(),name:f.name.trim(),rate:+f.rate,halfRate:+f.halfRate,otRate:+f.otRate,hours:+f.hours})};
  const I=(l:string,k:string,t='text')=><Field l={l} err={e[k]}><input className="inp" type={t} value={f[k]} onChange={s(k)}/></Field>;
  return <Modal title={w.id?'Edit worker':'Add worker'} onClose={onClose}><div className="grid grid-cols-2 gap-3">{I('Worker ID *','code')}{I('Name *','name')}{I('Phone (optional)','phone','tel')}{I('Job title *','title')}{I('Joining date *','joinDate','date')}
    <Field l="Pay type"><select className="inp" value={f.payType} onChange={s('payType')}><option value="monthly">Monthly salary</option><option value="daily">Daily wage</option></select></Field>
    {I(f.payType==='monthly'?'Monthly salary (₹) *':'Daily wage (₹) *','rate','number')}{I('Half-day rate (₹, 0 = auto half)','halfRate','number')}{I('Overtime rate (₹/hour)','otRate','number')}{I('Working hours/day','hours','number')}
    <div className="col-span-2"><Field l="Payment details (e.g. UPI ID or bank name — never passwords/PINs)"><input className="inp" value={f.payInfo} onChange={s('payInfo')}/></Field></div></div>
    <button className="btn w-full mt-4" onClick={go}>Save worker</button></Modal>}

function Attendance({D,reload,say,rules}:any){
  const [wid,setWid]=useState(D.workers[0]?.id||'');const [m,setM]=useState(mon());const [sel,setSel]=useState<string|null>(null);const [filt,setFilt]=useState('');
  const w:Worker=D.workers.find((x:Worker)=>x.id===wid)||D.workers[0];if(!w)return <Empty t="Add a worker first."/>;
  const att:Record<string,Status>={};D.attendance.filter((a:any)=>a.workerId===w.id&&a.date.startsWith(m)).forEach((a:any)=>att[a.date]=a.status);
  const c=counts(m,att,w.joinDate);const t=todayStr();const first=dow(dateOf(m,1));
  const set=async(date:string,st:Status|null)=>{const key=w.id+'|'+date;
    if(st===null)await del('attendance',key);else await put('attendance',{key,workerId:w.id,date,status:st});await reload();say('Attendance saved')};
  return <div className="space-y-3"><div className="flex gap-2 flex-wrap"><WorkerSel D={D} v={w.id} set={setWid}/><MonthPick v={m} set={setM}/>
    <select className="inp !w-auto" value={filt} onChange={e=>setFilt(e.target.value)}><option value="">All statuses</option>{Object.entries(ST).map(([k,v])=><option key={k} value={k}>{v.l}</option>)}</select></div>
    <div className="grid grid-cols-4 gap-2 text-center">{(Object.keys(ST) as Status[]).map(k=><div key={k} className="card !p-2"><div className="text-lg font-bold">{c[k]}</div><div className="text-[10px] text-slate-500">{ST[k].l}</div></div>)}</div>
    <div className="card"><div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-400 mb-1">{'SMTWTFS'.split('').map((d,i)=><div key={i}>{d}</div>)}</div>
    <div className="grid grid-cols-7 gap-1">{Array.from({length:first}).map((_,i)=><div key={'e'+i}/>)}{Array.from({length:daysIn(m)},(_,i)=>{const dt=dateOf(m,i+1);const s=effStatus(dt,att[dt],w.joinDate);const dim=filt&&s!==filt;
      return <button key={dt} onClick={()=>setSel(dt)} className={`aspect-square rounded-xl text-sm font-semibold ${s?ST[s].c:'bg-slate-100 text-slate-500'} ${dim?'opacity-20':''} ${dt===t?'ring-2 ring-brand-700':''} ${sel===dt?'outline outline-2 outline-slate-800':''}`}>{i+1}</button>})}</div>
    <p className="text-[11px] text-slate-400 mt-2">Sundays are Week Off automatically (tap to change). Unmarked days are never counted as absent. Future dates can’t be marked.</p></div>
    {sel&&<Modal title={`${w.name} — ${sel}`} onClose={()=>setSel(null)}>{sel>t?<p className="text-sm">Future dates can’t be marked yet.</p>:sel<w.joinDate?<p className="text-sm">Before joining date.</p>:<div className="grid grid-cols-2 gap-2">
      {(Object.keys(ST) as Status[]).map(k=><button key={k} className={`rounded-xl py-3 font-semibold ${ST[k].c}`} onClick={async()=>{await set(sel,k);setSel(null)}}>{ST[k].l}</button>)}
      <button className="btn2 col-span-2" onClick={async()=>{await set(sel,null);setSel(null)}}>Clear (unmarked{dow(sel)===0?' → Sunday auto week-off':''})</button></div>}</Modal>}</div>}

function Advances({D,reload,say}:any){
  const [m,setM]=useState(mon());const [wf,setWf]=useState('');const [edit,setEdit]=useState<any>(null);
  const list=D.advances.filter((a:any)=>a.date.startsWith(m)&&(!wf||a.workerId===wf)).sort((a:any,b:any)=>b.date.localeCompare(a.date));
  const name=(id:string)=>D.workers.find((w:Worker)=>w.id===id)?.name||'?';
  const by:Record<string,number>={};list.forEach((a:any)=>by[a.workerId]=(by[a.workerId]||0)+a.amount);
  return <div className="space-y-3"><div className="flex gap-2 flex-wrap"><MonthPick v={m} set={setM}/><WorkerSel all D={D} v={wf} set={setWf}/><button className="btn" onClick={()=>setEdit({})} disabled={!D.workers.length}>+ Advance</button></div>
    <div className="card"><div className="text-xs text-slate-500 mb-1">Total by worker ({m})</div>{Object.keys(by).length?Object.entries(by).map(([id,v])=><div key={id} className="flex justify-between text-sm"><span>{name(id)}</span><b>{inr(v)}</b></div>):<span className="text-sm text-slate-400">None</span>}</div>
    {!list.length?<Empty t="No advance payments in this month."/>:list.map((a:any)=><div key={a.id} className="card flex justify-between items-start"><div><div className="font-semibold">{name(a.workerId)} · {inr(a.amount)}</div><div className="text-xs text-slate-500">{a.date} · {a.method}{a.ref?` · Ref ${a.ref}`:''}{a.note?` · ${a.note}`:''}</div>
      <div className="text-xs mt-1">{a.deductedMonth?<span className="text-brand-700">Deducted from {a.deductedMonth} salary</span>:<span className="text-amber-600">Not yet deducted from salary</span>}</div></div>
      <div className="flex gap-1"><button className="btn2" onClick={()=>setEdit(a)}>Edit</button><button className="btnd" onClick={async()=>{if(confirm(a.deductedMonth?`This advance was already deducted from ${a.deductedMonth} salary. Deleting it will increase that month's balance. Delete?`:'Delete this advance record?')){await del('advances',a.id);await reload();say('Deleted')}}}>Del</button></div></div>)}
    {edit&&<TxForm kind="advance" D={D} t={edit} onClose={()=>setEdit(null)} done={async(x:any)=>{await put('advances',x);await reload();setEdit(null);say('Advance saved')}}/>}</div>}

function TxForm({kind,D,t,onClose,done,defWorker}:any){
  const [f,setF]=useState<any>({workerId:defWorker||D.workers[0]?.id,date:todayStr(),amount:'',method:'Cash',note:'',ref:'',...(kind==='payment'?{month:mon()}:{}),...t});const [e,setE]=useState<any>({});const s=(k:string)=>(ev:any)=>setF({...f,[k]:ev.target.value});
  const go=()=>{const er:any={};if(!f.workerId)er.workerId='Select a worker';if(!f.date)er.date='Required';if(!(+f.amount>0))er.amount='Enter an amount above 0';if(kind==='payment'&&!f.month)er.month='Required';setE(er);if(Object.keys(er).length)return;
    const {defWorker:_d,type:_t,...rest}=f;done({deductedMonth:null,...rest,id:t.id||uid(),amount:+f.amount})};
  return <Modal title={`${t.id?'Edit':'Add'} ${kind==='advance'?'advance':'salary payment'}`} onClose={onClose}><div className="grid grid-cols-2 gap-3">
    <Field l="Worker" err={e.workerId}><WorkerSel D={D} v={f.workerId} set={(v:string)=>setF({...f,workerId:v})}/></Field><Field l="Date" err={e.date}><input type="date" className="inp" value={f.date} onChange={s('date')}/></Field>
    <Field l="Amount (₹)" err={e.amount}><input type="number" className="inp" value={f.amount} onChange={s('amount')}/></Field><Field l="Method"><select className="inp" value={f.method} onChange={s('method')}>{METHODS.map(x=><option key={x}>{x}</option>)}</select></Field>
    {kind==='payment'&&<Field l="For salary month" err={e.month}><input type="month" className="inp" value={f.month} onChange={s('month')}/></Field>}<Field l="Reference no. (optional)"><input className="inp" value={f.ref} onChange={s('ref')}/></Field><Field l="Reason / note"><input className="inp" value={f.note} onChange={s('note')}/></Field></div><button className="btn w-full mt-4" onClick={go}>Save</button></Modal>}

function SalaryPage({D,reload,say,rules}:any){
  const [wid,setWid]=useState(D.workers[0]?.id||'');const [m,setM]=useState(mon());const [pay,setPay]=useState<any>(null);const [ft,setFt]=useState('');
  const w:Worker=D.workers.find((x:Worker)=>x.id===wid)||D.workers[0];if(!w)return <Empty t="Add a worker first."/>;
  const s=summarize(D,w,m,rules);const key=w.id+'|'+m;
  const advs=D.advances.filter((a:any)=>a.workerId===w.id);
  const hist=[...advs.map((a:any)=>({...a,type:'Advance'})),...D.payments.filter((p:any)=>p.workerId===w.id).map((p:any)=>({...p,type:'Salary payment'}))].filter(x=>!ft||x.type===ft).sort((a,b)=>b.date.localeCompare(a.date));
  const saveMi=async(k:string,v:string)=>{if(isNaN(+v)||+v<0)return say('Enter a valid number',false);await put('monthinfo',{...s.mi,key,[k]:+v});await reload()};
  const setDed=async(a:any,val:string|null)=>{if(val&&val<a.date.slice(0,7))return say('Cannot deduct an advance from a month before it was given',false);await put('advances',{...a,deductedMonth:val});await reload();say(val?'Advance deducted once from '+val:'Deduction undone')};
  return <div className="space-y-3"><div className="flex gap-2 flex-wrap"><WorkerSel D={D} v={w.id} set={setWid}/><MonthPick v={m} set={setM}/><button className="btn" onClick={()=>setPay({defWorker:w.id,month:m})}>+ Salary payment</button></div>
    <div className="card"><h3 className="font-bold mb-2">Calculation — {w.name}, {m}</h3><div className="text-xs text-slate-500 mb-2">Full {s.c.full} · Half {s.c.half} · Absent {s.c.absent} · Week-off {s.c.weekoff}</div>
      <table className="w-full"><tbody>{s.sal.lines.map((l,i)=><tr key={i}><td className="td">{l.label}{l.note&&<div className="text-[10px] text-slate-400">{l.note}</div>}</td><td className="td text-right">{inr(l.amount)}</td></tr>)}
      <tr><td className="td font-bold">Total earned (incl. overtime & additional)</td><td className="td text-right font-bold">{inr(s.sal.total)}</td></tr>
      <tr><td className="td">− Salary payments</td><td className="td text-right">{inr(s.paid)}</td></tr><tr><td className="td">− Advances deducted from salary</td><td className="td text-right">{inr(s.advDed)}</td></tr>
      <tr className="bg-brand-50"><td className="td font-bold">Outstanding balance</td><td className="td text-right font-bold text-brand-700">{inr(s.bal)}</td></tr></tbody></table>
      <div className="grid grid-cols-2 gap-3 mt-3"><Field l="Overtime hours"><input key={key+'o'} className="inp" type="number" defaultValue={s.mi.otHours} onBlur={e=>saveMi('otHours',e.target.value||'0')}/></Field><Field l="Additional payment (₹)"><input key={key+'b'} className="inp" type="number" defaultValue={s.mi.bonus} onBlur={e=>saveMi('bonus',e.target.value||'0')}/></Field></div></div>
    <div className="card"><h3 className="font-bold mb-2">Advances &amp; deduction</h3><p className="text-xs text-slate-500 mb-2">An advance reduces the balance only in the month you deduct it, and only once.</p>
      {!advs.length?<span className="text-sm text-slate-400">No advances for this worker.</span>:advs.map((a:any)=><div key={a.id} className="flex justify-between items-center text-sm py-1 border-t border-slate-100"><span>{a.date} · {inr(a.amount)}{a.deductedMonth&&<b className="text-brand-700"> · deducted in {a.deductedMonth}</b>}</span>
        {a.deductedMonth?<button className="btn2" onClick={()=>setDed(a,null)}>Undo</button>:<button className="btn" onClick={()=>setDed(a,m)}>Deduct in {m}</button>}</div>)}</div>
    <div className="card"><div className="flex justify-between mb-2"><h3 className="font-bold">Transaction history</h3><select className="inp !w-auto" value={ft} onChange={e=>setFt(e.target.value)}><option value="">All types</option><option>Advance</option><option>Salary payment</option></select></div>
      {!hist.length?<span className="text-sm text-slate-400">No transactions.</span>:<div className="overflow-x-auto"><table className="w-full"><thead><tr>{['Date','Type','Amount','Method','Note'].map(h=><th key={h} className="th">{h}</th>)}<th/></tr></thead><tbody>{hist.map(x=><tr key={x.id}><td className="td">{x.date}</td><td className="td">{x.type}{x.type==='Salary payment'&&<div className="text-[10px] text-slate-400">for {x.month}</div>}</td><td className="td">{inr(x.amount)}</td><td className="td">{x.method}{x.ref?` (${x.ref})`:''}</td><td className="td">{x.note}</td>
        <td className="td">{x.type==='Salary payment'&&<span className="flex gap-1"><button className="btn2" onClick={()=>setPay(x)}>Edit</button><button className="btnd" onClick={async()=>{if(confirm('Delete this salary payment?')){await del('payments',x.id);await reload();say('Deleted')}}}>Del</button></span>}</td></tr>)}</tbody></table></div>}</div>
    {pay&&<TxForm kind="payment" D={D} t={pay} defWorker={pay.defWorker} onClose={()=>setPay(null)} done={async(x:any)=>{if(!pay.id&&x.workerId===w.id&&x.month===m&&x.amount>s.bal+0.005&&!confirm(`This payment (${inr(x.amount)}) is more than the outstanding balance (${inr(s.bal)}). Save anyway?`))return;await put('payments',x);await reload();setPay(null);say('Payment recorded')}}/>}</div>}

function Reports({D,rules,say}:any){
  const [m,setM]=useState(mon());const [wf,setWf]=useState('');
  const rows=D.workers.filter((w:Worker)=>!wf||w.id===wf).map((w:Worker)=>{const s=summarize(D,w,m,rules);return{w,s}});
  const head=['ID','Name','Full','Half','Absent','Off','Earned','Overtime','Additional','Advances','Advances deducted','Paid','Balance'];
  const body=(f:(n:number)=>any)=>rows.map(({w,s}:any)=>[w.code,w.name,s.c.full,s.c.half,s.c.absent,s.c.weekoff,f(s.sal.earned),f(s.sal.ot),f(s.sal.bonus),f(s.advances),f(s.advDed),f(s.paid),f(s.bal)]);
  const pdf=()=>{const d=new jsPDF({orientation:'landscape'});d.text(`WorkTrack Pro — Monthly Report ${m}`,14,14);autoTable(d,{head:[head],body:body(n=>'Rs '+n.toLocaleString('en-IN')),startY:20,styles:{fontSize:8},headStyles:{fillColor:[22,138,73]}});d.save(`worktrack-${m}.pdf`);say('PDF exported')};
  const xls=()=>{const ws=XLSX.utils.aoa_to_sheet([head,...body(n=>n)]);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,m);XLSX.writeFile(wb,`worktrack-${m}.xlsx`);say('Excel exported')};
  return <div className="space-y-3"><div className="flex gap-2 flex-wrap"><MonthPick v={m} set={setM}/><WorkerSel all D={D} v={wf} set={setWf}/><button className="btn" onClick={pdf} disabled={!rows.length}>PDF</button><button className="btn" onClick={xls} disabled={!rows.length}>Excel</button></div>
    {!rows.length?<Empty t="No workers to report on."/>:<div className="card overflow-x-auto"><table className="w-full"><thead><tr>{head.map(h=><th key={h} className="th whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{body(inr).map((r:any,i:number)=><tr key={i}>{r.map((c:any,j:number)=><td key={j} className="td whitespace-nowrap">{c}</td>)}</tr>)}</tbody></table></div>}</div>}

function Settings({D,reload,say,rules,hasDemo}:any){
  const saveRules=async(r:Rules)=>{await put('meta',{key:'rules',value:r});await reload();say('Rules saved')};
  const backup=()=>{const data:any={};for(const k of Object.keys(D))data[k]=D[k];const b=new Blob([JSON.stringify({app:'WorkTrackPro',version:1,exportedAt:new Date().toISOString(),data},null,1)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`worktrack-backup-${todayStr()}.json`;a.click();say('Backup downloaded')};
  const restore=async(file:File)=>{try{const j=JSON.parse(await file.text());const err=validateBackup(j);if(err)return say(err,false);
    if(!confirm(`This backup has ${j.data.workers.length} workers, ${j.data.attendance.length} attendance, ${j.data.advances.length} advances, ${j.data.payments.length} payments.\n\nRestoring REPLACES all current data on this device. Download a backup first if unsure. Continue?`))return;
    await replaceAll(j.data);await reload();say('Backup restored')}catch{say('File is not valid JSON',false)}};
  const demo=async()=>{const t=new Date();const m=mon();const ws:Worker[]=[
    {id:'demo-1',code:'W001',name:'Ramesh Das',phone:'9830000001',title:'Mason',joinDate:'2025-01-01',payType:'monthly',rate:18000,halfRate:0,otRate:100,hours:8,active:true},
    {id:'demo-2',code:'W002',name:'Sunita Roy',phone:'',title:'Helper',joinDate:'2025-03-01',payType:'daily',rate:600,halfRate:300,otRate:75,hours:8,active:true}];
    const att:any[]=[];for(let d=1;d<=t.getDate();d++){const dt=dateOf(m,d);if(dow(dt)===0)continue;ws.forEach((w,i)=>att.push({key:w.id+'|'+dt,workerId:w.id,date:dt,status:(d+i)%9===0?'absent':(d+i)%7===0?'half':'full'}))}
    await bulkPut('workers',ws);await bulkPut('attendance',att);await bulkPut('advances',[{id:'demo-a1',workerId:'demo-1',date:dateOf(m,3),amount:2000,method:'Cash',note:'Medical',ref:'',deductedMonth:null}]);
    await bulkPut('payments',[{id:'demo-p1',workerId:'demo-2',date:dateOf(m,2),amount:1500,method:'UPI',note:'Part payment',ref:'UPI123',month:m}]);await reload();say('Demo data loaded')};
  const clearDemo=async()=>{if(!confirm('Remove demo workers and all their records?'))return;const isD=(x:any)=>String(x.id||x.key||'').startsWith('demo-')||String(x.workerId||'').startsWith('demo-');
    for(const s of ['workers','attendance','advances','payments','monthinfo'] as const)await bulkDelete(s,D[s].filter(isD).map((x:any)=>x.id||x.key));await reload();say('Demo data cleared')};
  return <div className="space-y-3">
    <div className="card space-y-2"><h3 className="font-bold">Salary rules</h3><Field l="Monthly workers: per-day divisor"><select className="inp" value={rules.divisor} onChange={e=>saveRules({...rules,divisor:e.target.value as any})}><option value="30">Fixed 30 days</option><option value="26">Fixed 26 working days</option><option value="calendar">Days in the calendar month</option></select></Field>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={rules.paidWeekOffDaily} onChange={e=>saveRules({...rules,paidWeekOffDaily:e.target.checked})}/>Pay week-offs for daily-wage workers</label></div>
    <div className="card space-y-2"><h3 className="font-bold">Backup &amp; restore</h3><div className="flex gap-2 flex-wrap"><button className="btn" onClick={backup}>Download JSON backup</button><label className="btn2 cursor-pointer">Restore from file<input type="file" accept=".json,application/json" hidden onChange={e=>{const f=e.target.files?.[0];if(f)restore(f);e.target.value=''}}/></label></div></div>
    <div className="card space-y-2"><h3 className="font-bold">Demo data</h3><div className="flex gap-2"><button className="btn2" onClick={demo} disabled={hasDemo}>Load demo data</button><button className="btnd" onClick={clearDemo} disabled={!hasDemo}>Clear demo data</button></div></div>
    <div className="card text-sm text-slate-600 space-y-1"><h3 className="font-bold text-slate-800">About your data</h3><p>All data is stored <b>only in this browser on this device</b> (IndexedDB). It is <b>not synced</b> to other devices or the cloud.</p>
      <p>Clearing browser data, uninstalling the browser, or using private mode can erase it. Download backups regularly. Do not store passwords, PINs or card/bank credentials in this app.</p></div></div>}
