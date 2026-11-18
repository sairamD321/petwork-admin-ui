import { Group, Paper, SegmentedControl, SimpleGrid, Text, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
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
import RecordCard from './RecordCard';
import RecordTable from './RecordTable';
import RowActions from './RowActions';

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
  const [search, setSearch] = useState('');

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

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) =>
      quickSearchFields.some((f) => formatValue(r[f.field]).toLowerCase().includes(q)),
    );
  }, [records, search, quickSearchFields]);

  const modes = blueprint.availableDisplayModes ?? [];
  const showModeSwitch = !!blueprint.enableMultipleDisplayModes && modes.length > 1;
  const showSearch = quickSearchFields.length > 0;

  return (
    <Paper withBorder radius="lg" p="lg">
      {(showSearch || showModeSwitch) && (
        <Group justify="space-between" mb="lg" gap="sm">
          {showSearch && (
            <TextInput
              placeholder={`Search by ${quickSearchFields.map((f) => f.displayName).join(', ')}...`}
              leftSection={<IconSearch size={18} />}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              variant="unstyled"
              style={{ flex: 1, minWidth: 160 }}
              aria-label="Search"
            />
          )}
          {showModeSwitch && (
            <SegmentedControl value={mode} onChange={(v) => setMode(v as DisplayMode)} data={modes} />
          )}
        </Group>
      )}

      {visible.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          {records.length === 0 ? 'Nothing here yet.' : 'No results match your search.'}
        </Text>
      ) : mode === 'cards' ? (
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
    </Paper>
  );
}
