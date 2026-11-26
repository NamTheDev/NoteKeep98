import {SyncDatabase,type Principal} from './database';
import {matchesSecret} from './credentials';
import {SYNC_PROTOCOL_VERSION,type Mutation,type ServerMessage} from '../../src/features/sync/protocol';
import type {Note} from '../../src/features/notes/data';

const MAX=256*1024;
const META='__keep_labels__';
type SocketData={secret:string;principal:Principal|null;ready:boolean};
type Socket=import('bun').ServerWebSocket<SocketData>;
type Server=import('bun').Server<SocketData>;
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const str=(x:unknown,n:number):x is string=>typeof x==='string'&&x.length<=n;
const identifier=(x:unknown):x is string=>str(x,100)&&/^[A-Za-z0-9_-]+$/.test(x);
const list=(x:unknown,n:number):x is string[]=>Array.isArray(x)&&x.length<=n&&x.every(v=>str(v,120))&&new Set(x).size===x.length;
function validNote(x:unknown,id:string):x is Note{
  if(!object(x)||x.id!==id||!str(x.title,10000)||!str(x.body,100000)||!str(x.color,7)||!/^#[0-9a-fA-F]{6}$/.test(x.color))return false;
  if(!['checklist','pinned','archived','trashed'].every(k=>typeof x[k]==='boolean')||!list(x.labels,id===META?200:30))return false;
  if(!str(x.createdAt,40)||!str(x.updatedAt,40)||!Number.isFinite(Date.parse(x.createdAt))||!Number.isFinite(Date.parse(x.updatedAt)))return false;
  if(x.reminder!==null&&(!str(x.reminder,40)||!Number.isFinite(Date.parse(x.reminder))))return false;
  if(!Array.isArray(x.items)||x.items.length>200||!x.items.every(i=>object(i)&&identifier(i.id)&&str(i.text,10000)&&typeof i.checked==='boolean')||new Set(x.items.map(i=>i.id)).size!==x.items.length)return false;
  const keys=['id','title','body','checklist','items','color','pinned','archived','trashed','labels','reminder','createdAt','updatedAt'];
  return Object.keys(x).every(k=>keys.includes(k))&&x.items.every(i=>Object.keys(i).every(k=>['id','text','checked'].includes(k)));
}
function validMutation(x:unknown):x is Mutation{
  return object(x)&&identifier(x.operationId)&&identifier(x.noteId)&&typeof x.baseRevision==='number'&&Number.isSafeInteger(x.baseRevision)&&x.baseRevision>=0&&(x.value===null||validNote(x.value,x.noteId))&&Object.keys(x).every(k=>['operationId','noteId','baseRevision','value'].includes(k));
}
export function createCloud(path:string,origin:string,maxWorkspaces=5){
  if(!origin||!Number.isSafeInteger(maxWorkspaces)||maxWorkspaces<1||maxWorkspaces>100)throw Error('Invalid cloud configuration');
  const db=new SyncDatabase(path),sockets=new Set<Socket>(),rates=new Map<string,{count:number;until:number}>();
  const cors={'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Methods':'GET, POST, DELETE, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type, X-Keep-Request','Access-Control-Max-Age':'600'};
  const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...cors}});
  const secret=(req:Request)=>/^Bearer (ks_[A-Za-z0-9_-]{43})$/.exec(req.headers.get('authorization')||'')?.[1]||'';
  const revoke=(ids:string[])=>{for(const socket of sockets)if(socket.data.principal&&ids.includes(socket.data.principal.deviceId))socket.close(4001,'Access revoked');};
  function allowed(key:string,max:number,ms:number){
    const now=Date.now();let entry=rates.get(key);
    if(!entry||entry.until<=now){if(rates.size>10000){for(const [k,v] of rates)if(v.until<=now)rates.delete(k);if(rates.size>10000)return false;}entry={count:0,until:now+ms};rates.set(key,entry);}
    return ++entry.count<=max;
  }
  const send=(socket:Socket,message:unknown)=>{if(socket.send(JSON.stringify(message))<0)socket.close(1013,'Reconnect');};
  async function fetch(req:Request,server:Server):Promise<Response|undefined>{
    const url=new URL(req.url),route=url.pathname,s=secret(req);
    if(route==='/api/v1/sync'){
      if(req.headers.get('origin')!==origin)return json({error:'origin'},403);
      if(sockets.size>=60||!allowed('ws-global',120,60000))return json({error:'socket quota'},429);
      if(server.upgrade(req,{data:{secret:'',principal:null,ready:false}}))return;
      return json({error:'upgrade required'},400);
    }
    if(req.headers.get('origin')!==origin)return json({error:'origin'},403);
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    if(req.method!=='GET'&&req.headers.get('x-keep-request')!=='1')return json({error:'request header required'},403);
    if(!allowed('http-global',600,60000))return json({error:'rate limit'},429);
    try{
      if(req.method==='POST'&&['/api/v1/workspaces','/api/v1/pair','/api/v1/recover'].includes(route)){
        const ip=server.requestIP(req)?.address||'unknown',limit=route.endsWith('recover')?5:route.endsWith('workspaces')?3:10,ms=route.endsWith('recover')?900000:route.endsWith('workspaces')?3600000:60000;
        if(!allowed(route+ip,limit,ms)||!allowed(route+'-global',limit*5,ms))return json({error:'rate limit'},429);
        const b=await req.json();if(!object(b))return json({error:'invalid request'},400);
        if(db.authenticate(s))return json({error:'Disconnect current workspace first'},409);
        if(route.endsWith('workspaces')){
          // Accountless creation is public; cap allocation and keep workspace data private.
          const count=db.db.query('SELECT COUNT(*) AS n FROM workspaces').get() as {n:number};
          if(count.n>=maxWorkspaces)return json({error:'Cloud workspace capacity reached. Existing workspaces are unaffected.'},503);
          const x=db.createWorkspace();return json({workspaceId:x.workspaceId,deviceId:x.deviceId,owner:true,recoveryKey:x.recoveryKey,session:x.secret},201);
        }
        if(route.endsWith('pair')){
          const x=db.pair(b.token);return json({workspaceId:x.workspaceId,deviceId:x.deviceId,owner:false,session:x.secret});
        }
        const x=db.recover(b.key);revoke(x.revoked);return json({workspaceId:x.workspaceId,deviceId:x.deviceId,owner:true,recoveryKey:x.recoveryKey,session:x.secret});
      }
      if(req.method==='POST'&&route==='/api/v1/session/logout'){revoke(db.logout(s));return json({ok:true});}
      const p=db.authenticate(s);if(!p)return json({error:'unauthorized'},401);
      if(req.method==='GET'&&route==='/api/v1/session')return json(p);
      if(req.method==='GET'&&route==='/api/v1/snapshot')return json(db.snapshot(s));
      if(req.method==='GET'&&route==='/api/v1/devices')return json({devices:db.devices(s),grants:db.grants(s)});
      if(req.method==='POST'&&route==='/api/v1/tokens'){const x=db.rotatePairing(s);revoke(x.revoked);return json({id:x.id,token:x.token});}
      if(req.method==='DELETE'&&route.startsWith('/api/v1/tokens/')){revoke(db.revokePairing(s,route.split('/').at(-1)!));return json({ok:true});}
      if(req.method==='DELETE'&&route.startsWith('/api/v1/devices/')){revoke(db.revokeDevice(s,route.split('/').at(-1)!));return json({ok:true});}
      if(req.method==='DELETE'&&route==='/api/v1/workspace'){
        const b=await req.json();if(!object(b)||b.confirm!=='DELETE'||!p.owner)return json({error:'confirmation required'},403);
        // Recovery-key proof establishes current owner authorization for this destructive action.
        const row=db.db.query<{recovery_hash:string},[string]>('SELECT recovery_hash FROM workspaces WHERE id=?').get(p.workspaceId);
        if(!row||!str(b.key,100)||!matchesSecret(b.key,row.recovery_hash))return json({error:'Recovery key required'},403);
        revoke(db.deleteWorkspace(s));return json({ok:true});
      }
      return json({error:'not found'},404);
    }catch(e){const message=e instanceof Error?e.message:'unknown';return json({error:['invalid pairing token','invalid recovery key','device quota','forbidden','unauthorized'].includes(message)?message:'Request failed'},message==='forbidden'?403:400);}
  }
  return {fetch,websocket:{
    maxPayloadLength:MAX,idleTimeout:120,
    open(ws:Socket){sockets.add(ws);setTimeout(()=>{if(sockets.has(ws)&&!ws.data.principal)ws.close(4001,'Authentication required');},5000);},
    close(ws:Socket){sockets.delete(ws);},
    message(ws:Socket,raw:string|Buffer){
      try{
        if(typeof raw!=='string'||Buffer.byteLength(raw)>MAX){ws.close(1009,'Message too large');return;}
        const x=JSON.parse(raw);if(!object(x)){ws.close(1008,'Invalid message');return;}
        if(!ws.data.principal){
          if(x.type!=='auth'||typeof x.session!=='string'||x.session.length>100){ws.close(4001,'Authentication required');return;}
          const p=db.authenticate(x.session);if(!p){ws.close(4001,'Access revoked');return;}
          if([...sockets].filter(w=>w.data.principal?.deviceId===p.deviceId).length>=3){ws.close(1013,'Device connection limit');return;}
          ws.data.secret=x.session;ws.data.principal=p;send(ws,{type:'ready'});return;
        }
        const p=db.authenticate(ws.data.secret);if(!p){ws.close(4001,'Access revoked');return;}
        if(x.type==='ping'){send(ws,{type:'pong'});return;}
        if(x.type==='resume'&&x.version===SYNC_PROTOCOL_VERSION&&typeof x.since==='number'&&Number.isSafeInteger(x.since)&&x.since>=0){
          const events=db.events(ws.data.secret,x.since);
          if(events===null){send(ws,{type:'resync'});return;}
          for(const event of events)send(ws,event);
          ws.data.ready=true;send(ws,{type:'resumed'});return;
        }
        if(!ws.data.ready||x.type!=='mutate'||!validMutation(x.mutation)){ws.close(1008,'Invalid mutation');return;}
        if(!allowed('mutate:'+p.deviceId,120,60000)){send(ws,{type:'error',code:'rate-limit',operationId:x.mutation.operationId});return;}
        const result=db.apply(ws.data.secret,x.mutation);send(ws,result);
        if(result.type==='ack'){
          const event:ServerMessage={type:'change',workspaceRevision:result.workspaceRevision,note:result.note};
          for(const other of sockets)if(other!==ws&&other.data.ready&&other.data.principal?.workspaceId===p.workspaceId){if(db.authenticate(other.data.secret))send(other,event);else other.close(4001,'Access revoked');}
        }
      }catch{ws.close(1011,'Sync error');}
    }
  }};
}
