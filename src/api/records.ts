import { resolveApiPath, resolveRecordPath } from './blueprint';
import { cacheByKey } from './cache';
import { apiRequest } from './client';

/** A row from a blueprint's `dataApi`; its shape is described by the blueprint's columns. */
export type DataRecord = Record<string, unknown>;

/** Backend allows up to 500 per page; 100 keeps each response small. */
const PAGE_SIZE = 100;

/** Accepts either a bare array or a `{ records: [...] }` envelope. */
function toRecords(body: unknown): DataRecord[] {
  if (Array.isArray(body)) return body as DataRecord[];
  if (body && typeof body === 'object' && Array.isArray((body as { records?: unknown }).records)) {
    return (body as { records: DataRecord[] }).records;
  }
  return [];
}

/** Fetches every record by walking the paginated `dataApi` until a short page comes back. */
async function loadAll(dataApi: string): Promise<DataRecord[]> {
  const path = resolveApiPath(dataApi);
  const sep = path.includes('?') ? '&' : '?';
  const all: DataRecord[] = [];
  for (let page = 0; ; page++) {
    const batch = toRecords(await apiRequest<unknown>(`${path}${sep}page=${page}&size=${PAGE_SIZE}`));
    all.push(...batch);
    if (batch.length < PAGE_SIZE) return all;
  }
}

const recordsCache = cacheByKey(loadAll);
// Dropdown options: the blueprint's `api` already carries its own page/size.
const optionsCache = cacheByKey(async (api: string) => toRecords(await apiRequest<unknown>(resolveApiPath(api))));

/** Cached per `dataApi`: revisiting a page reuses the last result instead of refetching. */
export const fetchRecords = recordsCache.get;
/** Makes the next `fetchRecords(dataApi)` hit the backend, e.g. after a save or delete. */
export const invalidateRecords = recordsCache.invalidate;
/** Options for a blueprint dropdown, cached per `api`. */
export const fetchOptions = optionsCache.get;

export function clearRecordsCache() {
  recordsCache.clear();
  optionsCache.clear();
}

/** POST a new record to a form blueprint's `createApi`. */
export function createRecord(createApi: string, body: FormData) {
  return apiRequest<unknown>(resolveApiPath(createApi), { method: 'POST', body });
}

/** PUT changes to a record through a form blueprint's `dataApi`. */
export function updateRecord(dataApi: string, recordId: string, body: Record<string, unknown>) {
  return apiRequest<unknown>(resolveRecordPath(dataApi, recordId), { method: 'PUT', body });
}

/** DELETE a record through a row action's `dataApi`. */
export function deleteRecord(dataApi: string, recordId: string) {
  return apiRequest<unknown>(resolveRecordPath(dataApi, recordId), { method: 'DELETE' });
}
