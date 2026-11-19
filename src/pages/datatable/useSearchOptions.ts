import { useEffect, useState } from 'react';
import type { SearchField } from '../../api/blueprint';
import { fetchOptions } from '../../api/records';
import { isDropdown, toOptions, type SearchOption } from './quickSearch';

/** Options for a dropdown search field: from its `api` when set, else its `staticDropDownValues`. */
export function useSearchOptions(field: SearchField | undefined) {
  const [remote, setRemote] = useState<{ api: string; options: SearchOption[]; failed: boolean } | null>(null);
  const api = field && isDropdown(field) ? field.api?.trim() : undefined;

  useEffect(() => {
    if (!api || !field) return;
    let cancelled = false;
    fetchOptions(api)
      .then((rows) => {
        if (!cancelled) setRemote({ api, options: toOptions(field, rows), failed: false });
      })
      .catch(() => {
        if (!cancelled) setRemote({ api, options: [], failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [api, field]);

  if (!field || !isDropdown(field)) return { options: [], failed: false };
  if (api) return remote?.api === api ? remote : { options: [], failed: false };
  return { options: toOptions(field, field.staticDropDownValues ?? []), failed: false };
}
