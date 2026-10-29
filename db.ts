export const STORES={workers:'id',attendance:'key',advances:'id',payments:'id',monthinfo:'key',meta:'key'} as const;
export type StoreName=keyof typeof STORES;
let dbp:Promise<IDBDatabase>|null=null;
const open=()=>dbp??=new Promise((res,rej)=>{const r=indexedDB.open('worktrack-pro',1);
  r.onupgradeneeded=()=>{for(const [s,k] of Object.entries(STORES))r.result.createObjectStore(s,{keyPath:k})};
  r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const tx=async<T,>(s:StoreName|StoreName[],mode:IDBTransactionMode,f:(t:IDBTransaction)=>IDBRequest<T>|void):Promise<T>=>{
  const db=await open();return new Promise((res,rej)=>{const t=db.transaction(s as any,mode);const rq=f(t);
    t.oncomplete=()=>res(rq?(rq as IDBRequest<T>).result:(undefined as any));t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error)})};
export const getAll=(s:StoreName)=>tx<any[]>(s,'readonly',t=>t.objectStore(s).getAll());
export const put=(s:StoreName,v:any)=>tx(s,'readwrite',t=>{t.objectStore(s).put(v)});
export const del=(s:StoreName,k:string)=>tx(s,'readwrite',t=>{t.objectStore(s).delete(k)});
export async function loadAll(){const o:any={};for(const s of Object.keys(STORES))o[s]=await getAll(s as StoreName);return o}
/** Atomic replace of all stores (single transaction: all-or-nothing). */
export const replaceAll=(data:Record<string,any[]>)=>tx(Object.keys(STORES) as StoreName[],'readwrite',t=>{
  for(const s of Object.keys(STORES)){const st=t.objectStore(s);st.clear();(data[s]||[]).forEach(v=>st.put(v))}});
export const bulkDelete=(s:StoreName,keys:string[])=>tx(s,'readwrite',t=>{keys.forEach(k=>t.objectStore(s).delete(k))});
export const bulkPut=(s:StoreName,vals:any[])=>tx(s,'readwrite',t=>{vals.forEach(v=>t.objectStore(s).put(v))});
export function validateBackup(j:any):string|null{
  if(!j||j.app!=='WorkTrackPro'||typeof j.data!=='object')return 'Not a WorkTrack Pro backup file.';
  for(const s of ['workers','attendance','advances','payments'])if(!Array.isArray(j.data[s]))return `Missing or invalid "${s}" data.`;
  const ids=new Set<string>();
  for(const w of j.data.workers){if(!w.id||!w.name||!['monthly','daily'].includes(w.payType)||typeof w.rate!=='number')return 'A worker record is invalid.';ids.add(w.id)}
  for(const a of j.data.attendance)if(!a.key||!ids.has(a.workerId)||!['full','half','absent','weekoff'].includes(a.status))return 'An attendance record is invalid.';
  for(const a of [...j.data.advances,...j.data.payments])if(!a.id||!ids.has(a.workerId)||!(a.amount>0)||!a.date)return 'An advance/payment record is invalid.';
  return null}
