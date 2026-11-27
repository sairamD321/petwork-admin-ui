import { ActionIcon, Button, Group, Paper, SimpleGrid, Stack, Text, Tooltip } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import type { FormFieldDef } from '../../api/blueprint';
import ExistingImages from './ExistingImages';
import FormField from './FormField';
import { newGroupItem, removeRowImage, rowImages, ruleOf, type FieldValue, type FormErrors, type GroupItem } from './formRules';

interface RepeatableGroupFieldProps {
  group: FormFieldDef;
  items: GroupItem[];
  errors: FormErrors;
  disabled?: boolean;
  /** Omit the group title when the surrounding card already shows it. */
  hideLabel?: boolean;
  /** `nonrepeatableGroup`: exactly one row, no numbering, remove or add buttons. */
  single?: boolean;
  onChange: (items: GroupItem[]) => void;
}

/** What picking a file does to the images a row already has (the backend's update rules). */
const fileNote = (f: FormFieldDef) =>
  ruleOf(f).multiple ? 'New files are added to the current images.' : 'A new file replaces the current image.';

/** A list of child-field rows (e.g. sizes/variants) with add and remove; or, with `single`, one fixed row. */
export default function RepeatableGroupField({
  group,
  items,
  errors,
  disabled,
  hideLabel,
  single,
  onChange,
}: RepeatableGroupFieldProps) {
  const rule = ruleOf(group);
  const min = Number(rule.minItems) || 0;
  const max = Number(rule.maxItems) || Infinity;
  const children = group.childFields ?? [];
  const fieldChildren = children.filter((c) => c.fieldType !== 'fileUpload');
  const fileChildren = children.filter((c) => c.fieldType === 'fileUpload');

  function setChild(index: number, field: string, value: FieldValue) {
    // Files stay files; everything else is kept as text or a checkbox flag.
    const next: GroupItem[string] =
      value instanceof File || typeof value === 'boolean' || value === null
        ? value
        : Array.isArray(value)
          ? (value as File[])
          : String(value);
    onChange(
      items.map((item, i) => {
        if (i === index) return { ...item, [field]: next };
        // `singleTrueField`: turning one on turns the others off.
        if (field === rule.singleTrueField && next === true) return { ...item, [field]: false };
        return item;
      }),
    );
  }

  const childInput = (item: GroupItem, i: number, c: FormFieldDef, note?: string) => (
    <FormField
      key={c.field}
      field={c}
      value={(item[c.field] ?? (c.fieldType === 'fileUpload' ? null : '')) as FieldValue}
      error={errors[`${group.field}.${i}.${c.field}`]}
      disabled={disabled}
      note={note}
      onChange={(v) => setChild(i, c.field, v)}
    />
  );

  return (
    <Stack gap="xs">
      {!hideLabel && (
        <Text size="sm" fw={500}>
          {group.displayName}
          {rule.mandatory && <Text span c="red"> *</Text>}
        </Text>
      )}

      {items.map((item, i) => {
        const current = rowImages(item);
        return (
          // A single group sits straight in its card; repeatable rows each get a numbered box.
          <Paper key={i} withBorder={!single} p={single ? 0 : 'sm'} radius="md">
            {!single && (
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
            )}

            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              {fieldChildren.map((c) => childInput(item, i, c))}
            </SimpleGrid>

            {fileChildren.length > 0 && (
              <SimpleGrid cols={{ base: 1, sm: fileChildren.length > 1 ? 2 : 1 }} spacing="md" mt="md">
                {fileChildren.map((c, k) => {
                  const own = current.filter((r) => r.field === c.field);
                  return (
                    <Stack key={c.field} gap="xs">
                      <ExistingImages
                        images={own}
                        title={`Current ${c.displayName}`}
                        color={k === 0 ? 'indigo' : 'teal'}
                        size={72}
                        onRemove={
                          disabled
                            ? undefined
                            : (url) => onChange(items.map((it, j) => (j === i ? removeRowImage(it, url) : it)))
                        }
                      />
                      {childInput(item, i, c, own.length ? fileNote(c) : undefined)}
                    </Stack>
                  );
                })}
              </SimpleGrid>
            )}
          </Paper>
        );
      })}

      {errors[group.field] && (
        <Text size="xs" c="red">
          {errors[group.field]}
        </Text>
      )}

      {!single && (
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
      )}
    </Stack>
  );
}
