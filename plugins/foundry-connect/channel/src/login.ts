import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

import { loadToken, saveToken, type StoredToken } from './token-store.js';

export type LoginOptions = {
  // Opens the authorize page. Defaults to the system browser.
  openUrl?: (url: string) => void | Promise<void>;
  // One line for the person at the terminal. Never receives the issued credential.
  notify?: (message: string) => void;
  timeoutMs?: number;
};

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

// A bare host name means https://<host>. A full http URL is accepted only for a loopback
// host, which is how a local development stack is reached.
export function instanceBaseUrl(instanceHost: string): string {
  const raw = instanceHost.trim();
  if (/^https?:\/\//i.test(raw)) {
    const u = new URL(raw);
    if (u.protocol === 'http:' && !LOOPBACK_HOSTS.has(u.hostname)) {
      throw new Error('plain http is allowed only for a loopback host');
    }
    if (u.pathname !== '/' || u.search) throw new Error('instance address must not carry a path');
    return `${u.protocol}//${u.host}`;
  }
  if (!/^[A-Za-z0-9.-]+(:\d+)?$/.test(raw)) {
    throw new Error('instance host must be a host name only, for example foundry.example.org');
  }
  return `https://${raw}`;
}

export function openInBrowser(url: string): void {
  const [cmd, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '""', url]]
        : ['xdg-open', [url]];
  try {
    const child = spawn(cmd, args as string[], { stdio: 'ignore', detached: true });
    child.on('error', () => {});
    child.unref();
  } catch {
    // the notice below still tells the person where to go
  }
}

type Callback = { port: number; result: Promise<URLSearchParams>; close(): void };

function listenForCallback(port: number, timeoutMs: number): Promise<Callback> {
  return new Promise((resolve, reject) => {
    let settle: (q: URLSearchParams) => void;
    let fail: (e: Error) => void;
    const result = new Promise<URLSearchParams>((res, rej) => {
      settle = res;
      fail = rej;
    });
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      if (url.pathname !== '/callback') {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><title>Foundry Connect</title><p>Sign in finished. You can close this tab and return to the terminal.</p>');
      settle(url.searchParams);
    });
    result.catch(() => {});
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      // started only once listening, so a taken port leaves no timer behind
      const timer = setTimeout(() => fail(new Error('sign in timed out')), timeoutMs);
      const close = () => {
        clearTimeout(timer);
        server.close();
        server.closeAllConnections?.();
      };
      resolve({ port: (server.address() as AddressInfo).port, result, close });
    });
  });
}

async function register(base: string, port: number): Promise<string> {
  const res = await fetch(`${base}/api/oauth/v1/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Foundry Connect channel for Claude Code',
      redirect_uris: [`http://127.0.0.1:${port}/callback`],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }),
  });
  if (!res.ok) throw new Error(`client registration failed with HTTP ${res.status}`);
  const body = (await res.json()) as { client_id?: unknown };
  if (typeof body.client_id !== 'string') throw new Error('client registration returned no client id');
  return body.client_id;
}

export async function login(instanceHost: string, opts: LoginOptions = {}): Promise<StoredToken> {
  const base = instanceBaseUrl(instanceHost);
  const notify = opts.notify ?? ((m: string) => process.stderr.write(`${m}\n`));
  const openUrl = opts.openUrl ?? openInBrowser;
  const timeoutMs = opts.timeoutMs ?? 10 * 60_000;

  // Reuse the registered client while its fixed port is free; register again only if not.
  const previous = loadToken();
  let clientId: string | null = null;
  let callback: Callback;
  if (previous && previous.instanceHost === instanceHost) {
    try {
      callback = await listenForCallback(previous.redirectPort, timeoutMs);
      clientId = previous.clientId;
    } catch {
      callback = await listenForCallback(0, timeoutMs);
    }
  } else {
    callback = await listenForCallback(0, timeoutMs);
  }

  try {
    if (!clientId) clientId = await register(base, callback.port);
    const redirectUri = `http://127.0.0.1:${callback.port}/callback`;
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const state = randomBytes(16).toString('base64url');

    const authorize = new URL(`${base}/api/oauth/v1/authorize`);
    authorize.search = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
      scope: 'mcp',
    }).toString();

    notify(`Foundry Connect: opening your browser to sign in. If it did not open, visit ${authorize.toString()}`);
    await openUrl(authorize.toString());

    const q = await callback.result;
    if (q.get('state') !== state) throw new Error('sign in refused: state did not match');
    const error = q.get('error');
    if (error) throw new Error(`sign in refused: ${error}`);
    const code = q.get('code');
    if (!code) throw new Error('sign in returned no authorization code');

    const res = await fetch(`${base}/api/oauth/v1/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: verifier,
      }).toString(),
    });
    if (!res.ok) throw new Error(`sign in exchange failed with HTTP ${res.status}`);
    const body = (await res.json()) as { access_token?: unknown; expires_in?: unknown };
    if (typeof body.access_token !== 'string' || typeof body.expires_in !== 'number') {
      throw new Error('sign in exchange returned an unexpected response');
    }
    const stored: StoredToken = {
      instanceHost,
      clientId,
      redirectPort: callback.port,
      accessToken: body.access_token,
      expiresAt: new Date(Date.now() + body.expires_in * 1000).toISOString(),
    };
    saveToken(stored);
    notify('Foundry Connect: signed in. The channel will connect now.');
    return stored;
  } finally {
    callback.close();
  }
}
