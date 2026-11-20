/**
 * No caching: every call goes to the backend for fresh data.
 *
 * The only sharing is while a request is still in flight: callers asking for the same key at the
 * same moment (e.g. the side nav and the page both loading the menu, or React StrictMode's double
 * effects in dev) get that one request. The moment it settles it is forgotten, so the next call
 * fetches again. Nothing is ever kept.
 */
export function shareInFlight<T>(load: (key: string) => Promise<T>): (key: string) => Promise<T> {
  const inFlight = new Map<string, Promise<T>>();

  return (key: string) => {
    const running = inFlight.get(key);
    if (running) return running;
    const request = load(key).finally(() => inFlight.delete(key));
    inFlight.set(key, request);
    return request;
  };
}
