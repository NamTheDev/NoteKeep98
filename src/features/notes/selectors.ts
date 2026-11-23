import type {AppData,Note} from './data';
export type View = 'notes' | 'reminders' | 'archive' | 'trash' | `label:${string}`;
export function selectNotes(data:AppData,view:View,search:string): Note[] {
  const found = data.notes.filter(n=>{
    if (view==='trash') return n.trashed;
    if (view==='archive') return n.archived&&!n.trashed;
    if (view==='reminders') return !!n.reminder&&!n.archived&&!n.trashed;
    if (view.startsWith('label:')) return n.labels.includes(view.slice(6))&&!n.archived&&!n.trashed;
    return !n.archived&&!n.trashed;
  });
  const q = search.trim().toLocaleLowerCase();
  return found.filter(n=>!q || [n.title,n.body,...n.items.map(i=>i.text),...n.labels].join(' ').toLocaleLowerCase().includes(q))
    .sort((a,b)=>Number(b.pinned)-Number(a.pinned)||new Date(b.updatedAt).getTime()-new Date(a.updatedAt).getTime());
}
