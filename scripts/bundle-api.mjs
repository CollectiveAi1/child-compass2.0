// Pre-bundles the Express API into a single dependency-free ESM file for Vercel's
// serverless function builder. Vercel transpiles /api/*.ts file-by-file rather than
// bundling, which breaks Node's native ESM resolver on our extensionless workspace
// imports (apps/api/src/*, @compass/shared). Bundling here sidesteps that entirely —
// only external npm packages (resolved from node_modules at runtime) remain unbundled.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

await build({
  entryPoints: [resolve(root, 'apps/api/src/serverless.ts')],
  outfile: resolve(root, 'api/index.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  packages: 'external',
  logLevel: 'info',
});
