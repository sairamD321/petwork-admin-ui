import type { SearchField } from '../../api/blueprint';

/** The value typed or picked per quick-search field, keyed by `SearchField.field`. */
export type QuickSearch = Record<string, string>;

export interface SearchOption {
  value: string;
  label: string;
}

export const isDropdown = (f: SearchField) => f.fieldType === 'dropDown' || f.fieldType === 'cascadeDropDown';

/** Turns option rows into `{ value, label }` using the field's `dropdownCode` / `dropdownValue`. */
export function toOptions(f: SearchField, rows: Record<string, unknown>[]): SearchOption[] {
  const code = f.dropdownCode ?? 'code';
  const name = f.dropdownValue ?? 'name';
  return rows
    .filter((r) => r[code] !== undefined && r[code] !== null)
    .map((r) => ({ value: String(r[code]), label: String(r[name] ?? r[code]) }));
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
