import { Badge, Box, Image, Table, Text } from '@mantine/core';
import type { CSSProperties, ReactNode } from 'react';
import type { GridColumn } from '../../api/blueprint';
import type { DataRecord } from '../../api/records';
import { formatValue, isImageUrl } from './cellValue';
import classes from './RecordTable.module.css';

interface RecordTableProps {
  columns: GridColumn[];
  records: DataRecord[];
  rowKey: (record: DataRecord, index: number) => string;
  onRecordClick: (record: DataRecord) => void;
  /** Row-level action buttons; omit to hide the actions column. */
  renderActions?: (record: DataRecord) => ReactNode;
  /** The picture column; when its value isn't an image URL, `imageOf` supplies one (as in cards). */
  imageField?: string;
  imageOf?: (record: DataRecord) => string | undefined;
}

/** How a column's values are drawn: codes as chips, types/statuses as coloured tags, the rest as text. */
type ColumnKind = 'code' | 'tag' | 'primary' | 'text';

const CODE_COLUMN = /code|sku|hsn|slug|(^|[^a-z])id$/i;
const TAG_COLUMN = /type|status|stage|gender|kind|level|group/i;

function columnKinds(columns: GridColumn[], imageField?: string): Record<string, ColumnKind> {
  const kinds: Record<string, ColumnKind> = {};
  let primaryTaken = false;
  for (const c of columns) {
    const name = `${c.field} ${c.displayName}`;
    if (CODE_COLUMN.test(name)) kinds[c.field] = 'code';
    else if (TAG_COLUMN.test(name)) kinds[c.field] = 'tag';
    else if (!primaryTaken && c.field !== imageField) {
      // The first plain text column (e.g. "Category", "Brand") reads as the row's name.
      kinds[c.field] = 'primary';
      primaryTaken = true;
    } else kinds[c.field] = 'text';
  }
  return kinds;
}

/** Same value, same colour, on every row and every page (Dog is always one colour, Cat another). */
const TAG_COLORS = ['indigo', 'teal', 'grape', 'orange', 'cyan', 'pink', 'lime', 'violet'];
function tagColor(text: string) {
  let hash = 0;
  for (const ch of text.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TAG_COLORS[hash % TAG_COLORS.length];
}

/** Same look as the card picture: the whole image visible on a soft background. */
function Thumbnail({ src }: { src: string }) {
  return (
    <Box className={classes.thumb}>
      <Image src={src} alt="" w="100%" h="100%" fit="contain" loading="lazy" />
    </Box>
  );
}

/** One cell's content: yes/no flags as coloured pills, empty values dimmed, the rest by column kind. */
function CellValue({ value, kind }: { value: unknown; kind: ColumnKind }) {
  if (typeof value === 'boolean') {
    return (
      <Badge
        variant="light"
        color={value ? 'teal' : 'gray'}
        radius="xl"
        size="md"
        tt="none"
        leftSection={<Box w={6} h={6} bg="currentColor" style={{ borderRadius: '50%' }} />}
      >
        {value ? 'Yes' : 'No'}
      </Badge>
    );
  }
  const text = formatValue(value);
  if (text === '—') {
    return (
      <Text size="sm" c="dimmed">
        —
      </Text>
    );
  }
  if (kind === 'code') {
    return <span className={classes.code}>{text}</span>;
  }
  if (kind === 'tag' && text.length <= 24) {
    return (
      <Badge variant="light" color={tagColor(text)} radius="xl" size="md" tt="none" className={classes.tag}>
        {text}
      </Badge>
    );
  }
  return (
    <Text
      size="sm"
      lineClamp={2}
      fw={kind === 'primary' ? 600 : undefined}
      className={kind === 'primary' ? classes.primary : undefined}
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {text}
    </Text>
  );
}

/** Columns with `mobileDisplay: false` are hidden on small screens. */
function responsive(column: GridColumn) {
  return column.mobileDisplay === false ? { visibleFrom: 'sm' as const } : {};
}

export default function RecordTable({
  columns,
  records,
  rowKey,
  onRecordClick,
  renderActions,
  imageField,
  imageOf,
}: RecordTableProps) {
  const kinds = columnKinds(columns, imageField);
  return (
    <Box className={classes.frame}>
      <Table.ScrollContainer minWidth={600} type="native">
        <Table withRowBorders={false}>
          <Table.Thead>
            <Table.Tr>
              {columns.map((c) => (
                <Table.Th key={c.field} className={classes.th} {...responsive(c)}>
                  {c.displayName}
                </Table.Th>
              ))}
              {renderActions && <Table.Th className={classes.th} aria-label="Actions" />}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {records.map((record, i) => (
              <Table.Tr
                key={rowKey(record, i)}
                className={classes.tr}
                // Rows fade in one after another (only the first dozen wait, so long lists stay quick).
                style={{ '--row-i': Math.min(i, 12) } as CSSProperties}
                tabIndex={0}
                aria-label="Edit record"
                onClick={() => onRecordClick(record)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onRecordClick(record);
                  }
                }}
              >
                {columns.map((c) => {
                  const value = record[c.field];
                  const image = isImageUrl(value) ? value : c.field === imageField ? imageOf?.(record) : undefined;
                  return (
                    <Table.Td key={c.field} className={classes.td} {...responsive(c)}>
                      {image ? <Thumbnail src={image} /> : <CellValue value={value} kind={kinds[c.field]} />}
                    </Table.Td>
                  );
                })}
                {renderActions && (
                  <Table.Td className={classes.td} ta="right">
                    <div className={classes.actions}>{renderActions(record)}</div>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Box>
  );
}
