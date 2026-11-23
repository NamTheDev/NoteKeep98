/** Quick-note editor DOM behavior, separate from persistence. */
const $ = <T extends Element = HTMLElement>(selector:string):T|null => document.querySelector<T>(selector);
export function expandQuickComposer():void {
  const bar=$('#quickBar');
  if (!bar || bar.classList.contains('is-editing'))return;
  bar.classList.add('is-editing');
  const title=$<HTMLInputElement>('#quickNoteTitle');
  const actions=$('#quickActions');
  if (title)title.hidden=false;
  if (actions)actions.hidden=false;
}
export function resetQuickComposer():void {
  const text=$<HTMLTextAreaElement>('#quickNoteText');
  const title=$<HTMLInputElement>('#quickNoteTitle');
  const actions=$('#quickActions');
  if(text){text.value='';text.style.height='';}
  if(title){title.value='';title.hidden=true;}
  if(actions)actions.hidden=true;
  $('#quickBar')?.classList.remove('is-editing');
}
export function resizeQuickText(text:HTMLTextAreaElement):void {
  text.style.height='auto';
  text.style.height=Math.min(text.scrollHeight,Math.max(160,window.innerHeight*0.3))+'px';
}
