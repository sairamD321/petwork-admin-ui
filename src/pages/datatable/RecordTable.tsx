import { Avatar, Table, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import type { GridColumn } from '../../api/blueprint';
import type { DataRecord } from '../../api/records';
import { formatValue, isImageUrl } from './cellValue';

interface RecordTableProps {
  columns: GridColumn[];
  records: DataRecord[];
  rowKey: (record: DataRecord, index: number) => string;
  /** Row-level action buttons; omit to hide the actions column. */
  renderActions?: (record: DataRecord) => ReactNode;
  /** Rows to highlight, e.g. search matches. */
  isHighlighted?: (record: DataRecord) => boolean;
}

/** Columns with `mobileDisplay: false` are hidden on small screens. */
function responsive(column: GridColumn) {
  return column.mobileDisplay === false ? { visibleFrom: 'sm' as const } : {};
}

export default function RecordTable({ columns, records, rowKey, renderActions, isHighlighted }: RecordTableProps) {
  return (
    <Table.ScrollContainer minWidth={600}>
      <Table verticalSpacing="sm" highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            {columns.map((c) => (
              <Table.Th key={c.field} {...responsive(c)}>
                {c.displayName}
              </Table.Th>
            ))}
            {renderActions && <Table.Th />}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {records.map((record, i) => (
            <Table.Tr
              key={rowKey(record, i)}
              bg={isHighlighted?.(record) ? 'var(--mantine-primary-color-light)' : undefined}
            >
              {columns.map((c) => {
                const value = record[c.field];
                return (
                  <Table.Td key={c.field} {...responsive(c)}>
                    {isImageUrl(value) ? (
                      <Avatar src={value} radius="sm" size={40} />
                    ) : (
                      <Text size="sm" lineClamp={2}>
                        {formatValue(value)}
                      </Text>
                    )}
                  </Table.Td>
                );
              })}
              {renderActions && <Table.Td ta="right">{renderActions(record)}</Table.Td>}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
