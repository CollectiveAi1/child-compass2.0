// Renders apps/web/public/icons/icon.svg into the PNG sizes required by the PWA
// manifest, iOS home screens, and the desktop app. Run after changing the SVG:
//   node scripts/make-icons.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
Object.defineProperty(process, 'getuid', { value: () => 1000 });
const { default: sparticuz } = await import('@sparticuz/chromium');
const { chromium } = await import('playwright-core');

const iconsDir = resolve('apps/web/public/icons');
const svg = await readFile(resolve(iconsDir, 'icon.svg'), 'utf8');
const browser = await chromium.launch({ executablePath: await sparticuz.executablePath(), args: sparticuz.args, headless: true });
const page = await browser.newPage({ viewport: { width: 512, height: 512 } });

async function render(size, file, padding = 0) {
  await page.setViewportSize({ width: size, height: size });
  const inner = size - padding * 2;
  await page.setContent(`<body style="margin:0;background:${padding ? '#f7f9fb' : 'transparent'};display:grid;place-items:center;width:${size}px;height:${size}px"><div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body>`);
  await page.screenshot({ path: resolve(iconsDir, file), omitBackground: !padding });
  console.log(`wrote icons/${file}`);
}

await render(192, 'icon-192.png');
await render(512, 'icon-512.png');
// Maskable icons need a safe zone: content within the inner 80%.
await render(512, 'icon-maskable-512.png', 51);
await browser.close();
