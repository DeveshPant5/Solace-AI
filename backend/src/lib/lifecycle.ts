// Server lifecycle shared between index.ts and long-lived routes (chat streams).

const shutdownController = new AbortController();

/** Aborted when the server starts shutting down; long-running work should stop. */
export const shutdownSignal = shutdownController.signal;

export function beginShutdown() {
  if (!shutdownController.signal.aborted) shutdownController.abort();
}

export const isShuttingDown = () => shutdownController.signal.aborted;
