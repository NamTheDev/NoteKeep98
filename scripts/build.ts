import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url).pathname;
await Bun.$`mkdir -p ${root}dist/icons`;
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
const css=await Bun.file(`${root}src/style.css`).text();
const appBytes=new Uint8Array(await Bun.file(`${root}dist/app.js`).arrayBuffer());
const fingerprint=(input:string|Uint8Array):string=>createHash('sha256').update(input).digest('hex').slice(0,12);
const cssHash=fingerprint(css),appHash=fingerprint(appBytes);
const template=await Bun.file(`${root}index.html`).text();
const html=template
  .replace('href="./style.css"',`href="./style.css?v=${cssHash}"`)
  .replace('src="./app.js"',`src="./app.js?v=${appHash}"`);
const names=["file-text","folder","pencil","square-check","search","archive","trash-2","rotate-ccw","pin","bell","palette","tag","list","layout-grid","ellipsis","x","settings","save","upload","download","copy","info","triangle-alert","notebook-pen","clock","star","menu","sparkles","chevron-right"];
await Promise.all([
  Bun.write(`${root}dist/index.html`,html),
  Bun.write(`${root}dist/style.css`,css),
  Bun.write(`${root}dist/favicon.svg`,await Bun.file(`${root}node_modules/lucide-static/icons/notebook-pen.svg`).text()),
  ...names.map(async name=>Bun.write(`${root}dist/icons/${name}.svg`,await Bun.file(`${root}node_modules/lucide-static/icons/${name}.svg`).text()))
]);
console.log(`Built ${build.outputs.length} JS bundle and ${names.length} Lucide icons in dist/`);
