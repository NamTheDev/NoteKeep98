import {blankNote, COLORS, id, LEGACY_KEY, load, normalizeNote, seed, STORAGE_KEY, type AppData, type Note} from './data';

type View = 'notes' | 'reminders' | 'archive' | 'trash' | `label:${string}`;
type Dialog = 'editor' | 'reminder' | 'labels' | 'settings' | 'about' | 'confirm' | null;
type PopupKind = 'file' | 'edit' | 'view' | 'help' | 'start' | 'color' | 'labels' | 'more' | null;
interface PopupState { kind: PopupKind; target: string | null; anchor: HTMLElement | null; }

const $ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T | null => root.querySelector<T>(selector);
const $$ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T[] => Array.from(root.querySelectorAll<T>(selector));
const html = (v: unknown): string => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c] ?? c));
const glyphs: Record<string,string> = {
  note:'<path d="M6 2h9l5 5v14H6z" fill="#ffe16e" stroke="#464646"/><path d="M15 2v5h5" fill="#fff7c7" stroke="#464646"/><path d="M9 11h8M9 14h8M9 17h6" stroke="#8c7426"/>',
  folder:'<path d="M2 7V4h8l2 3h10v14H2z" fill="#d6ac49" stroke="#604821"/><path d="M2 9h20v12H2z" fill="#ffdd7a" stroke="#71532b"/>',
  pencil:'<path d="M4 18 3 22l5-1L20 9l-4-4z" fill="#f7dc61" stroke="#363636"/><path d="m14 7 4 4M4 18l4 3" stroke="#666"/>',
  check:'<rect x="3" y="3" width="18" height="18" fill="#fff" stroke="#555"/><path d="m6 12 4 4 8-9" stroke="#008080" stroke-width="2.5" fill="none"/>',
  search:'<circle cx="10" cy="10" r="6" fill="white" stroke="#484848" stroke-width="2"/><path d="m15 15 7 7" stroke="#484848" stroke-width="3"/>',
  archive:'<rect x="3" y="7" width="18" height="14" fill="#c7c7c7" stroke="#505050"/><rect x="2" y="4" width="20" height="5" fill="#e7e7e7" stroke="#505050"/><path d="M10 12h4" stroke="#444" stroke-width="2"/>',
  trash:'<path d="M5 7h14l-1 15H6z" fill="#e5e5e5" stroke="#555"/><path d="M3 6h18M9 3h6M10 10v8m4-8v8" stroke="#555" stroke-width="1.8"/>',
  restore:'<path d="M7 4v6h6" fill="none" stroke="#444" stroke-width="2"/><path d="M7 10a8 8 0 1 1-1 8" fill="none" stroke="#008080" stroke-width="2.5"/>',
  pin:'<path d="m8 3 8 0-1 5 3 4v2H6v-2l3-4z" fill="#c4c4c4" stroke="#464646"/><path d="M12 14v8" stroke="#454545" stroke-width="2"/>',
  bell:'<path d="M17 9a5 5 0 0 0-10 0c0 7-3 7-3 9h16c0-2-3-2-3-9Z" fill="#ffdf6a" stroke="#666"/><path d="M10 21h4" stroke="#444" stroke-width="2"/>',
  palette:'<path d="M12 2a10 10 0 1 0 0 20h2c2 0 2-3 0-4-1.5-1-1-3 1-3h4c2 0 3-2 3-4A10 10 0 0 0 12 2Z" fill="#fff4c1" stroke="#444"/><circle cx="7" cy="10" r="2" fill="#f66"/><circle cx="11" cy="6" r="2" fill="#79b2fe"/><circle cx="17" cy="8" r="2" fill="#69bb70"/><circle cx="8" cy="16" r="2" fill="#aa85cf"/>',
  label:'<path d="M3 4h10l9 8-9 8L3 11Z" fill="#d3ebee" stroke="#525252"/><circle cx="8" cy="9" r="2" fill="#555"/>',
  list:'<path d="M4 5h3v3H4zM4 11h3v3H4zM4 17h3v3H4z" fill="#e7e7e7" stroke="#444"/><path d="M10 6h11M10 12h11M10 18h11" stroke="#444" stroke-width="2"/>',
  grid:'<rect x="3" y="3" width="8" height="8" fill="#ddd" stroke="#555"/><rect x="13" y="3" width="8" height="8" fill="#ddd" stroke="#555"/><rect x="3" y="13" width="8" height="8" fill="#ddd" stroke="#555"/><rect x="13" y="13" width="8" height="8" fill="#ddd" stroke="#555"/>',
  more:'<circle cx="5" cy="12" r="2" fill="#444"/><circle cx="12" cy="12" r="2" fill="#444"/><circle cx="19" cy="12" r="2" fill="#444"/>',
  x:'<path d="M5 5 19 19M19 5 5 19" stroke="#111" stroke-width="2.4"/>',
  settings:'<path d="M10 2h4l1 3 3 1 3-1 2 4-3 2v3l3 2-2 4-3-1-3 1-1 3h-4l-1-3-3-1-3 1-2-4 3-2v-3L1 9l2-4 3 1 3-1z" fill="#ddd" stroke="#444"/><circle cx="12" cy="12" r="4" fill="#fff" stroke="#666"/>',
  save:'<path d="M3 2h16l3 3v17H2V2Z" fill="#eee" stroke="#444"/><path d="M6 3h11v7H6z" fill="#15518b"/><path d="M6 15h12v7H6z" fill="white" stroke="#444"/>',
  upload:'<path d="M4 13v8h16v-8M12 17V3m-5 5 5-5 5 5" fill="none" stroke="#444" stroke-width="2"/>',
  download:'<path d="M4 14v7h16v-7M12 3v14m-5-5 5 5 5-5" fill="none" stroke="#444" stroke-width="2"/>',
  copy:'<rect x="7" y="6" width="14" height="16" fill="#fff" stroke="#555"/><path d="M3 18V2h14" fill="none" stroke="#555"/>',
  info:'<circle cx="12" cy="12" r="10" fill="#e9e9e9" stroke="#444"/><path d="M12 10v7m0-11v2" stroke="#000080" stroke-width="3"/>',
  warning:'<path d="m12 2 11 19H1Z" fill="#ffdd55" stroke="#555"/><path d="M12 8v6m0 3v2" stroke="#222" stroke-width="2.5"/>',
  computer:'<rect x="2" y="2" width="20" height="16" fill="#ccc" stroke="#222"/><rect x="5" y="5" width="14" height="10" fill="#008080" stroke="#444"/><path d="M9 19h6v3H9z" fill="#bbb" stroke="#333"/>',
  clock:'<circle cx="12" cy="12" r="10" fill="#fff" stroke="#555"/><path d="M12 5v7l5 4" stroke="#333" stroke-width="2" fill="none"/>',
  star:'<path d="m12 2 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1z" fill="#ffdb59" stroke="#7d6b25"/>',
  menu:'<path d="M3 6h18M3 12h18M3 18h18" stroke="#333" stroke-width="2"/>',
  sparkle:'<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z" fill="#ffe36b" stroke="#5a501f"/>',
  arrow:'<path d="m9 4 8 8-8 8" fill="none" stroke="#444" stroke-width="2"/>'
};
const icon = (name: string): string => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke-linecap="square" stroke-linejoin="miter">${glyphs[name] ?? glyphs.note}</svg>`;
const now = (): string => new Date().toISOString();
const dateLabel = (value: string | null): string => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
};

let data: AppData = load();
let view: View = 'notes';
let search = '';
let dialog: Dialog = null;
let popup: PopupState = {kind:null,target:null,anchor:null};
let draft: Note | null = null;
let editingId: string | null = null;
let reminderTarget: string | null = null;
let reminderReturn: Dialog = null;
let confirmAction: (()=>void) | null = null;
let confirmTitle = '';
let confirmMessage = '';
let minimized = false;
let maximized = false;
let mobileMenu = false;
let undo: Note[] | null = null;
let toastTimer: number | undefined;

const app = $('#app');
if (!app) throw new Error('Missing #app root');
app.innerHTML = `
<div class="desktop" id="desktop">
  <div class="desktop-shortcuts" aria-label="Desktop shortcuts">
    <button class="desktop-shortcut" data-action="reopen" data-view="notes" title="Open My Notes">${icon('computer')}<span>My Notes</span></button>
    <button class="desktop-shortcut" data-action="reopen" data-view="trash" title="Open Recycle Bin">${icon('trash')}<span>Recycle Bin</span></button>
  </div>
  <main class="main-window window" id="mainWindow" aria-label="NoteKeep 98 application window">
    <div class="title-bar"><span class="app-icon">${icon('note')}</span><span class="title-text">NoteKeep 98 — My Notes</span>
      <div class="window-controls"><button class="win-control" data-action="minimize" title="Minimize" aria-label="Minimize">_</button><button class="win-control" data-action="maximize" title="Maximize" aria-label="Maximize">□</button><button class="win-control" data-action="minimize" title="Close window" aria-label="Close window">${icon('x')}</button></div>
    </div>
    <div class="menu-bar" role="menubar"><button class="menu-btn" data-action="menu" data-value="file">File</button><button class="menu-btn" data-action="menu" data-value="edit">Edit</button><button class="menu-btn" data-action="menu" data-value="view">View</button><button class="menu-btn" data-action="menu" data-value="help">Help</button></div>
    <div class="toolbar">
      <button class="tool-btn mobile-nav-toggle" data-action="toggleNav" title="Folders" aria-label="Toggle folders">${icon('menu')}</button>
      <button class="tool-btn" data-action="newNote" title="New note">${icon('note')}<span>New Note</span></button>
      <button class="tool-btn" data-action="newChecklist" title="New checklist">${icon('check')}<span>Checklist</span></button>
      <span class="tool-separator"></span>
      <button class="tool-btn" data-action="manageLabels" title="Manage labels">${icon('label')}<span>Labels</span></button>
      <button class="tool-btn" data-action="export" title="Export JSON backup">${icon('save')}<span>Backup</span></button>
      <span class="tool-separator"></span>
      <button class="tool-btn" data-action="settings" title="Settings">${icon('settings')}<span>Settings</span></button>
      <span class="toolbar-spacer"></span><span class="toolbar-caption">LOCAL MODE &nbsp;•&nbsp; ALL CHANGES SAVED</span>
    </div>
    <div class="address-bar"><span class="address-label">Address</span><div class="address-input">${icon('folder')}<span class="address-path" id="addressPath">My Computer \\ My Notes</span></div><span class="address-badge">NoteKeep 98</span></div>
    <div class="workspace">
      <aside class="sidebar" id="sidebar"><div id="navRoot"></div><div class="sidebar-foot">${icon('info')}<span>Private, local-first notes. No account required, no cloud syncing.</span></div></aside>
      <div class="mobile-scrim" id="mobileScrim" data-action="closeNav"></div>
      <section class="content-pane" aria-label="Notes">
        <div class="content-heading"><div class="heading-copy"><div><div class="page-kicker" id="pageKicker">YOUR DESKTOP NOTES</div><h1 class="page-title" id="pageTitle">All Notes</h1><div class="page-desc" id="pageDescription">A little space for everything on your mind.</div></div></div>
          <div class="content-actions"><label class="search-box">${icon('search')}<input type="search" id="searchInput" aria-label="Search notes" placeholder="Search notes..." autocomplete="off"><button class="search-clear" id="clearSearch" data-action="clearSearch" aria-label="Clear search" hidden>×</button></label><button class="chrome-btn" id="viewToggle" data-action="toggleView" title="Toggle grid or list view" aria-label="Toggle list view">${icon('list')}</button></div>
        </div>
        <div class="quick-bar" id="quickBar"><div class="quick-tile">${icon('pencil')}</div><div class="quick-copy"><strong>Capture a thought...</strong><span>Ideas, lists, reminders — keep them in one place.</span></div><div class="quick-buttons"><button class="chrome-btn primary" data-action="newNote">${icon('note')} New note</button><button class="chrome-btn" data-action="newChecklist">${icon('check')} List</button></div></div>
        <div class="board-scroll" id="boardScroll"><div id="boardRoot"></div></div>
      </section>
    </div>
    <div class="status-bar"><div class="status-cell" id="statusText">Ready</div><div class="status-cell" id="statusCount">0 notes</div><div class="status-cell">LOCAL STORAGE</div></div>
  </main>
  <div id="desktopHint" class="desktop-hint" hidden>NoteKeep is minimized. Open My Notes to continue.</div>
  <div id="popupRoot"></div><div id="dialogRoot"></div><div id="toastRoot" role="status" aria-live="polite"></div>
  <footer class="taskbar"><button class="chrome-btn start-button" id="startButton" data-action="start">${icon('computer')} Start</button><span class="taskbar-divider"></span><button class="chrome-btn task-app is-open" data-action="taskApp">${icon('note')} NoteKeep 98</button><div class="task-clock">${icon('clock')}<span id="taskClock"></span></div></footer>
  <input type="file" id="importInput" accept=".json,application/json" hidden>
