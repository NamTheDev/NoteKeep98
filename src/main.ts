import {blankNote, COLORS, id, load, normalizeNote, seed, STORAGE_KEY, type AppData, type Note} from './features/notes/data';
import {selectNotes, type View} from './features/notes/selectors';
import {noteHTML as renderNoteCard} from './features/notes/note-card';
import {html,now} from './utils/format';
import {icon} from './ui/icons';
import {renderShell} from './ui/shell';
import {expandQuickComposer,resetQuickComposer,resizeQuickText} from './ui/quick-composer';
import {downloadBackup} from './features/notes/backup';
import {CloudSync} from './features/sync/client';
import {mergeNote} from './features/sync/merge';

type Dialog = 'editor' | 'reminder' | 'labels' | 'settings' | 'about' | 'confirm' | null;
type PopupKind = 'color' | 'labels' | 'more' | null;
interface PopupState { kind: PopupKind; target: string | null; anchor: HTMLElement | null; }

const $ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T | null => root.querySelector<T>(selector);
const cloud:CloudSync|null=document.querySelector('meta[name="keep-cloud"]')?new CloudSync(()=>{data=cloud?.project(load())??load();render();},message=>notify(message)):null;
let data: AppData = cloud?.project(load())??load();
let view: View = 'notes';
let search = '';
let dialog: Dialog = null;
let popup: PopupState = {kind:null,target:null,anchor:null};
let draft: Note | null = null;
let editorBase: Note | null = null;
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
app.innerHTML = renderShell(icon);

