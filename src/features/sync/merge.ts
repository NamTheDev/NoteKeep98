import type { Note, ChecklistItem } from '../notes/data';

export type MergeResult<T> = { ok: true; value: T } | { ok: false; fields: string[] };
const equal = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const fail = (field: string): MergeResult<never> => ({ok:false, fields:[field]});
const scalar = <T>(base:T, local:T, remote:T, field:string): MergeResult<T> =>
  equal(local, remote) || equal(remote, base) ? {ok:true,value:local} :
  equal(local, base) ? {ok:true,value:remote} : fail(field);

interface Edit { start:number; end:number; replacement:string }
function edit(base:string, next:string):Edit {
  let start=0, end=base.length, nextEnd=next.length;
  while(start<end && start<nextEnd && base[start]===next[start]) start++;
  while(end>start && nextEnd>start && base[end-1]===next[nextEnd-1]) {end--;nextEnd--;}
  return {start,end,replacement:next.slice(start,nextEnd)};
}

/** Conservative three-way text merge: disjoint contiguous changes merge;
 * ambiguous or overlapping ranges remain conflicts rather than losing text. */
export function mergeText(base:string,local:string,remote:string):MergeResult<string> {
  const simple=scalar(base,local,remote,'text');
  if(simple.ok) return simple;
  const a=edit(base,local), b=edit(base,remote);
  if(a.start===b.start || !(a.end<=b.start || b.end<=a.start)) return fail('text');
  const [first,second]=a.start<b.start?[a,b]:[b,a];
  return {ok:true,value:base.slice(0,first.start)+first.replacement+
    base.slice(first.end,second.start)+second.replacement+base.slice(second.end)};
}
export function mergeLabels(base:string[],local:string[],remote:string[]):string[] {
  return [...new Set([...base,...local,...remote])].filter(label=>{
    const b=base.includes(label),l=local.includes(label),r=remote.includes(label);
    return l===b?r:l;
  });
}
function mergeItems(base:ChecklistItem[],local:ChecklistItem[],remote:ChecklistItem[]):MergeResult<ChecklistItem[]> {
  const maps=[base,local,remote].map(items=>new Map(items.map(item=>[item.id,item])));
  const result:ChecklistItem[]=[];const conflicts:string[]=[];
  for(const id of new Set([...base,...local,...remote].map(item=>item.id))) {
    const b=maps[0]!.get(id),l=maps[1]!.get(id),r=maps[2]!.get(id);
    const simple=scalar(b,l,r,'items.'+id);
    if(simple.ok){if(simple.value)result.push(simple.value);continue;}
    if(!b||!l||!r){conflicts.push('items.'+id);continue;}
    const text=mergeText(b.text,l.text,r.text);
    const checked=scalar(b.checked,l.checked,r.checked,'items.'+id+'.checked');
    if(text.ok&&checked.ok)result.push({id,text:text.value,checked:checked.value});
    else conflicts.push('items.'+id);
  }
  return conflicts.length?{ok:false,fields:conflicts}:{ok:true,value:result};
}

/** null means a permanent deletion, not a move to the recycle bin. */
export function mergeNote(base:Note|null,local:Note|null,remote:Note|null):MergeResult<Note|null> {
  const simple=scalar(base,local,remote,'note');
  if(simple.ok)return simple;
  if(!base||!local||!remote)return fail('note');
  if(base.id!==local.id||base.id!==remote.id)return fail('id');
  // Trash versus an independent edit is deliberately recoverable rather than silently hidden.
  const content=(n:Note)=>({...n,updatedAt:''});
  if((local.trashed!==base.trashed && !equal(content(remote),content(base)) && remote.trashed!==local.trashed) ||
     (remote.trashed!==base.trashed && !equal(content(local),content(base)) && local.trashed!==remote.trashed))return fail('trashed');
  const value:Note={...remote}; const fields:string[]=[];
  for(const field of ['title','body'] as const){
    const merged=mergeText(base[field],local[field],remote[field]);
    if(merged.ok)value[field]=merged.value;else fields.push(field);
  }
  for(const field of ['checklist','color','pinned','archived','trashed','reminder','createdAt'] as const){
    const merged=scalar(base[field],local[field],remote[field],field);
    if(merged.ok)Object.assign(value,{[field]:merged.value});else fields.push(field);
  }
  const items=mergeItems(base.items,local.items,remote.items);
  if(items.ok)value.items=items.value;else fields.push(...items.fields);
  value.labels=mergeLabels(base.labels,local.labels,remote.labels);
  // A type conversion concurrent with content editing must be reviewed.
  if((local.checklist!==base.checklist && (!equal(remote.items,base.items)||remote.body!==base.body)) ||
     (remote.checklist!==base.checklist && (!equal(local.items,base.items)||local.body!==base.body)))fields.push('checklist');
  return fields.length?{ok:false,fields:[...new Set(fields)]}:{ok:true,value};
}
