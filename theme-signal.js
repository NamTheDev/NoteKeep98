/* Advertise the app's NATIVE theme to browsers and dark-mode extensions.
   Dark Reader recommends <meta name="color-scheme" content="dark">.
   Do not use darkreader-lock: extensions should still work in light mode. */
(() => {
  const root = document.documentElement;
  const schemeMeta = document.querySelector('meta[name="color-scheme"]');
  const themeColor = document.querySelector('meta[name="theme-color"]');
  function signal(dark) {
    const scheme = dark ? 'dark' : 'light';
    root.dataset.theme = scheme;
    root.dataset.bsTheme = scheme;
    root.style.colorScheme = scheme;
    schemeMeta?.setAttribute('content', scheme);
    themeColor?.setAttribute('content', dark ? '#121212' : '#fafafa');
  }
  window.addEventListener('app-theme-change', (event) => {
    signal(event.detail?.dark === true);
  });
  try {
    const saved = JSON.parse(localStorage.getItem('notekeep98-v1') || 'null');
    signal(saved?.dark !== false);
  } catch {
    signal(true);
  }
})();