function persist(): boolean {
  try {localStorage.setItem(STORAGE_KEY,JSON.stringify(data));return true;}
  catch {return false;}
}
function getNote(noteId: string): Note | undefined {return data.notes.find(n=>n.id===noteId);}
function mutate(fn:()=>void): boolean {
  const previous=structuredClone(data);
  const previousView=view;
  fn();
  if(!(cloud?.active?cloud.capture(previous,data):persist())){
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
  root.innerHTML = `<div class="toast show d-flex align-items-center gap-3 p-3"><span>${html(message)}</span>${allowUndo?'<button class="chrome-btn btn-outline theme-secondary btn rounded-5" data-action="undo">Undo</button>':''}<button class="chrome-btn btn-outline theme-secondary btn rounded-5" data-action="dismissToast" aria-label="Dismiss message">${icon('x')}</button></div>`;
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
function filterNotes(): Note[] { return selectNotes(data,view,search); }
function setView(next: View): void {
  view=next;mobileMenu=false;closePopup();render();
  $('#boardScroll')?.scrollTo({top:0});
}
function viewTitle():string {
  if(view==='notes')return 'All Notes';
  if(view==='reminders')return 'Reminders';
  if(view==='archive')return 'Archive';
  if(view==='trash')return 'Recycle Bin';
  return view.startsWith('label:')?view.slice(6):'All Notes';
}
function navButton(dest:View,name:string,iconName:string,count?:number,sub=false):string {
  return `<button class="nav-btn ${view===dest?'active':''} ${sub?'sub':''} nav-link w-100 rounded-5 justify-content-start text-start" data-action="view" data-view="${html(dest)}" aria-current="${view===dest?'page':'false'}">${icon(iconName)}<span>${html(name)}</span>${count!==undefined?`<span class="nav-count ms-auto fg-2">${count}</span>`:''}</button>`;
}
function renderNav():void {
  const c=counts();const root=$('#navRoot');if(!root)return;
  root.innerHTML=`
  <div class="sidebar-heading fg-2 fw-medium fs-xs">Navigation</div>
  <nav class="sidebar-group nav flex-column" aria-label="Notes navigation">
    ${navButton('notes','All Notes','folder',c.notes)}
    ${navButton('reminders','Reminders','bell',c.reminders)}
    ${navButton('archive','Archive','archive',c.archive)}
    ${navButton('trash','Recycle Bin','trash',c.trash)}
  </nav>
  <div class="sidebar-divider border-top mx-4 my-3 opacity-50"></div>
  <div class="sidebar-heading fg-2 fw-medium fs-xs">Labels</div>
  <nav class="sidebar-group nav flex-column" aria-label="Note labels">
    ${data.labels.map(label=>navButton(`label:${label}`,label,'label',data.notes.filter(n=>n.labels.includes(label)&&!n.trashed&&!n.archived).length,true)).join('')}
    <button class="nav-btn nav-link w-100 rounded-5 justify-content-start text-start" data-action="manageLabels">${icon('pencil')}<span>Manage labels</span></button>
  </nav>
  <div class="sidebar-divider border-top mx-4 my-3 opacity-50"></div>
  <div class="sidebar-heading fg-2 fw-medium fs-xs">Actions</div>
  <nav class="sidebar-group nav flex-column" aria-label="Note actions">
    <button class="nav-btn nav-link w-100 rounded-5 justify-content-start text-start" data-action="newNote">${icon('note')}<span>New note</span></button>
    <button class="nav-btn nav-link w-100 rounded-5 justify-content-start text-start" data-action="newChecklist">${icon('check')}<span>New checklist</span></button>
    <button class="nav-btn nav-link w-100 rounded-5 justify-content-start text-start" id="viewToggle" data-action="toggleView" aria-pressed="${data.list}" aria-label="${data.list?'Switch to grid':'Switch to list'}">${icon(data.list?'grid':'list')}<span>${data.list?'Grid view':'List view'}</span></button>
  </nav>
  <div class="sidebar-divider border-top mx-4 my-3 opacity-50"></div>
  <div class="sidebar-heading fg-2 fw-medium fs-xs">Preferences</div>
  <nav class="sidebar-group nav flex-column" aria-label="Settings and data">
    <button class="nav-btn nav-link w-100 rounded-5 justify-content-start text-start" data-action="settings">${icon('settings')}<span>Settings</span></button>
    <button class="nav-btn nav-link w-100 rounded-5 justify-content-start text-start" data-action="import">${icon('upload')}<span>Import notes</span></button>
    <button class="nav-btn nav-link w-100 rounded-5 justify-content-start text-start" data-action="export">${icon('download')}<span>Export backup</span></button>
    <button class="nav-btn nav-link w-100 rounded-5 justify-content-start text-start" data-action="reset">${icon('restore')}<span>Restore samples</span></button>
    <button class="nav-btn nav-link w-100 rounded-5 justify-content-start text-start" data-action="about">${icon('info')}<span>About</span></button>
  </nav>`;
}
function noteGroup(notes: Note[],heading:string):string {return `<div class="board-label fg-2 text-uppercase fw-medium">${html(heading)}</div><div class="note-grid ${data.list?'is-list':''} d-grid">${notes.map(note=>renderNoteCard(note,view)).join('')}</div>`;}
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
    root.innerHTML=`<div class="empty-state text-center fg-2 p-7"><div class="empty-illustration">${icon(symbol)}</div><h2>${html(title)}</h2><p>${html(description)}</p></div>`;return;
  }
  const pinned=notes.filter(n=>n.pinned);
  const other=notes.filter(n=>!n.pinned);
  root.innerHTML=`${view==='trash'?`<div class="empty-trash mb-3"><button class="chrome-btn btn-outline theme-secondary btn rounded-5" data-action="emptyTrash">${icon('trash')} Empty Recycle Bin</button></div>`:''}`+
    (view==='notes' && !search.trim() && pinned.length ? noteGroup(pinned,`Pinned notes · ${pinned.length}`) : '')+
    (view==='notes' && !search.trim() && pinned.length ? (other.length?noteGroup(other,`Other notes · ${other.length}`):'') : noteGroup(notes,`${notes.length} ${notes.length===1?'item':'items'}`));
}
function render():void {
  renderNav();renderBoard();
  const setText=(sel:string,text:string)=>{const el=$(sel);if(el)el.textContent=text;};
  setText('#pageTitle',viewTitle());
  if(cloud){setText('#statusText',cloud.statusText);setText('#storageNotice',cloud.active?'Cloud workspace · saved edits sync automatically.':'Notes stay on this device.');}
  setText('#statusCount',`${filterNotes().length} ${filterNotes().length===1?'note':'notes'}`);
  const quick=$('#quickBar');if(quick)quick.hidden=view==='trash'||view==='archive';
  const clear=$('#clearSearch');if(clear)clear.hidden=!search;
  $('#sidebar')?.classList.toggle('mobile-open',mobileMenu);
  $('#mobileScrim')?.classList.toggle('show',mobileMenu);
  $('[data-action="toggleNav"]')?.setAttribute('aria-expanded',String(mobileMenu));
  $('.desktop')?.classList.add('dark-mode');
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
  editorBase=note?structuredClone(note):null;
  draft=note?structuredClone(note):blankNote(checklist);
  editingId=note?.id??null;
  dialog='editor';closePopup();renderDialog();
  window.setTimeout(()=>$<HTMLInputElement>('#editTitle')?.focus(),10);
}
function saveEditor():void {
  syncDraft();if(!draft)return;
  let item=draft;
  if(cloud?.active&&editingId&&editorBase){
    const current=getNote(editingId)??null,merged=mergeNote(editorBase,item,current);
    if(!merged.ok||!merged.value){item={...item,id:id(),title:(item.title+' (conflict copy)').slice(0,10000)};editingId=null;notify('Concurrent edit preserved as a separate note');}
    else item=merged.value;
  }
  item.items=item.items.filter(c=>c.text.trim());
  if(!item.title.trim()&&!item.body.trim()&&!item.items.length){dialog=null;draft=null;renderDialog();return;}
  item.updatedAt=now();
  if(!mutate(()=>{
    if(editingId){const index=data.notes.findIndex(n=>n.id===editingId);if(index>=0)data.notes[index]=normalizeNote(item);}
    else data.notes.unshift(normalizeNote(item));
  })){
    // Rebuild from the preserved draft when browser storage rejects a write.
    // Never leave the editor showing stale input after a failed save.
    renderDialog();
    return;
  }
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
function windowHeader(title:string):string {return `<div class="title-bar dialog-heading dialog-header d-flex align-items-center gap-3 py-3"><span class="app-icon">${icon('note')}</span><span class="title-text dialog-title fw-medium fs-lg">${html(title)}</span></div>`;}
function renderDialog():void {
  const root=$('#dialogRoot');if(!root)return;
  if(!dialog){root.innerHTML='';return;}
  if(dialog==='editor'&&draft){
    root.innerHTML=`<div class="dialog-backdrop d-flex align-items-center justify-content-center" data-action="backdrop"><dialog class="dialog-window dialog show window rounded-7" role="dialog" aria-modal="true" aria-label="${editingId?'Edit note':'New note'}" open>
      ${windowHeader(editingId?'Edit Note — keep':'New Note — keep')}
      <div class="dialog-body min-h-0 py-4">
        <div class="dialog-paper rounded-5 p-4" id="editorPaper" style="--note-color:${html(draft.color)}">
          <div class="field form-field mb-5"><label class="field-label form-label" for="editTitle">Title</label><input class="win-input form-control rounded-5 min-w-0" id="editTitle" type="text" maxlength="10000" value="${html(draft.title)}" placeholder="Untitled note"></div>
          <div class="field form-field mb-5"><label class="field-label form-label" for="editBody">${draft.checklist?'Checklist':'Your note'}</label>
            ${draft.checklist?`<div class="editor-checks d-grid gap-3" id="editorChecks">${draft.items.map(i=>`<div class="editor-check-row d-flex align-items-center gap-3" data-item="${html(i.id)}"><input class="item-check check" type="checkbox" ${i.checked?'checked':''} aria-label="Completed"><input class="win-input item-text form-control rounded-5 min-w-0" value="${html(i.text)}" placeholder="List item"><button class="mini-tool btn-text theme-secondary btn-sm btn rounded-5" data-action="removeItem" data-item="${html(i.id)}" title="Remove item">×</button></div>`).join('')}</div><button class="chrome-btn btn-outline theme-secondary btn rounded-5 mt-4" data-action="addItem">+ Add list item</button>`:`<textarea class="win-input form-control rounded-5 min-w-0" id="editBody" rows="6" placeholder="Take a note...">${html(draft.body)}</textarea>`}
          </div>
        </div>
        <div class="editor-tools d-flex flex-wrap gap-3 mt-3"><button class="chrome-btn btn-outline theme-secondary btn rounded-5" data-action="toggleDraftPin" aria-pressed="${draft.pinned}">${icon('pin')} ${draft.pinned?'Unpin':'Pin note'}</button><button class="chrome-btn btn-outline theme-secondary btn rounded-5" data-action="popup" data-kind="color" data-id="draft">${icon('palette')} Color</button><button class="chrome-btn btn-outline theme-secondary btn rounded-5" data-action="popup" data-kind="labels" data-id="draft">${icon('label')} Labels ${draft.labels.length?`(${draft.labels.length})`:''}</button><button class="chrome-btn btn-outline theme-secondary btn rounded-5" data-action="reminder" data-id="draft">${icon('bell')} ${draft.reminder?'Edit reminder':'Reminder'}</button><button class="chrome-btn btn-outline theme-secondary btn rounded-5" data-action="toggleDraftChecklist">${icon('check')} ${draft.checklist?'Text note':'Checklist'}</button></div>
      </div>
      <div class="dialog-footer d-flex flex-wrap justify-content-end align-items-center gap-3 py-3"><span class="footer-left me-auto fg-2 small">${editingId?'Changes saved when you click Save':'A new local note'} &nbsp;·&nbsp; Ctrl+Enter</span><button class="chrome-btn btn-outline theme-secondary btn rounded-5" data-action="cancelEditor">Cancel</button><button class="chrome-btn primary btn-solid theme-primary btn rounded-5" data-action="saveEditor">${icon('save')} Save note</button></div>
    </dialog></div>`;return;
  }
  if(dialog==='reminder'){
    const target=reminderTarget==='draft'?draft:getNote(reminderTarget||'');
    const original=dateValue(target?.reminder??null);
    root.innerHTML=`<div class="dialog-backdrop d-flex align-items-center justify-content-center"><dialog class="dialog-window dialog show window medium rounded-7" role="dialog" aria-modal="true" aria-label="Set reminder" open>${windowHeader('Set Reminder')}
      <div class="dialog-body min-h-0 py-4"><p class="dialog-note form-text">Choose a date and time for this note. Reminder dates appear in the app; system notifications are not enabled.</p><div class="field form-field mb-5"><label class="field-label form-label" for="reminderDate">Date</label><input class="win-input form-control rounded-5 min-w-0" id="reminderDate" type="date" value="${original.date}"></div><div class="field form-field mb-5"><label class="field-label form-label" for="reminderTime">Time</label><input class="win-input form-control rounded-5 min-w-0" id="reminderTime" type="time" value="${original.time}"></div></div>
      <div class="dialog-footer d-flex flex-wrap justify-content-end align-items-center gap-3 py-3"><span class="footer-left me-auto fg-2 small"></span>${target?.reminder?'<button class="chrome-btn btn-outline theme-secondary btn rounded-5" data-action="removeReminder">Remove</button>':''}<button class="chrome-btn btn-outline theme-secondary btn rounded-5" data-action="closeReminder">Cancel</button><button class="chrome-btn primary btn-solid theme-primary btn rounded-5" data-action="saveReminder">${icon('save')} Save</button></div>
    </dialog></div>`;return;
  }
  if(dialog==='labels'){
    root.innerHTML=`<div class="dialog-backdrop d-flex align-items-center justify-content-center"><dialog class="dialog-window dialog show window medium rounded-7" role="dialog" aria-modal="true" aria-label="Manage labels" open>${windowHeader('Edit Labels')}
      <div class="dialog-body min-h-0 py-4"><h3>Organize your notes</h3><p class="dialog-note form-text">Create custom labels and use them to filter your notes from the folder pane.</p><label class="field-label form-label" for="newLabelInput">New label</label><div class="input-inline d-flex align-items-center gap-3 mb-5"><input class="win-input form-control rounded-5 min-w-0" id="newLabelInput" maxlength="120" placeholder="Type a label name"><button class="chrome-btn btn-outline theme-secondary btn rounded-5" data-action="addLabel">+ Add</button></div><div class="label-list d-grid gap-3">${data.labels.length?data.labels.map(l=>`<div class="label-row d-flex align-items-center gap-3"><span>${icon('label')}</span><input class="win-input rename-input form-control rounded-5 min-w-0" aria-label="Rename ${html(l)}" value="${html(l)}" data-old="${html(l)}"><button class="chrome-btn btn-outline theme-secondary btn rounded-5" title="Save label name" data-action="renameLabel" data-value="${html(l)}">${icon('save')}</button><button class="chrome-btn btn-outline theme-secondary btn rounded-5" title="Delete label" data-action="deleteLabel" data-value="${html(l)}">${icon('trash')}</button></div>`).join(''):'<p class="p-3">No labels yet.</p>'}</div></div><div class="dialog-footer d-flex flex-wrap justify-content-end align-items-center gap-3 py-3"><button class="chrome-btn primary btn-solid theme-primary btn rounded-5" data-action="closeDialog">Done</button></div>
    </dialog></div>`;return;
  }
  if(dialog==='settings'){
    root.innerHTML=`<div class="dialog-backdrop d-flex align-items-center justify-content-center"><dialog class="dialog-window dialog show window medium rounded-7" role="dialog" aria-modal="true" aria-label="Settings" open>${windowHeader('keep — Settings')}
      <div class="dialog-body min-h-0 py-4"><h3>Preferences</h3><p class="dialog-note form-text">${cloud?'Cloud Sync is available in this deployment.':'Notes are saved in this browser on this device. keep is not affiliated with Google Keep, and does not offer cloud synchronization.'}</p>
      <fieldset class="settings-group d-grid gap-3 mb-3"><legend>Notes layout</legend><label class="simple-choice d-flex align-items-center gap-3"><input type="checkbox" data-action="toggleListFromSettings" ${data.list?'checked':''} class="check"> List layout</label></fieldset>
      <p class="dialog-note form-text mt-5">Settings and notes remain in this browser. Existing notes from earlier app versions are preserved automatically.</p>${cloud?.settings()??''}</div>
      <div class="dialog-footer d-flex flex-wrap justify-content-end align-items-center gap-3 py-3"><button class="chrome-btn primary btn-solid theme-primary btn rounded-5" data-action="closeDialog">OK</button></div></dialog></div>`;return;
  }
  if(dialog==='about'){
    root.innerHTML=`<div class="dialog-backdrop d-flex align-items-center justify-content-center"><dialog class="dialog-window dialog show window medium rounded-7" role="dialog" aria-modal="true" aria-label="About keep" open>${windowHeader('About keep')}
      <div class="dialog-body min-h-0 py-4"><div class="dialog-icon-message">${icon('computer')}<div><h3 class="m-0 mb-2">keep</h3><p>Version 1.0<br>TypeScript + Bun.js<br>Independent local-first notes application</p></div></div><p class="dialog-note form-text">Minimal Catppuccin interface with Bootstrap 6. Notes are stored only in your browser; this is not Google Keep and does not connect to Google.</p></div><div class="dialog-footer d-flex flex-wrap justify-content-end align-items-center gap-3 py-3"><button class="chrome-btn primary btn-solid theme-primary btn rounded-5" data-action="closeDialog">OK</button></div></dialog></div>`;return;
  }
  if(dialog==='confirm'){
    root.innerHTML=`<div class="dialog-backdrop d-flex align-items-center justify-content-center"><dialog class="dialog-window dialog show window medium rounded-7" role="alertdialog" aria-modal="true" aria-label="${html(confirmTitle)}" open>${windowHeader(confirmTitle)}
      <div class="dialog-body min-h-0 py-4"><div class="dialog-icon-message">${icon('warning')}<p>${html(confirmMessage)}</p></div></div><div class="dialog-footer d-flex flex-wrap justify-content-end align-items-center gap-3 py-3"><button class="chrome-btn btn-outline theme-secondary btn rounded-5" data-action="closeDialog">Cancel</button><button class="chrome-btn primary btn-solid theme-primary btn rounded-5" data-action="confirm">Continue</button></div></dialog></div>`;
  }
}
function confirm(title:string,message:string,action:()=>void):void {confirmTitle=title;confirmMessage=message;confirmAction=action;dialog='confirm';closePopup();renderDialog();}
function closePopup():void {popup={kind:null,target:null,anchor:null};const root=$('#popupRoot');if(root)root.innerHTML='';}
function popupItem(action:string,name:string,glyph:string,extra=''):string{return `<button class="popup-item menu-item" data-action="${action}" ${extra}>${icon(glyph)}<span>${html(name)}</span></button>`;}
function openPopup(kind:PopupKind,target:string|null,anchor:HTMLElement):void {
  if(popup.kind===kind && popup.target===target){closePopup();return;}
  if(dialog==='editor')syncDraft();
  popup={kind,target,anchor};renderPopup();
}
function renderPopup():void {
  const root=$('#popupRoot');if(!root||!popup.kind||!popup.anchor)return;
  const kind=popup.kind;
  const target=popup.target==='draft'?draft:popup.target?getNote(popup.target):null;
  let body='';
  if (kind==='color' && target){body=`<div class="popup-title menu-header">Background color</div><div class="palette-grid d-grid gap-3">${COLORS.map(c=>`<button class="swatch ${target.color===c.value?'selected':''} rounded-pill" title="${html(c.name)}" aria-label="${html(c.name)}" style="background:${c.value}" data-action="chooseColor" data-value="${c.value}"></button>`).join('')}</div>`;}
  else if(kind==='labels' && target){body=`<div class="popup-title menu-header">Add / remove labels</div>${data.labels.map(l=>`<label class="popup-check-label d-flex align-items-center gap-3 p-3"><input type="checkbox" data-action="toggleLabel" data-value="${html(l)}" ${target.labels.includes(l)?'checked':''} class="check">${html(l)}</label>`).join('')}${data.labels.length?'':'<p class="py-2 px-3">No labels yet.</p>'}<div class="popup-label-actions p-3"><button class="chrome-btn btn-outline theme-secondary btn rounded-5" data-action="manageLabels">Edit labels...</button></div>`;}
  else if(kind==='more'&&target){body=`${popupItem('duplicate','Make a copy','copy')}${popupItem('archive',target.archived?'Unarchive':'Archive',target.archived?'restore':'archive',`data-id="${html(target.id)}"`)}<div class="popup-divider menu-divider border-top my-2"></div>${popupItem('delete','Move to Recycle Bin','trash',`data-id="${html(target.id)}"`)}`;}
  else return;
  root.innerHTML=`<div class="popup menu show" role="menu" id="activePopup">${body}</div>`;
  const el=$<HTMLElement>('.popup',root);
  if(el){
    const r=popup.anchor.getBoundingClientRect();
    const b=el.getBoundingClientRect();
    let top=r.bottom+3;
    if(top+b.height>innerHeight-45)top=Math.max(8,r.top-b.height-3);
    el.style.top=`${Math.max(8,top)}px`;
    el.style.left=`${Math.min(Math.max(8,r.left),innerWidth-b.width-8)}px`;
  }
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
function exportData():void { downloadBackup(data); notify('JSON backup exported'); }
function renameLabel(oldName:string):void {
  const input=$<HTMLInputElement>(`.rename-input[data-old="${CSS.escape(oldName)}"]`);
  const next=input?.value.trim();if(!next||next===oldName)return;
  if(data.labels.some(l=>l.toLowerCase()===next.toLowerCase())){notify('A label with that name already exists');return;}
  if(!mutate(()=>{data.labels=data.labels.map(l=>l===oldName?next:l);for(const n of data.notes)n.labels=n.labels.map(l=>l===oldName?next:l);if(view===`label:${oldName}`)view=`label:${next}`;}))return;
  renderDialog();notify('Label renamed');
}
function execute(action:string,button:HTMLElement):void {
  if(button.closest('#sidebar') && mobileMenu){mobileMenu=false;$('#sidebar')?.classList.remove('mobile-open');$('#mobileScrim')?.classList.remove('show');}
  const noteId=button.getAttribute('data-id')??'';
  const value=button.getAttribute('data-value')??'';
  if(action.startsWith('cloud:')&&cloud){void cloud.action(action.slice(6),noteId,data).then(()=>{if(dialog==='settings')renderDialog();});return;}
  switch(action){
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
    case 'settings':dialog='settings';closePopup();renderDialog();if(cloud?.active)void cloud.refreshDevices().then(()=>{if(dialog==='settings')renderDialog();});break;
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
      const n=getNote(popup.target??'');if(n){const copy=structuredClone(n);copy.id=id();copy.createdAt=now();copy.updatedAt=now();copy.pinned=false;copy.items=copy.items.map(i=>({...i,id:id()}));if(mutate(()=>data.notes.unshift(copy)))notify('Note duplicated');}closePopup();break;
    }
    case 'export':closePopup();exportData();break;
    case 'import':closePopup();$<HTMLInputElement>('#importInput')?.click();break;
    case 'reset':confirm('Restore sample notes?','This replaces all your notes and labels with the sample set. Export a JSON backup first if you want to keep your notes.',()=>{if(!mutate(()=>{data=seed();}))return;
      dialog=null;view='notes';search='';const field=$<HTMLInputElement>('#searchInput');if(field)field.value='';renderDialog();render();notify('Sample notes restored');});break;
    case 'confirm':{const fn=confirmAction;confirmAction=null;dialog=null;renderDialog();fn?.();break;}
    case 'toggleView':mutate(()=>{data.list=!data.list;});closePopup();break;
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
    if(['toggleLabel','checkItem','toggleListFromSettings'].includes(action) && button.matches('input'))return;
    if(action==='backdrop')return;
    execute(action,button);
  }
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
  if(popup.kind&&!target.closest('#popupRoot')&&!target.closest('[data-action="popup"]'))closePopup();
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
cloud?.start();
