// A minimal MCP server over JSON-RPC 2.0: initialize, ping, the request handlers the
// channel registers, and outgoing notifications. It replaces @modelcontextprotocol/sdk so
// the shipped bundle stays small and readable. The transport shape matches the SDK's
// Transport interface, so the tests can still drive it with the SDK client.

export type JsonRpcId = string | number;

export type JsonRpcMessage = {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

export type Transport = {
  start(): Promise<void>;
  send(message: JsonRpcMessage): Promise<void>;
  close(): Promise<void>;
  onmessage?: (message: JsonRpcMessage) => void;
  onclose?: () => void;
  onerror?: (error: Error) => void;
};

export type Implementation = { name: string; version: string };

type RequestHandler = (params: Record<string, unknown>) => unknown | Promise<unknown>;
type NotificationHandler = (params: Record<string, unknown>) => void | Promise<void>;

export const LATEST_PROTOCOL_VERSION = '2025-11-25';
export const SUPPORTED_PROTOCOL_VERSIONS = [LATEST_PROTOCOL_VERSION, '2025-06-18', '2025-03-26', '2024-11-05', '2024-10-07'];

const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export class McpServer {
  oninitialized?: () => void;
  private transport?: Transport;
  private client?: Implementation;
  private readonly requests = new Map<string, RequestHandler>();
  private readonly notifications = new Map<string, NotificationHandler>();

  constructor(
    private readonly info: Implementation,
    private readonly options: { capabilities: Record<string, unknown>; instructions?: string },
  ) {
    this.requests.set('initialize', (params) => this.initialize(params));
    this.requests.set('ping', () => ({}));
    this.notifications.set('notifications/initialized', () => this.oninitialized?.());
  }

  setRequestHandler(method: string, handler: RequestHandler): void {
    this.requests.set(method, handler);
  }

  setNotificationHandler(method: string, handler: NotificationHandler): void {
    this.notifications.set(method, handler);
  }

  getClientVersion(): Implementation | undefined {
    return this.client;
  }

  async connect(transport: Transport): Promise<void> {
    this.transport = transport;
    transport.onmessage = (message) => {
      this.handle(message).catch((err: unknown) => transport.onerror?.(err instanceof Error ? err : new Error(String(err))));
    };
    await transport.start();
  }

  async notification(message: { method: string; params?: Record<string, unknown> }): Promise<void> {
    if (!this.transport) throw new Error('Not connected');
    await this.transport.send({ jsonrpc: '2.0', method: message.method, params: message.params });
  }

  private initialize(params: Record<string, unknown>) {
    const requested = params.protocolVersion;
    const clientInfo = params.clientInfo;
    if (isObject(clientInfo) && typeof clientInfo.name === 'string' && typeof clientInfo.version === 'string') {
      this.client = { name: clientInfo.name, version: clientInfo.version };
    }
    return {
      protocolVersion:
        typeof requested === 'string' && SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : LATEST_PROTOCOL_VERSION,
      capabilities: this.options.capabilities,
      serverInfo: this.info,
      ...(this.options.instructions ? { instructions: this.options.instructions } : {}),
    };
  }

  private async handle(message: JsonRpcMessage): Promise<void> {
    // A response to a request we sent. The channel sends none, so there is nothing to match.
    if (typeof message.method !== 'string') return;
    const params = isObject(message.params) ? message.params : {};

    if (message.id === undefined) {
      await this.notifications.get(message.method)?.(params);
      return;
    }

    const id = message.id;
    const handler = this.requests.get(message.method);
    if (!handler) {
      await this.reply({ jsonrpc: '2.0', id, error: { code: METHOD_NOT_FOUND, message: `Method not found: ${message.method}` } });
      return;
    }
    if (message.params !== undefined && !isObject(message.params)) {
      await this.reply({ jsonrpc: '2.0', id, error: { code: INVALID_PARAMS, message: 'params must be an object' } });
      return;
    }
    try {
      await this.reply({ jsonrpc: '2.0', id, result: await handler(params) });
    } catch (err) {
      await this.reply({ jsonrpc: '2.0', id, error: { code: INTERNAL_ERROR, message: err instanceof Error ? err.message : String(err) } });
    }
  }

  private async reply(message: JsonRpcMessage): Promise<void> {
    await this.transport?.send(message);
  }
}

// Newline delimited JSON-RPC over stdin and stdout, as MCP's stdio transport defines it.
export class StdioTransport implements Transport {
  onmessage?: (message: JsonRpcMessage) => void;
  onclose?: () => void;
  onerror?: (error: Error) => void;
  private buffer = '';
  private closed = false;

  constructor(
    private readonly input: NodeJS.ReadableStream = process.stdin,
    private readonly output: NodeJS.WritableStream = process.stdout,
  ) {}

  private readonly onData = (chunk: Buffer | string) => {
    this.buffer += chunk.toString();
    let newline: number;
    while ((newline = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newline).replace(/\r$/, '');
      this.buffer = this.buffer.slice(newline + 1);
      if (!line.trim()) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch (err) {
        this.onerror?.(err instanceof Error ? err : new Error(String(err)));
        continue;
      }
      if (isObject(parsed) && parsed.jsonrpc === '2.0') this.onmessage?.(parsed as JsonRpcMessage);
      else this.onerror?.(new Error('not a JSON-RPC 2.0 message'));
    }
  };

  private readonly onStreamError = (err: Error) => this.onerror?.(err);

  async start(): Promise<void> {
    this.input.on('data', this.onData);
    this.input.on('error', this.onStreamError);
  }

  send(message: JsonRpcMessage): Promise<void> {
    return new Promise((resolve) => {
      if (this.output.write(`${JSON.stringify(message)}\n`)) resolve();
      else this.output.once('drain', resolve);
    });
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.input.off('data', this.onData);
    this.input.off('error', this.onStreamError);
    this.buffer = '';
    this.onclose?.();
  }
}
