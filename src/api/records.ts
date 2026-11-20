import { resolveApiPath, resolveRecordPath } from './blueprint';
import { shareInFlight } from './cache';
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

const loadRecordsPageShared = shareInFlight(loadRecordsPage);

function recordsPageUrl(dataApi: string, page: number): string {
  const path = resolveApiPath(dataApi);
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}page=${page}&size=${PAGE_SIZE}`;
}

/** Fetches one page of records, always fresh from the backend (not cached). */
export function fetchRecords(dataApi: string, page: number): Promise<RecordPage> {
  return loadRecordsPageShared(recordsPageUrl(dataApi, page));
}

/**
 * Options for a blueprint dropdown, always fresh from the backend (not cached).
 * The blueprint's `api` already carries its own page/size.
 */
export const fetchOptions = shareInFlight(async (api: string) => toRecords(await apiRequest<unknown>(resolveApiPath(api))));

/** Page size for filtered searches. */
export const SEARCH_PAGE_SIZE = 20;

/**
 * GET `{dataApi}?field=value&...&page={page}&size=20` — the backend does the filtering.
 * Not cached: filters change with every keystroke and results must stay fresh.
 */
export async function searchRecords(
  dataApi: string,
  filters: Record<string, string>,
  page: number,
): Promise<DataRecord[]> {
  const path = resolveApiPath(dataApi);
  const params = new URLSearchParams(filters);
  params.set('page', String(page));
  params.set('size', String(SEARCH_PAGE_SIZE));
  const sep = path.includes('?') ? '&' : '?';
  return toRecords(await apiRequest<unknown>(`${path}${sep}${params}`));
}

/** POST a new record to a form blueprint's `createApi`. */
export function createRecord(createApi: string, body: Record<string, unknown> | FormData) {
  return apiRequest<unknown>(resolveApiPath(createApi), { method: 'POST', body });
}

/**
 * GET one record's full details through a form blueprint's `dataApi`, for prefilling the edit form.
 * Accepts the record itself or an envelope: `{ records: [..] }`, `{ record }` or `{ data }`.
 */
export async function fetchRecord(dataApi: string, recordId: string): Promise<DataRecord> {
  const body = await apiRequest<unknown>(resolveRecordPath(dataApi, recordId));
  const isObject = (v: unknown): v is DataRecord => !!v && typeof v === 'object' && !Array.isArray(v);
  if (Array.isArray(body)) return isObject(body[0]) ? body[0] : {};
  if (!isObject(body)) return {};
  const records = body.records;
  if (Array.isArray(records)) return isObject(records[0]) ? records[0] : {};
  if (isObject(body.record)) return body.record;
  if (isObject(body.data)) return body.data;
  return body;
}

/** PATCH changes to a record through a form blueprint's `dataApi` (the backend's update routes are PATCH). */
export function updateRecord(dataApi: string, recordId: string, body: Record<string, unknown> | FormData) {
  return apiRequest<unknown>(resolveRecordPath(dataApi, recordId), { method: 'PATCH', body });
}

/** DELETE a record through a row action's `dataApi`. */
export function deleteRecord(dataApi: string, recordId: string) {
  return apiRequest<unknown>(resolveRecordPath(dataApi, recordId), { method: 'DELETE' });
}
