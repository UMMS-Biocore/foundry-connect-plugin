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

const LOGIN_AGAIN = 'Run /foundry-channel-login in Claude Code to sign in again.';

const STOP_NOTICES: Record<string, string> = {
  auth_expired: `Foundry Connect channel: the sign in expired or was revoked, so the channel disconnected. ${LOGIN_AGAIN}`,
  version_too_old: `Foundry Connect channel: Foundry Connect refused this Claude Code version. Update Claude Code to ${MIN_CLAUDE_CODE_VERSION} or later.`,
  session_id_in_use: 'Foundry Connect channel: another channel already uses this session id, so this one stopped. Restart Claude Code to get a new one.',
  unsupported_envelope: 'Foundry Connect channel: Foundry Connect does not accept this channel version. Update the Foundry Connect plugin.',
};

function isAuthRefusal(err: Error & { data?: unknown }): boolean {
  const data = err.data as { code?: unknown; status?: unknown } | undefined;
  return (
    /auth_expired|unauthori[sz]ed|forbidden|401/i.test(err.message) ||
    data?.code === 'auth_expired' ||
    data?.status === 401
  );
}

export function startLink(opts: LinkOptions): Link {
  const { server, descriptor } = opts;
  let stopped = false;
  let socket: Socket | null = null;

  const halt = (reason: string, notice: string) => {
    if (stopped) return;
    stopped = true;
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
      // socket.io buffers this while reconnecting and sends it on the next connect
      socket.emit('reply', { v: CLAUDE_CHANNEL_ENVELOPE_VERSION, conversationId, text });
    },
    permissionRequest(r) {
      if (stopped || !socket) return;
      socket.emit('permission:request', { v: CLAUDE_CHANNEL_ENVELOPE_VERSION, ...r });
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
    socket?.emit('session:announce', { v: CLAUDE_CHANNEL_ENVELOPE_VERSION, ...descriptor, claudeCodeVersion });
  });

  socket.on('connect_error', (err: Error & { data?: unknown }) => {
    if (isAuthRefusal(err)) halt('auth_expired', STOP_NOTICES.auth_expired);
    // anything else (network, server restart) is retried by socket.io with backoff
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
