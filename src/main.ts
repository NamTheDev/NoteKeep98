import {blankNote, COLORS, id, LEGACY_KEY, load, normalizeNote, seed, STORAGE_KEY, type AppData, type Note} from './data';

type View = 'notes' | 'reminders' | 'archive' | 'trash' | `label:${string}`;
type Dialog = 'editor' | 'reminder' | 'labels' | 'settings' | 'about' | 'confirm' | null;
type PopupKind = 'file' | 'edit' | 'view' | 'help' | 'start' | 'color' | 'labels' | 'more' | null;
interface PopupState { kind: PopupKind; target: string | null; anchor: HTMLElement | null; }

const $ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T | null => root.querySelector<T>(selector);
const $$ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T[] => Array.from(root.querySelectorAll<T>(selector));
const html = (v: unknown): string => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c] ?? c));
const iconNames: Record<string,string> = {
  "note": "file-text",
  "folder": "folder",
  "pencil": "pencil",
  "check": "square-check",
  "search": "search",
  "archive": "archive",
  "trash": "trash-2",
  "restore": "rotate-ccw",
  "pin": "pin",
  "bell": "bell",
  "palette": "palette",
  "label": "tag",
  "list": "list",
  "grid": "layout-grid",
  "more": "ellipsis",
  "x": "x",
  "settings": "settings",
  "save": "save",
  "upload": "upload",
  "download": "download",
  "copy": "copy",
  "info": "info",
  "warning": "triangle-alert",
  "computer": "notebook-pen",
  "clock": "clock",
  "star": "star",
  "menu": "menu",
  "sparkle": "sparkles",
  "arrow": "chevron-right"
};
const icon = (name: string): string => `<img class="ui-icon" src="./icons/${iconNames[name] ?? 'file-text'}.svg" alt="" aria-hidden="true">`;
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
let mobileMenu = false;
let undo: Note[] | null = null;
let toastTimer: number | undefined;

// Normalize inbound ChatGPT/referral tracking without disrupting local notes.
const canonicalUrl = new URL(window.location.href);
let hadTracking = false;
for (const key of [...canonicalUrl.searchParams.keys()]) {
  if (/^utm_/i.test(key)) { canonicalUrl.searchParams.delete(key); hadTracking = true; }
}
if (hadTracking) window.history.replaceState(null, '', canonicalUrl);

