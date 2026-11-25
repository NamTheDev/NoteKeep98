import type {Note} from '../notes/data';
import type {PendingMutation,RevisionedNote} from './protocol';

const DB='keep-cloud-sync-v1';
type StoredNote=RevisionedNote & {workspaceId:string;local:Note|null};
type Queued=PendingMutation & {workspaceId:string;sequence?:number};
type Cursor={workspaceId:string;revision:number};
const request=<T>(r:IDBRequest<T>):Promise<T>=>new Promise((resolve,reject)=>{
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
});
const complete=(tx:IDBTransaction):Promise<void>=>new Promise((resolve,reject)=>{
  tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error??Error('Storage transaction aborted'));
  tx.onerror=()=>reject(tx.error??Error('Storage transaction failed'));
});
/** Separate workspace keys prevent pairing one device from overwriting another workspace. */
export class SyncStorage {
  private constructor(private readonly db:IDBDatabase){}
  static async open():Promise<SyncStorage>{
    const r=indexedDB.open(DB,1);
    r.onupgradeneeded=()=>{
      const db=r.result;
      db.createObjectStore('notes',{keyPath:['workspaceId','noteId']});
      const pending=db.createObjectStore('pending',{keyPath:'sequence',autoIncrement:true});
      pending.createIndex('operation',['workspaceId','operationId'],{unique:true});
      pending.createIndex('workspace','workspaceId');
      pending.createIndex('note',['workspaceId','noteId']);
      db.createObjectStore('cursors',{keyPath:'workspaceId'});
    };
    const db=await request(r);
    db.onversionchange=()=>db.close();
    return new SyncStorage(db);
  }
  close(){this.db.close();}
  private write(stores:string[]):IDBTransaction {
    try{return this.db.transaction(stores,'readwrite',{durability:'strict'});}
    catch(e){if(!(e instanceof TypeError))throw e;return this.db.transaction(stores,'readwrite');}
  }
  /** Queue the operation and its optimistic local value atomically. */
  async enqueue(workspaceId:string,mutation:PendingMutation):Promise<void>{
    const tx=this.write(['notes','pending']),done=complete(tx);
    const notes=tx.objectStore('notes'),pending=tx.objectStore('pending');
    const get=notes.get([workspaceId,mutation.noteId]);
    get.onsuccess=()=>{
      const prior=get.result as StoredNote|undefined;
      notes.put({workspaceId,noteId:mutation.noteId,revision:prior?.revision??mutation.baseRevision,
        value:prior?prior.value:mutation.base,local:mutation.value} satisfies StoredNote);
      pending.add({...mutation,workspaceId} satisfies Queued);
    };
    await done;
  }
  async pending(workspaceId:string):Promise<Queued[]>{
    const tx=this.db.transaction('pending');
    return request(tx.objectStore('pending').index('workspace').getAll(workspaceId));
  }
  async notes(workspaceId:string):Promise<StoredNote[]>{
    const tx=this.db.transaction('notes');
    return request(tx.objectStore('notes').getAll(IDBKeyRange.bound([workspaceId,''],[workspaceId,'\uffff'])));
  }
  async cursor(workspaceId:string):Promise<number>{
    const tx=this.db.transaction('cursors');
    const value=await request<Cursor|undefined>(tx.objectStore('cursors').get(workspaceId));
    return value?.revision??0;
  }
  /** Persist a committed note and cursor atomically, never erase a pending local edit.
   * Caller must deliver events sequentially and request a snapshot on a cursor gap. */
  async commit(workspaceId:string,note:RevisionedNote,workspaceRevision:number,operationId?:string):Promise<void>{
    const tx=this.write(['notes','pending','cursors']),done=complete(tx);
    const notes=tx.objectStore('notes'),pending=tx.objectStore('pending'),cursors=tx.objectStore('cursors');
    const cursor=cursors.get(workspaceId);
    cursor.onsuccess=()=>{
      const last=(cursor.result as Cursor|undefined)?.revision??0;
      // Duplicate acknowledgements may refer to old events; do not roll back newer state.
      if(workspaceRevision>last+1){tx.abort();return;}
      const key=operationId?pending.index('operation').getKey([workspaceId,operationId]):null;
      const apply=()=>{
        const outstanding=pending.index('note').getAll([workspaceId,note.noteId]);
        outstanding.onsuccess=()=>{
          const read=notes.get([workspaceId,note.noteId]);
          read.onsuccess=()=>{
            const existing=read.result as StoredNote|undefined;
            const confirmed=existing&&existing.revision>note.revision?existing:note;
            const remaining=outstanding.result as Queued[];
            const tail=remaining.at(-1);
            notes.put({workspaceId,noteId:note.noteId,revision:confirmed.revision,value:confirmed.value,
              local:tail?tail.value:confirmed.value} satisfies StoredNote);
            cursors.put({workspaceId,revision:Math.max(last,workspaceRevision)} satisfies Cursor);
          };
        };
      };
      if(key)key.onsuccess=()=>{if(key.result!==undefined)pending.delete(key.result);apply();};
      else apply();
    };
    await done;
  }
}
