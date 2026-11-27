import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url).pathname;
await Bun.$`mkdir -p ${root}dist`;
const build = await Bun.build({
  entrypoints: [`${root}src/main.ts`],
  target: 'browser',
  minify: true,
  outdir: `${root}dist`,
  naming: 'app.js'
});
if (!build.success) {
  for (const log of build.logs) console.error(log);
  process.exit(1);
}
const config=await Bun.file(`${root}src/config.css`).text();
const css=await Bun.file(`${root}src/style.css`).text();
const appBytes=new Uint8Array(await Bun.file(`${root}dist/app.js`).arrayBuffer());
const fingerprint=(input:string|Uint8Array):string=>createHash('sha256').update(input).digest('hex').slice(0,12);
const cssHash=fingerprint(css),appHash=fingerprint(appBytes);
const template=await Bun.file(`${root}index.html`).text();
const apiBase=Bun.env.KEEP_API_BASE||'';
if(apiBase&&!/^https:\/\/[a-z0-9.-]+(?::[0-9]+)?$/i.test(apiBase)&&!/^http:\/\/127\.0\.0\.1:[0-9]+$/.test(apiBase))throw Error('Invalid KEEP_API_BASE');
const html=(apiBase?template.replace('</head>',`<meta name="keep-cloud" content="${apiBase}"></head>`):template)
  .replace('href="./config.css"',`href="./config.css?v=${fingerprint(config)}"`)
  .replace('href="./style.css"',`href="./style.css?v=${cssHash}"`)
  .replace('src="./app.js"',`src="./app.js?v=${appHash}"`);
const baseFavicon=await Bun.file(`${root}node_modules/lucide-static/icons/notebook-pen.svg`).text();
const adaptiveFavicon=baseFavicon.replace(/(<svg\b[^>]*>)/, (tag)=>tag+
  '<style>:root{color:#252525}@media (prefers-color-scheme:dark){:root{color:#f1f1f1}}</style>');
await Promise.all([
  Bun.write(`${root}dist/index.html`,html),
  Bun.write(`${root}dist/style.css`,css),
  Bun.write(`${root}dist/shell.css`,await Bun.file(`${root}src/shell.css`).text()),
  Bun.write(`${root}dist/config.css`,config),
  Bun.write(`${root}dist/bootstrap.min.css`,await Bun.file(`${root}src/bootstrap.min.css`).text()),
  Bun.write(`${root}dist/theme-signal.js`,await Bun.file(`${root}theme-signal.js`).text()),
  Bun.write(`${root}dist/favicon.svg`,adaptiveFavicon)
]);
console.log(`Built ${build.outputs.length} JS bundle with Material Symbols Rounded UI icons in dist/`);
