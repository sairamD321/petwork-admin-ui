import { useCallback, useEffect, useState } from 'react';
import {
  fetchDataTableBlueprint,
  fetchSearchBlueprint,
  type DataTableBlueprint,
  type SearchField,
} from '../../api/blueprint';
import { fetchRecords, invalidateRecords, type DataRecord } from '../../api/records';

export type DataTableState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      blueprint: DataTableBlueprint;
      records: DataRecord[];
      /** Fields the search box covers (`quickSearchFilter` in the search blueprint). */
      quickSearchFields: SearchField[];
    };

/** Loads the table blueprint, then the records from its `dataApi`, plus the optional search blueprint. */
export function useDataTable(tableBlueprintUrl: string, searchBlueprintUrl?: string | null) {
  const [state, setState] = useState<DataTableState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const table = fetchDataTableBlueprint(tableBlueprintUrl).then(async (blueprint) => ({
      blueprint,
      records: await fetchRecords(blueprint.dataApi),
    }));
    // Search is optional: if its blueprint fails, still show the table without a search box.
    const search = searchBlueprintUrl
      ? fetchSearchBlueprint(searchBlueprintUrl)
          .then((bp) => (bp.searchForm ?? []).filter((f) => f.quickSearchFilter))
          .catch(() => [])
      : Promise.resolve([]);

    Promise.all([table, search])
      .then(([{ blueprint, records }, quickSearchFields]) => {
        if (!cancelled) setState({ status: 'ready', blueprint, records, quickSearchFields });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Could not load this page.',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tableBlueprintUrl, searchBlueprintUrl, attempt]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  /** Refetch records after a change, keeping the current list on screen until they arrive. */
  const dataApi = state.status === 'ready' ? state.blueprint.dataApi : undefined;
  const refresh = useCallback(() => {
    if (dataApi) invalidateRecords(dataApi);
    setAttempt((n) => n + 1);
  }, [dataApi]);

  return { state, reload, refresh };
}
