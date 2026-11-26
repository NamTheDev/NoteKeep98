import {now} from '../../utils/format';

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}
export interface Note {
  id: string;
  title: string;
  body: string;
  checklist: boolean;
  items: ChecklistItem[];
  color: string;
  pinned: boolean;
  archived: boolean;
  trashed: boolean;
  labels: string[];
  reminder: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface AppData {
  notes: Note[];
  labels: string[];
  list: boolean;
  collapsed: boolean;
}

// Preserve the original browser storage key so upgrades never discard existing notes.
export const STORAGE_KEY = 'notekeep98-v1';
export const LEGACY_KEY = 'keep-recreation-v1';
export const COLORS: Array<{name: string, value: string}> = [
  {name:'Paper', value:'#ffffff'},
  {name:'Butter', value:'#fff2b3'},
  {name:'Peach', value:'#ffd8c9'},
  {name:'Mint', value:'#d7edcd'},
  {name:'Sky', value:'#d7e8ff'},
  {name:'Lilac', value:'#e6d9ff'},
  {name:'Rose', value:'#f7d7e4'},
  {name:'Aqua', value:'#d3eeed'}
];

export const id = (): string => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
export const blankNote = (checklist = false): Note => ({
  id: id(), title: '', body: '', checklist,
  items: checklist ? [{id:id(),text:'',checked:false}] : [],
  color:'#ffffff',pinned:false,archived:false,trashed:false,labels:[],reminder:null,createdAt:now(),updatedAt:now()
});
const sample = (title: string, body: string, opts: Partial<Note> = {}): Note => ({...blankNote(),title,body,...opts});
export function seed(): AppData {
  const time = Date.now();
  const recent = (days: number): string => new Date(time - days * 86400000).toISOString();
  return {
    notes: [
      sample('Welcome to keep!', 'Your thoughts, saved the old-fashioned way.\n\nClick a note to edit it, or use the toolbar to create something new. Everything is saved in this browser.', {pinned:true,color:'#fff2b3',labels:['Personal'],createdAt:recent(4),updatedAt:recent(0)}),
      sample('Ideas for the week', '✳ Sketch a new concept\n✳ Organize reference images\n✳ Make time to experiment\n\nGood ideas start somewhere.', {pinned:true,color:'#d7e8ff',labels:['Ideas'],createdAt:recent(3),updatedAt:recent(1)}),
      sample('Things to do', '', {checklist:true,items:[{id:id(),text:'Review project notes',checked:true},{id:id(),text:'Finish the moodboard',checked:false},{id:id(),text:'Send the final draft',checked:false},{id:id(),text:'Back up important files',checked:false}],color:'#d7edcd',labels:['Work'],createdAt:recent(2),updatedAt:recent(1)}),
      sample('Small reminder', 'Not everything needs to be urgent. Make room for a little quiet between things.',{color:'#e6d9ff',createdAt:recent(5),updatedAt:recent(2)}),
      sample('Favorite color combinations', 'Teal + navy + warm gray\nDusty lilac + soft cream\nForest green + paper white',{color:'#ffd8c9',labels:['Ideas'],createdAt:recent(7),updatedAt:recent(3)}),
      sample('A note to future me', 'Keep making things. Keep asking questions. Save the interesting bits.',{color:'#ffffff',createdAt:recent(7),updatedAt:recent(4)})
    ],
    labels:['Personal','Work','Ideas'],list:false,collapsed:false
  };
}
function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string,unknown> : {};
}
function text(value: unknown, max = 100000): string {return typeof value === 'string' ? value.slice(0, max) : '';}
export function normalizeNote(value: unknown): Note {
  const n = obj(value);
  const items: ChecklistItem[] = Array.isArray(n.items) ? n.items.slice(0,200).map((v: unknown) => {
    const item = obj(v);
    return {id:text(item.id,100) || id(),text:text(item.text,10000),checked:!!item.checked};
  }) : [];
  return {
    id:text(n.id,100) || id(),title:text(n.title,10000),body:text(n.body),checklist:!!n.checklist,items,
    color: typeof n.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(n.color) ? n.color : '#ffffff',
    pinned:!!n.pinned, archived:!!n.archived,trashed:!!n.trashed,
    labels:Array.isArray(n.labels) ? n.labels.filter((x:unknown)=>typeof x==='string').slice(0,30).map((x:string)=>x.slice(0,120)) : [],
    reminder:typeof n.reminder==='string' && !Number.isNaN(new Date(n.reminder).getTime()) ? n.reminder : null,
    createdAt:text(n.createdAt,40)||now(),updatedAt:text(n.updatedAt,40)||now()
  };
}
export function load(): AppData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!stored) return seed();
    const raw = obj(JSON.parse(stored));
    return {
      notes:Array.isArray(raw.notes) ? raw.notes.slice(0,5000).map(normalizeNote) : [],
      labels:Array.isArray(raw.labels) ? raw.labels.filter((x:unknown)=>typeof x==='string').slice(0,200).map((x:string)=>x.slice(0,120)) : [],
      list: !!(raw.list ?? raw.listView),collapsed:!!raw.collapsed
    };
  } catch {return seed();}
}
