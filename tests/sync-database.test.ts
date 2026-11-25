import {test,expect} from 'bun:test';
import {SyncDatabase} from '../server/sync/database';
import {blankNote} from '../src/features/notes/data';
import {issueSecret,digestSecret,validSecret,matchesSecret} from '../server/sync/credentials';

test('credentials are random, correctly shaped and verified by digest',()=>{
  const a=issueSecret('kp'),b=issueSecret('kp');expect(a).not.toBe(b);
  expect(validSecret(a,'kp')).toBe(true);expect(matchesSecret(a,digestSecret(a))).toBe(true);
  expect(matchesSecret(b,digestSecret(a))).toBe(false);
});
test('pairing revocation invalidates children, not owner or another workspace',()=>{
  const db=new SyncDatabase(':memory:');
  try{
    const a=db.createWorkspace(),b=db.createWorkspace(),grant=db.issuePairing(a.secret);
    const phone=db.pair(grant.token),tablet=db.pair(grant.token);
    expect(db.authenticate(phone.secret)?.workspaceId).toBe(a.workspaceId);
    expect(db.revokePairing(b.secret,grant.id)).toEqual([]);
    expect(db.revokePairing(a.secret,grant.id)).toContain(phone.deviceId);
    expect(db.authenticate(phone.secret)).toBeNull();expect(db.authenticate(tablet.secret)).toBeNull();
    expect(db.authenticate(a.secret)?.owner).toBe(true);
    expect(()=>db.pair(grant.token)).toThrow();
  }finally{db.close();}
});
test('atomic mutation, repeat acknowledgement, and disjoint changes',()=>{
  const db=new SyncDatabase(':memory:');
  try{
    const a=db.createWorkspace(),b=db.pair(db.issuePairing(a.secret).token),n=blankNote();
    const op={operationId:crypto.randomUUID(),noteId:n.id,baseRevision:0,value:n};
    const first=db.apply(a.secret,op);
    expect(first.type).toBe('ack');expect(db.apply(a.secret,op)).toEqual(first);
    expect(db.apply(a.secret,{...op,value:{...n,title:'different'}}).type).toBe('error');
    if(first.type!=='ack')throw Error('missing ack');
    const base=first.note.value!;
    const left=db.apply(a.secret,{...op,operationId:crypto.randomUUID(),baseRevision:first.note.revision,value:{...base,title:'Left'}});
    expect(left.type).toBe('ack');
    const right=db.apply(b.secret,{...op,operationId:crypto.randomUUID(),baseRevision:first.note.revision,value:{...base,body:'Right'}});
    expect(right.type).toBe('ack');
    if(right.type==='ack'){expect(right.note.value?.title).toBe('Left');expect(right.note.value?.body).toBe('Right');}
    const outsider=db.createWorkspace();
    expect(db.apply(outsider.secret,{...op,operationId:crypto.randomUUID(),baseRevision:first.note.revision}).type).toBe('conflict');
  }finally{db.close();}
});
test('permanent deletion cannot be resurrected by stale edits',()=>{
  const db=new SyncDatabase(':memory:');
  try{
    const a=db.createWorkspace(),n=blankNote();
    const op={operationId:crypto.randomUUID(),noteId:n.id,baseRevision:0,value:n};
    const first=db.apply(a.secret,op);if(first.type!=='ack')throw Error('missing ack');
    const del=db.apply(a.secret,{...op,operationId:crypto.randomUUID(),baseRevision:first.note.revision,value:null});
    expect(del.type).toBe('ack');
    const stale=db.apply(a.secret,{...op,operationId:crypto.randomUUID(),baseRevision:first.note.revision,value:{...n,title:'stale edit'}});
    expect(stale.type).toBe('conflict');
  }finally{db.close();}
});
