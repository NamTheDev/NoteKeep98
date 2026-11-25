import {SyncStorage} from '../src/features/sync/storage';
import {blankNote} from '../src/features/notes/data';

export async function verifyStorage():Promise<void>{
  const check=(value:unknown,message:string)=>{if(!value)throw Error(message);};
  const workspace=crypto.randomUUID(),other=crypto.randomUUID(),note=blankNote();
  const operationId=crypto.randomUUID();
  let storage=await SyncStorage.open();
  await storage.enqueue(workspace,{operationId,noteId:note.id,baseRevision:0,base:null,value:note,queuedAt:Date.now()});
  storage.close();storage=await SyncStorage.open();
  check((await storage.pending(workspace)).length===1,'outbox must survive reopen');
  check((await storage.notes(workspace))[0]?.local?.id===note.id,'local note not saved');
  check((await storage.notes(other)).length===0,'workspace isolation');
  const next={...note,title:'later local edit'};
  const second=crypto.randomUUID();
  await storage.enqueue(workspace,{operationId:second,noteId:note.id,baseRevision:0,base:note,value:next,queuedAt:Date.now()});
  await storage.commit(workspace,{noteId:note.id,revision:1,value:note},1,operationId);
  check((await storage.pending(workspace)).length===1,'only acknowledged operation should leave queue');
  check((await storage.notes(workspace))[0]?.local?.title===next.title,'ack must not clobber later edit');
  await storage.commit(workspace,{noteId:note.id,revision:2,value:next},2,second);
  await storage.commit(workspace,{noteId:note.id,revision:1,value:note},1,operationId);
  check(await storage.cursor(workspace)===2,'cursor must not move backwards');
  check((await storage.notes(workspace))[0]?.local?.title===next.title,'old ack must not restore old content');
  check((await storage.pending(workspace)).length===0,'acknowledged queue must be empty');
  let gap=false;
  try{await storage.commit(workspace,{noteId:note.id,revision:4,value:note},4);}
  catch{gap=true;}
  check(gap&&await storage.cursor(workspace)===2,'cursor gaps must abort');
  storage.close();
}
