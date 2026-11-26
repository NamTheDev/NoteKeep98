"""Integration test against an isolated cloud-enabled Bun server, never production."""
import os
from playwright.sync_api import sync_playwright, expect
URL=os.environ.get("KEEP_CLOUD_TEST_URL","http://127.0.0.1:3010/")
INVITE=os.environ["KEEP_CREATE_INVITE"]
with sync_playwright() as p:
    browser=p.chromium.launch()
    owner=browser.new_context()
    guest=browser.new_context()
    a=owner.new_page()
    b=guest.new_page()
    for page in (a,b):
        page.on("dialog",lambda d:d.accept())
        page.goto(URL)
        page.get_by_role("button",name="Settings",exact=True).click()
        expect(page.locator("#cloudCredential")).to_be_visible()
    a.locator("#cloudCredential").fill(INVITE)
    a.get_by_role("button",name="Create workspace",exact=True).click()
    expect(a.locator("#cloudSecret")).to_contain_text("Recovery key",timeout=15000)
    expect(a.locator("#statusText")).to_have_text("Synced",timeout=15000)
    a.get_by_role("button",name="Generate / rotate pairing token",exact=True).click()
    expect(a.locator("#cloudSecret")).to_contain_text("Pairing token:",timeout=10000)
    token=a.locator("#cloudSecret").input_value().split("Pairing token: ",1)[1]
    b.locator("#cloudCredential").fill(token)
    b.get_by_role("button",name="Pair device",exact=True).click()
    expect(b.locator("#statusText")).to_have_text("Synced",timeout=15000)
    for page in (a,b):
        page.get_by_role("button",name="OK",exact=True).click()
    a.locator("#quickNoteText").fill("Owner sync integration")
    a.locator("#quickActions").get_by_role("button",name="Save note",exact=True).click()
    expect(b.get_by_text("Owner sync integration",exact=True)).to_be_visible(timeout=10000)
    b.locator("#quickNoteText").fill("Guest sync integration")
    b.locator("#quickActions").get_by_role("button",name="Save note",exact=True).click()
    expect(a.get_by_text("Guest sync integration",exact=True)).to_be_visible(timeout=10000)
    a.get_by_role("button",name="Settings",exact=True).click()
    a.get_by_role("button",name="Generate / rotate pairing token",exact=True).click()
    expect(b.locator("#statusText")).to_contain_text("Access revoked",timeout=10000)
    a.get_by_role("button",name="OK",exact=True).click()
    a.reload()
    expect(a.get_by_text("Guest sync integration",exact=True)).to_be_visible(timeout=10000)
    expect(a.locator("#statusText")).to_have_text("Synced",timeout=10000)
    browser.close()
