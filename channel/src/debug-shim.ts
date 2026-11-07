// Stands in for the `debug` logging package that socket.io loads. The channel never turns
// socket.io's debug output on, and the real package scans every environment variable name
// for DEBUG_* options at load time. This no-op logger keeps the bundle from touching the
// environment beyond the options the channel itself reads.
type Logger = ((...args: unknown[]) => void) & { enabled: boolean; namespace: string; extend(ns: string): Logger };

function createDebug(namespace: string): Logger {
  const log = Object.assign(() => {}, {
    enabled: false,
    namespace,
    extend: (ns: string) => createDebug(`${namespace}:${ns}`),
  });
  return log;
}

export default createDebug;
