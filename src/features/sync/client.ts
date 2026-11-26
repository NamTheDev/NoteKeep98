import {blankNote,type AppData,type Note} from '../notes/data';
import {html} from '../../utils/format';
import {mergeNote} from './merge';
import type {Conflict,Mutation,PendingMutation,RevisionedNote,ServerMessage} from './protocol';

const KEY='keep-cloud-test-v1',META='__keep_labels__',MAX=256*1024;
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
type Queue=PendingMutation & {wire?:Mutation};
type Identity={workspaceId:string;deviceId:string;owner:boolean;recoveryKey?:string};
type State={identity:Identity;cursor:number;confirmed:RevisionedNote[];pending:Queue[];conflicts:Conflict[];list:boolean;collapsed:boolean};
type Device={id:string;owner:number;last_seen:number|null};
type Grant={id:string;created_at:number};
type Snapshot={workspaceRevision:number;notes:RevisionedNote[]};
type Frame=ServerMessage|{type:'ready'|'resumed'|'resync'|'pong'};
const metadata=(labels:string[]):Note=>({...blankNote(),id:META,labels,createdAt:'1970-01-01T00:00:00.000Z',updatedAt:'1970-01-01T00:00:00.000Z'});
const button=(action:string,label:string,extra='')=>`<button class="chrome-btn btn-outline theme-secondary btn rounded-5" data-action="cloud:${action}" ${extra}>${html(label)}</button>`;
export class CloudSync{
  private state:State|null=null;
  private socket:WebSocket|null=null;
  private writer=false;
  private ready=false;
  private status='Local only';
  private inFlight:string|null=null;
  private timer:number|undefined;
  private heartbeat:number|undefined;
  private backoff=1000;
  private secretDisplay='';
  private devices:Device[]=[];
  private grants:Grant[]=[];
  private busy=false;
  private epoch=0;
  constructor(private changed:()=>void,private notice:(message:string)=>void){
    this.reload();
  }
  get active(){return !!this.state;}
  get canWrite(){return this.writer;}
  get statusText(){return this.active?this.status:'Local only';}
  private reload(){
    try{const raw=localStorage.getItem(KEY);this.state=raw?JSON.parse(raw) as State:null;}
    catch{this.state=null;}
  }
  start(){
    if(!navigator.locks){this.status='Cloud requires browser lock support';return;}
    window.addEventListener('storage',e=>{if(e.key===KEY&&!this.writer){this.reload();this.status='Read-only: another tab is syncing';this.changed();}});
    void navigator.locks.request('keep-cloud-sync-writer',async()=>{
      this.writer=true;this.reload();this.changed();if(this.active)void this.connect();
      await new Promise<void>(()=>{});
    });
    window.addEventListener('online',()=>{if(this.writer&&this.active&&!this.socket)void this.connect();});
    window.addEventListener('offline',()=>{if(this.active){this.status='Offline — edits queued';this.changed();}});
  }
  private save(next:State|null):boolean{
    try{if(next)localStorage.setItem(KEY,JSON.stringify(next));else localStorage.removeItem(KEY);this.state=next;return true;}
    catch{this.notice('Cloud cache is full; the change was not applied. Export a backup.');return false;}
  }
  private optimistic(s:State):Map<string,Note|null>{
    const map=new Map(s.confirmed.map(n=>[n.noteId,n.value]));
    for(const p of s.pending)map.set(p.noteId,p.value);
    return map;
  }
  project(local:AppData):AppData{
    const s=this.state;if(!s)return local;
    const all=this.optimistic(s),labels=all.get(META)?.labels??[];
    const notes=[...all].filter(([id,n])=>id!==META&&n!==null).map(([,n])=>n!);
    return {notes,labels:[...new Set([...labels,...notes.flatMap(n=>n.labels)])],list:s.list,collapsed:s.collapsed};
  }
  capture(previous:AppData,next:AppData):boolean{
    if(!this.state||!this.writer){this.notice('This tab is read-only while another tab owns synchronization.');return false;}
    const s=structuredClone(this.state),before=new Map(previous.notes.map(n=>[n.id,n])),after=new Map(next.notes.map(n=>[n.id,n]));
    if(before.has(META)||after.has(META)){this.notice('Reserved note identifier.');return false;}
    if(!equal(previous.labels,next.labels)){
      before.set(META,this.optimistic(s).get(META)??metadata(previous.labels));
      after.set(META,metadata(next.labels));
    }
    for(const id of new Set([...before.keys(),...after.keys()])){
      const prior=before.get(id)??null,value=after.get(id)??null;
      if(equal(prior,value))continue;
      const confirmed=s.confirmed.find(n=>n.noteId===id);
      const m:Queue={operationId:crypto.randomUUID(),noteId:id,baseRevision:confirmed?.revision??0,base:id===META&&!confirmed&&!s.pending.some(p=>p.noteId===id)?null:prior,value,queuedAt:Date.now()};
      if(new TextEncoder().encode(JSON.stringify({type:'mutate',mutation:{operationId:m.operationId,noteId:id,baseRevision:m.baseRevision,value}})).length>MAX){this.notice('Note exceeds the 256 KiB sync message limit.');return false;}
      s.pending.push(m);
    }
    s.list=next.list;s.collapsed=next.collapsed;
    if(!this.save(s))return false;
    this.status=s.pending.length?'Syncing…':'Synced';this.flush();return true;
  }
  private async api<T>(path:string,method='GET',body?:unknown):Promise<T>{
    const response=await fetch('/api/v1/'+path,{method,credentials:'same-origin',cache:'no-store',headers:{'X-Keep-Request':'1','Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const result=await response.json();
    if(!response.ok)throw Error(result.error||'Request failed');
    return result as T;
  }
  private stop(){
    this.epoch++;this.ready=false;this.inFlight=null;clearTimeout(this.timer);clearInterval(this.heartbeat);
    const socket=this.socket;this.socket=null;if(socket)socket.close();
  }
  private schedule(){
    if(!this.writer||!this.active||this.timer!==undefined)return;
    const delay=this.backoff*(.8+Math.random()*.4);this.backoff=Math.min(30000,this.backoff*2);
    this.timer=window.setTimeout(()=>{this.timer=undefined;void this.connect();},delay);
  }
  private async connect(){
    if(!this.writer||!this.state||this.socket)return;
    const epoch=++this.epoch;this.status='Connecting…';this.changed();
    try{
      const identity=await this.api<Identity>('session');
      if(epoch!==this.epoch)return;
      if(identity.workspaceId!==this.state.identity.workspaceId){this.status='Session belongs to another workspace';this.changed();return;}
      const scheme=location.protocol==='https:'?'wss:':'ws:';
      const ws=new WebSocket(scheme+'//'+location.host+'/api/v1/sync');this.socket=ws;
      ws.onopen=()=>{this.heartbeat=window.setInterval(()=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'ping'}));},25000);};
      ws.onmessage=e=>{if(this.socket!==ws)return;try{void this.receive(JSON.parse(String(e.data)) as Frame,ws).catch(()=>{this.status='Sync recovery required';ws.close();this.changed();});}catch{ws.close();}};
      ws.onclose=e=>{if(this.socket!==ws)return;this.socket=null;this.ready=false;this.inFlight=null;clearInterval(this.heartbeat);
        this.status=e.code===4001?'Access revoked — local edits retained':'Offline — edits queued';this.changed();
        if(e.code!==4001)this.schedule();};
      ws.onerror=()=>ws.close();
    }catch(e){
      if(epoch!==this.epoch)return;
      this.status=e instanceof Error&&e.message==='unauthorized'?'Access revoked or expired — local edits retained':'Offline — edits queued';
      this.changed();if(!this.status.startsWith('Access revoked'))this.schedule();
    }
  }
  private async receive(frame:Frame,ws:WebSocket){
    if(!this.state)return;
    if(frame.type==='ready'){ws.send(JSON.stringify({type:'resume',version:1,since:this.state.cursor}));return;}
    if(frame.type==='resync'){
      this.ready=false;const snap=await this.api<Snapshot>('snapshot');
      if(this.socket!==ws||!this.state)return;
      const s=structuredClone(this.state);s.confirmed=snap.notes;s.cursor=snap.workspaceRevision;
      if(!this.save(s)){ws.close();return;}
      ws.send(JSON.stringify({type:'resume',version:1,since:s.cursor}));this.changed();return;
    }
    if(frame.type==='resumed'){this.ready=true;this.backoff=1000;this.status=this.state.pending.length?'Syncing…':'Synced';this.changed();this.flush();return;}
    if(frame.type==='pong')return;
    const s=structuredClone(this.state);
    if(frame.type==='change'||frame.type==='ack'){
      if(frame.workspaceRevision>s.cursor+1){this.ready=false;ws.close();return;}
      const prior=s.confirmed.find(n=>n.noteId===frame.note.noteId);
      if(!prior||prior.revision<frame.note.revision)s.confirmed=[...s.confirmed.filter(n=>n.noteId!==frame.note.noteId),frame.note];
      s.cursor=Math.max(s.cursor,frame.workspaceRevision);
      if(frame.type==='ack'){s.pending=s.pending.filter(p=>p.operationId!==frame.operationId);if(this.inFlight===frame.operationId)this.inFlight=null;}
    }else if(frame.type==='conflict'){
      if(!s.conflicts.some(c=>c.operationId===frame.conflict.operationId))s.conflicts.push(frame.conflict);
      s.pending=s.pending.filter(p=>p.operationId!==frame.conflict.operationId);this.inFlight=null;
      this.notice('A conflicting edit was preserved in Cloud Sync settings.');
    }else if(frame.type==='error'){
      this.ready=false;this.inFlight=null;this.status='Sync blocked: '+frame.code;this.changed();return;
    }else return;
    if(!this.save(s)){ws.close();return;}
    this.status=s.pending.length?'Syncing…':s.conflicts.length?'Conflicts preserved':'Synced';this.changed();this.flush();
  }
  private flush(){
    if(!this.writer||!this.ready||!this.socket||this.socket.readyState!==WebSocket.OPEN||!this.state||this.inFlight)return;
    const s=structuredClone(this.state),p=s.pending[0];if(!p)return;
    if(!p.wire){
      const confirmed=s.confirmed.find(n=>n.noteId===p.noteId),remote=confirmed?.value??null;
      if(Date.now()-p.queuedAt>90*86400000||(confirmed&&confirmed.value===null&&p.value!==null)){
        s.conflicts.push({operationId:p.operationId,noteId:p.noteId,base:p.base,local:p.value,remote,fields:['stale or deleted']});
        s.pending.shift();if(this.save(s)){this.changed();this.flush();}return;
      }
      const merged=mergeNote(p.base,p.value,remote);
      if(!merged.ok){
        s.conflicts.push({operationId:p.operationId,noteId:p.noteId,base:p.base,local:p.value,remote,fields:merged.fields});
        s.pending.shift();if(this.save(s)){this.notice('Conflicting edit preserved');this.changed();this.flush();}return;
      }
      p.wire={operationId:p.operationId,noteId:p.noteId,baseRevision:confirmed?.revision??0,value:merged.value};
      if(!this.save(s))return;
    }
    const message=JSON.stringify({type:'mutate',mutation:p.wire});
    if(new TextEncoder().encode(message).length>MAX){this.status='Sync blocked: message too large';this.changed();return;}
    this.inFlight=p.operationId;this.socket.send(message);
  }
  private async adopt(identity:Identity,local:AppData,upload:boolean){
    const snapshot=await this.api<Snapshot>('snapshot');
    const recovery=identity.recoveryKey;
    const safeIdentity={workspaceId:identity.workspaceId,deviceId:identity.deviceId,owner:identity.owner};
    const next:State={identity:safeIdentity,cursor:snapshot.workspaceRevision,confirmed:snapshot.notes,pending:[],conflicts:[],list:local.list,collapsed:local.collapsed};
    if(!this.save(next))throw Error('Cannot save workspace locally');
    if(recovery)this.secretDisplay='Recovery key (save now): '+recovery;
    if(upload&&!this.capture({notes:[],labels:[],list:local.list,collapsed:local.collapsed},local))this.notice('Workspace created; original local notes remain available. Import a backup to upload.');
    this.changed();void this.connect();await this.refreshDevices();
  }
  async refreshDevices(){
    if(!this.state?.identity.owner)return;
    try{const r=await this.api<{devices:Device[];grants:Grant[]}>('devices');this.devices=r.devices;this.grants=r.grants;}
    catch{this.devices=[];this.grants=[];}
  }
  settings():string{
    const s=this.state;
    if(!navigator.locks)return '<p>Cloud Sync requires a browser with Web Locks support.</p>';
    if(!s)return `<fieldset class="settings-group d-grid gap-3 mt-3"><legend>Cloud Sync (test)</legend><p>Connect using a pairing token, or create a private workspace. Local-only notes remain separate when pairing.</p><label for="cloudCredential">Invitation, pairing token or recovery key</label><input id="cloudCredential" class="form-control rounded-5" type="password" autocomplete="off"><div class="d-flex flex-wrap gap-2">${button('create','Create workspace')}${button('pair','Pair device')}${button('recover','Recover owner')}</div></fieldset>`;
    return `<fieldset class="settings-group d-grid gap-3 mt-3"><legend>Cloud Sync (test)</legend><p>${html(this.status)} · ${s.pending.length} pending · ${s.conflicts.length} conflicts</p>
      ${this.secretDisplay?`<label for="cloudSecret">Save this credential now — it is not stored in the browser.</label><textarea id="cloudSecret" class="form-control" readonly rows="3">${html(this.secretDisplay)}</textarea>${button('hide','Hide credential')}`:''}
      ${s.identity.owner?`<div class="d-flex flex-wrap gap-2">${button('token','Generate / rotate pairing token')}${button('refresh','Refresh devices')}</div>
      ${this.grants.map(g=>`<div>${html(new Date(g.created_at).toLocaleString())} ${button('revoke-token','Revoke token','data-id="'+html(g.id)+'"')}</div>`).join('')}
      <h4>Devices</h4>${this.devices.map(d=>`<div class="d-flex align-items-center justify-content-between gap-2"><span>${d.owner?'Owner':html(d.id.slice(0,8))}${d.id===s.identity.deviceId?' (this device)':''}</span>${!d.owner?button('revoke-device','Remove','data-id="'+html(d.id)+'"'):''}</div>`).join('')}`:''}
      ${s.conflicts.map(c=>`<div class="border rounded-5 p-3"><p>Conflict: ${html(c.local?.title||c.remote?.title||'Untitled note')} (${html(c.fields.join(', '))})</p>${c.local&&c.noteId!==META?button('recover-conflict','Recover as a separate note','data-id="'+html(c.operationId)+'"'):''} ${button('discard-conflict','Discard conflicting edit','data-id="'+html(c.operationId)+'"')}</div>`).join('')}
      <div class="d-flex flex-wrap gap-2">${button('retry','Reconnect')}${button('leave','Disconnect')}${s.identity.owner?button('delete','Delete cloud workspace'):''}</div></fieldset>`;
  }
  async action(action:string,id:string,local:AppData):Promise<void>{
    if(!this.writer){this.notice('Use the active synchronization tab.');return;}
    if(this.busy)return;this.busy=true;
    try{
      const credential=(document.getElementById('cloudCredential') as HTMLInputElement|null)?.value.trim()||'';
      if(action==='create'||action==='pair'||action==='recover'){
        if(this.active)return;
        if(!credential)throw Error('Enter a credential');
        if(action==='pair'||action==='recover'){if(!window.confirm('Open this cloud workspace? Existing local-only notes remain separate.'))return;}
        const route=action==='create'?'workspaces':action;
        const body=action==='create'?{invite:credential}:action==='pair'?{token:credential}:{key:credential};
        await this.adopt(await this.api<Identity>(route,'POST',body),local,action==='create');
      }else if(action==='token'){
        if(!window.confirm('Generate a new pairing token? Previous paired devices will lose cloud access.'))return;
        const token=await this.api<{token:string}>('tokens','POST',{});this.secretDisplay='Pairing token: '+token.token;await this.refreshDevices();
      }else if(action==='revoke-token'||action==='revoke-device'){
        if(!window.confirm('Revoke this access? Already downloaded copies cannot be erased.'))return;
        await this.api((action==='revoke-token'?'tokens/':'devices/')+encodeURIComponent(id),'DELETE');this.secretDisplay='';await this.refreshDevices();
      }else if(action==='refresh'){await this.refreshDevices();}
      else if(action==='hide'){this.secretDisplay='';}
      else if(action==='retry'){this.stop();this.timer=undefined;void this.connect();}
      else if(action==='leave'||action==='delete'){
        if(!window.confirm('Disconnect from this workspace? Export a JSON backup first if you need a separate copy.'))return;
        if(action==='delete'){
          const key=window.prompt('Enter the owner recovery key to permanently delete the cloud workspace.');
          if(!key)return;
          if(!window.confirm('Permanently delete the cloud workspace for all devices?'))return;
          await this.api('workspace','DELETE',{confirm:'DELETE',key});
        }else{try{await this.api('session/logout','POST',{});}catch{throw Error('Reconnect before disconnecting; your local data remains safe.');}}
        this.stop();this.timer=undefined;this.secretDisplay='';this.devices=[];this.grants=[];
        // Preserve the cloud cache as an independent local backup before leaving.
        if(this.state)localStorage.setItem(KEY+'-disconnected',JSON.stringify(this.state));
        if(!this.save(null))throw Error('Could not disconnect local cache');
        this.changed();
      }else if(action==='recover-conflict'||action==='discard-conflict'){
        if(!this.state)return;
        const s=structuredClone(this.state),c=s.conflicts.find(x=>x.operationId===id);if(!c)return;
        if(action==='recover-conflict'&&c.local&&c.noteId!==META){
          const n={...c.local,id:crypto.randomUUID(),title:(c.local.title+' (conflict copy)').slice(0,10000)};
          if(!this.capture(local,{...local,notes:[n,...local.notes]}))return;
        }else if(!window.confirm('Discard this preserved conflicting edit?'))return;
        const updated=structuredClone(this.state);updated.conflicts=updated.conflicts.filter(x=>x.operationId!==id);this.save(updated);this.changed();
      }
    }catch(e){this.notice(e instanceof Error?e.message:'Cloud operation failed');}
    finally{this.busy=false;}
  }
}
