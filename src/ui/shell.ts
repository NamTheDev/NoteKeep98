/** Application shell: no legacy menu bar or toolbar; actions live with their content. */
export function renderShell(icon:(name:string)=>string): string {
  return `
<div class="desktop d-flex justify-content-center bg-body" id="desktop">

  <main class="main-window window w-100 d-flex flex-column h-100 min-h-0 position-relative" id="mainWindow" aria-label="keep application window">
    <header class="site-header border-bottom mx-4 lg:mx-6"><div class="header-inner d-flex align-items-center gap-4 w-100"><span class="brand-name">namchill235 / keep</span><span class="header-description flex-grow-1 min-w-0 fg-2 fs-sm">A note-taking GitHub web app for storing notes..</span></div></header>
    <div id="navRoot" class="app-navigation border-bottom"></div>
    <div class="workspace d-flex flex-grow-1 position-relative min-h-0 min-w-0">
      <section class="content-pane d-flex flex-column flex-grow-1 overflow-hidden min-h-0 min-w-0" aria-label="Notes">
        <div class="content-heading d-flex align-items-center justify-content-between">
          <h1 class="page-title fw-medium m-0" id="pageTitle">All Notes</h1>
          <div class="content-actions d-flex flex-wrap align-items-center"><label class="search-box d-flex align-items-center gap-3 max-w-100">${icon('search')}<input type="search" id="searchInput" aria-label="Search notes" placeholder="Search notes..." autocomplete="off" class="form-control flex-grow-1 rounded-5 min-w-0"><button class="search-clear btn-text theme-secondary btn-sm btn rounded-5" id="clearSearch" data-action="clearSearch" aria-label="Clear search" hidden>×</button></label></div>
        </div>
        <div class="quick-bar card d-flex flex-row align-items-center rounded-6" id="quickBar" role="group" aria-label="Quick note">
          <div class="quick-composer min-w-0 flex-grow-1">
            <input class="quick-title form-control mb-2 fw-medium rounded-5" id="quickNoteTitle" type="text" maxlength="10000" placeholder="Title (optional)" aria-label="Quick note title" hidden>
            <textarea class="quick-text form-control rounded-5" id="quickNoteText" rows="1" maxlength="100000" placeholder="Take a note..." aria-label="Quick note text"></textarea>
            <div class="quick-actions d-flex flex-wrap align-items-center gap-3 mt-2" id="quickActions" hidden>
              <span class="quick-hint fg-2 small me-auto">Ctrl+Enter to save</span>
              <button class="chrome-btn btn-outline theme-secondary btn rounded-5" data-action="cancelQuickNote">Cancel</button>
              <button class="chrome-btn primary btn-solid theme-primary btn rounded-5" data-action="saveQuickNote">${icon('save')} Save note</button>
            </div>
          </div>
        </div>
        <div class="board-scroll flex-grow-1 overflow-auto min-h-0 min-w-0" id="boardScroll"><div id="boardRoot"></div></div>
      </section>
    </div>
    <div class="status-bar d-flex align-items-center gap-4 border-top fg-2 bg-1 fs-xs"><div class="status-cell flex-grow-1" id="statusText">Ready</div><span id="storageNotice" class="fg-3">Notes stay on this device.</span><div class="status-cell" id="statusCount">0 notes</div></div>
  </main>
  <div id="popupRoot"></div><div id="dialogRoot"></div><div id="toastRoot" role="status" aria-live="polite"></div>
  <input type="file" id="importInput" accept=".json,application/json" hidden>
</div>`;
}
