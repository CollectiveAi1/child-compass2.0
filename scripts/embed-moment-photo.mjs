// Regenerates apps/web/src/assets/momentPhoto.ts from the committed source
// photo, hard-embedding it as a base64 data URL in the code.
//
// Usage: node scripts/embed-moment-photo.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = resolve(root, 'apps/web/src/assets/moment-photo.jpg');
if (!existsSync(source)) {
  console.error('apps/web/src/assets/moment-photo.jpg not found — add the source photo first.');
  process.exit(1);
}
const base64 = readFileSync(source).toString('base64');

writeFileSync(resolve(root, 'apps/web/src/assets/momentPhoto.ts'), `// The classroom "moment" photo, hard-embedded as a base64 data URL so it ships
// inside the JS bundle with no network fetch. Activities store the lightweight
// MOMENT_TOKEN instead of the image itself to keep API payloads small;
// resolveMedia swaps the token for the embedded photo at render time.
// Generated from moment-photo.jpg by scripts/embed-moment-photo.mjs — do not edit by hand.
export const MOMENT_TOKEN = 'compass://moment-photo';

export const momentPhoto = 'data:image/jpeg;base64,${base64}';

export const resolveMedia = (url?: string) => (url === MOMENT_TOKEN ? momentPhoto : url);
`);
console.log(`Embedded moment-photo.jpg (${Math.round(base64.length / 1024)} KB base64) into momentPhoto.ts`);
