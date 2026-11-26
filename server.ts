/** Bun static server with opt-in same-origin synchronization. */
import {createCloud} from './server/sync/transport';
const port = Number(Bun.env.PORT || 3000);
const production = Bun.env.NODE_ENV === "production";
const root = import.meta.dir;
const cloud = Bun.env.KEEP_CLOUD_ENABLED==='true' ? createCloud(Bun.env.KEEP_DATABASE_PATH||'/data/keep.sqlite',Bun.env.KEEP_ORIGIN||'',Bun.env.KEEP_CREATE_INVITE||'') : null;
const staticPaths=new Set(['/','/index.html','/app.js','/bootstrap.min.css','/config.css','/style.css','/theme-signal.js','/favicon.svg','/sync-storage-test.js']);
const mime = (path: string) => path.endsWith('.js') ? 'text/javascript; charset=utf-8' : path.endsWith('.css') ? 'text/css; charset=utf-8' : path.endsWith('.html') ? 'text/html; charset=utf-8' : path.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream';

Bun.serve({
  maxRequestBodySize: 256*1024,
  ...(cloud ? {websocket:cloud.websocket} : {}),
  port,
  hostname: '0.0.0.0',
  async fetch(req,server) {
    const path = new URL(req.url).pathname;
    if(path==='/health')return new Response('ok');
    if(path.startsWith('/api/'))return cloud?cloud.fetch(req,server):new Response('Not found',{status:404});
    if(!staticPaths.has(path))return new Response('Not found',{status:404});
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
    if(cloud&&(path==='/'||path==='/index.html'))return new Response((await file.text()).replace('</head>','<meta name="keep-cloud" content="enabled"></head>'),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' "+(Bun.env.KEEP_ORIGIN||'').replace(/^http/,'ws')+"; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
    return new Response(file, {headers: {'Content-Type': mime(target), 'Cache-Control': production ? 'public, max-age=3600' : 'no-store'}});
  }
});
console.log(`keep (${production ? 'production' : 'development'}) → http://localhost:${port}`);
