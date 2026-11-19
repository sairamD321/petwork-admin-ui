import { resolveApiPath, resolveRecordPath } from './blueprint';
import { cacheByKey } from './cache';
import { apiRequest } from './client';

/** A row from a blueprint's `dataApi`; its shape is described by the blueprint's columns. */
export type DataRecord = Record<string, unknown>;

export interface RecordPage {
  records: DataRecord[];
  hasNext: boolean;
}

const PAGE_SIZE = 20;

/** Accepts either a bare array or a `{ records: [...] }` envelope. */
function toRecords(body: unknown): DataRecord[] {
  if (Array.isArray(body)) return body as DataRecord[];
  if (body && typeof body === 'object' && Array.isArray((body as { records?: unknown }).records)) {
    return (body as { records: DataRecord[] }).records;
  }
  return [];
}

function toRecordPage(body: unknown, page: number): RecordPage {
  const records = toRecords(body);
  let hasNext = records.length === PAGE_SIZE;

  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const metadata = body as { hasNext?: unknown; totalPages?: unknown; total?: unknown };
    if (typeof metadata.hasNext === 'boolean') {
      hasNext = metadata.hasNext;
    } else if (typeof metadata.totalPages === 'number') {
      hasNext = page + 1 < metadata.totalPages;
    } else if (typeof metadata.total === 'number') {
      hasNext = (page + 1) * PAGE_SIZE < metadata.total;
    }
  }

  return { records, hasNext };
}

async function loadRecordsPage(url: string): Promise<RecordPage> {
  const query = url.slice(url.indexOf('?') + 1);
  const page = Number(new URLSearchParams(query).get('page') ?? 0);
  return toRecordPage(await apiRequest<unknown>(url), page);
}

const recordsCache = cacheByKey(loadRecordsPage);
const pageCacheKeys = new Map<string, Set<string>>();

function recordsPageUrl(dataApi: string, page: number): string {
  const path = resolveApiPath(dataApi);
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}page=${page}&size=${PAGE_SIZE}`;
}

/** Fetches and caches one page of records. */
export function fetchRecords(dataApi: string, page: number): Promise<RecordPage> {
  const url = recordsPageUrl(dataApi, page);
  let keys = pageCacheKeys.get(dataApi);
  if (!keys) {
    keys = new Set();
    pageCacheKeys.set(dataApi, keys);
  }
  keys.add(url);
  return recordsCache.get(url);
}

/** Invalidates all cached pages for one data endpoint after a mutation. */
export function invalidateRecords(dataApi: string) {
  pageCacheKeys.get(dataApi)?.forEach((key) => recordsCache.invalidate(key));
  pageCacheKeys.delete(dataApi);
}

// Dropdown options: the blueprint's `api` already carries its own page/size.
const optionsCache = cacheByKey(async (api: string) => toRecords(await apiRequest<unknown>(resolveApiPath(api))));

/** Options for a blueprint dropdown, cached per `api`. */
export const fetchOptions = optionsCache.get;

export function clearRecordsCache() {
  recordsCache.clear();
  pageCacheKeys.clear();
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
