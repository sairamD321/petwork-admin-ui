import type { SearchField } from '../../api/blueprint';

/** The value typed or picked per quick-search field, keyed by `SearchField.field`. */
export type QuickSearch = Record<string, string>;

export interface SearchOption {
  value: string;
  label: string;
}

export const isDropdown = (f: SearchField) => f.fieldType === 'dropDown' || f.fieldType === 'cascadeDropDown';

/**
 * Turns option rows into `{ value, label }` using the field's `dropdownCode` / `dropdownValue`.
 * Duplicate values are dropped: the backend can repeat entries (e.g. brands), and Mantine's Select
 * throws on duplicates, which blanks the whole page.
 */
export function toOptions(f: SearchField, rows: Record<string, unknown>[]): SearchOption[] {
  const code = f.dropdownCode ?? 'code';
  const name = f.dropdownValue ?? 'name';
  const seen = new Set<string>();
  const out: SearchOption[] = [];
  for (const r of rows) {
    if (r[code] === undefined || r[code] === null) continue;
    const value = String(r[code]);
    if (seen.has(value)) continue;
    seen.add(value);
    out.push({ value, label: String(r[name] ?? r[code]) });
  }
  return out;
}

/** Text searches only kick in once the blueprint's `minSize` is reached. */
export function minLength(f: SearchField | undefined): number {
  const min = Number(f?.rules?.[0]?.minSize);
  return f && !isDropdown(f) && min > 0 ? min : 1;
}

/** Whether a field's search value is complete enough to apply. */
export function isActive(f: SearchField, value: string | undefined): boolean {
  const q = value?.trim() ?? '';
  return q.length > 0 && q.length >= minLength(f);
}

/** The active filters as `{ field: value }`, ready to send as query params. Empty when nothing is applied. */
export function activeFilters(fields: SearchField[], search: QuickSearch): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    if (isActive(f, search[f.field])) out[f.field] = search[f.field].trim();
  }
  return out;
}
