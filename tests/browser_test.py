"""Chromium smoke test. Uses transpiled TS inline because local loopback navigation is blocked in sandbox."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re
root=Path(__file__).resolve().parent.parent
js_data=(root/'.preview/data.js').read_text().replace('export ','').replace('const now =','const dataNow =').replace('now()','dataNow()').replace('Date.dataNow()','Date.now()')
js_main=(root/'.preview/main.js').read_text()
js_main=re.sub(r'^import \{[^\n]+\} from [^\n]+;\n','',js_main,count=1)
html=(root/'index.html').read_text().replace('<link rel="stylesheet" href="/style.css" />','<style>'+(root/'src/style.css').read_text()+'</style>').replace('<script src="/app.js" type="module" defer></script>','')
html=html.replace('</body>','<script>'+js_data+'\n'+js_main+'</script></body>')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1,accept_downloads=True)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html,wait_until='load')
    page.wait_for_timeout(300)
    print('title',page.title(),'notes',page.locator('.note-window').count(), 'errors:',errors)
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
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
    page.locator('[data-action="addItem"]').click()
    page.locator('.editor-check-row .item-text').last.fill('two')
    page.locator('.editor-check-row .item-check').last.check()
    page.locator('[data-action="saveEditor"]').click()
    assert page.locator('.note-window').filter(has_text='QA List 98').locator('input[data-action="checkItem"]').count()==2
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
    mobile.set_content(html,wait_until='load')
    mobile.wait_for_timeout(200)
    mobile.screenshot(path=str(root/'mobile.png'),full_page=True)
    print('mobile horizontal overflow:',mobile.evaluate('document.documentElement.scrollWidth > window.innerWidth'))
    print('errors',errors)
    assert not errors, errors
    assert mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
    print('ALL BROWSER TESTS PASSED')
    browser.close()
