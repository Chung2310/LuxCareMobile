export function isProtectedPath(pathname: string): boolean {
  return /^\/(blog|chat)(\/|$)/.test(pathname);
}

interface ProtectionAdapter {
  prevent(): Promise<void>;
  allow(): Promise<void>;
  enablePrivacy?(): Promise<void>;
  disablePrivacy?(): Promise<void>;
}

// Serialize native changes and discard obsolete queued tab transitions.
export function createScreenProtection(adapter: ProtectionAdapter, onError: (error: unknown) => void) {
  let desired = false;
  let applied: boolean | undefined = false;
  let pending = Promise.resolve();
  return (enabled: boolean): Promise<void> => {
    desired = enabled;
    pending = pending.then(async () => {
      if (applied === desired) return;
      const target = desired;
      const results = await Promise.allSettled([
        Promise.resolve().then(() => target ? adapter.prevent() : adapter.allow()),
        Promise.resolve().then(() => target ? adapter.enablePrivacy?.() : adapter.disablePrivacy?.()),
      ]);
      applied = target;
      for (const result of results) {
        if (result.status === "rejected") {
          applied = undefined;
          onError(result.reason);
        }
      }
    });
    return pending;
  };
}
