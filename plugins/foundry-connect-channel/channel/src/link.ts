import { io, type Socket } from 'socket.io-client';

import {
  CLAUDE_CHANNEL_ENVELOPE_VERSION,
  MIN_CLAUDE_CODE_VERSION,
  REQUEST_ID_PATTERN,
  isClaudeCodeVersionSupported,
  type ChannelSessionDescriptor,
  type PageContext,
} from './envelope.js';
import { instanceBaseUrl } from './login.js';
import type { PermissionRequest } from './server.js';

// What the link needs from the channel server (see createChannelServer).
export type LinkTarget = {
  clientVersion(): string | undefined;
  pushMessage(conversationId: number, text: string, context?: PageContext): Promise<void>;
  sendVerdict(requestId: string, behavior: 'allow' | 'deny'): Promise<void>;
  pushNotice(text: string): Promise<void>;
};

export type LinkOptions = {
  instanceHost: string;
  token: string;
  descriptor: Omit<ChannelSessionDescriptor, 'claudeCodeVersion'>;
  server: LinkTarget;
  // Called once when the link stops for good, with the reason code.
  onStop?: (reason: string) => void;
  reconnectionDelayMs?: number;
};

export type Link = {
  stop(): void;
  stopped(): boolean;
  reply(conversationId: number, text: string): Promise<void>;
  permissionRequest(r: PermissionRequest): void;
};

// Replies and requests held while the link reconnects; past this many, new ones are dropped.
const MAX_PENDING = 100;

const LOGIN_AGAIN ='Run /foundry-channel-login in Claude Code to sign in again.';

const STOP_NOTICES: Record<string, string> = {
  // The backend also sends auth_expired when the channel is turned off for the account.
  auth_expired: `Foundry Connect channel: the sign in expired or was revoked, or the channel was turned off for your account, so the channel disconnected. ${LOGIN_AGAIN}`,
  feature_off:
    'Foundry Connect channel: the Claude Code channel is not turned on for your Foundry Connect account, so the channel did not connect. Ask your Foundry Connect administrator to turn it on, then restart Claude Code.',
  version_too_old: `Foundry Connect channel: Foundry Connect refused this Claude Code version. Update Claude Code to ${MIN_CLAUDE_CODE_VERSION} or later.`,
  session_id_in_use: 'Foundry Connect channel: another channel already uses this session id, so this one stopped. Restart Claude Code to get a new one.',
  unsupported_envelope: 'Foundry Connect channel: Foundry Connect does not accept this channel version. Update the Foundry Connect plugin.',
};

// A refusal from namespace middleware carries a message or data; one at the HTTP layer
// (before socket.io sees the request) carries the status in description or context.
function isAuthRefusal(err: Error & { data?: unknown; description?: unknown; context?: unknown }): boolean {
  const data = err.data as { code?: unknown; status?: unknown } | undefined;
  const context = err.context as { status?: unknown } | undefined;
  const refused = (s: unknown) => s === 401 || s === 403;
  return (
    /auth_expired|authentication error|unauthori[sz]ed|forbidden|401/i.test(err.message) ||
    data?.code === 'auth_expired' ||
    refused(data?.status) ||
    refused(err.description) ||
    refused(context?.status)
  );
}