</div>`;

function persist(): boolean {
  try {localStorage.setItem(STORAGE_KEY,JSON.stringify(data));return true;}
  catch {return false;}
}
function getNote(noteId: string): Note | undefined {return data.notes.find(n=>n.id===noteId);}
function mutate(fn:()=>void): boolean {
  const previous=structuredClone(data);
  const previousView=view;
  fn();
  if(!persist()){
    data=previous;
    view=previousView;
    render();
    notify('Could not save to browser storage. Your change was not applied. Free up space or export a backup.');
    return false;
  }
  render();
  return true;
}
function notify(message: string, allowUndo = false): void {
  if (toastTimer) window.clearTimeout(toastTimer);
  const root = $('#toastRoot'); if (!root) return;
  root.innerHTML = `<div class="toast"><span>${html(message)}</span>${allowUndo?'<button class="chrome-btn" data-action="undo">Undo</button>':''}<button class="chrome-btn" data-action="dismissToast" aria-label="Dismiss message">${icon('x')}</button></div>`;
  toastTimer = window.setTimeout(()=>{root.innerHTML='';},4500);
}
function mutationWithUndo(message: string, fn:()=>void): void {
  const previous=structuredClone(data.notes);
  if(!mutate(fn))return;
  undo=previous;
  notify(message,true);
}
function counts(): Record<string,number> {
  return {
    notes:data.notes.filter(n=>!n.archived&&!n.trashed).length,
    reminders:data.notes.filter(n=>n.reminder&&!n.archived&&!n.trashed).length,
    archive:data.notes.filter(n=>n.archived&&!n.trashed).length,
    trash:data.notes.filter(n=>n.trashed).length
  };
}
function filterNotes(): Note[] {
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
function setView(next: View): void {
  view=next;mobileMenu=false;closePopup();render();
  $('#boardScroll')?.scrollTo({top:0});
}
const viewMeta = (): {title:string,subtitle:string,kicker:string,path:string} => {
  switch(view) {
    case 'reminders': return {title:'Reminders',subtitle:'The notes you need to remember.',kicker:'YOUR PLANNED NOTES',path:'Reminders'};
    case 'archive': return {title:'Archive',subtitle:'Out of sight, not forgotten.',kicker:'YOUR SAVED NOTES',path:'Archive'};
    case 'trash': return {title:'Recycle Bin',subtitle:'Deleted notes can be restored here.',kicker:'RECENTLY DELETED',path:'Recycle Bin'};
    case 'notes': return {title:'All Notes',subtitle:'A little space for everything on your mind.',kicker:'YOUR DESKTOP NOTES',path:'All Notes'};
    default: {const label = view.slice(6);return {title:label,subtitle:'Notes filed under '+label+'.',kicker:'YOUR CUSTOM FOLDER',path:'Labels \\ '+label};}
  }
};
function navButton(dest:View,name:string,iconName:string,count?:number,sub=false):string {
  return `<button class="nav-btn ${view===dest?'active':''} ${sub?'sub':''}" data-action="view" data-view="${html(dest)}" aria-current="${view===dest?'page':'false'}">${icon(iconName)}<span>${html(name)}</span>${count!==undefined?`<span class="nav-count">${count}</span>`:''}</button>`;
}
function renderNav():void {
  const c=counts();const root=$('#navRoot');if (!root)return;
  root.innerHTML=`<div class="sidebar-heading">Folders</div><div class="sidebar-group">
    ${navButton('notes','All Notes','folder',c.notes)}${navButton('reminders','Reminders','bell',c.reminders)}${navButton('archive','Archive','archive',c.archive)}${navButton('trash','Recycle Bin','trash',c.trash)}
    </div><div class="sidebar-divider"></div><div class="sidebar-heading">My Labels</div><div class="sidebar-group">
    ${data.labels.map(label=>navButton(`label:${label}`,label,'label',data.notes.filter(n=>n.labels.includes(label)&&!n.trashed&&!n.archived).length,true)).join('')}
    <button class="nav-btn sub" data-action="manageLabels">${icon('pencil')}<span>Edit labels...</span></button>
    </div>`;
}
function noteHTML(n:Note):string {
  const isTrash = view==='trash';
  const body = n.checklist ? `<div class="note-checks">${n.items.slice(0,12).map(item=>`<label class="check-item ${item.checked?'done':''}"><input type="checkbox" data-action="checkItem" data-id="${html(n.id)}" data-item="${html(item.id)}" ${item.checked?'checked':''} ${isTrash?'disabled':''}><span>${html(item.text)}</span></label>`).join('')}</div>` : `<p class="note-text">${html(n.body || (n.title ? '' : 'Empty note'))}</p>`;
  const tags = n.labels.length ? `<div class="note-tags">${n.labels.map(l=>`<span class="note-tag">${html(l)}</span>`).join('')}</div>` : '';
  const reminder = n.reminder ? `<div class="note-reminder">${icon('bell')} ${html(dateLabel(n.reminder))}</div>` : '';
  const footer = isTrash ? `<button class="mini-tool" title="Restore" aria-label="Restore" data-action="restore" data-id="${html(n.id)}">${icon('restore')}</button><button class="mini-tool" title="Delete permanently" aria-label="Delete permanently" data-action="deleteForever" data-id="${html(n.id)}">${icon('trash')}</button>` : `
    <button class="mini-tool" title="Edit note" aria-label="Edit note" data-action="editNote" data-id="${html(n.id)}">${icon('pencil')}</button>
    <button class="mini-tool" title="Change color" aria-label="Change color" data-action="popup" data-kind="color" data-id="${html(n.id)}">${icon('palette')}</button>
    <button class="mini-tool" title="Add reminder" aria-label="Add reminder" data-action="reminder" data-id="${html(n.id)}">${icon('bell')}</button>
    <button class="mini-tool" title="Edit labels" aria-label="Edit labels" data-action="popup" data-kind="labels" data-id="${html(n.id)}">${icon('label')}</button>
    <button class="mini-tool" title="${n.archived?'Unarchive':'Archive'}" aria-label="${n.archived?'Unarchive':'Archive'}" data-action="archive" data-id="${html(n.id)}">${icon(n.archived?'restore':'archive')}</button>
    <button class="mini-tool" title="More options" aria-label="More options" data-action="popup" data-kind="more" data-id="${html(n.id)}">${icon('more')}</button>`;
  return `<article class="note-window" data-note="${html(n.id)}" style="--note-color:${html(n.color)}">
    <div class="note-titlebar">${icon(n.checklist?'check':'note')}<span class="note-titlebar-text">NOTE_${html(n.id.slice(0,6).toUpperCase())}.TXT</span><button class="note-top-btn ${n.pinned?'pinned':''}" data-action="pin" data-id="${html(n.id)}" title="${n.pinned?'Unpin':'Pin'}" aria-label="${n.pinned?'Unpin':'Pin'}" ${isTrash?'disabled':''}>${icon('pin')}</button></div>
    <div class="note-paper" data-action="editNote" data-id="${html(n.id)}" role="button" tabindex="0" aria-label="Open ${html(n.title || 'untitled note')}">
      ${n.title?`<h2 class="note-heading">${html(n.title)}</h2>`:''}${body}${tags}${reminder}</div>
    <div class="note-foot">${footer}<span class="date">${html(dateLabel(n.updatedAt))}</span></div>
  </article>`;
}
function noteGroup(notes: Note[],heading:string):string {return `<div class="board-label">${html(heading)}</div><div class="note-grid ${data.list?'is-list':''}">${notes.map(noteHTML).join('')}</div>`;}
function renderBoard():void {
  const root=$('#boardRoot');if (!root)return;
  const notes=filterNotes();
  if (!notes.length) {
    const messages:Record<string,[string,string,string]>={
      notes:['Nothing on your desktop yet','Start a new note and make this space yours.','note'],
      archive:['Your archive is empty','Archived notes will be kept safely here.','archive'],
      trash:['Recycle Bin is empty','Deleted notes will appear here.','trash'],
      reminders:['No reminders yet','Set a reminder on any note to see it here.','bell']
    };
    const [title,description,symbol] = search ? ['No matching notes','Try a different search term.','search'] : messages[view] ?? ['No notes in this folder','Add a label to a note to find it here.','label'];
    root.innerHTML=`<div class="empty-state"><div class="empty-illustration">${icon(symbol)}</div><h2>${html(title)}</h2><p>${html(description)}</p></div>`;return;
  }
  const pinned=notes.filter(n=>n.pinned);
  const other=notes.filter(n=>!n.pinned);
  root.innerHTML=`${view==='trash'?`<div class="empty-trash"><button class="chrome-btn" data-action="emptyTrash">${icon('trash')} Empty Recycle Bin</button></div>`:''}`+
    (view==='notes' && !search.trim() && pinned.length ? noteGroup(pinned,`Pinned notes · ${pinned.length}`) : '')+
    (view==='notes' && !search.trim() && pinned.length ? (other.length?noteGroup(other,`Other notes · ${other.length}`):'') : noteGroup(notes,`${notes.length} ${notes.length===1?'item':'items'}`));
}
function render():void {
  renderNav();renderBoard();
  const meta=viewMeta();
  const setText=(sel:string,text:string)=>{const el=$(sel);if(el)el.textContent=text;};
  setText('#pageTitle',meta.title);setText('#pageDescription',meta.subtitle);setText('#pageKicker',meta.kicker);
  setText('#addressPath',`My Computer \\ NoteKeep 98 \\ ${meta.path}`);
  setText('#statusCount',`${filterNotes().length} ${filterNotes().length===1?'note':'notes'}`);
  setText('#statusText',`${data.notes.filter(n=>!n.trashed).length} saved notes  |  Click a note to edit  |  Ctrl+K to search`);
  setText('.title-text',`NoteKeep 98 — ${meta.title}`);
  const viewBtn=$('#viewToggle'); if (viewBtn) {viewBtn.innerHTML=icon(data.list?'grid':'list');viewBtn.title=data.list?'Grid view':'List view';viewBtn.setAttribute('aria-pressed',String(data.list));}
  const quick=$('#quickBar');if(quick)quick.hidden=view==='trash'||view==='archive';
  const clear=$('#clearSearch');if(clear)clear.hidden=!search;
  $('#mainWindow')?.classList.toggle('is-maximized',maximized);
  $('#mainWindow')?.classList.toggle('is-minimized',minimized);
  const main=$('#mainWindow');if(main)main.hidden=minimized;
  const hint=$('#desktopHint');if(hint)hint.hidden=!minimized;
  $('.task-app')?.classList.toggle('is-open',!minimized);
  $('#sidebar')?.classList.toggle('mobile-open',mobileMenu);
  $('#mobileScrim')?.classList.toggle('show',mobileMenu);
  $('.desktop')?.classList.toggle('night',data.dark);
}

function syncDraft():void {
  if (!draft||dialog!=='editor') return;
  const title=$<HTMLInputElement>('#editTitle');const body=$<HTMLTextAreaElement>('#editBody');
  if(title)draft.title=title.value;
  if(body)draft.body=body.value;
  $$('.editor-check-row').forEach(row=>{
    const item=draft?.items.find(i=>i.id===row.getAttribute('data-item'));
    if (!item)return;
    const input=$<HTMLInputElement>('.item-text',row);
    const checked=$<HTMLInputElement>('.item-check',row);
    if(input)item.text=input.value;
    if(checked)item.checked=checked.checked;
  });
}
function openEditor(note:Note|null,checklist=false):void {
  draft=note?structuredClone(note):blankNote(checklist);
  editingId=note?.id??null;
  dialog='editor';closePopup();renderDialog();
  window.setTimeout(()=>$<HTMLInputElement>('#editTitle')?.focus(),10);
}
function saveEditor():void {
  syncDraft();if(!draft)return;
  const item=draft;
  item.items=item.items.filter(c=>c.text.trim());
  if(!item.title.trim()&&!item.body.trim()&&!item.items.length){dialog=null;draft=null;renderDialog();return;}
  item.updatedAt=now();
  if(!mutate(()=>{
    if(editingId){const index=data.notes.findIndex(n=>n.id===editingId);if(index>=0)data.notes[index]=normalizeNote(item);}
    else data.notes.unshift(normalizeNote(item));
  }))return;
  editingId=null;draft=null;dialog=null;renderDialog();notify('Note saved');
}
function closeEditor():void {draft=null;editingId=null;dialog=null;closePopup();renderDialog();}
function openReminder(target:string):void {
  if(dialog==='editor')syncDraft();
  reminderTarget=target;
  reminderReturn=dialog==='editor'?'editor':null;
  dialog='reminder';closePopup();renderDialog();
}
function dateValue(iso:string|null):{date:string,time:string} {
  const dt=iso?new Date(iso):new Date(Date.now()+60*60*1000);
  const d=Number.isNaN(dt.getTime())?new Date():dt;
  return {date:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,time:`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`};
}
function closeReminder():void {dialog=reminderReturn;renderDialog();}
function windowHeader(title:string,closeAction='closeDialog'):string {return `<div class="title-bar"><span class="app-icon">${icon('note')}</span><span class="title-text">${html(title)}</span><div class="window-controls"><button class="win-control" data-action="${html(closeAction)}" aria-label="Close">${icon('x')}</button></div></div>`;}
function renderDialog():void {
  const root=$('#dialogRoot');if(!root)return;
  if(!dialog){root.innerHTML='';return;}
  if(dialog==='editor'&&draft){
    root.innerHTML=`<div class="dialog-backdrop" data-action="backdrop"><section class="dialog-window window" role="dialog" aria-modal="true" aria-label="${editingId?'Edit note':'New note'}">
      ${windowHeader(editingId?'Edit Note — NoteKeep 98':'New Note — NoteKeep 98','cancelEditor')}
      <div class="dialog-body">
        <div class="dialog-paper" id="editorPaper" style="--note-color:${html(draft.color)}">
          <div class="field"><label class="field-label" for="editTitle">Title</label><input class="win-input" id="editTitle" type="text" maxlength="10000" value="${html(draft.title)}" placeholder="Untitled note"></div>
          <div class="field"><label class="field-label" for="editBody">${draft.checklist?'Checklist':'Your note'}</label>
            ${draft.checklist?`<div class="editor-checks" id="editorChecks">${draft.items.map(i=>`<div class="editor-check-row" data-item="${html(i.id)}"><input class="item-check" type="checkbox" ${i.checked?'checked':''} aria-label="Completed"><input class="win-input item-text" value="${html(i.text)}" placeholder="List item"><button class="mini-tool" data-action="removeItem" data-item="${html(i.id)}" title="Remove item">×</button></div>`).join('')}</div><button class="chrome-btn" data-action="addItem" style="margin-top:10px">+ Add list item</button>`:`<textarea class="win-input" id="editBody" rows="6" placeholder="Take a note...">${html(draft.body)}</textarea>`}
          </div>
        </div>
        <div class="editor-tools"><button class="chrome-btn" data-action="toggleDraftPin" aria-pressed="${draft.pinned}">${icon('pin')} ${draft.pinned?'Unpin':'Pin note'}</button><button class="chrome-btn" data-action="popup" data-kind="color" data-id="draft">${icon('palette')} Color</button><button class="chrome-btn" data-action="popup" data-kind="labels" data-id="draft">${icon('label')} Labels ${draft.labels.length?`(${draft.labels.length})`:''}</button><button class="chrome-btn" data-action="reminder" data-id="draft">${icon('bell')} ${draft.reminder?'Edit reminder':'Reminder'}</button><button class="chrome-btn" data-action="toggleDraftChecklist">${icon('check')} ${draft.checklist?'Text note':'Checklist'}</button></div>
      </div>
      <div class="dialog-footer"><span class="footer-left">${editingId?'Changes saved when you click Save':'A new local note'} &nbsp;·&nbsp; Ctrl+Enter</span><button class="chrome-btn" data-action="cancelEditor">Cancel</button><button class="chrome-btn primary" data-action="saveEditor">${icon('save')} Save note</button></div>
    </section></div>`;return;
  }
  if(dialog==='reminder'){
    const target=reminderTarget==='draft'?draft:getNote(reminderTarget||'');
    const original=dateValue(target?.reminder??null);
    root.innerHTML=`<div class="dialog-backdrop"><section class="dialog-window window medium" role="dialog" aria-modal="true" aria-label="Set reminder">${windowHeader('Set Reminder','closeReminder')}
      <div class="dialog-body"><p class="dialog-note">Choose a date and time for this note. Reminder dates appear in the app; system notifications are not enabled.</p><div class="field"><label class="field-label" for="reminderDate">Date</label><input class="win-input" id="reminderDate" type="date" value="${original.date}"></div><div class="field"><label class="field-label" for="reminderTime">Time</label><input class="win-input" id="reminderTime" type="time" value="${original.time}"></div></div>
      <div class="dialog-footer"><span class="footer-left"></span>${target?.reminder?'<button class="chrome-btn" data-action="removeReminder">Remove</button>':''}<button class="chrome-btn" data-action="closeReminder">Cancel</button><button class="chrome-btn primary" data-action="saveReminder">${icon('save')} Save</button></div>
    </section></div>`;return;
  }
  if(dialog==='labels'){
    root.innerHTML=`<div class="dialog-backdrop"><section class="dialog-window window medium" role="dialog" aria-modal="true" aria-label="Manage labels">${windowHeader('Edit Labels','closeDialog')}
      <div class="dialog-body"><h3>Organize your notes</h3><p class="dialog-note">Create custom labels and use them to filter your notes from the folder pane.</p><label class="field-label" for="newLabelInput">New label</label><div class="input-inline" style="margin-bottom:15px"><input class="win-input" id="newLabelInput" maxlength="120" placeholder="Type a label name"><button class="chrome-btn" data-action="addLabel">+ Add</button></div><div class="label-list">${data.labels.length?data.labels.map(l=>`<div class="label-row"><span>${icon('label')}</span><input class="win-input rename-input" aria-label="Rename ${html(l)}" value="${html(l)}" data-old="${html(l)}"><button class="chrome-btn" title="Save label name" data-action="renameLabel" data-value="${html(l)}">${icon('save')}</button><button class="chrome-btn" title="Delete label" data-action="deleteLabel" data-value="${html(l)}">${icon('trash')}</button></div>`).join(''):'<p style="padding:8px">No labels yet.</p>'}</div></div><div class="dialog-footer"><button class="chrome-btn primary" data-action="closeDialog">Done</button></div>
    </section></div>`;return;
  }
  if(dialog==='settings'){
    root.innerHTML=`<div class="dialog-backdrop"><section class="dialog-window window medium" role="dialog" aria-modal="true" aria-label="Settings">${windowHeader('NoteKeep 98 — Settings','closeDialog')}
      <div class="dialog-body"><h3>Notes and data</h3><p class="dialog-note">Notes are saved in this browser on this device. NoteKeep 98 is not affiliated with Google Keep, and does not offer cloud synchronization.</p>
      <div style="display:flex;flex-direction:column;gap:9px"><button class="chrome-btn" data-action="export" style="justify-content:flex-start">${icon('download')} Export JSON backup</button><button class="chrome-btn" data-action="import" style="justify-content:flex-start">${icon('upload')} Import JSON notes</button><button class="chrome-btn" data-action="reset" style="justify-content:flex-start">${icon('restore')} Restore sample notes</button></div>
      <h3 style="margin-top:24px">Desktop preferences</h3><label class="simple-choice"><input type="checkbox" data-action="toggleNight" ${data.dark?'checked':''}> Midnight desktop background</label><label class="simple-choice"><input type="checkbox" data-action="toggleListFromSettings" ${data.list?'checked':''}> List layout</label>
      <p class="dialog-note" style="margin-top:17px">Data storage key: <code>${STORAGE_KEY}</code><br>Previous notes from <code>${LEGACY_KEY}</code> are imported automatically on first use.</p></div>
      <div class="dialog-footer"><button class="chrome-btn primary" data-action="closeDialog">OK</button></div></section></div>`;return;
  }
  if(dialog==='about'){
    root.innerHTML=`<div class="dialog-backdrop"><section class="dialog-window window medium" role="dialog" aria-modal="true" aria-label="About NoteKeep">${windowHeader('About NoteKeep 98','closeDialog')}
      <div class="dialog-body"><div class="dialog-icon-message">${icon('computer')}<div><h3 style="margin:0 0 5px">NoteKeep 98</h3><p>Version 1.0<br>TypeScript + Bun.js<br>Independent local-first notes application</p></div></div><p class="dialog-note">Windows 95/98-inspired visual language. Notes are stored only in your browser; this is not Google Keep and does not connect to Google.</p></div><div class="dialog-footer"><button class="chrome-btn primary" data-action="closeDialog">OK</button></div></section></div>`;return;
  }
  if(dialog==='confirm'){
    root.innerHTML=`<div class="dialog-backdrop"><section class="dialog-window window medium" role="alertdialog" aria-modal="true" aria-label="${html(confirmTitle)}">${windowHeader(confirmTitle,'closeDialog')}
      <div class="dialog-body"><div class="dialog-icon-message">${icon('warning')}<p>${html(confirmMessage)}</p></div></div><div class="dialog-footer"><button class="chrome-btn" data-action="closeDialog">Cancel</button><button class="chrome-btn primary" data-action="confirm">Continue</button></div></section></div>`;
  }
}
function confirm(title:string,message:string,action:()=>void):void {confirmTitle=title;confirmMessage=message;confirmAction=action;dialog='confirm';closePopup();renderDialog();}
function closePopup():void {popup={kind:null,target:null,anchor:null};const root=$('#popupRoot');if(root)root.innerHTML='';$$('.menu-btn').forEach(btn=>btn.classList.remove('is-active'));}
function popupItem(action:string,name:string,glyph:string,extra=''):string{return `<button class="popup-item" data-action="${action}" ${extra}>${icon(glyph)}<span>${html(name)}</span></button>`;}
function openPopup(kind:PopupKind,target:string|null,anchor:HTMLElement):void {
  if(popup.kind===kind && popup.target===target){closePopup();return;}
  if(dialog==='editor')syncDraft();
  popup={kind,target,anchor};renderPopup();
}
function renderPopup():void {
  const root=$('#popupRoot');if(!root||!popup.kind||!popup.anchor)return;
  const kind=popup.kind;
  const target=popup.target==='draft'?draft:popup.target?getNote(popup.target):null;
  const menu:Record<string,string> = {
    file:`${popupItem('newNote','New note','note')}${popupItem('newChecklist','New checklist','check')}<div class="popup-divider"></div>${popupItem('import','Import notes...','upload')}${popupItem('export','Export backup...','download')}<div class="popup-divider"></div>${popupItem('settings','Settings...','settings')}`,
    edit:`${popupItem('manageLabels','Manage labels...','label')}${popupItem('newNote','Create new note','pencil')}<div class="popup-divider"></div>${popupItem('reset','Reset sample notes...','restore')}`,
    view:`${popupItem('toggleView',data.list?'Switch to grid':'Switch to list',data.list?'grid':'list')}${popupItem('view','All notes','folder','data-view="notes"')}${popupItem('view','Archive','archive','data-view="archive"')}${popupItem('view','Recycle Bin','trash','data-view="trash"')}<div class="popup-divider"></div>${popupItem('toggleNight',data.dark?'Teal desktop':'Midnight desktop','palette')}`,
    help:`${popupItem('about','About NoteKeep 98','info')}${popupItem('settings','Data & privacy','settings')}`,
    start:`${popupItem('reopen','Open My Notes','folder','data-view="notes"')}${popupItem('newNote','New note','note')}${popupItem('newChecklist','New checklist','check')}<div class="popup-divider"></div>${popupItem('settings','Settings','settings')}${popupItem('about','About','info')}`
  };
  let body='';
  if (kind==='color' && target){body=`<div class="popup-title">Background color</div><div class="palette-grid">${COLORS.map(c=>`<button class="swatch ${target.color===c.value?'selected':''}" title="${html(c.name)}" aria-label="${html(c.name)}" style="background:${c.value}" data-action="chooseColor" data-value="${c.value}"></button>`).join('')}</div>`;}
  else if(kind==='labels' && target){body=`<div class="popup-title">Add / remove labels</div>${data.labels.map(l=>`<label class="popup-check-label"><input type="checkbox" data-action="toggleLabel" data-value="${html(l)}" ${target.labels.includes(l)?'checked':''}>${html(l)}</label>`).join('')}${data.labels.length?'':'<p style="padding:5px 9px">No labels yet.</p>'}<div class="popup-label-actions"><button class="chrome-btn" data-action="manageLabels">Edit labels...</button></div>`;}
  else if(kind==='more'&&target){body=`${popupItem('duplicate','Make a copy','copy')}${popupItem('archive',target.archived?'Unarchive':'Archive',target.archived?'restore':'archive',`data-id="${html(target.id)}"`)}<div class="popup-divider"></div>${popupItem('delete','Move to Recycle Bin','trash',`data-id="${html(target.id)}"`)}`;}
  else body=menu[kind]??'';
  root.innerHTML=kind==='start'?`<div class="start-menu"><div class="start-rail"><span>NoteKeep 98</span></div><div class="start-links">${body}</div></div>`:`<div class="popup" role="menu" id="activePopup">${body}</div>`;
  const el=$<HTMLElement>('.popup',root);
  if(el){
    const r=popup.anchor.getBoundingClientRect();
    const b=el.getBoundingClientRect();
    let top=r.bottom+3;
    if(top+b.height>innerHeight-45)top=Math.max(8,r.top-b.height-3);
    el.style.top=`${Math.max(8,top)}px`;
    el.style.left=`${Math.min(Math.max(8,r.left),innerWidth-b.width-8)}px`;
  }
  if (['file','edit','view','help'].includes(kind))$$('.menu-btn').forEach(btn=>btn.classList.toggle('is-active',btn.getAttribute('data-value')===kind));
}
function updateTarget(action:(n:Note)=>void,target:string|null=popup.target):boolean {
  if(target==='draft'&&draft){action(draft);return true;}
  const n=target?getNote(target):undefined;
  return n?mutate(()=>{action(n);n.updatedAt=now();}):false;
}
function setReminder(value:string|null):void {
  const target=reminderTarget;
  if(!updateTarget(n=>{n.reminder=value;},target))return;
  closeReminder();
  if(reminderReturn==='editor') renderDialog();
  notify(value?'Reminder set':'Reminder removed');
}
function exportData():void {
  const payload={version:2,app:'NoteKeep 98',exportedAt:now(),notes:data.notes,labels:data.labels};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const anchor=document.createElement('a');
  anchor.href=url;anchor.download=`notekeep98-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(anchor);anchor.click();anchor.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),2500);notify('JSON backup exported');
}
function renameLabel(oldName:string):void {
  const input=$<HTMLInputElement>(`.rename-input[data-old="${CSS.escape(oldName)}"]`);
  const next=input?.value.trim();if(!next||next===oldName)return;
  if(data.labels.some(l=>l.toLowerCase()===next.toLowerCase())){notify('A label with that name already exists');return;}
  if(!mutate(()=>{data.labels=data.labels.map(l=>l===oldName?next:l);for(const n of data.notes)n.labels=n.labels.map(l=>l===oldName?next:l);if(view===`label:${oldName}`)view=`label:${next}`;}))return;
  renderDialog();notify('Label renamed');
}
function setWindowClock():void {
  const clock=$('#taskClock');if(clock)clock.textContent=new Date().toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});
}