const app = $('#app');
if (!app) throw new Error('Missing #app root');
app.innerHTML = `
<div class="desktop" id="desktop">

  <main class="main-window window" id="mainWindow" aria-label="keep application window">
    <header class="title-bar app-header"><span class="app-icon">${icon('note')}</span><span class="title-text">keep — My Notes</span></header>
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
    <div class="address-bar"><span class="address-label">Address</span><div class="address-input">${icon('folder')}<span class="address-path" id="addressPath">My Computer \\ My Notes</span></div><span class="address-badge">keep</span></div>
    <div class="workspace">
      <aside class="sidebar" id="sidebar"><div id="navRoot"></div><div class="sidebar-foot">${icon('info')}<span>Private, local-first notes. No account required, no cloud syncing.</span></div></aside>
      <div class="mobile-scrim" id="mobileScrim" data-action="closeNav"></div>
      <section class="content-pane" aria-label="Notes">
        <div class="content-heading"><div class="heading-copy"><div><div class="page-kicker" id="pageKicker">YOUR DESKTOP NOTES</div><h1 class="page-title" id="pageTitle">All Notes</h1><div class="page-desc" id="pageDescription">A little space for everything on your mind.</div></div></div>
          <div class="content-actions"><label class="search-box">${icon('search')}<input type="search" id="searchInput" aria-label="Search notes" placeholder="Search notes..." autocomplete="off"><button class="search-clear" id="clearSearch" data-action="clearSearch" aria-label="Clear search" hidden>×</button></label><button class="chrome-btn" id="viewToggle" data-action="toggleView" title="Toggle grid or list view" aria-label="Toggle list view">${icon('list')}</button></div>
        </div>
        <div class="quick-bar" id="quickBar" role="group" aria-label="Quick note">
          <div class="quick-composer" id="quickComposer">
            <input class="quick-title" id="quickNoteTitle" type="text" maxlength="10000" placeholder="Title (optional)" aria-label="Quick note title" hidden>
            <textarea class="quick-text" id="quickNoteText" rows="1" maxlength="100000" placeholder="Take a note..." aria-label="Quick note text"></textarea>
            <div class="quick-actions" id="quickActions" hidden>
              <span class="quick-hint">Ctrl+Enter to save</span>
              <button class="chrome-btn" data-action="cancelQuickNote">Cancel</button>
              <button class="chrome-btn primary" data-action="saveQuickNote">${icon('save')} Save note</button>
            </div>
          </div>
          <div class="quick-buttons"><button class="chrome-btn primary" data-action="newNote">${icon('note')} New note</button><button class="chrome-btn" data-action="newChecklist">${icon('check')} List</button></div>
        </div>
        <div class="board-scroll" id="boardScroll"><div id="boardRoot"></div></div>
      </section>
    </div>
    <div class="status-bar"><div class="status-cell" id="statusText">Ready</div><div class="status-cell" id="statusCount">0 notes</div><div class="status-cell">LOCAL STORAGE</div></div>
  </main>
  <div id="popupRoot"></div><div id="dialogRoot"></div><div id="toastRoot" role="status" aria-live="polite"></div>
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
  setText('#addressPath',`My Computer \\ keep \\ ${meta.path}`);
  setText('#statusCount',`${filterNotes().length} ${filterNotes().length===1?'note':'notes'}`);
  setText('#statusText',`${data.notes.filter(n=>!n.trashed).length} saved notes  |  Click a note to edit  |  Ctrl+K to search`);
  setText('.title-text',`keep — ${meta.title}`);
  const viewBtn=$('#viewToggle'); if (viewBtn) {viewBtn.innerHTML=icon(data.list?'grid':'list');viewBtn.title=data.list?'Grid view':'List view';viewBtn.setAttribute('aria-pressed',String(data.list));}
  const quick=$('#quickBar');if(quick)quick.hidden=view==='trash'||view==='archive';
  const clear=$('#clearSearch');if(clear)clear.hidden=!search;
  $('#sidebar')?.classList.toggle('mobile-open',mobileMenu);
  $('#mobileScrim')?.classList.toggle('show',mobileMenu);
  $('.desktop')?.classList.toggle('dark-mode',data.dark);
}

function expandQuickComposer():void {
  const bar=$('#quickBar');
  if (!bar || bar.classList.contains('is-editing'))return;
  bar.classList.add('is-editing');
  const title=$<HTMLInputElement>('#quickNoteTitle');
  const actions=$('#quickActions');
  if (title)title.hidden=false;
  if (actions)actions.hidden=false;
}
function resetQuickComposer():void {
  const text=$<HTMLTextAreaElement>('#quickNoteText');
  const title=$<HTMLInputElement>('#quickNoteTitle');
  const actions=$('#quickActions');
  if(text){text.value='';text.style.height='';}
  if(title){title.value='';title.hidden=true;}
  if(actions)actions.hidden=true;
  $('#quickBar')?.classList.remove('is-editing');
}
function saveQuickNote():void {
  const input=$<HTMLTextAreaElement>('#quickNoteText');
  const title=$<HTMLInputElement>('#quickNoteTitle');
  if (!input)return;
  const body=input.value;
  const heading=title?.value??'';
  if(!body.trim()&&!heading.trim()){
    resetQuickComposer();
    return;
  }
  const note=blankNote();
  note.body=body;
  note.title=heading;
  if(!mutate(()=>{data.notes.unshift(note);}))return;
  resetQuickComposer();
  notify('Note saved');
}
function resizeQuickText(text:HTMLTextAreaElement):void {
  text.style.height='auto';
  text.style.height=Math.min(text.scrollHeight,Math.max(160,window.innerHeight*0.3))+'px';
}
function syncDraft():void {
  if (!draft||dialog!=='editor') return;
  const title=$<HTMLInputElement>('#editTitle');const body=$<HTMLTextAreaElement>('#editBody');
  if(title)draft.title=title.value;
  if(body)draft.body=body.value;
  document.querySelectorAll<HTMLElement>('.editor-check-row').forEach((row,index)=>{
    const item=draft?.items.find(i=>i.id===row.getAttribute('data-item')) ?? draft?.items[index];
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
function windowHeader(title:string,_closeAction='closeDialog'):string {return `<div class="title-bar dialog-heading"><span class="app-icon">${icon('note')}</span><span class="title-text">${html(title)}</span></div>`;}
function renderDialog():void {
  const root=$('#dialogRoot');if(!root)return;
  if(!dialog){root.innerHTML='';return;}
  if(dialog==='editor'&&draft){
    root.innerHTML=`<div class="dialog-backdrop" data-action="backdrop"><section class="dialog-window window" role="dialog" aria-modal="true" aria-label="${editingId?'Edit note':'New note'}">
      ${windowHeader(editingId?'Edit Note — keep':'New Note — keep','cancelEditor')}
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
    root.innerHTML=`<div class="dialog-backdrop"><section class="dialog-window window medium" role="dialog" aria-modal="true" aria-label="Settings">${windowHeader('keep — Settings','closeDialog')}
      <div class="dialog-body"><h3>Notes and data</h3><p class="dialog-note">Notes are saved in this browser on this device. keep is not affiliated with Google Keep, and does not offer cloud synchronization.</p>
      <div style="display:flex;flex-direction:column;gap:9px"><button class="chrome-btn" data-action="export" style="justify-content:flex-start">${icon('download')} Export JSON backup</button><button class="chrome-btn" data-action="import" style="justify-content:flex-start">${icon('upload')} Import JSON notes</button><button class="chrome-btn" data-action="reset" style="justify-content:flex-start">${icon('restore')} Restore sample notes</button></div>
      <fieldset class="settings-group"><legend>Appearance</legend><label class="simple-choice"><input type="checkbox" data-action="toggleDarkMode" ${data.dark?'checked':''}> Dark mode</label></fieldset><fieldset class="settings-group"><legend>Notes layout</legend><label class="simple-choice"><input type="checkbox" data-action="toggleListFromSettings" ${data.list?'checked':''}> List layout</label></fieldset>
      <p class="dialog-note" style="margin-top:17px">Settings and notes remain in this browser. Existing notes from earlier app versions are preserved automatically.</p></div>
      <div class="dialog-footer"><button class="chrome-btn primary" data-action="closeDialog">OK</button></div></section></div>`;return;
  }
  if(dialog==='about'){
    root.innerHTML=`<div class="dialog-backdrop"><section class="dialog-window window medium" role="dialog" aria-modal="true" aria-label="About keep">${windowHeader('About keep','closeDialog')}
      <div class="dialog-body"><div class="dialog-icon-message">${icon('computer')}<div><h3 style="margin:0 0 5px">keep</h3><p>Version 1.0<br>TypeScript + Bun.js<br>Independent local-first notes application</p></div></div><p class="dialog-note">Windows 95/98-inspired visual language. Notes are stored only in your browser; this is not Google Keep and does not connect to Google.</p></div><div class="dialog-footer"><button class="chrome-btn primary" data-action="closeDialog">OK</button></div></section></div>`;return;
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
    view:`${popupItem('toggleView',data.list?'Switch to grid':'Switch to list',data.list?'grid':'list')}${popupItem('view','All notes','folder','data-view="notes"')}${popupItem('view','Archive','archive','data-view="archive"')}${popupItem('view','Recycle Bin','trash','data-view="trash"')}<div class="popup-divider"></div>${popupItem('toggleDarkMode',data.dark?'Switch to light mode':'Switch to dark mode','palette')}`,
    help:`${popupItem('about','About keep','info')}${popupItem('settings','Data & privacy','settings')}`,
    start:`${popupItem('reopen','Open My Notes','folder','data-view="notes"')}${popupItem('newNote','New note','note')}${popupItem('newChecklist','New checklist','check')}<div class="popup-divider"></div>${popupItem('settings','Settings','settings')}${popupItem('about','About','info')}`
  };
  let body='';
  if (kind==='color' && target){body=`<div class="popup-title">Background color</div><div class="palette-grid">${COLORS.map(c=>`<button class="swatch ${target.color===c.value?'selected':''}" title="${html(c.name)}" aria-label="${html(c.name)}" style="background:${c.value}" data-action="chooseColor" data-value="${c.value}"></button>`).join('')}</div>`;}
  else if(kind==='labels' && target){body=`<div class="popup-title">Add / remove labels</div>${data.labels.map(l=>`<label class="popup-check-label"><input type="checkbox" data-action="toggleLabel" data-value="${html(l)}" ${target.labels.includes(l)?'checked':''}>${html(l)}</label>`).join('')}${data.labels.length?'':'<p style="padding:5px 9px">No labels yet.</p>'}<div class="popup-label-actions"><button class="chrome-btn" data-action="manageLabels">Edit labels...</button></div>`;}
  else if(kind==='more'&&target){body=`${popupItem('duplicate','Make a copy','copy')}${popupItem('archive',target.archived?'Unarchive':'Archive',target.archived?'restore':'archive',`data-id="${html(target.id)}"`)}<div class="popup-divider"></div>${popupItem('delete','Move to Recycle Bin','trash',`data-id="${html(target.id)}"`)}`;}
  else body=menu[kind]??'';
  root.innerHTML=kind==='start'?`<div class="start-menu"><div class="start-rail"><span>keep</span></div><div class="start-links">${body}</div></div>`:`<div class="popup" role="menu" id="activePopup">${body}</div>`;
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
  const payload={version:2,app:'keep',exportedAt:now(),notes:data.notes,labels:data.labels};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const anchor=document.createElement('a');
  anchor.href=url;anchor.download=`keep-${new Date().toISOString().slice(0,10)}.json`;
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
    case 'saveQuickNote':saveQuickNote();break;
    case 'cancelQuickNote':resetQuickComposer();break;
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
    case 'toggleDarkMode':mutate(()=>{data.dark=!data.dark;});closePopup();if(dialog==='settings')renderDialog();break;
    case 'toggleListFromSettings':mutate(()=>{data.list=!data.list;});renderDialog();break;
    case 'clearSearch':search='';{const field=$<HTMLInputElement>('#searchInput');if(field){field.value='';field.focus();}}render();break;
    case 'dismissToast':{const root=$('#toastRoot');if(root)root.innerHTML='';break;}
    case 'undo':if(undo){const snapshot=structuredClone(undo);if(mutate(()=>{data.notes=snapshot;})){undo=null;notify('Undone');}}break;
    case 'toggleNav':mobileMenu=!mobileMenu;render();break;
    case 'closeNav':mobileMenu=false;render();break;
  }
}

