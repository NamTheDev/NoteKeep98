/** Application shell: no legacy menu bar or toolbar; actions live with their content. */
export function renderShell(icon:(name:string)=>string): string {
  return `
<div class="desktop d-flex justify-content-center" id="desktop">

  <main class="main-window window w-100 d-flex flex-column" id="mainWindow" aria-label="keep application window">
    <div class="workspace d-flex flex-grow-1 position-relative">
      <aside class="sidebar border-end" id="sidebar"><div id="navRoot"></div><div class="sidebar-foot d-flex gap-3 fg-2 small">${icon('info')}<span>Private, local-first notes. No account required, no cloud syncing.</span></div></aside>
      <div class="mobile-scrim" id="mobileScrim" data-action="closeNav"></div>
      <section class="content-pane d-flex flex-column flex-grow-1 overflow-hidden" aria-label="Notes">
        <div class="content-heading d-flex align-items-center justify-content-between">
          <button class="chrome-btn mobile-nav-toggle btn-outline theme-secondary" data-action="toggleNav" title="Open navigation" aria-label="Open navigation" aria-expanded="false">${icon('menu')}</button>
          <h1 class="page-title fw-medium" id="pageTitle">All Notes</h1>
          <div class="content-actions d-flex flex-wrap align-items-center"><label class="search-box input-group align-items-center">${icon('search')}<input type="search" id="searchInput" aria-label="Search notes" placeholder="Search notes..." autocomplete="off" class="form-control"><button class="search-clear btn-text theme-secondary btn-sm" id="clearSearch" data-action="clearSearch" aria-label="Clear search" hidden>×</button></label></div>
        </div>
        <div class="quick-bar card d-flex flex-row align-items-center" id="quickBar" role="group" aria-label="Quick note">
          <div class="quick-composer" id="quickComposer">
            <input class="quick-title form-control mb-2 fw-medium" id="quickNoteTitle" type="text" maxlength="10000" placeholder="Title (optional)" aria-label="Quick note title" hidden>
            <textarea class="quick-text form-control" id="quickNoteText" rows="1" maxlength="100000" placeholder="Take a note..." aria-label="Quick note text"></textarea>
            <div class="quick-actions d-flex flex-wrap align-items-center gap-3 mt-2" id="quickActions" hidden>
              <span class="quick-hint fg-2 small me-auto">Ctrl+Enter to save</span>
              <button class="chrome-btn btn-outline theme-secondary" data-action="cancelQuickNote">Cancel</button>
              <button class="chrome-btn primary btn-solid theme-primary" data-action="saveQuickNote">${icon('save')} Save note</button>
            </div>
          </div>
        </div>
        <div class="board-scroll flex-grow-1 overflow-auto" id="boardScroll"><div id="boardRoot"></div></div>
      </section>
    </div>
    <div class="status-bar d-flex align-items-center gap-4 border-top fg-2"><div class="status-cell" id="statusText">Ready</div><div class="status-cell" id="statusCount">0 notes</div></div>
  </main>
  <div id="popupRoot"></div><div id="dialogRoot"></div><div id="toastRoot" role="status" aria-live="polite"></div>
  <input type="file" id="importInput" accept=".json,application/json" hidden>
</div>`;
}
