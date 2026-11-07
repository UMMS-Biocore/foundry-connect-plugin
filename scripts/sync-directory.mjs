#!/usr/bin/env node
// Builds plugins/foundry-connect-directory from plugins/foundry-connect.
//
// The Claude plugin directory refuses an MCP server whose url holds a ${...}
// variable, and every Foundry Connect install has its own hostname. So the
// directory copy ships the same skills, commands and icon with no mcpServers
// and no userConfig. Its README (written by hand, not synced) tells the user
// to add their instance as a connector.
//
//   node scripts/sync-directory.mjs           rewrite the copy
//   node scripts/sync-directory.mjs --check   exit 1 if the copy is stale
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'plugins/foundry-connect');
const dst = join(root, 'plugins/foundry-connect-directory');

// Copied as they are. README.md is the directory copy's own file.
const SYNCED_DIRS = ['skills', 'commands', 'assets'];

const DIRECTORY_DESCRIPTION =
  'Run the Foundry Connect pipeline lifecycle from Claude: explore runs, access and analyze results, ' +
  'share them back, author processes, build or extend pipelines, launch runs and apps, and answer ' +
  'questions from a project knowledge base. Includes the foundry-pipelines, foundry-pipeline-dev and ' +
  'foundry-kb skills and the /foundry-* commands. Connect your own Foundry Connect instance as an MCP ' +
  'connector first, as the README describes.';

function manifest() {
  const m = JSON.parse(readFileSync(join(src, '.claude-plugin/plugin.json'), 'utf8'));
  delete m.userConfig;
  delete m.mcpServers;
  m.description = DIRECTORY_DESCRIPTION;
  return JSON.stringify(m, null, 2) + '\n';
}

function files(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    if (name === '.DS_Store') return [];
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

function snapshot(base) {
  const out = new Map();
  for (const d of SYNCED_DIRS) {
    for (const f of files(join(base, d))) out.set(relative(base, f), readFileSync(f));
  }
  return out;
}

if (process.argv.includes('--check')) {
  const problems = [];
  const manifestPath = join(dst, '.claude-plugin/plugin.json');
  if (!existsSync(manifestPath) || readFileSync(manifestPath, 'utf8') !== manifest()) {
    problems.push('.claude-plugin/plugin.json');
  }
  const want = snapshot(src);
  const have = snapshot(dst);
  for (const [k, v] of want) if (!have.has(k) || !have.get(k).equals(v)) problems.push(k);
  for (const k of have.keys()) if (!want.has(k)) problems.push(`${k} (not in foundry-connect)`);
  if (!existsSync(join(dst, 'README.md'))) problems.push('README.md (missing)');
  if (problems.length) {
    console.error('plugins/foundry-connect-directory is stale. Run node scripts/sync-directory.mjs. Differs:');
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log('plugins/foundry-connect-directory matches plugins/foundry-connect');
} else {
  for (const d of SYNCED_DIRS) {
    rmSync(join(dst, d), { recursive: true, force: true });
    cpSync(join(src, d), join(dst, d), { recursive: true, filter: (p) => !p.endsWith('.DS_Store') });
  }
  mkdirSync(join(dst, '.claude-plugin'), { recursive: true });
  writeFileSync(join(dst, '.claude-plugin/plugin.json'), manifest());
  console.log('wrote plugins/foundry-connect-directory');
}
