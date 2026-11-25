import type {Note} from './data';
import {icon} from '../../ui/icons';
import {html,dateLabel} from '../../utils/format';
export function noteHTML(n:Note,currentView:string):string {
  const isTrash = currentView==='trash';
  const body = n.checklist ? `<div class="note-checks d-grid gap-2">${n.items.slice(0,12).map(item=>`<label class="check-item ${item.checked?'done':''} d-flex align-items-center gap-3"><input type="checkbox" data-action="checkItem" data-id="${html(n.id)}" data-item="${html(item.id)}" ${item.checked?'checked':''} ${isTrash?'disabled':''} class="check"><span>${html(item.text)}</span></label>`).join('')}</div>` : `<p class="note-text mb-0">${html(n.body || (n.title ? '' : 'Empty note'))}</p>`;
  const tags = n.labels.length ? `<div class="note-tags d-flex flex-wrap gap-2">${n.labels.map(l=>`<span class="note-tag badge">${html(l)}</span>`).join('')}</div>` : '';
  const reminder = n.reminder ? `<div class="note-reminder badge align-self-start">${icon('bell')} ${html(dateLabel(n.reminder))}</div>` : '';
  const footer = isTrash ? `<button class="mini-tool btn-text theme-secondary btn-sm btn" title="Restore" aria-label="Restore" data-action="restore" data-id="${html(n.id)}">${icon('restore')}</button><button class="mini-tool btn-text theme-secondary btn-sm btn" title="Delete permanently" aria-label="Delete permanently" data-action="deleteForever" data-id="${html(n.id)}">${icon('trash')}</button>` : `
    <button class="mini-tool btn-text theme-secondary btn-sm btn" title="Edit note" aria-label="Edit note" data-action="editNote" data-id="${html(n.id)}">${icon('pencil')}</button>
    <button class="mini-tool btn-text theme-secondary btn-sm btn" title="Change color" aria-label="Change color" data-action="popup" data-kind="color" data-id="${html(n.id)}">${icon('palette')}</button>
    <button class="mini-tool btn-text theme-secondary btn-sm btn" title="Add reminder" aria-label="Add reminder" data-action="reminder" data-id="${html(n.id)}">${icon('bell')}</button>
    <button class="mini-tool btn-text theme-secondary btn-sm btn" title="Edit labels" aria-label="Edit labels" data-action="popup" data-kind="labels" data-id="${html(n.id)}">${icon('label')}</button>
    <button class="mini-tool btn-text theme-secondary btn-sm btn" title="${n.archived?'Unarchive':'Archive'}" aria-label="${n.archived?'Unarchive':'Archive'}" data-action="archive" data-id="${html(n.id)}">${icon(n.archived?'restore':'archive')}</button>
    <button class="mini-tool btn-text theme-secondary btn-sm btn" title="More options" aria-label="More options" data-action="popup" data-kind="more" data-id="${html(n.id)}">${icon('more')}</button>`;
  return `<article class="note-window card" data-note="${html(n.id)}" style="--note-color:${html(n.color)}">
    <div class="note-titlebar d-flex align-items-center gap-3 fg-2"><span class="note-titlebar-text flex-grow-1 text-truncate"></span><button class="note-top-btn ${n.pinned?'pinned':''} btn-text theme-secondary btn-sm btn" data-action="pin" data-id="${html(n.id)}" title="${n.pinned?'Unpin':'Pin'}" aria-label="${n.pinned?'Unpin':'Pin'}" ${isTrash?'disabled':''}>${icon('pin')}</button></div>
    <div class="note-paper card-body" data-action="editNote" data-id="${html(n.id)}" role="button" tabindex="0" aria-label="Open ${html(n.title || 'untitled note')}">
      ${n.title?`<h2 class="note-heading card-title fw-medium mb-1">${html(n.title)}</h2>`:''}${body}${tags}${reminder}</div>
    <div class="note-foot d-flex flex-wrap align-items-center">${footer}<span class="date">${html(dateLabel(n.updatedAt))}</span></div>
  </article>`;
}
