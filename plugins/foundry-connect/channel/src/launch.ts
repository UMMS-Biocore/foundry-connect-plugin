import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

// Claude Code starts every MCP server a plugin declares, channel or not, and tells the
// server nothing about whether it registered it as a channel: that gate runs on the
// client side only. The one place the answer shows is the command line Claude Code was
// started with, so the channel reads its parent's and stays idle unless it is named there.
const CHANNEL_FLAGS = ['--channels', '--dangerously-load-development-channels'];

// The values Claude Code accepts: plugin:<name>@<marketplace>, or server:<name> for a
// manually configured server (the plugin's own server is named plugin:<plugin>:<server>).
function namesThisChannel(entry: string): boolean {
  if (entry.startsWith('plugin:')) {
    const at = entry.indexOf('@');
    return at > 0 && at < entry.length - 1 && entry.slice(7, at) === 'foundry-connect';
  }
  if (entry.startsWith('server:')) {
    const name = entry.slice(7);
    return name === 'foundry-channel' || name === 'plugin:foundry-connect:foundry-channel';
  }
  return false;
}

// Every value given to either channel flag. Each flag takes values up to the next argument
// that starts with "-".
export function channelEntries(argv: readonly string[]): string[] {
  const entries: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const inline = CHANNEL_FLAGS.find((f) => arg.startsWith(`${f}=`));
    if (inline) {
      entries.push(arg.slice(inline.length + 1));
      continue;
    }
    if (!CHANNEL_FLAGS.includes(arg)) continue;
    while (i + 1 < argv.length && !argv[i + 1].startsWith('-')) entries.push(argv[++i]);
  }
  return entries;
}

export function loadedAsChannel(argv: readonly string[] | null): boolean {
  return !!argv && channelEntries(argv).some(namesThisChannel);
}

// ps joins the arguments with spaces, so this cannot tell a space inside one argument from
// a separator. Channel entries never contain one, so the flags still read correctly.
export function splitCommandLine(line: string): string[] {
  return line.split(/\s+/).filter(Boolean);
}

// The parent's argument list, or null when it cannot be read.
export function parentArgv(ppid: number = process.ppid): string[] | null {
  if (!Number.isInteger(ppid) || ppid <= 1) return null;
  try {
    if (process.platform === 'linux') {
      return fs.readFileSync(`/proc/${ppid}/cmdline`, 'utf8').split('\0').filter(Boolean);
    }
    const line =
      process.platform === 'win32'
        ? execFileSync(
            'powershell.exe',
            ['-NoProfile', '-NonInteractive', '-Command', `(Get-CimInstance Win32_Process -Filter 'ProcessId=${ppid}').CommandLine`],
            { encoding: 'utf8', timeout: 5000, windowsHide: true },
          )
        : execFileSync('ps', ['-ww', '-o', 'args=', '-p', String(ppid)], { encoding: 'utf8', timeout: 5000 });
    return splitCommandLine(line);
  } catch {
    return null;
  }
}