function execute(action:string,button:HTMLElement):void {
  const noteId=button.getAttribute('data-id')??'';
  const value=button.getAttribute('data-value')??'';
  switch(action){
    case 'menu':openPopup(value as PopupKind,null,button);break;
    case 'start':openPopup('start',null,button);break;
    case 'popup':openPopup(button.getAttribute('data-kind') as PopupKind,noteId,button);break;
    case 'view':setView(button.getAttribute('data-view') as View || 'notes');break;
    case 'newNote':openEditor(null,false);break;
    case 'newChecklist':openEditor(null,true);break;
    case 'editNote':{const n=getNote(noteId);if(n&& !n.trashed)openEditor(n);break;}
    case 'saveEditor':saveEditor();break;
    case 'cancelEditor':closeEditor();break;
    case 'closeDialog':dialog=null;closePopup();renderDialog();break;
    case 'manageLabels':dialog='labels';closePopup();renderDialog();break;
    case 'settings':dialog='settings';closePopup();renderDialog();break;
    case 'about':dialog='about';closePopup();renderDialog();break;
    case 'addLabel':{
      const input=$<HTMLInputElement>('#newLabelInput');const name=input?.value.trim();if(!name)return;
      if(data.labels.some(l=>l.toLowerCase()===name.toLowerCase())){notify('That label already exists');return;}
      if(!mutate(()=>data.labels.push(name)))break;
      renderDialog();$<HTMLInputElement>('#newLabelInput')?.focus();notify('Label created');break;
    }
    case 'renameLabel':renameLabel(value);break;
    case 'deleteLabel':confirm('Delete label?',`Remove the “${value}” label from all notes? The notes will remain.`,()=>{if(!mutate(()=>{data.labels=data.labels.filter(l=>l!==value);for(const n of data.notes)n.labels=n.labels.filter(l=>l!==value);if(view===`label:${value}`)view='notes';}))return;
      dialog='labels';renderDialog();notify('Label deleted');});break;
    case 'chooseColor':{
      updateTarget(n=>n.color=value);if(popup.target==='draft'){$<HTMLElement>('#editorPaper')?.style.setProperty('--note-color',value);}
      closePopup();break;
    }
    case 'pin':updateTarget(n=>n.pinned=!n.pinned,noteId);break;
    case 'toggleDraftPin':if(draft){syncDraft();draft.pinned=!draft.pinned;renderDialog();}break;
    case 'toggleDraftChecklist':if(draft){syncDraft();draft.checklist=!draft.checklist;if(draft.checklist&&!draft.items.length)draft.items.push({id:id(),text:'',checked:false});renderDialog();}break;
    case 'addItem':if(draft){syncDraft();draft.items.push({id:id(),text:'',checked:false});renderDialog();$<HTMLInputElement>('.editor-check-row:last-child .item-text')?.focus();}break;
    case 'removeItem':if(draft){syncDraft();draft.items=draft.items.filter(i=>i.id!==button.getAttribute('data-item'));renderDialog();}break;
    case 'reminder':openReminder(noteId);break;
    case 'closeReminder':closeReminder();break;
    case 'saveReminder':{
      const d=$<HTMLInputElement>('#reminderDate')?.value;const t=$<HTMLInputElement>('#reminderTime')?.value;
      if(!d||!t){notify('Choose a date and time');break;}
      const stamp=new Date(`${d}T${t}`);if(Number.isNaN(stamp.getTime())){notify('Invalid reminder date');break;}
      setReminder(stamp.toISOString());break;
    }
    case 'removeReminder':setReminder(null);break;
    case 'archive':mutationWithUndo('Note moved',()=>{const n=getNote(noteId);if(n){n.archived=!n.archived;n.updatedAt=now();}});closePopup();break;
    case 'delete':mutationWithUndo('Moved to Recycle Bin',()=>{const n=getNote(noteId);if(n){n.trashed=true;n.archived=false;n.updatedAt=now();}});closePopup();break;
    case 'restore':mutationWithUndo('Note restored',()=>{const n=getNote(noteId);if(n){n.trashed=false;n.updatedAt=now();}});break;
    case 'deleteForever':confirm('Delete permanently?','This note will be removed permanently. This action cannot be undone.',()=>{if(!mutate(()=>data.notes=data.notes.filter(n=>n.id!==noteId)))return;
      dialog=null;renderDialog();notify('Note deleted permanently');});break;
    case 'emptyTrash':confirm('Empty Recycle Bin?','All notes in the Recycle Bin will be permanently deleted. This cannot be undone.',()=>{if(!mutate(()=>data.notes=data.notes.filter(n=>!n.trashed)))return;
      dialog=null;renderDialog();notify('Recycle Bin emptied');});break;
    case 'duplicate':{
      const n=getNote(popup.target??'');if(n){const copy=structuredClone(n);copy.id=id();copy.title=n.title;copy.createdAt=now();copy.updatedAt=now();copy.pinned=false;copy.items=copy.items.map(i=>({...i,id:id()}));if(mutate(()=>data.notes.unshift(copy)))notify('Note duplicated');}closePopup();break;
    }
    case 'export':closePopup();exportData();break;
    case 'import':closePopup();$<HTMLInputElement>('#importInput')?.click();break;
    case 'reset':confirm('Restore sample notes?','This replaces all your notes and labels with the sample set. Export a JSON backup first if you want to keep your notes.',()=>{if(!mutate(()=>{data=seed();}))return;
      dialog=null;view='notes';search='';const field=$<HTMLInputElement>('#searchInput');if(field)field.value='';renderDialog();render();notify('Sample notes restored');});break;
    case 'confirm':{const fn=confirmAction;confirmAction=null;dialog=null;renderDialog();fn?.();break;}
    case 'toggleView':mutate(()=>{data.list=!data.list;});closePopup();break;
    case 'toggleNight':mutate(()=>{data.dark=!data.dark;});closePopup();if(dialog==='settings')renderDialog();break;
    case 'toggleListFromSettings':mutate(()=>{data.list=!data.list;});renderDialog();break;
    case 'clearSearch':search='';{const field=$<HTMLInputElement>('#searchInput');if(field){field.value='';field.focus();}}render();break;
    case 'dismissToast':{const root=$('#toastRoot');if(root)root.innerHTML='';break;}
    case 'undo':if(undo){const snapshot=structuredClone(undo);if(mutate(()=>{data.notes=snapshot;})){undo=null;notify('Undone');}}break;
    case 'minimize':minimized=true;mobileMenu=false;closePopup();render();break;
    case 'maximize':maximized=!maximized;render();break;
    case 'taskApp':minimized=!minimized;render();break;
    case 'reopen':minimized=false;setView(button.getAttribute('data-view') as View||'notes');render();break;
    case 'toggleNav':mobileMenu=!mobileMenu;render();break;
    case 'closeNav':mobileMenu=false;render();break;
  }
}

