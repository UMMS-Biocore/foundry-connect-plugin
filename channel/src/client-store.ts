import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// The OAuth client this channel registered with an instance, kept so each sign in can reuse it
// instead of registering a new client every time. It holds no credential: a public client id
// (the client authenticates with PKCE only) and the loopback port its redirect URI names. The
// credential a sign in returns lives in the channel's memory only and is never written to disk.
export type RegisteredClient = {
  instanceHost: string;
  clientId: string;
  redirectPort: number;
};

function configDir(): string {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, 'foundry-connect');
}

export function registeredClientPath(): string {
  return path.join(configDir(), 'channel-client.json');
}

function isRegisteredClient(v: unknown): v is RegisteredClient {
  if (!v || typeof v !== 'object') return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.instanceHost === 'string' &&
    typeof c.clientId === 'string' &&
    Number.isInteger(c.redirectPort) &&
    (c.redirectPort as number) > 0 &&
    (c.redirectPort as number) < 65536
  );
}

export function loadRegisteredClient(): RegisteredClient | null {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(registeredClientPath(), 'utf8'));
    if (!isRegisteredClient(parsed)) return null;
    return { instanceHost: parsed.instanceHost, clientId: parsed.clientId, redirectPort: parsed.redirectPort };
  } catch {
    return null;
  }
}

export function saveRegisteredClient(c: RegisteredClient): void {
  const file = registeredClientPath();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.tmp`;
  const record: RegisteredClient = { instanceHost: c.instanceHost, clientId: c.clientId, redirectPort: c.redirectPort };
  fs.writeFileSync(tmp, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tmp, file);
}

// Versions up to 0.7.0 kept the sign in itself in channel.json. Nothing reads it any more, so
// it is removed unread rather than left on disk.
export function removeLegacySignInFile(): void {
  try {
    fs.rmSync(path.join(configDir(), 'channel.json'), { force: true });
  } catch {
    // a file we cannot remove is left as it is
  }
}
