export const wsTicketMemoryFallback = new Map();

// BUG-3: Prevent OOM — clean up expired WS tickets from memory every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of wsTicketMemoryFallback) {
    if (value.expiresAt < now) wsTicketMemoryFallback.delete(key);
  }
}, 60_000).unref(); // .unref() so this doesn't block process exit
