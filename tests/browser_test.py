"""Portable Playwright browser tests against a running keep development server.

Run `bun run build && NODE_ENV=production bun run start` separately, then execute
`python -m pip install playwright==1.56.0`,
`python -m playwright install chromium`, and `python tests/browser_test.py`.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import os

root=Path(__file__).resolve().parent.parent
base_url=os.environ.get('KEEP_BASE_URL','http://127.0.0.1:3000')
results=root/'test-results'
results.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1,accept_downloads=True)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base_url + ('&' if '?' in base_url else '?') + 'utm_source=chatgpt.com',wait_until='load')
    assert page.title() == 'keep', 'The website title must be exactly keep'
    assert page.locator('link[rel="icon"]').get_attribute('href') == './favicon.svg'
    assert 'utm_source' not in page.url, 'Remove tracking parameters from the canonical address'
    page.wait_for_timeout(300)
    def assert_theme_signal(expected):
        signal=page.evaluate("""() => ({
          meta:document.querySelector('meta[name="color-scheme"]')?.content,
          root:document.documentElement.dataset.theme,
          computed:getComputedStyle(document.documentElement).colorScheme,
          browser:document.querySelector('meta[name="theme-color"]')?.content,
          locked:!!document.querySelector('meta[name="darkreader-lock"]')
        })""")
        assert signal == {
          'meta':expected, 'root':expected, 'computed':expected,
          'browser':'#1e1e2e' if expected=='dark' else '#eff1f5', 'locked':False
        }, signal
    assert_theme_signal('dark')
    assert page.locator('html').get_attribute('data-bs-theme') == 'dark'
    assert page.locator('link[href="./bootstrap.min.css"]').count() == 1
    assert page.locator('link[href^="./config.css"]').count() == 1
    assert page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()") == '#b4befe'
    assert page.locator('.note-window').count() > 0
    assert page.locator('.material-symbols-rounded').count() > 12
    assert page.locator('#navRoot .ui-icon').first.evaluate('(e)=>e.textContent.trim().length>0')
    assert page.locator('.toolbar, .menu-bar').count() == 0
    # Shared design spacing contract: keep and clipboard must agree on these values.
    spacing=page.evaluate("""() => {
      const root=getComputedStyle(document.documentElement);
      const style=(s)=>getComputedStyle(document.querySelector(s));
      return {
        gutter:root.getPropertyValue('--content-gutter').trim(),
        gap:root.getPropertyValue('--content-gap').trim(),
        cardInset:root.getPropertyValue('--card-inset').trim(),
        sidebarWidth:style('#sidebar').width,
        headingLeft:style('.content-heading').paddingLeft,
        noteInset:style('.note-window .note-paper').paddingLeft,
        gridGap:style('.note-grid').columnGap
      };
    }""")
    assert spacing=={
      'gutter':'20px','gap':'12px','cardInset':'14px',
      'sidebarWidth':'224px','headingLeft':'20px','noteInset':'14px','gridGap':'12px'
    }, spacing
    assert page.locator('.page-kicker, .page-desc').count() == 0
    assert page.locator('#navRoot [data-action="settings"]').is_visible()
    visual=page.evaluate("""() => {
      const style=s=>getComputedStyle(document.querySelector(s));
      return {bg:style('.desktop').backgroundColor,
        surface:style('.note-window').backgroundColor,
        radius:style('.note-window').borderRadius,
        shadow:style('.main-window').boxShadow,
        font:style('body').fontFamily,
        animation:style('.chrome-btn').animationDuration,
        transition:style('.chrome-btn').transitionDuration}
    }""")
    assert visual['bg']=='rgb(30, 30, 46)',visual
    assert visual['surface']=='rgb(24, 24, 37)',visual
    assert visual['radius']=='10px',visual
    assert visual['shadow']=='none',visual
    assert 'Roboto' in visual['font'],visual
    assert visual['animation']=='0s' and visual['transition']=='0s',visual
    page.screenshot(path=str(results/'desktop-dark.png'),full_page=True)
    page.locator('[data-action="settings"]').first.click()
    assert page.locator('input[data-action="toggleDarkMode"]').is_checked()
    page.locator('[data-action="closeDialog"]').last.click()
    page.locator('[data-action="settings"]').first.click()
    page.locator('input[data-action="toggleDarkMode"]').uncheck()
    page.locator('[data-action="closeDialog"]').last.click()
    assert_theme_signal('light')
    assert page.evaluate("JSON.parse(localStorage.getItem('notekeep98-v1')).dark") is False
    page.reload(wait_until='load')
    assert_theme_signal('light')
    # Quick note is a genuine textarea, directly editable without a modal.
    quick=page.locator('#quickNoteText')
    assert quick.evaluate('(e)=>e.tagName')=='TEXTAREA'
    quick.fill('A fast note from the composer')
    assert page.locator('#quickNoteTitle').is_visible()
    assert page.locator('#quickActions').is_visible()
    page.locator('#quickNoteTitle').fill('Quick capture')
    quick.press('Control+Enter')
    assert page.locator('.note-window').filter(has_text='Quick capture').count()==1
    assert page.locator('.note-window').filter(has_text='A fast note from the composer').count()==1
    assert quick.input_value()==''
    assert page.locator('#quickNoteTitle').is_hidden()
    assert page.locator('#quickActions').is_hidden()
    # Multiline body and action button; saved after reload.
    quick.fill('First line' + chr(10) + 'Second line')
    page.locator('[data-action="saveQuickNote"]').click()
    assert page.locator('.note-window').filter(has_text='First line').count()==1
    assert page.evaluate("""() => JSON.parse(localStorage.getItem('notekeep98-v1')).notes.some(n=>n.body.split(String.fromCharCode(10)).join('|')==='First line|Second line')""")
    quick.fill('Unsaved text')
    quick.press('Escape')
    assert quick.input_value()==''
    assert page.locator('.note-window').filter(has_text='Unsaved text').count()==0
    page.reload(wait_until='load')
    assert page.locator('.note-window').filter(has_text='Quick capture').count()==1
    # open and save note
    page.locator('#navRoot [data-action="newNote"]').click()
    assert page.locator('#editTitle').count()==1
    page.locator('#editTitle').fill('QA Note 98')
    page.locator('#editBody').fill('Testing notes')
    page.locator('[data-action="saveEditor"]').click()
    assert page.locator('.note-window').filter(has_text='QA Note 98').count()==1
    # search
    page.locator('#searchInput').fill('QA Note 98')
    assert page.locator('.note-window').count()==1
    page.locator('#clearSearch').click()
    # checklist
    page.locator('#navRoot [data-action="newChecklist"]').click()
    page.locator('#editTitle').fill('QA List 98')
    page.locator('.editor-check-row .item-text').first.fill('one')
    assert page.locator('.editor-check-row .item-text').first.input_value()=='one'
    page.locator('[data-action="addItem"]').click()
    assert page.locator('.editor-check-row .item-text').first.input_value()=='one', 'Adding a checklist item must not discard existing text'
    page.locator('.editor-check-row .item-text').last.fill('two')
    page.locator('.editor-check-row .item-check').last.check()
    editor_rows=page.locator('.editor-check-row')
    assert editor_rows.count()==2, f'Expected two editor checklist rows, got {editor_rows.count()}'
    editor_values=page.locator('.editor-check-row .item-text').evaluate_all('(nodes) => nodes.map(node => node.value)')
    assert editor_values==['one','two'], f'Checklist input values changed before save: {editor_values}'
    page.locator('[data-action="saveEditor"]').click()
    saved_checks=page.locator('.note-window').filter(has_text='QA List 98').locator('input[data-action="checkItem"]')
    try:
        expect(saved_checks).to_have_count(2)
    except AssertionError:
        print('Checklist persistence diagnostic:',
              page.evaluate("""() => {
                const saved = JSON.parse(localStorage.getItem('notekeep98-v1') || '{}');
                const list = saved.notes?.find(note => note.title === 'QA List 98');
                return { items: list?.items, checklist: list?.checklist };
              }"""))
        raise
    # pin
    card=page.locator('.note-window').filter(has_text='QA Note 98')
    card.locator('[data-action="pin"]').click()
    assert card.locator('.pinned').count()==1
    # color
    card.locator('[data-kind="color"]').click()
    page.locator('.swatch[title="Sky"]').click()
    assert 'd7e8ff' in card.get_attribute('style')
    # labels
    page.locator('[data-action="manageLabels"]').first.click()
    page.locator('#newLabelInput').fill('QA Label')
    page.locator('[data-action="addLabel"]').click()
    page.locator('[data-action="closeDialog"]').last.click()
    card=page.locator('.note-window').filter(has_text='QA Note 98')
    card.locator('[data-kind="labels"]').click()
    page.locator('input[data-value="QA Label"]').check()
    page.locator('[data-view="label:QA Label"]').click()
    assert page.locator('.note-window').count()==1
    # archive + restore
    page.locator('[data-view="notes"]').first.click()
    card=page.locator('.note-window').filter(has_text='QA Note 98')
    card.locator('[data-action="archive"]').click()
    page.locator('[data-view="archive"]').first.click()
    assert page.locator('.note-window').filter(has_text='QA Note 98').count()==1
    page.locator('.note-window').filter(has_text='QA Note 98').locator('[data-action="archive"]').click()
    page.locator('[data-view="notes"]').first.click()
    # delete and restore
    card=page.locator('.note-window').filter(has_text='QA Note 98')
    card.locator('[data-kind="more"]').click()
    page.locator('.popup-item[data-action="delete"]').click()
    page.locator('[data-view="trash"]').first.click()
    assert page.locator('.note-window').filter(has_text='QA Note 98').count()==1
    page.locator('.note-window').filter(has_text='QA Note 98').locator('[data-action="restore"]').click()
    # Export is a sidebar action, not a toolbar or settings-dialog duplicate.
    with page.expect_download() as d:
        page.locator('#navRoot [data-action="export"]').click()
    assert d.value.suggested_filename.endswith('.json')
    # reminders and reminder filtering
    page.locator('[data-view="notes"]').first.click()
    checklist=page.locator('.note-window').filter(has_text='QA List 98')
    checklist.locator('[data-action="reminder"]').click()
    page.locator('#reminderDate').fill('2026-12-01')
    page.locator('#reminderTime').fill('10:30')
    page.locator('[data-action="saveReminder"]').click()
    page.locator('[data-view="reminders"]').first.click()
    assert page.locator('.note-window').filter(has_text='QA List 98').count()==1
    page.locator('[data-view="notes"]').first.click()
    # duplicate, then remove duplicate
    checklist=page.locator('.note-window').filter(has_text='QA List 98')
    checklist.locator('[data-kind="more"]').click()
    page.locator('.popup-item[data-action="duplicate"]').click()
    assert page.locator('.note-window').filter(has_text='QA List 98').count()==2
    # editor pin and change note type
    checklist=page.locator('.note-window').filter(has_text='QA List 98').first
    checklist.locator('[data-action="editNote"]').first.click()
    page.locator('[data-action="toggleDraftPin"]').click()
    assert page.locator('[data-action="toggleDraftPin"]').get_attribute('aria-pressed')=='true'
    page.locator('[data-action="saveEditor"]').click()
    # view menu and layout toggle
    page.locator('#viewToggle').click()
    assert page.locator('.note-grid.is-list').count()>0
    page.locator('#viewToggle').click()
    # The application fills the viewport without a simulated OS window manager.
    assert page.locator('[data-action="minimize"]').count()==0
    assert page.locator('[data-action="maximize"]').count()==0
    assert page.locator('.taskbar').count()==0
    assert page.locator('#mainWindow').evaluate('(e)=>Math.round(e.getBoundingClientRect().height)==innerHeight')
    # Ctrl+K focuses search
    page.keyboard.press('Control+k')
    assert page.locator('#searchInput').evaluate('(e) => document.activeElement === e')
    page.locator('#searchInput').blur()
    print('additional reminder, duplicate, editor, menu and fullscreen app tests: PASS')
    # mobile
    mobile=browser.new_page(viewport={'width':390,'height':844})
    mobile.on('pageerror',lambda e:errors.append('mobile: '+str(e)))
    mobile.goto(base_url,wait_until='load')
    mobile.wait_for_timeout(200)
    mobile_gutter=mobile.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--content-gutter').trim()")
    assert mobile_gutter=='12px',mobile_gutter
    main_window=mobile.locator('#mainWindow')
    assert mobile.locator('#mainWindow .window-controls').count()==0
    assert mobile.locator('.taskbar').count()==0
    # The sidebar and backdrop must still work in full-viewport mode.
    mobile.locator('[data-action="toggleNav"]').click()
    assert mobile.locator('#sidebar').evaluate('(e)=>e.classList.contains("mobile-open")')
    workspace_box=mobile.locator('.workspace').bounding_box()
    sidebar_box=mobile.locator('#sidebar').bounding_box()
    assert workspace_box is not None and sidebar_box is not None
    assert abs(workspace_box['y']-sidebar_box['y'])<=2,(workspace_box,sidebar_box)
    mobile.locator('#mobileScrim').click(position={'x':320,'y':15})
    assert not mobile.locator('#sidebar').evaluate('(e)=>e.classList.contains("mobile-open")')
    assert main_window.is_visible()
    bounds=main_window.bounding_box()
    assert bounds is not None
    assert abs(bounds['x'])<=1 and abs(bounds['width']-390)<=2, bounds
    assert mobile.locator('#desktop').evaluate('(e)=>e.classList.contains("dark-mode")')
    icon_filter=mobile.locator('.mobile-nav-toggle .ui-icon').evaluate('(e)=>getComputedStyle(e).filter')
    assert icon_filter == 'none', icon_filter
    mobile.locator('[data-action="toggleNav"]').click()
    mobile.locator('#navRoot [data-action="settings"]').click()
    backdrop=mobile.locator('.dialog-backdrop').evaluate('(e)=>getComputedStyle(e).backgroundColor')
    assert backdrop=='rgba(17, 17, 27, 0.75)',backdrop
    mobile.locator('.dialog-window [data-action="closeDialog"]').last.click()
    mobile.screenshot(path=str(results/'mobile-dark.png'),full_page=True)
    mobile.reload(wait_until='load')
    mobile.locator('[data-action="toggleNav"]').click()
    mobile.locator('#navRoot [data-action="settings"]').click()
    mobile.locator('input[data-action="toggleDarkMode"]').uncheck()
    mobile.locator('[data-action="closeDialog"]').last.click()
    # Mobile quick composer expands without horizontal overflow and allows cancel.
    mobile_quick=mobile.locator('#quickNoteText')
    mobile_quick.fill('Mobile quick draft')
    assert mobile.locator('#quickActions').is_visible()
    assert mobile.locator('#quickNoteTitle').is_visible()
    assert mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
    mobile.locator('[data-action="cancelQuickNote"]').click()
    assert mobile_quick.input_value()==''
    assert mobile.locator('#quickActions').is_hidden()
    mobile.screenshot(path=str(results/'mobile.png'),full_page=True)
    print('mobile horizontal overflow:',mobile.evaluate('document.documentElement.scrollWidth > window.innerWidth'))
    print('errors',errors)
    assert not errors, errors
    assert mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
    # Storage quota/denial regression: no false "Note saved" and editor stays open.
    blocked=browser.new_page(viewport={'width':1280,'height':800})
    blocked.add_init_script("""(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key === 'notekeep98-v1') throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
        return original.call(this, key, value);
      };
    })();""")
    blocked.goto(base_url, wait_until='load')
    seed_card=blocked.locator('.note-window').filter(has_text='Welcome to keep!')
    assert seed_card.locator('.pinned').count()==1
    seed_card.locator('[data-action="pin"]').click()
    assert seed_card.locator('.pinned').count()==1, "Failed storage write modified an existing note"
    blocked.locator('#navRoot [data-action="newNote"]').click()
    blocked.locator('#editTitle').fill('Must Not Claim Saved')
    blocked.locator('#editBody').fill('Keep the draft visible')
    blocked.locator('[data-action="saveEditor"]').click()
    assert blocked.locator('#editTitle').is_visible(), "Editor closed after storage failure"
    assert blocked.locator('#editTitle').input_value()=='Must Not Claim Saved'
    assert 'Could not save to browser storage' in blocked.locator('#toastRoot').inner_text()
    assert 'Note saved' not in blocked.locator('#toastRoot').inner_text()
    blocked.reload(wait_until='load')
    assert blocked.locator('.note-window').filter(has_text='Must Not Claim Saved').count()==0
    # Quick composer also keeps unsaved text when localStorage rejects writes.
    blocked.locator('#quickNoteText').fill('Preserve blocked quick draft')
    blocked.locator('[data-action="saveQuickNote"]').click()
    assert blocked.locator('#quickNoteText').input_value()=='Preserve blocked quick draft'
    assert blocked.locator('#quickActions').is_visible()
    assert blocked.locator('.note-window').filter(has_text='Preserve blocked quick draft').count()==0
    assert 'Could not save to browser storage' in blocked.locator('#toastRoot').inner_text()
    blocked.close()
    print('ALL BROWSER TESTS PASSED')
    browser.close()
