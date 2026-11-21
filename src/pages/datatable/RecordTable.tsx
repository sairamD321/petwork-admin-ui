import { Badge, Box, Image, Table, Text } from '@mantine/core';
import type { ReactNode } from 'react';
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

/** Same look as the card picture: the whole image visible on a soft background. */
function Thumbnail({ src }: { src: string }) {
  return (
    <Box className={classes.thumb}>
      <Image src={src} alt="" w="100%" h="100%" fit="contain" loading="lazy" />
    </Box>
  );
}

/** One cell's content: yes/no flags as coloured pills, empty values dimmed, the rest as text. */
function CellValue({ value }: { value: unknown }) {
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
  return (
    <Text size="sm" lineClamp={2} style={{ fontVariantNumeric: 'tabular-nums' }}>
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
                      {image ? <Thumbnail src={image} /> : <CellValue value={value} />}
                    </Table.Td>
                  );
                })}
                {renderActions && (
                  <Table.Td className={classes.td} ta="right">
                    {renderActions(record)}
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
