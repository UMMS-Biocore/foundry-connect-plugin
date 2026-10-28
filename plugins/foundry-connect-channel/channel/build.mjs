// Bundles the channel into one CommonJS file that runs on Node 18 or later with no
// install step, because a plugin fetched from git is never built on the user's machine.
// dist/channel.js is committed and CI fails when it differs from a fresh build.
// build/lib.cjs is the same code with every module exported, for the tests only.
import { build } from 'esbuild';

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

await build({ ...common, entryPoints: ['src/index.ts'], outfile: 'dist/channel.js', minify: false });
await build({ ...common, entryPoints: ['src/lib.ts'], outfile: 'build/lib.cjs' });
