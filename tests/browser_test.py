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
    print('title',page.title(),'notes',page.locator('.note-window').count(), 'errors:',errors)
    # Canonical 1990s system palette and four-tone component checks.
    light_system=page.evaluate("""() => {
      const snapshot=(selector)=>{const s=getComputedStyle(document.querySelector(selector));return {
        bg:s.backgroundColor, image:s.backgroundImage,
        top:s.borderTopColor,left:s.borderLeftColor,
        right:s.borderRightColor,bottom:s.borderBottomColor,
        shadow:s.boxShadow,height:s.height
      }};
      return {
        desktop:snapshot('.desktop'),window:snapshot('#mainWindow'),
        content:snapshot('.content-pane'),header:snapshot('.content-heading'),
        button:snapshot('.chrome-btn'),field:snapshot('.search-box'),
        note:snapshot('.note-window'),taskbar:snapshot('.taskbar'),
        title:snapshot('.title-bar')
      };
    }""")
    assert light_system['desktop']['bg']=='rgb(0, 128, 128)',light_system
    assert light_system['desktop']['image']=='none',light_system
    assert light_system['window']['bg']=='rgb(192, 192, 192)',light_system
    assert light_system['content']['bg']=='rgb(255, 255, 255)',light_system
    assert light_system['header']['bg']=='rgb(192, 192, 192)',light_system
    assert 'gradient' in light_system['title']['image'],light_system
    for raised in ['window','button','note']:
        style=light_system[raised]
        assert style['top']==style['left']=='rgb(255, 255, 255)',(raised,style)
        assert style['right']==style['bottom']=='rgb(0, 0, 0)',(raised,style)
        assert 'rgb(223, 223, 223)' in style['shadow'] and 'rgb(128, 128, 128)' in style['shadow'],(raised,style)
    recessed=light_system['field']
    assert recessed['top']==recessed['left']=='rgb(0, 0, 0)',recessed
    assert recessed['right']==recessed['bottom']=='rgb(255, 255, 255)',recessed
    assert light_system['taskbar']['height']=='34px',light_system
    page.screenshot(path=str(results/'desktop.png'),full_page=True)
    close_icon='#mainWindow .win-control[aria-label="Close window"] svg path'
    assert page.locator(close_icon).evaluate('(e)=>getComputedStyle(e).stroke')=='rgb(0, 0, 0)', 'Light mode close icon should remain black'
    # Dark mode themes the complete app, not only its desktop background.
    page.locator('[data-action="menu"][data-value="view"]').click()
    page.locator('.popup-item[data-action="toggleDarkMode"]').click()
    assert 'dark-mode' in (page.locator('#desktop').get_attribute('class') or '')
    assert page.locator(close_icon).evaluate('(e)=>getComputedStyle(e).stroke')=='rgb(240, 240, 240)', 'Dark mode close icon must use light system text'
    dark_colors=page.evaluate("""() => {
      const rgb=(selector,prop='backgroundColor') => getComputedStyle(document.querySelector(selector))[prop];
      return {
        pane:rgb('.content-pane'), paper:rgb('.note-paper'),
        title:rgb('.note-heading','color'),
        controls:rgb('.chrome-btn'), sidebar:rgb('.sidebar'),
        selected:JSON.parse(localStorage.getItem('notekeep98-v1')).dark
      };
    }""")
    def channels(rgb):
        return [int(value) for value in rgb.replace('rgb(','').replace(')','').replace(' ','').split(',')[:3]]
    assert max(channels(dark_colors['pane'])) < 100, dark_colors
    assert max(channels(dark_colors['paper'])) < 110, dark_colors
    assert min(channels(dark_colors['title'])) > 180, dark_colors
    assert max(channels(dark_colors['controls'])) < 115, dark_colors
    assert max(channels(dark_colors['sidebar'])) < 115, dark_colors
    assert dark_colors['selected'] is True
    # The adapted Win98 palette uses neutral system panels and one consistent
    # four-tone raised/recessed bevel system, not arbitrary blue-gray surfaces.
    system=page.evaluate("""() => {
      const win=document.querySelector('.main-window');
      const button=document.querySelector('.chrome-btn');
      const input=document.querySelector('.search-box');
      const note=document.querySelector('.note-window');
      const title=document.querySelector('.title-bar');
      const desk=document.querySelector('.desktop');
      const paper=document.querySelector('.note-paper');
      const snapshot=(e)=>{const s=getComputedStyle(e);return {
        bg:s.backgroundColor, top:s.borderTopColor,left:s.borderLeftColor,
        right:s.borderRightColor,bottom:s.borderBottomColor,
        shadow:s.boxShadow
      }};
      return {
        desktop:snapshot(desk),window:snapshot(win),
        button:snapshot(button),input:snapshot(input),
        note:snapshot(note),paper:snapshot(paper),
        desktopImage:getComputedStyle(desk).backgroundImage,
        titleImage:getComputedStyle(title).backgroundImage,
        noteAccent:getComputedStyle(document.querySelector('.note-titlebar'),'::before').backgroundColor,
        originalColor:JSON.parse(localStorage.getItem('notekeep98-v1')).notes[0].color
      };
    }""")
    assert system['desktop']['bg']=='rgb(24, 24, 24)', system
    assert system['window']['bg']=='rgb(48, 48, 48)', system
    assert system['paper']['bg']=='rgb(27, 27, 27)', system
    assert system['desktopImage']=='none', 'Only system title bars may use gradients'
    assert 'gradient' in system['titleImage'], 'Active title bar should retain its gradient'
    for component in ['window','button','note']:
        raised=system[component]
        assert raised['top']==raised['left']=='rgb(112, 112, 112)', (component,raised)
        assert raised['right']==raised['bottom']=='rgb(9, 9, 9)', (component,raised)
        assert 'rgb(80, 80, 80)' in raised['shadow'] and 'rgb(32, 32, 32)' in raised['shadow'], raised
    recessed=system['input']
    assert recessed['top']==recessed['left']=='rgb(9, 9, 9)', recessed
    assert recessed['right']==recessed['bottom']=='rgb(112, 112, 112)', recessed
    assert system['originalColor']=='#fff2b3', system
    assert system['noteAccent']=='rgb(255, 242, 179)', system
    page.locator('[data-action="settings"]').first.click()
    assert page.locator('input[data-action="toggleDarkMode"]').is_checked()
    assert max(channels(page.locator('.dialog-window').evaluate('(e)=>getComputedStyle(e).backgroundColor'))) < 115
    assert page.locator('.dialog-window .win-control[aria-label="Close"] svg path').evaluate('(e)=>getComputedStyle(e).stroke')=='rgb(240, 240, 240)', 'Dialog close icon must also be light in dark mode'
    assert max(channels(page.locator('.search-box').evaluate('(e)=>getComputedStyle(e).backgroundColor'))) < 100
    page.screenshot(path=str(results/'desktop-dark.png'),full_page=True)
    page.locator('[data-action="closeDialog"]').last.click()
    page.locator('.quick-bar [data-action="newNote"]').click()
    assert max(channels(page.locator('#editTitle').evaluate('(e)=>getComputedStyle(e).backgroundColor'))) < 100
    page.locator('[data-action="cancelEditor"]').last.click()
    page.reload(wait_until='load')
    assert 'dark-mode' in (page.locator('#desktop').get_attribute('class') or ''), 'Dark preference must survive a reload'
    page.locator('[data-action="menu"][data-value="view"]').click()
    page.locator('.popup-item[data-action="toggleDarkMode"]').click()
    assert 'dark-mode' not in (page.locator('#desktop').get_attribute('class') or '')
    assert page.locator(close_icon).evaluate('(e)=>getComputedStyle(e).stroke')=='rgb(0, 0, 0)', 'Switching back to light mode should restore black icon'
    assert page.evaluate("JSON.parse(localStorage.getItem('notekeep98-v1')).dark") is False
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
    page.locator('.quick-bar [data-action="newNote"]').click()
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
    page.locator('.quick-bar [data-action="newChecklist"]').click()
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
    # export
    with page.expect_download() as d:
        page.locator('[data-action="export"]').first.click()
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
    page.locator('[data-action="menu"][data-value="view"]').click()
    page.locator('.popup-item[data-action="toggleView"]').click()
    assert page.locator('.note-grid.is-list').count()>0
    page.locator('#viewToggle').click()
    # window minimize / taskbar restore
    page.locator('[data-action="minimize"]').first.click()
    assert page.locator('#mainWindow').is_hidden()
    page.locator('[data-action="taskApp"]').click()
    assert page.locator('#mainWindow').is_visible()
    # Ctrl+K focuses search
    page.keyboard.press('Control+k')
    assert page.locator('#searchInput').evaluate('(e) => document.activeElement === e')
    page.locator('#searchInput').blur()
    print('additional reminder, duplicate, editor, menu and window tests: PASS')
    # mobile
    mobile=browser.new_page(viewport={'width':390,'height':844})
    mobile.on('pageerror',lambda e:errors.append('mobile: '+str(e)))
    mobile.goto(base_url,wait_until='load')
    mobile.wait_for_timeout(200)
    main_window=mobile.locator('#mainWindow')
    maximize_button=mobile.locator('#mainWindow [data-action="maximize"]')
    # The sidebar and backdrop align with the workspace after layout changes.
    mobile.locator('[data-action="toggleNav"]').click()
    assert mobile.locator('#sidebar').evaluate('(e)=>e.classList.contains("mobile-open")')
    workspace_box=mobile.locator('.workspace').bounding_box()
    sidebar_box=mobile.locator('#sidebar').bounding_box()
    assert workspace_box is not None and sidebar_box is not None
    assert abs(workspace_box['y']-sidebar_box['y'])<=2,(workspace_box,sidebar_box)
    mobile.locator('#mobileScrim').click(position={'x':320,'y':15})
    assert not mobile.locator('#sidebar').evaluate('(e)=>e.classList.contains("mobile-open")')
    assert main_window.is_visible()
    assert 'is-maximized' in (main_window.get_attribute('class') or ''), 'Mobile window must always be maximized'
    assert maximize_button.is_disabled(), 'Mobile maximize control must be disabled'
    bounds=main_window.bounding_box()
    assert bounds is not None
    assert abs(bounds['x']) <= 1 and abs(bounds['width']-390) <= 2, f'Mobile window must fill available width: {bounds}'
    # Switching between mobile and desktop must preserve desktop maximize behavior.
    mobile.set_viewport_size({'width':751,'height':844})
    expect(maximize_button).to_be_enabled()  # Media-query change events settle after viewport resize.
    assert 'is-maximized' not in (main_window.get_attribute('class') or ''), 'Desktop starts restored'
    maximize_button.click()
    assert 'is-maximized' in (main_window.get_attribute('class') or ''), 'Desktop maximize remains functional'
    maximize_button.click()
    assert 'is-maximized' not in (main_window.get_attribute('class') or ''), 'Desktop restore remains functional'
    mobile.set_viewport_size({'width':390,'height':844})
    expect(maximize_button).to_be_disabled()
    assert 'is-maximized' in (main_window.get_attribute('class') or ''), 'Returning to mobile must maximize'
    # The mobile close X and window controls must be visible in both modes.
    mobile_close=mobile.locator('#mainWindow [aria-label="Close window"] svg path')
    assert mobile_close.evaluate('(e)=>getComputedStyle(e).stroke')=='rgb(0, 0, 0)'
    mobile.locator('[data-action="menu"][data-value="view"]').click()
    mobile.locator('.popup-item[data-action="toggleDarkMode"]').click()
    expect(mobile.locator('#desktop')).to_have_class('desktop dark-mode')
    assert mobile_close.evaluate('(e)=>getComputedStyle(e).stroke')=='rgb(240, 240, 240)', 'Mobile X must be white in dark mode'
    control_colors=mobile.evaluate("""() => [...document.querySelectorAll('#mainWindow .window-controls .win-control')].map((e) => getComputedStyle(e).color)""")
    assert control_colors==['rgb(240, 240, 240)']*3, control_colors
    icon_colors=mobile.evaluate("""() => ({
      navigation:getComputedStyle(document.querySelector('.mobile-nav-toggle svg path')).stroke,
      search:getComputedStyle(document.querySelector('.search-box svg path')).stroke,
      list:getComputedStyle(document.querySelector('#viewToggle svg path')).stroke
    })""")
    assert all(color=='rgb(240, 240, 240)' for color in icon_colors.values()),icon_colors
    mobile.locator('[data-action="settings"]').first.click()
    backdrop=mobile.locator('.dialog-backdrop').evaluate('(e)=>getComputedStyle(e).backgroundColor')
    assert backdrop=='rgba(0, 0, 0, 0.28)',backdrop
    mobile.locator('.dialog-window [data-action="closeDialog"]').last.click()
    mobile.screenshot(path=str(results/'mobile-dark.png'),full_page=True)
    mobile.reload(wait_until='load')
    assert mobile_close.evaluate('(e)=>getComputedStyle(e).stroke')=='rgb(240, 240, 240)', 'Mobile dark X must survive reload'
    mobile.locator('[data-action="menu"][data-value="view"]').click()
    mobile.locator('.popup-item[data-action="toggleDarkMode"]').click()
    assert mobile_close.evaluate('(e)=>getComputedStyle(e).stroke')=='rgb(0, 0, 0)'
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
    blocked.locator('.quick-bar [data-action="newNote"]').click()
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
