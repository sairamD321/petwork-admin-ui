import { Button, Center, Group, Loader, Paper, SegmentedControl, SimpleGrid, Text } from '@mantine/core';
import { useMemo, useState } from 'react';
import {
  recordIdOf,
  type BlueprintAction,
  type DataTableBlueprint,
  type DisplayMode,
  type SearchField,
} from '../../api/blueprint';
import type { DataRecord } from '../../api/records';
import { formatValue, isImageUrl } from './cellValue';
import { activeFilters, isDropdown, type QuickSearch } from './quickSearch';
import QuickSearchBar from './QuickSearchBar';
import RecordCard from './RecordCard';
import RecordTable from './RecordTable';
import RowActions from './RowActions';
import { useSearchResults } from './useSearchResults';

interface DataTableViewProps {
  blueprint: DataTableBlueprint;
  records: DataRecord[];
  quickSearchFields: SearchField[];
  /** A row action was clicked; `name` is the record's display title. */
  onRowAction: (action: BlueprintAction, record: DataRecord, name: string) => void;
}

const GRID_COLS = { base: 2, sm: 3, md: 4, lg: 6 };

/** Renders records exactly as the blueprint describes: columns, display mode and search fields. */
export default function DataTableView({ blueprint, records, quickSearchFields, onRowAction }: DataTableViewProps) {
  const [mode, setMode] = useState<DisplayMode>(blueprint.defaultDisplayMode ?? 'table');
  const [search, setSearch] = useState<QuickSearch>({});

  const columns = useMemo(() => blueprint.dataGrid.filter((c) => c.display !== false), [blueprint]);

  // For cards: the first column holding image URLs becomes the picture, the next one the title.
  const imageField = useMemo(
    () => columns.find((c) => records.some((r) => isImageUrl(r[c.field])))?.field,
    [columns, records],
  );
  const titleField = columns.find((c) => c.field !== imageField)?.field;
  const cardColumns = columns.filter(
    (c) => c.field !== imageField && c.field !== titleField && c.mobileDisplay !== false,
  );

  const rowKey = (r: DataRecord, i: number) => recordIdOf(blueprint.mappings, r) ?? String(i);
  const titleOf = (r: DataRecord) => (titleField ? formatValue(r[titleField]) : '');

  const rowActions = blueprint.rowLevelactions ?? [];
  const renderActions = rowActions.length
    ? (r: DataRecord) => <RowActions actions={rowActions} onAction={(a) => onRowAction(a, r, titleOf(r))} />
    : undefined;

  // Any active filter is sent to the backend: {dataApi}?field=value&page=0&size=20.
  const filters = useMemo(() => activeFilters(quickSearchFields, search), [quickSearchFields, search]);
  const typing = quickSearchFields.some((f) => !isDropdown(f) && filters[f.field] !== undefined);
  // `records` changes after a save/delete refresh, which refetches the search too.
  const { results, loadMore } = useSearchResults(blueprint.dataApi, filters, typing, records);

  const visible =
    results.status === 'idle' ? records
    : results.status === 'error' ? []
    : (results.records ?? []);
  const loading = results.status === 'loading';
  const resultHint =
    results.status === 'loading' ? 'Searching...'
    : results.status === 'error' ? 'Search failed'
    : results.status === 'ready'
      ? `${results.records.length}${results.hasMore ? '+' : ''} result${results.records.length === 1 ? '' : 's'}`
    : undefined;

  const modes = blueprint.availableDisplayModes ?? [];
  const showModeSwitch = !!blueprint.enableMultipleDisplayModes && modes.length > 1;
  const showSearch = quickSearchFields.length > 0;

  return (
    <Paper withBorder radius="lg" p="lg">
      {(showSearch || showModeSwitch) && (
        <Group justify="space-between" align="flex-start" mb="lg" gap="sm" wrap="nowrap">
          {showSearch && (
            <QuickSearchBar
              fields={quickSearchFields}
              search={search}
              onChange={setSearch}
              resultHint={resultHint}
            />
          )}
          {showModeSwitch && (
            <SegmentedControl value={mode} onChange={(v) => setMode(v as DisplayMode)} data={modes} />
          )}
        </Group>
      )}

      {results.status === 'error' ? (
        <Text c="red" ta="center" py="xl">
          {results.message}
        </Text>
      ) : loading && !results.records ? (
        <Center py="xl">
          <Loader size="sm" />
        </Center>
      ) : visible.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          {results.status === 'idle' ? 'Nothing here yet.' : 'No results match your search.'}
        </Text>
      ) : (
        // Previous results stay visible, dimmed, while a new search loads.
        <div style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 200ms ease' }}>
          {mode === 'cards' ? (
            <SimpleGrid cols={GRID_COLS} spacing="lg" verticalSpacing="xl">
              {visible.map((r, i) => (
                <RecordCard
                  key={rowKey(r, i)}
                  title={titleOf(r)}
                  imageUrl={imageField && isImageUrl(r[imageField]) ? r[imageField] : undefined}
                  fields={cardColumns.map((c) => ({ label: c.displayName, value: r[c.field] }))}
                  actions={renderActions?.(r)}
                />
              ))}
            </SimpleGrid>
          ) : (
            <RecordTable columns={columns} records={visible} rowKey={rowKey} renderActions={renderActions} />
          )}
        </div>
      )}

      {results.status === 'ready' && results.hasMore && (
        <Center mt="lg">
          <Button variant="light" onClick={loadMore} loading={results.loadingMore}>
            Load more
          </Button>
        </Center>
      )}
    </Paper>
  );
}
