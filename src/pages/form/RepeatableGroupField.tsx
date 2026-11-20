import { ActionIcon, Box, Button, Group, Paper, SimpleGrid, Stack, Text, Tooltip } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import type { FormFieldDef } from '../../api/blueprint';
import ExistingImages from './ExistingImages';
import FormField from './FormField';
import { newGroupItem, rowImages, ruleOf, type FormErrors, type GroupItem } from './formRules';

interface RepeatableGroupFieldProps {
  group: FormFieldDef;
  items: GroupItem[];
  errors: FormErrors;
  disabled?: boolean;
  /** Omit the group title when the surrounding card already shows it. */
  hideLabel?: boolean;
  onChange: (items: GroupItem[]) => void;
}

/** A list of child-field rows (e.g. sizes/variants) with add and remove. */
export default function RepeatableGroupField({
  group,
  items,
  errors,
  disabled,
  hideLabel,
  onChange,
}: RepeatableGroupFieldProps) {
  const rule = ruleOf(group);
  const min = Number(rule.minItems) || 0;
  const max = Number(rule.maxItems) || Infinity;
  const children = group.childFields ?? [];

  function setChild(index: number, field: string, value: string | boolean) {
    onChange(
      items.map((item, i) => {
        if (i === index) return { ...item, [field]: value };
        // `singleTrueField`: turning one on turns the others off.
        if (field === rule.singleTrueField && value === true) return { ...item, [field]: false };
        return item;
      }),
    );
  }

  return (
    <Stack gap="xs">
      {!hideLabel && (
        <Text size="sm" fw={500}>
          {group.displayName}
          {rule.mandatory && <Text span c="red"> *</Text>}
        </Text>
      )}

      {items.map((item, i) => (
        <Paper key={i} withBorder p="sm" radius="md">
          <Group justify="space-between" mb="xs">
            <Text size="xs" c="dimmed">
              #{i + 1}
            </Text>
            <Tooltip label="Remove">
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label="Remove"
                disabled={disabled || items.length <= min}
                onClick={() => onChange(items.filter((_, j) => j !== i))}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
          {rowImages(item).length > 0 && (
            <Box mb="sm">
              <ExistingImages urls={rowImages(item)} label="Images" size={72} />
            </Box>
          )}
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
            {children.map((c) => (
              <FormField
                key={c.field}
                field={c}
                value={item[c.field] ?? ''}
                error={errors[`${group.field}.${i}.${c.field}`]}
                disabled={disabled}
                onChange={(v) => setChild(i, c.field, typeof v === 'boolean' ? v : String(v ?? ''))}
              />
            ))}
          </SimpleGrid>
        </Paper>
      ))}

      {errors[group.field] && (
        <Text size="xs" c="red">
          {errors[group.field]}
        </Text>
      )}

      <Group>
        <Button
          variant="light"
          size="xs"
          leftSection={<IconPlus size={14} />}
          disabled={disabled || items.length >= max}
          onClick={() => onChange([...items, newGroupItem(group)])}
        >
          {group.addButtonLabel || 'Add'}
        </Button>
      </Group>
    </Stack>
  );
}
