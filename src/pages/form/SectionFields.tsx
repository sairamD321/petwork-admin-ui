import { Grid } from '@mantine/core';
import type { FormFieldDef } from '../../api/blueprint';
import FormField from './FormField';
import { isWideField } from './formLayout';
import type { GroupItem } from './formRules';
import RepeatableGroupField from './RepeatableGroupField';
import type { useBlueprintForm } from './useBlueprintForm';

interface SectionFieldsProps {
  fields: FormFieldDef[];
  form: ReturnType<typeof useBlueprintForm>;
  editing: boolean;
  /** Narrow columns stack every field full width. */
  narrow?: boolean;
}

/** The inputs of one form card. */
export default function SectionFields({ fields, form, editing, narrow }: SectionFieldsProps) {
  return (
    <Grid gap="md">
      {fields.map((f, i) => {
        // Fields not marked editable can only be set when creating.
        const locked = form.saving || (editing && f.editable === false);
        const fileOnEdit = editing && f.fieldType === 'fileUpload';
        const span = narrow || isWideField(f) ? 12 : { base: 12, sm: 6 };

        return (
          <Grid.Col key={`${f.field}-${i}`} span={span}>
            {f.fieldType === 'repeatableGroup' ? (
              <RepeatableGroupField
                group={f}
                items={(form.values[f.field] as GroupItem[]) ?? []}
                errors={form.errors}
                disabled={locked}
                hideLabel
                onChange={(items) => form.setValue(f.field, items)}
              />
            ) : (
              <FormField
                field={f}
                value={form.values[f.field] ?? null}
                error={form.errors[f.field]}
                disabled={locked || fileOnEdit}
                note={fileOnEdit ? "Images can't be changed while editing yet." : undefined}
                onChange={(v) => form.setValue(f.field, v)}
              />
            )}
          </Grid.Col>
        );
      })}
    </Grid>
  );
}
