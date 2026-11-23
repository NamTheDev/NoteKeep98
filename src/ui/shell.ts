/** Application shell: no legacy menu bar or toolbar; actions live with their content. */
export function renderShell(icon:(name:string)=>string): string {
  return `
<div class="desktop" id="desktop">

  <main class="main-window window" id="mainWindow" aria-label="keep application window">
    <div class="workspace">
      <aside class="sidebar" id="sidebar"><div id="navRoot"></div><div class="sidebar-foot">${icon('info')}<span>Private, local-first notes. No account required, no cloud syncing.</span></div></aside>
      <div class="mobile-scrim" id="mobileScrim" data-action="closeNav"></div>
      <section class="content-pane" aria-label="Notes">
        <div class="content-heading"><button class="chrome-btn mobile-nav-toggle" data-action="toggleNav" title="Open folders" aria-label="Toggle folders" aria-expanded="false">${icon('menu')}</button><div class="heading-copy"><div><div class="page-kicker" id="pageKicker">YOUR DESKTOP NOTES</div><h1 class="page-title" id="pageTitle">All Notes</h1><div class="page-desc" id="pageDescription">A little space for everything on your mind.</div></div></div>
          <div class="content-actions"><label class="search-box">${icon('search')}<input type="search" id="searchInput" aria-label="Search notes" placeholder="Search notes..." autocomplete="off"><button class="search-clear" id="clearSearch" data-action="clearSearch" aria-label="Clear search" hidden>×</button></label><button class="chrome-btn" id="viewToggle" data-action="toggleView" title="Toggle grid or list view" aria-label="Toggle list view">${icon('list')}</button><button class="chrome-btn" data-action="settings" title="Settings" aria-label="Settings">${icon('settings')}</button></div>
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
}
