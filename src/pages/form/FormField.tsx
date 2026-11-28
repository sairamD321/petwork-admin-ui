import { Checkbox, Select, TextInput } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import type { FormFieldDef } from '../../api/blueprint';
import { fetchOptions } from '../../api/records';
import { ruleOf, type FieldValue } from './formRules';
import FileUploadField from './FileUploadField';
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
  return {
    label: f.displayName,
    description: note ?? hint,
    withAsterisk: !!ruleOf(f).mandatory,
    error,
    styles: alignedInputStyles,
  };
}

/**
 * Fill the grid cell and push the input box to the bottom, so inputs in the same row line up
 * even when one field's description wraps onto more lines than its neighbours'.
 */
const alignedInputStyles = {
  root: { display: 'flex', flexDirection: 'column', height: '100%' },
  wrapper: { marginTop: 'auto' },
} as const;

type Option = { value: string; label: string };

/** Rows (from `api` or `staticDropDownValues`) as options: `dropdownCode` is the value, `dropdownValue` the label. */
function toOptions(rows: Record<string, unknown>[], code: string, name: string): Option[] {
  return rows
    .filter((r) => r[code] !== undefined && r[code] !== null)
    .map((r) => ({ value: String(r[code]), label: String(r[name] ?? r[code]) }));
}

/** Options come from the field's `api` when it is set, else from its `staticDropDownValues`. */
function DropdownField({ field, value, error, disabled, onChange }: FormFieldProps) {
  const [remoteOptions, setRemoteOptions] = useState<Option[]>([]);
  const [failed, setFailed] = useState(false);
  const code = field.dropdownCode ?? 'code';
  const name = field.dropdownValue ?? 'name';
  const api = field.api?.trim();
  const staticOptions = useMemo(
    () => toOptions(field.staticDropDownValues ?? [], code, name),
    [field.staticDropDownValues, code, name],
  );
  const options = api ? remoteOptions : staticOptions;

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    fetchOptions(api)
      .then((rows) => {
        if (!cancelled) setRemoteOptions(toOptions(rows, code, name));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [api, code, name]);

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
      const { label, description, withAsterisk } = labelProps(field, error, note);
      // Picked files show as thumbnails; with `multiple`, each pick adds one more (e.g. sub images one by one).
      return (
        <FileUploadField
          label={label}
          description={description}
          error={error}
          required={withAsterisk}
          accept={accept}
          multiple={!!rule.multiple}
          disabled={disabled}
          value={rule.multiple ? (Array.isArray(value) ? (value as File[]) : []) : value instanceof File ? value : null}
          onChange={onChange}
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