app.addEventListener('click',event=>{
  const button=(event.target as Element).closest<HTMLElement>('[data-action]');
  if(button){
    const action=button.getAttribute('data-action')??'';
    if(['toggleLabel','checkItem','toggleDarkMode','toggleListFromSettings'].includes(action) && button.matches('input'))return;
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
  if(dialog==='editor' && draft && input.matches('.editor-check-row .item-check')){
    const row=input.closest<HTMLElement>('.editor-check-row');
    const item=draft.items.find(i=>i.id===row?.getAttribute('data-item'));
    if(item)item.checked=input.checked;
  }
  if(action==='toggleDarkMode')mutate(()=>{data.dark=input.checked;});
  if(action==='toggleListFromSettings')mutate(()=>{data.list=input.checked;});
});
app.addEventListener('focusin',event=>{
  const element=event.target as HTMLElement;
  if(element.id==='quickNoteText'||element.id==='quickNoteTitle')expandQuickComposer();
});
app.addEventListener('input',event=>{
  const node=event.target as HTMLInputElement | HTMLTextAreaElement;
  if(node instanceof HTMLTextAreaElement && node.id==='quickNoteText'){
    expandQuickComposer();
    resizeQuickText(node);
  }
  if(dialog==='editor' && draft && node.matches('.editor-check-row .item-text')){
    const row=node.closest<HTMLElement>('.editor-check-row');
    const item=draft.items.find(i=>i.id===row?.getAttribute('data-item'));
    if(item)item.text=node.value;
  }
  if(node.id==='searchInput') {search=node.value;render();}
});
app.addEventListener('keydown',event=>{
  const node=event.target as HTMLElement;
  if(node.id==='quickNoteText'||node.id==='quickNoteTitle'){
    if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){
      event.preventDefault();event.stopPropagation();saveQuickNote();return;
    }
    if(event.key==='Escape'){
      event.preventDefault();event.stopPropagation();resetQuickComposer();node.blur();return;
    }
  }
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
render();
