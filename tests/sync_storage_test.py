"""Exercise the actual IndexedDB outbox in an isolated Chromium context."""
import os
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context()
    page = context.new_page()
    page.goto(os.environ.get("KEEP_BASE_URL", "http://127.0.0.1:3000/"))
    page.evaluate("async () => { const module = await import('./sync-storage-test.js'); await module.verifyStorage(); }")
    context.close()
    browser.close()
