// Stands in for the `ws` package, which engine.io-client loads in Node. Node 22 and later
// ship a standard WebSocket, so the bundle uses that and stays small. engine.io asks for
// the Node only "nodebuffer" binary type, which the standard WebSocket rejects, so it is
// mapped to "arraybuffer". On older Node this exports undefined and the channel refuses to
// connect with a notice (see index.ts).
const Native = (globalThis as { WebSocket?: typeof globalThis.WebSocket }).WebSocket;

export const WebSocket = Native
  ? class extends Native {
      get binaryType(): BinaryType {
        return super.binaryType;
      }
      set binaryType(type: BinaryType | 'nodebuffer') {
        super.binaryType = type === 'nodebuffer' ? 'arraybuffer' : type;
      }
    }
  : undefined;
