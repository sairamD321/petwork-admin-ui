import { useEffect, useRef, useState } from 'react';
import { SEARCH_PAGE_SIZE, searchRecords, type DataRecord } from '../../api/records';

/** Typing waits this long after the last keystroke; dropdown picks go out immediately. */
const TYPING_DELAY_MS = 350;

export type SearchResults =
  | { status: 'idle' }
  | { status: 'loading'; records?: DataRecord[] }
  | { status: 'error'; message: string }
  | { status: 'ready'; records: DataRecord[]; hasMore: boolean; loadingMore: boolean };

/**
 * Fetches `{dataApi}?field=value&page=0&size=20` from the backend whenever the filters change.
 * `debounce` delays the request while the user is still typing. `version` refetches after a save or delete.
 */
export function useSearchResults(
  dataApi: string,
  filters: Record<string, string>,
  debounce: boolean,
  version: unknown,
) {
  const [results, setResults] = useState<SearchResults>({ status: 'idle' });
  const [page, setPage] = useState(0);
  // Each request gets an id; responses from an older request are ignored.
  const requestId = useRef(0);
  const key = JSON.stringify(filters);
  const active = key !== '{}';

  useEffect(() => {
    const id = ++requestId.current;
    setPage(0);
    if (!active) {
      setResults({ status: 'idle' });
      return;
    }
    // Keep the previous results on screen (dimmed) while the new ones load.
    setResults((prev) => ({ status: 'loading', records: prev.status === 'ready' ? prev.records : undefined }));
    const timer = setTimeout(
      () => {
        searchRecords(dataApi, JSON.parse(key) as Record<string, string>, 0)
          .then((records) => {
            if (id === requestId.current) {
              setResults({ status: 'ready', records, hasMore: records.length === SEARCH_PAGE_SIZE, loadingMore: false });
            }
          })
          .catch((err: unknown) => {
            if (id === requestId.current) {
              setResults({ status: 'error', message: err instanceof Error ? err.message : 'Search failed.' });
            }
          });
      },
      debounce ? TYPING_DELAY_MS : 0,
    );
    return () => clearTimeout(timer);
    // `debounce` only shapes the delay; it must not trigger a request of its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataApi, key, active, version]);

  /** Appends the next page of 20. */
  function loadMore() {
    if (results.status !== 'ready' || !results.hasMore || results.loadingMore) return;
    const id = requestId.current;
    const next = page + 1;
    setResults({ ...results, loadingMore: true });
    searchRecords(dataApi, JSON.parse(key) as Record<string, string>, next)
      .then((more) => {
        if (id !== requestId.current) return;
        setPage(next);
        setResults((prev) =>
          prev.status === 'ready'
            ? { status: 'ready', records: [...prev.records, ...more], hasMore: more.length === SEARCH_PAGE_SIZE, loadingMore: false }
            : prev,
        );
      })
      .catch(() => {
        if (id === requestId.current) setResults((prev) => (prev.status === 'ready' ? { ...prev, loadingMore: false } : prev));
      });
  }

  return { results, loadMore };
}
