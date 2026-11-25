import {describe,expect,test} from 'bun:test';
import {blankNote} from '../src/features/notes/data';
import {mergeText,mergeLabels,mergeNote} from '../src/features/sync/merge';

describe('conservative three-way merge',()=>{
  test('merges disjoint text edits',()=>expect(mergeText('first\nsecond','FIRST\nsecond','first\nSECOND')).toEqual({ok:true,value:'FIRST\nSECOND'}));
  test('preserves overlapping edits as conflicts',()=>expect(mergeText('Monday','Wednesday','Friday').ok).toBe(false));
  test('identical edits merge',()=>expect(mergeText('a','b','b')).toEqual({ok:true,value:'b'}));
  test('same-position insertion is ambiguous',()=>expect(mergeText('ab','aXb','aYb').ok).toBe(false));
  test('independent labels merge',()=>expect(mergeLabels(['a'],['a','b'],[])).toEqual(['b']));
  test('independent fields merge',()=>{
    const b=blankNote();const result=mergeNote(b,{...b,title:'local'},{...b,body:'remote'});
    expect(result.ok&&result.value?.title).toBe('local');
    expect(result.ok&&result.value?.body).toBe('remote');
  });
  test('delete versus edit is recoverable',()=>{
    const b=blankNote();expect(mergeNote(b,null,{...b,title:'edit'}).ok).toBe(false);
  });
  test('trash versus edit is recoverable',()=>{
    const b=blankNote();expect(mergeNote(b,{...b,trashed:true},{...b,title:'edit'}).ok).toBe(false);
  });
  test('independent checklist item edits merge',()=>{
    const b=blankNote(true);b.items=[{id:'a',text:'a',checked:false},{id:'b',text:'b',checked:false}];
    const l={...b,items:b.items.map(i=>i.id==='a'?{...i,checked:true}:i)};
    const r={...b,items:b.items.map(i=>i.id==='b'?{...i,text:'B'}:i)};
    const m=mergeNote(b,l,r);
    expect(m.ok&&m.value?.items).toEqual([{id:'a',text:'a',checked:true},{id:'b',text:'B',checked:false}]);
  });
});
