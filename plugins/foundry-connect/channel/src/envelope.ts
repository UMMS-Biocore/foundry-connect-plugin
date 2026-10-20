// Envelope v1 shared with the Foundry Connect backend. Keep this file in step with the
// backend copy: every event on the channel namespace carries `v`, and the backend refuses
// any other value.

export const CLAUDE_CHANNEL_ENVELOPE_VERSION = 1;
export const MIN_CLAUDE_CODE_VERSION = '2.1.234';

export type PageContext = { route: string; title: string; ids: Record<string, string | number> };

export type ChannelSessionDescriptor = {
  sessionId: string;
  machine: string;
  folder: string;
  startedAt: string;
  claudeCodeVersion: string;
  channelVersion: string;
};

export type PermissionBehavior = 'allow' | 'deny';

export type ChannelErrorCode =
  | 'unsupported_envelope'
  | 'version_too_old'
  | 'session_id_in_use'
  | 'auth_expired';

// Channel to backend, namespace /claude-channel
export type SessionAnnounceEvent = { v: number } & ChannelSessionDescriptor;
export type ReplyEvent = { v: number; conversationId: number; text: string };
export type PermissionRequestEvent = {
  v: number;
  requestId: string;
  toolName: string;
  description: string;
  inputPreview: string;
};

// Backend to channel
export type MessageEvent = { v: number; conversationId: number; text: string; context?: PageContext };
export type PermissionVerdictEvent = { v: number; requestId: string; behavior: PermissionBehavior };
export type ErrorEvent = { v: number; code: ChannelErrorCode };

export const REQUEST_ID_PATTERN = /^[a-km-z]{5}$/;

function parseVersion(v: string): number[] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

export function isClaudeCodeVersionSupported(v: string): boolean {
  const have = parseVersion(v);
  const floor = parseVersion(MIN_CLAUDE_CODE_VERSION) as number[];
  if (!have) return false;
  for (let i = 0; i < 3; i++) {
    if (have[i] !== floor[i]) return have[i] > floor[i];
  }
  return true;
}
