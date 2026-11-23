import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url).pathname;
await Bun.$`mkdir -p ${root}dist`;
const build = await Bun.build({
  entrypoints: [`${root}src/main.ts`], target:'browser', minify: true, outdir: `${root}dist`, naming: 'app.js'
});
if (!build.success) {
  for (const log of build.logs) console.error(log);
  process.exit(1);
}
const css=await Bun.file(`${root}src/style.css`).text();
const appBytes=new Uint8Array(await Bun.file(`${root}dist/app.js`).arrayBuffer());
const fingerprint=(input:string|Uint8Array):string=>createHash('sha256').update(input).digest('hex').slice(0,12);
const cssHash=fingerprint(css);
const appHash=fingerprint(appBytes);
const template=await Bun.file(`${root}index.html`).text();
const html=template
  .replace('href="./style.css"',`href="./style.css?v=${cssHash}"`)
  .replace('src="./app.js"',`src="./app.js?v=${appHash}"`);
await Promise.all([
  Bun.write(`${root}dist/index.html`,html),
  Bun.write(`${root}dist/style.css`,css)
]);
console.log(`Built ${build.outputs.length} JavaScript bundle and fingerprinted static assets in dist/`);
