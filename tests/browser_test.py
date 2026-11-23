"""Portable Playwright browser tests against a running NoteKeep98 server.

Run `bun run build && NODE_ENV=production bun run start` separately, then execute
`python -m pip install playwright==1.56.0`,
`python -m playwright install chromium`, and `python tests/browser_test.py`.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import os

root=Path(__file__).resolve().parent.parent
base_url=os.environ.get('NOTEKEEP_BASE_URL','http://127.0.0.1:3000')
results=root/'test-results'
results.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1,accept_downloads=True)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base_url,wait_until='load')
    page.wait_for_timeout(300)
    print('title',page.title(),'notes',page.locator('.note-window').count(), 'errors:',errors)
    page.screenshot(path=str(results/'desktop.png'),full_page=True)
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
    mobile.goto(base_url,wait_until='load')
    mobile.wait_for_timeout(200)
    main_window=mobile.locator('#mainWindow')
    maximize_button=mobile.locator('#mainWindow [data-action="maximize"]')
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
    seed_card=blocked.locator('.note-window').filter(has_text='Welcome to NoteKeep 98!')
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
    blocked.close()
    print('ALL BROWSER TESTS PASSED')
    browser.close()
