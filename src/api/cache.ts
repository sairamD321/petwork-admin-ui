/**
 * Shares one in-flight/settled request between all callers, so remounts (and React StrictMode's
 * double effects in dev) don't hit the backend again. A failed request is dropped so it can be retried.
 */
export function cacheRequest<T>(load: () => Promise<T>) {
  let pending: Promise<T> | null = null;

  return {
    get(): Promise<T> {
      pending ??= load().catch((err: unknown) => {
        pending = null;
        throw err;
      });
      return pending;
    },
    /** Forget the cached result, e.g. on logout or an explicit refresh. */
    clear() {
      pending = null;
    },
  };
}

/** Like `cacheRequest`, but keeps one shared request per key (e.g. per URL). */
export function cacheByKey<T>(load: (key: string) => Promise<T>) {
  const pending = new Map<string, Promise<T>>();

  return {
    get(key: string): Promise<T> {
      let request = pending.get(key);
      if (!request) {
        request = load(key).catch((err: unknown) => {
          pending.delete(key);
          throw err;
        });
        pending.set(key, request);
      }
      return request;
    },
    /** Forget one key so its next `get` refetches. */
    invalidate(key: string) {
      pending.delete(key);
    },
    clear() {
      pending.clear();
    },
  };
}