app.addEventListener('click',event=>{
  const button=(event.target as Element).closest<HTMLElement>('[data-action]');
  if(button){
    const action=button.getAttribute('data-action')??'';
    if(['toggleLabel','checkItem','toggleNight','toggleListFromSettings'].includes(action) && button.matches('input'))return;
    if(action==='backdrop')return;
    execute(action,button);
  }
  else if(popup.kind && !(event.target as Element).closest('.popup,.start-menu'))closePopup();
});
app.addEventListener('change',event=>{
  const node=event.target as HTMLElement;
  const input=node as HTMLInputElement;
  const action=node.getAttribute('data-action');
  if(action==='checkItem'){
    const noteId=node.getAttribute('data-id')??'';const itemId=node.getAttribute('data-item')??'';
    mutate(()=>{const item=getNote(noteId)?.items.find(i=>i.id===itemId);if(item)item.checked=input.checked;});
  }
  if(action==='toggleLabel'){
    const label=node.getAttribute('data-value')??'';
    updateTarget(n=>{n.labels=input.checked?[...new Set([...n.labels,label])]:n.labels.filter(l=>l!==label);});
    renderPopup();
  }
  if(action==='toggleNight')mutate(()=>{data.dark=input.checked;});
  if(action==='toggleListFromSettings')mutate(()=>{data.list=input.checked;});
});
app.addEventListener('input',event=>{
  const node=event.target as HTMLInputElement;
  if(node.id==='searchInput') {search=node.value;render();}
});
app.addEventListener('keydown',event=>{
  const node=event.target as HTMLElement;
  if(node.matches('[data-action="editNote"]')&&(event.key==='Enter'||event.key===' ')){event.preventDefault();execute('editNote',node);}
  if(node.id==='newLabelInput'&&event.key==='Enter'){event.preventDefault();execute('addLabel',node);}
});
document.addEventListener('click',event=>{
  const target=event.target as Element;
  if(popup.kind&&!target.closest('#popupRoot')&&!target.closest('[data-action="popup"],[data-action="menu"],[data-action="start"]'))closePopup();
});
document.addEventListener('keydown',event=>{
  const focused=event.target as HTMLElement;
  const typing=['INPUT','TEXTAREA'].includes(focused?.tagName) || focused?.isContentEditable;
  if(event.key==='Escape'){
    if(popup.kind){closePopup();return;}
    if(dialog==='reminder'){closeReminder();return;}
    if(dialog==='editor'){closeEditor();return;}
    if(dialog){dialog=null;renderDialog();return;}
    if(mobileMenu){mobileMenu=false;render();return;}
    if(search){search='';const f=$<HTMLInputElement>('#searchInput');if(f)f.value='';render();}
  }
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
    event.preventDefault();$<HTMLInputElement>('#searchInput')?.focus();
  }
  if((event.ctrlKey||event.metaKey)&&event.key==='Enter'&&dialog==='editor'){
    event.preventDefault();saveEditor();
  }
  if(!dialog&&!typing&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&event.key.toLowerCase()==='n'){
    event.preventDefault();openEditor(null);
  }
});
const importInput=$<HTMLInputElement>('#importInput');
if(importInput)importInput.addEventListener('change',async()=>{
  const file=importInput.files?.[0];if(!file)return;
  try{
    const parsed=JSON.parse(await file.text()) as unknown;
    if(!parsed||typeof parsed!=='object'||!('notes' in parsed)||!Array.isArray(parsed.notes)||parsed.notes.length>5000)throw new Error('Invalid file');
    const incoming=parsed.notes.map(normalizeNote);
    const used=new Set(data.notes.map(n=>n.id));
    incoming.forEach(n=>{if(used.has(n.id))n.id=id();used.add(n.id);});
    const labels=('labels' in parsed && Array.isArray(parsed.labels)) ? parsed.labels.filter((x:unknown):x is string=>typeof x==='string').slice(0,200) : [];
    if(mutate(()=>{data.notes.unshift(...incoming);data.labels=Array.from(new Set([...data.labels,...labels,...incoming.flatMap(n=>n.labels)])).slice(0,200);})){
      dialog=null;renderDialog();notify(`${incoming.length} notes imported`);
    }
  }catch{notify('Invalid JSON notes backup');}
  importInput.value='';
});
setWindowClock();window.setInterval(setWindowClock,30000);
render();
