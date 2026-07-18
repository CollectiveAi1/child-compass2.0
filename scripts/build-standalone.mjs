// Builds child-compass-local.html — the entire app (all three portals) plus an
// in-browser API in ONE file. Double-click it, or serve it with any static
// host, and the full demo runs with no Node server and no install.
//
// Usage: npm run build:web && node scripts/build-standalone.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = resolve(root, 'apps/web/dist');

if (!existsSync(resolve(dist, 'index.html'))) {
  console.log('apps/web/dist not found — running the web build first…');
  execFileSync('npm', ['run', 'build:web'], { cwd: root, stdio: 'inherit' });
}

const indexHtml = readFileSync(resolve(dist, 'index.html'), 'utf8');
const jsFile = indexHtml.match(/src="\/(assets\/index-[^"]+\.js)"/)?.[1];
const cssFile = indexHtml.match(/href="\/(assets\/index-[^"]+\.css)"/)?.[1];
if (!jsFile || !cssFile) throw new Error('Could not locate built assets in apps/web/dist/index.html');

let bundle = readFileSync(resolve(dist, jsFile), 'utf8');
const styles = readFileSync(resolve(dist, cssFile), 'utf8');

// Local assets referenced by absolute path break on file:// — inline them
// everywhere they appear: in the JS bundle and in the seeded activity data.
const gardenSvg = readFileSync(resolve(root, 'apps/web/public/garden-moment.svg'));
const gardenDataUrl = `data:image/svg+xml;base64,${gardenSvg.toString('base64')}`;
bundle = bundle.split('/garden-moment.svg').join(gardenDataUrl);

// Dump the real API seed so the standalone demo matches the server exactly.
const seed = execFileSync('npx', ['tsx', '-e', "import('./apps/api/src/store.ts').then(m => console.log(JSON.stringify(m.resetDemoStore())))"], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  .trim().split('/garden-moment.svg').join(gardenDataUrl);

const mockApi = readFileSync(resolve(root, 'scripts/standalone-mock-api.js'), 'utf8');
const favicon = readFileSync(resolve(root, 'apps/web/public/icons/icon.svg'));

// </script> inside inlined code would end the tag early; the escaped form is
// identical inside JS strings and JSON.
const inline = code => code.replace(/<\/script/gi, '<\\/script');

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#12295b" />
    <meta name="description" content="Child Compass — standalone local demo. All three portals with an in-browser API." />
    <link rel="icon" href="data:image/svg+xml;base64,${favicon.toString('base64')}" />
    <title>Child Compass — Local Demo</title>
    <style>${styles}</style>
    <script>window.__COMPASS_SEED__ = ${inline(seed)};</script>
    <script>${inline(mockApi)}</script>
  </head>
  <body><div id="root"></div><script type="module">${inline(bundle)}</script></body>
</html>
`;

const outFile = resolve(root, 'child-compass-local.html');
writeFileSync(outFile, html);
console.log(`Wrote ${outFile} (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
console.log('Open it directly in a browser, or serve it with e.g. `npx serve .`');
