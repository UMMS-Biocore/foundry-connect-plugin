// Bundles the channel into one CommonJS file that runs on Node 18 or later with no
// install step, because a plugin fetched from git is never built on the user's machine.
// The source lives outside the plugin folder so the plugin ships only the bundle. The
// bundle is written into the plugin at plugins/foundry-connect-channel/channel/dist/channel.js,
// is committed, and CI fails when it differs from a fresh build.
// build/lib.cjs is the same code with every module exported, for the tests only.
import { build } from 'esbuild';

const BUNDLE = '../plugins/foundry-connect-channel/channel/dist/channel.js';

const common = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  // optional native speedups that ws loads only when present
  external: ['bufferutil', 'utf-8-validate'],
  legalComments: 'none',
  logLevel: 'warning',
};

await build({ ...common, entryPoints: ['src/index.ts'], outfile: BUNDLE, minify: false });
await build({ ...common, entryPoints: ['src/lib.ts'], outfile: 'build/lib.cjs' });
