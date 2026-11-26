// A distinct IndexedDB store for the device bearer, never included in note exports.
// GitHub Pages project paths share an origin; only deploy trusted scripts on it.
const NAME='keep-device-credential-v1';
async function db():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{const r=indexedDB.open(NAME,1);r.onupgradeneeded=()=>r.result.createObjectStore('credentials');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
}
export async function readSession():Promise<string>{
  const d=await db();try{return await new Promise((resolve,reject)=>{const r=d.transaction('credentials').objectStore('credentials').get('session');r.onsuccess=()=>resolve(typeof r.result==='string'?r.result:'');r.onerror=()=>reject(r.error);});}finally{d.close();}
}
export async function writeSession(value:string):Promise<void>{
  const d=await db();try{await new Promise<void>((resolve,reject)=>{const tx=d.transaction('credentials','readwrite');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error??Error('Credential storage failed'));const store=tx.objectStore('credentials');if(value)store.put(value,'session');else store.delete('session');});}finally{d.close();}
}
