import {Database} from 'bun:sqlite';
import {randomUUID} from 'node:crypto';
import {digestSecret,issueSecret,validSecret} from './credentials';
import {mergeNote} from '../../src/features/sync/merge';
import type {Note} from '../../src/features/notes/data';
import type {Mutation,ServerMessage} from '../../src/features/sync/protocol';

const DAY=86400000;
export interface Principal {deviceId:string;workspaceId:string;owner:boolean;familyId:string}
type SessionRow={device_id:string;workspace_id:string;owner:number;family_id:string};
type StoredNote={revision:number;value:string|null};
type Outcome=Extract<ServerMessage,{type:'ack'|'conflict'|'error'}>;
export class SyncDatabase {
  readonly db:Database;
  constructor(path:string,private readonly maxDevices=10,private readonly maxNotes=5000,private readonly maxBytes=50*1024*1024){
    this.db=new Database(path,{create:true,strict:true});
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS workspaces(id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, recovery_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS pairing_tokens(id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, revoked_at INTEGER);
      CREATE TABLE IF NOT EXISTS devices(id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, pairing_id TEXT REFERENCES pairing_tokens(id), owner INTEGER NOT NULL CHECK(owner IN(0,1)), revoked_at INTEGER);
      CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY, device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE, family_id TEXT NOT NULL, last_seen INTEGER NOT NULL, revoked_at INTEGER);
      CREATE TABLE IF NOT EXISTS notes(workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, note_id TEXT NOT NULL, revision INTEGER NOT NULL, value TEXT, PRIMARY KEY(workspace_id,note_id));
      CREATE TABLE IF NOT EXISTS note_revisions(workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, note_id TEXT NOT NULL, revision INTEGER NOT NULL, value TEXT, created_at INTEGER NOT NULL, PRIMARY KEY(workspace_id,note_id,revision));
      CREATE TABLE IF NOT EXISTS mutations(workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, operation_id TEXT NOT NULL, digest TEXT NOT NULL, outcome TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(workspace_id,operation_id));
      CREATE TABLE IF NOT EXISTS sync_events(workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, revision INTEGER NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(workspace_id,revision));
      CREATE TABLE IF NOT EXISTS conflicts(workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, operation_id TEXT NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(workspace_id,operation_id));
      CREATE INDEX IF NOT EXISTS devices_workspace ON devices(workspace_id);
      CREATE INDEX IF NOT EXISTS sessions_device ON sessions(device_id);
    `);
  }
  close(){this.db.close();}
  private session(workspaceId:string,owner:boolean,pairingId:string|null){
    const deviceId=randomUUID(),familyId=randomUUID(),secret=issueSecret('ks');
    this.db.run('INSERT INTO devices(id,workspace_id,pairing_id,owner) VALUES(?,?,?,?)',[deviceId,workspaceId,pairingId,owner?1:0]);
    this.db.run('INSERT INTO sessions(hash,device_id,family_id,last_seen) VALUES(?,?,?,?)',[digestSecret(secret),deviceId,familyId,Date.now()]);
    return {deviceId,workspaceId,secret};
  }
  /** Caller must enforce invitation authorization and request rate limits. */
  createWorkspace(){
    return this.db.transaction(()=>{
      const workspaceId=randomUUID(),recoveryKey=issueSecret('kr');
      this.db.run('INSERT INTO workspaces(id,recovery_hash,created_at) VALUES(?,?,?)',[workspaceId,digestSecret(recoveryKey),Date.now()]);
      return {...this.session(workspaceId,true,null),recoveryKey};
    })();
  }
  authenticate(secret:unknown):Principal|null {
    if(!validSecret(secret,'ks'))return null;
    const hash=digestSecret(secret),now=Date.now();
    const row=this.db.query<SessionRow,[string,number]>(`SELECT d.id AS device_id,d.workspace_id,d.owner,s.family_id FROM sessions s
      JOIN devices d ON d.id=s.device_id LEFT JOIN pairing_tokens t ON t.id=d.pairing_id
      WHERE s.hash=? AND s.last_seen>=? AND s.revoked_at IS NULL AND d.revoked_at IS NULL
      AND (d.owner=1 OR (t.id IS NOT NULL AND t.revoked_at IS NULL))`).get(hash,now-90*DAY);
    if(!row)return null;
    this.db.run('UPDATE sessions SET last_seen=? WHERE hash=?',[now,hash]);
    return {deviceId:row.device_id,workspaceId:row.workspace_id,owner:!!row.owner,familyId:row.family_id};
  }
  issuePairing(ownerSecret:string){
    return this.db.transaction(()=>{
      const p=this.authenticate(ownerSecret);if(!p?.owner)throw Error('forbidden');
      const token=issueSecret('kp'),id=randomUUID();
      this.db.run('INSERT INTO pairing_tokens(id,workspace_id,hash,created_at) VALUES(?,?,?,?)',[id,p.workspaceId,digestSecret(token),Date.now()]);
      return {id,token};
    })();
  }
  pair(token:unknown){
    if(!validSecret(token,'kp'))throw Error('invalid pairing token');
    return this.db.transaction(()=>{
      const row=this.db.query<{id:string;workspace_id:string},[string]>('SELECT id,workspace_id FROM pairing_tokens WHERE hash=? AND revoked_at IS NULL').get(digestSecret(token));
      if(!row)throw Error('invalid pairing token');
      const count=this.db.query<{n:number},[string]>('SELECT COUNT(*) AS n FROM devices WHERE workspace_id=? AND revoked_at IS NULL').get(row.workspace_id)!.n;
      if(count>=this.maxDevices)throw Error('device quota');
      return this.session(row.workspace_id,false,row.id);
    })();
  }
  revokePairing(ownerSecret:string,tokenId:string){
    return this.db.transaction(()=>{
      const p=this.authenticate(ownerSecret);if(!p?.owner)throw Error('forbidden');
      const now=Date.now();
      const result=this.db.run('UPDATE pairing_tokens SET revoked_at=? WHERE id=? AND workspace_id=? AND revoked_at IS NULL',[now,tokenId,p.workspaceId]);
      if(!result.changes)return [];
      const devices=this.db.query<{id:string},[string,string]>('SELECT id FROM devices WHERE pairing_id=? AND workspace_id=?').all(tokenId,p.workspaceId).map(d=>d.id);
      this.db.run('UPDATE devices SET revoked_at=? WHERE pairing_id=? AND workspace_id=?',[now,tokenId,p.workspaceId]);
      this.db.run('UPDATE sessions SET revoked_at=? WHERE device_id IN (SELECT id FROM devices WHERE pairing_id=? AND workspace_id=?)',[now,tokenId,p.workspaceId]);
      return devices; // The transport must also close these active sockets.
    })();
  }
  /** Internal transaction: callers must validate wire schemas and size, and throttle. */
  apply(secret:string,mutation:Mutation):Outcome {
    return this.db.transaction(()=>{
      const p=this.authenticate(secret);if(!p)throw Error('unauthorized');
      const w=p.workspaceId, m=mutation, hash=digestSecret(JSON.stringify(m)), now=Date.now();
      if(m.value!==null && m.value.id!==m.noteId) return {type:'error',code:'note-id-mismatch',operationId:m.operationId};
      if(!Number.isSafeInteger(m.baseRevision)||m.baseRevision<0)return {type:'error',code:'invalid-base',operationId:m.operationId};
      const prior=this.db.query<{digest:string;outcome:string},[string,string]>('SELECT digest,outcome FROM mutations WHERE workspace_id=? AND operation_id=?').get(w,m.operationId);
      if(prior)return prior.digest===hash?JSON.parse(prior.outcome) as Outcome:{type:'error',code:'operation-id-reused',operationId:m.operationId};
      const current=this.db.query<StoredNote,[string,string]>('SELECT revision,value FROM notes WHERE workspace_id=? AND note_id=?').get(w,m.noteId);
      const unpack=(v:string|null|undefined):Note|null=>v==null?null:JSON.parse(v);
      const remote=unpack(current?.value);
      const historical=m.baseRevision===0?null:this.db.query<StoredNote,[string,string,number]>('SELECT revision,value FROM note_revisions WHERE workspace_id=? AND note_id=? AND revision=?').get(w,m.noteId,m.baseRevision);
      const ancestor=unpack(historical?.value);
      const record=(outcome:Outcome)=>{this.db.run('INSERT INTO mutations(workspace_id,operation_id,digest,outcome,created_at) VALUES(?,?,?,?,?)',[w,m.operationId,hash,JSON.stringify(outcome),now]);return outcome;};
      const conflict=(fields:string[])=>{
        const c={operationId:m.operationId,noteId:m.noteId,base:ancestor,local:m.value,remote,fields};
        this.db.run('INSERT INTO conflicts(workspace_id,operation_id,payload,created_at) VALUES(?,?,?,?)',[w,m.operationId,JSON.stringify(c),now]);
        return record({type:'conflict',conflict:c});
      };
      if(m.baseRevision!==0&&!historical)return conflict(['missing-base']);
      if(current&&current.value===null&&m.value!==null)return conflict(['deleted-note']);
      if(!current&&m.baseRevision!==0)return conflict(['missing-note']);
      if(current&&m.baseRevision===0)return conflict(['existing-id']);
      const merged=mergeNote(ancestor,m.value,remote);
      if(!merged.ok)return conflict(merged.fields);
      const next=merged.value===null?null:JSON.stringify({...merged.value,updatedAt:new Date(now).toISOString()});
      const usage=this.db.query<{n:number;bytes:number},[string,string]>('SELECT COUNT(value) AS n, COALESCE(SUM(length(CAST(value AS BLOB))),0) AS bytes FROM notes WHERE workspace_id=? AND note_id<>?').get(w,m.noteId)!;
      if(next!==null&&(usage.n>=this.maxNotes||usage.bytes+Buffer.byteLength(next)>this.maxBytes))return {type:'error',code:'workspace-quota',operationId:m.operationId};
      const revision=this.db.query<{revision:number},[string]>('UPDATE workspaces SET revision=revision+1 WHERE id=? RETURNING revision').get(w)!.revision;
      this.db.run('INSERT INTO notes(workspace_id,note_id,revision,value) VALUES(?,?,?,?) ON CONFLICT(workspace_id,note_id) DO UPDATE SET revision=excluded.revision,value=excluded.value',[w,m.noteId,revision,next]);
      this.db.run('INSERT INTO note_revisions(workspace_id,note_id,revision,value,created_at) VALUES(?,?,?,?,?)',[w,m.noteId,revision,next,now]);
      const note={noteId:m.noteId,revision,value:unpack(next)};
      this.db.run('INSERT INTO sync_events(workspace_id,revision,payload,created_at) VALUES(?,?,?,?)',[w,revision,JSON.stringify({type:'change',workspaceRevision:revision,note}),now]);
      return record({type:'ack',operationId:m.operationId,workspaceRevision:revision,note});
    })();
  }
}
