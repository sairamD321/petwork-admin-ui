import { Checkbox, FileInput, Select, TextInput } from '@mantine/core';
import { useEffect, useState } from 'react';
import type { FormFieldDef } from '../../api/blueprint';
import { fetchOptions } from '../../api/records';
import { ruleOf, type FieldValue } from './formRules';
import SlidingRadio from './SlidingRadio';

export interface FormFieldProps {
  field: FormFieldDef;
  value: FieldValue;
  error?: string;
  disabled?: boolean;
  /** Extra help text, e.g. why a field is disabled. */
  note?: string;
  onChange: (value: FieldValue) => void;
}

/** Common label props; the tooltip is shown only when it adds something to the label. */
function labelProps(f: FormFieldDef, error?: string, note?: string) {
  const hint = f.toolTip && f.toolTip !== f.displayName ? f.toolTip : undefined;
  return { label: f.displayName, description: note ?? hint, withAsterisk: !!ruleOf(f).mandatory, error };
}

function DropdownField({ field, value, error, disabled, onChange }: FormFieldProps) {
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [failed, setFailed] = useState(false);
  const code = field.dropdownCode ?? 'code';
  const name = field.dropdownValue ?? 'name';

  useEffect(() => {
    if (!field.api) return;
    let cancelled = false;
    fetchOptions(field.api)
      .then((rows) => {
        if (!cancelled) {
          setOptions(rows.map((r) => ({ value: String(r[code]), label: String(r[name] ?? r[code]) })));
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [field.api, code, name]);

  return (
    <Select
      {...labelProps(field, error ?? (failed ? 'Could not load options' : undefined))}
      placeholder={field.placeholder || `Select ${field.displayName.toLowerCase()}`}
      data={options}
      value={typeof value === 'string' && value ? value : null}
      onChange={(v) => onChange(v ?? '')}
      searchable
      disabled={disabled}
      nothingFoundMessage="No matches"
    />
  );
}

/** Renders one blueprint field by its `fieldType`. Repeatable groups are handled separately. */
export default function FormField(props: FormFieldProps) {
  const { field, value, error, disabled, note, onChange } = props;
  const rule = ruleOf(field);

  switch (field.fieldType) {
    case 'radioButton':
      return (
        <SlidingRadio
          {...labelProps(field, error, note)}
          options={(field.values ?? []).map((v) => v.radioValue)}
          value={String(value ?? '')}
          disabled={disabled}
          onChange={onChange}
        />
      );
    case 'dropDown':
    case 'cascadeDropDown':
      return <DropdownField {...props} />;
    case 'checkBox':
      return (
        <Checkbox
          label={field.displayName}
          description={note}
          error={error}
          checked={value === true}
          disabled={disabled}
          onChange={(e) => onChange(e.currentTarget.checked)}
        />
      );
    case 'fileUpload': {
      const accept = rule.allowValues
        ?.split(',')
        .map((e) => `.${e.trim()}`)
        .join(',');
      const common = { ...labelProps(field, error, note), accept, clearable: true, disabled };
      return rule.multiple ? (
        <FileInput
          {...common}
          multiple
          placeholder="Choose files"
          value={Array.isArray(value) ? (value as File[]) : []}
          onChange={(files) => onChange(files)}
        />
      ) : (
        <FileInput
          {...common}
          placeholder="Choose a file"
          value={value instanceof File ? value : null}
          onChange={(file) => onChange(file)}
        />
      );
    }
    default:
      return (
        <TextInput
          {...labelProps(field, error, note)}
          placeholder={field.placeholder}
          value={typeof value === 'string' ? value : ''}
          maxLength={rule.maxSize && !Number.isNaN(Number(rule.maxSize)) ? Number(rule.maxSize) : undefined}
          disabled={disabled}
          onChange={(e) => onChange(e.currentTarget.value)}
        />
      );
  }
}