export function startLink(opts: LinkOptions): Link {
  const { server, descriptor } = opts;
  let stopped = false;
  let socket: Socket | null = null;
  // The backend drops a reply or request from a socket that has not announced, and socket.io
  // flushes its own buffer before our connect handler runs. So everything waits here until the
  // announce of the current connection is acknowledged.
  let announced = false;
  const pending: Array<[string, unknown]> = [];

  const send = (event: string, payload: unknown) => {
    if (announced && socket?.connected) socket.emit(event, payload);
    else if (pending.length < MAX_PENDING) pending.push([event, payload]);
  };

  const halt = (reason: string, notice: string) => {
    if (stopped) return;
    stopped = true;
    pending.length = 0;
    socket?.disconnect();
    process.stderr.write(`${notice}\n`);
    server.pushNotice(notice).catch(() => {});
    opts.onStop?.(reason);
  };

  const link: Link = {
    stop() {
      stopped = true;
      socket?.disconnect();
    },
    stopped: () => stopped,
    async reply(conversationId, text) {
      if (stopped || !socket) throw new Error(`the channel is not signed in to Foundry Connect. ${LOGIN_AGAIN}`);
      // held while reconnecting and sent once the next announce is acknowledged
      send('reply', { v: CLAUDE_CHANNEL_ENVELOPE_VERSION, conversationId, text });
    },
    permissionRequest(r) {
      if (stopped || !socket) return;
      send('permission:request', { v: CLAUDE_CHANNEL_ENVELOPE_VERSION, ...r });
    },
  };

  const claudeCodeVersion = server.clientVersion() ?? '';
  if (!isClaudeCodeVersionSupported(claudeCodeVersion)) {
    halt(
      'version_too_old',
      `Foundry Connect channel: Claude Code ${claudeCodeVersion || '(unknown version)'} is older than ${MIN_CLAUDE_CODE_VERSION}, so the channel did not connect. Update Claude Code and restart it.`,
    );
    return link;
  }

  socket = io(`${instanceBaseUrl(opts.instanceHost)}/claude-channel`, {
    auth: { token: opts.token },
    reconnectionDelay: opts.reconnectionDelayMs ?? 1000,
    reconnectionDelayMax: Math.max(opts.reconnectionDelayMs ?? 1000, 30_000),
  });

  socket.on('connect', () => {
    announced = false;
    const s = socket;
    s?.emit('session:announce', { v: CLAUDE_CHANNEL_ENVELOPE_VERSION, ...descriptor, claudeCodeVersion }, (ack: unknown) => {
      const a = ack as { v?: unknown; ok?: unknown } | undefined;
      // A refusal arrives as an error event instead, which stops the link.
      if (stopped || socket !== s || !s?.connected || a?.v !== CLAUDE_CHANNEL_ENVELOPE_VERSION || a.ok !== true) return;
      announced = true;
      for (const [event, payload] of pending.splice(0)) s.emit(event, payload);
    });
  });

  socket.on('connect_error', (err: Error & { data?: unknown }) => {
    if (/feature not found/i.test(err.message)) halt('feature_off', STOP_NOTICES.feature_off);
    // A refusal from namespace middleware leaves the socket inactive: socket.io will not retry it.
    else if (isAuthRefusal(err) || socket?.active === false) halt('auth_expired', STOP_NOTICES.auth_expired);
    // anything else (network, server restart) is retried by socket.io with backoff
  });

  // socket.io never reconnects after the server closes the socket, so stop for good and
  // say so; otherwise the channel would sit dead and a new sign in could not relink.
  socket.on('disconnect', (reason: string) => {
    announced = false;
    if (reason === 'io server disconnect') {
      halt('server_disconnect', `Foundry Connect channel: Foundry Connect closed the connection. ${LOGIN_AGAIN}`);
    }
  });

  socket.on('error', (e: { v?: unknown; code?: unknown }) => {
    const code = typeof e?.code === 'string' ? e.code : '';
    if (STOP_NOTICES[code]) halt(code, STOP_NOTICES[code]);
  });

  socket.on('message', (m: { v?: unknown; conversationId?: unknown; text?: unknown; context?: unknown }) => {
    if (m?.v !== CLAUDE_CHANNEL_ENVELOPE_VERSION) return;
    if (!Number.isSafeInteger(m.conversationId) || (m.conversationId as number) < 1) return;
    if (typeof m.text !== 'string') return;
    const context = isPageContext(m.context) ? m.context : undefined;
    server.pushMessage(m.conversationId as number, m.text, context).catch(() => {});
  });

  socket.on('permission:verdict', (m: { v?: unknown; requestId?: unknown; behavior?: unknown }) => {
    if (m?.v !== CLAUDE_CHANNEL_ENVELOPE_VERSION) return;
    if (typeof m.requestId !== 'string' || !REQUEST_ID_PATTERN.test(m.requestId)) return;
    if (m.behavior !== 'allow' && m.behavior !== 'deny') return;
    server.sendVerdict(m.requestId, m.behavior).catch(() => {});
  });

  return link;
}

function isPageContext(v: unknown): v is PageContext {
  if (!v || typeof v !== 'object') return false;
  const c = v as Record<string, unknown>;
  if (typeof c.route !== 'string' || typeof c.title !== 'string') return false;
  if (!c.ids || typeof c.ids !== 'object') return false;
  return Object.values(c.ids as Record<string, unknown>).every((x) => typeof x === 'string' || typeof x === 'number');
}
