const root = new URL('../', import.meta.url).pathname;
await Bun.$`mkdir -p ${root}dist`;
const build = await Bun.build({
  entrypoints: [`${root}src/main.ts`], target:'browser', minify: true, outdir: `${root}dist`, naming: 'app.js'
});
if (!build.success) {
  for (const log of build.logs) console.error(log);
  process.exit(1);
}
await Promise.all([
  Bun.write(`${root}dist/index.html`, Bun.file(`${root}index.html`)),
  Bun.write(`${root}dist/style.css`, Bun.file(`${root}src/style.css`))
]);
console.log(`Built ${build.outputs.length} JavaScript bundle and static assets in dist/`);
