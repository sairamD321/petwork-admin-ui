import { useCallback, useEffect, useState } from 'react';
import {
  fetchDataTableBlueprint,
  fetchSearchBlueprint,
  type DataTableBlueprint,
  type SearchField,
} from '../../api/blueprint';
import { fetchRecords, type DataRecord } from '../../api/records';

export type DataTableState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      blueprint: DataTableBlueprint;
      records: DataRecord[];
      page: number;
      hasNext: boolean;
      /** Fields shown in the search bar (`quickSearchFilter: true` in the search blueprint). */
      quickSearchFields: SearchField[];
      /** Every other search field; these live behind the bar's "More filters" button. */
      moreFilterFields: SearchField[];
    };

/** Loads the table blueprint, then the records from its `dataApi`, plus the optional search blueprint. */
export function useDataTable(tableBlueprintUrl: string, searchBlueprintUrl?: string | null) {
  const [state, setState] = useState<DataTableState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const table = fetchDataTableBlueprint(tableBlueprintUrl).then(async (blueprint) => ({
      blueprint,
      result: await fetchRecords(blueprint.dataApi, page),
    }));
    // Search is optional: if its blueprint fails, still show the table without a search box.
    const search = searchBlueprintUrl
      ? fetchSearchBlueprint(searchBlueprintUrl)
          .then((bp) => bp.searchForm ?? [])
          .catch((): SearchField[] => [])
      : Promise.resolve<SearchField[]>([]);

    Promise.all([table, search])
      .then(([{ blueprint, result }, searchFields]) => {
        if (!cancelled) {
          setState({
            status: 'ready',
            blueprint,
            records: result.records,
            page,
            hasNext: result.hasNext,
            quickSearchFields: searchFields.filter((f) => f.quickSearchFilter === true),
            moreFilterFields: searchFields.filter((f) => f.quickSearchFilter !== true),
          });
        }
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
  }, [tableBlueprintUrl, searchBlueprintUrl, attempt, page]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setPage(0);
    setAttempt((n) => n + 1);
  }, []);

  /** Refetch records after a change, keeping the current list on screen until they arrive. */
  const refresh = useCallback(() => {
    setPage(0);
    setAttempt((n) => n + 1);
  }, []);

  const goToPage = useCallback((nextPage: number) => {
    if (nextPage >= 0) setPage(nextPage);
  }, []);

  const pageLoading = state.status === 'ready' && state.page !== page;

  return { state, reload, refresh, goToPage, pageLoading };
}
