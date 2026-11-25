/** Zero-dependency Bun development/production server. */
const port = Number(Bun.env.PORT || 3000);
const production = Bun.env.NODE_ENV === "production";
const root = import.meta.dir;
const mime = (path: string) => path.endsWith('.js') ? 'text/javascript; charset=utf-8' : path.endsWith('.css') ? 'text/css; charset=utf-8' : path.endsWith('.html') ? 'text/html; charset=utf-8' : path.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream';

Bun.serve({
  port,
  hostname: '0.0.0.0',
  async fetch(req) {
    const path = new URL(req.url).pathname;
    if (!production && /^\/icons\/[a-z0-9-]+\.svg$/.test(path)) {
      const file = Bun.file(`${root}/node_modules/lucide-static${path}`);
      return (await file.exists()) ? new Response(file,{headers:{'Content-Type':'image/svg+xml'}}) : new Response('Not found',{status:404});
    }
    if (!production && path === '/app.js') {
      const result = await Bun.build({ entrypoints: [`${root}/src/main.ts`], target: 'browser', minify: false, sourcemap: 'inline' });
      if (!result.success) return new Response(result.logs.map(String).join('\n'), {status: 500});
      return new Response(result.outputs[0], {headers: {'Content-Type': mime(path), 'Cache-Control': 'no-store'}});
    }
    const target = production
      ? (path === '/' ? `${root}/dist/index.html` : `${root}/dist${path}`)
      : (path === '/' ? `${root}/index.html` : path === '/bootstrap.min.css' ? `${root}/src/bootstrap.min.css` : path === '/config.css' ? `${root}/src/config.css` : path === '/style.css' ? `${root}/src/style.css` : path === '/theme-signal.js' ? `${root}/theme-signal.js` : path === '/favicon.svg' ? `${root}/node_modules/lucide-static/icons/notebook-pen.svg` : `${root}/index.html`);
    const file = Bun.file(target);
    if (!await file.exists()) return new Response('Not found', {status:404});
    return new Response(file, {headers: {'Content-Type': mime(target), 'Cache-Control': production ? 'public, max-age=3600' : 'no-store'}});
  }
});
console.log(`keep (${production ? 'production' : 'development'}) → http://localhost:${port}`);
