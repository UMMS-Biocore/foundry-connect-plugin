import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// The channel's sign in record. accessToken is a Foundry Connect personal access credential
// that can do anything its owner can: it is written only to this file, never printed,
// logged or sent to Claude.
export type StoredToken = {
  instanceHost: string;
  clientId: string;
  redirectPort: number;
  accessToken: string;
  expiresAt: string;
};

export function storedLoginPath(): string {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, 'foundry-connect', 'channel.json');
}

function isStoredToken(v: unknown): v is StoredToken {
  if (!v || typeof v !== 'object') return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t.instanceHost === 'string' &&
    typeof t.clientId === 'string' &&
    typeof t.redirectPort === 'number' &&
    typeof t.accessToken === 'string' &&
    typeof t.expiresAt === 'string'
  );
}

export function loadToken(): StoredToken | null {
  const file = storedLoginPath();
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredToken(parsed)) return null;
    // tighten a file someone loosened by hand
    if ((fs.statSync(file).mode & 0o077) !== 0) fs.chmodSync(file, 0o600);
    return parsed;
  } catch {
    return null;
  }
}

export function saveToken(t: StoredToken): void {
  const file = storedLoginPath();
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.chmodSync(dir, 0o700);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(t, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(tmp, 0o600);
  fs.renameSync(tmp, file);
}

export function isUsable(t: StoredToken | null, instanceHost: string): t is StoredToken {
  return !!t && t.instanceHost === instanceHost && Date.parse(t.expiresAt) > Date.now() + 60_000;
}
