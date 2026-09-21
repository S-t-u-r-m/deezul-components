/*
 * dev.js — `npm run dev`. Change the port here.
 *
 * Runs deezul-dev in --dist mode: it builds dist/ once, then pushes each save into it
 * and serves dist/ — so what you test here is exactly what `npm run build` deploys.
 *
 * deezul-dev takes its port from the PORT env var and nothing else, and there is no
 * cross-platform way to set one inline in an npm script (`PORT=x cmd` is bash, `set PORT=x`
 * is cmd). So the port lives here, and this file just hands it to the dev server.
 *
 * An env var still wins, for a one-off run on a different port:
 *   PowerShell:  $env:PORT=9000; npm run dev
 *   bash:        PORT=9000 npm run dev
 *
 * Imported by relative path rather than as `deezul/dev-server`: the package's exports map
 * only publishes the runtime and the compiler, not the bin scripts.
 */
const PORT = 8081;

process.env.PORT = process.env.PORT || String(PORT);
process.argv.push('--dist');
await import('./node_modules/deezul/src/dev-server/index.js');
