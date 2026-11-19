import { Avatar, Table, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import type { GridColumn } from '../../api/blueprint';
import type { DataRecord } from '../../api/records';
import { formatValue, isImageUrl } from './cellValue';

interface RecordTableProps {
  columns: GridColumn[];
  records: DataRecord[];
  rowKey: (record: DataRecord, index: number) => string;
  onRecordClick: (record: DataRecord) => void;
  /** Row-level action buttons; omit to hide the actions column. */
  renderActions?: (record: DataRecord) => ReactNode;
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
}: RecordTableProps) {
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
              style={{ cursor: 'pointer' }}
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
