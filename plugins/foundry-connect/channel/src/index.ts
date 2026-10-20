import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

async function main(): Promise<void> {
  const server = new Server({ name: 'foundry-channel', version: '0.4.0' }, { capabilities: {} });
  const transport = new StdioServerTransport();
  transport.onclose = () => process.exit(0);
  process.stdin.on('end', () => process.exit(0));
  await server.connect(transport);
}

main().catch((err: unknown) => {
  process.stderr.write(`foundry-channel: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
