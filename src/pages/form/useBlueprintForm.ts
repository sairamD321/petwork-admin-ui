import { useEffect, useState } from 'react';
import { fetchEditFormBlueprint, recordIdOf, type EditFormBlueprint } from '../../api/blueprint';
import { createRecord, updateRecord, type DataRecord } from '../../api/records';
import {
  defaultValue,
  dependsOn,
  initialValues,
  toFormData,
  toJson,
  validate,
  type FieldValue,
  type FormErrors,
  type FormValues,
} from './formRules';

interface Options {
  blueprintApi: string;
  /** Present when editing an existing record. */
  record?: DataRecord;
  /** The row's id from the table blueprint, used if the form's own id field isn't in the record. */
  fallbackRecordId?: string;
  onSaved: () => void;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; blueprint: EditFormBlueprint };

const message = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

/** Loads a form blueprint and owns its values, validation and save. */
export function useBlueprintForm({ blueprintApi, record, fallbackRecordId, onSaved }: Options) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [values, setValues] = useState<FormValues>({});
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchEditFormBlueprint(blueprintApi)
      .then((blueprint) => {
        if (cancelled) return;
        setValues(initialValues(blueprint.editForm ?? [], record));
        setLoad({ status: 'ready', blueprint });
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoad({ status: 'error', message: message(err, 'Could not load the form.') });
      });
    return () => {
      cancelled = true;
    };
  }, [blueprintApi, record]);

  const fields = load.status === 'ready' ? (load.blueprint.editForm ?? []) : [];

  /** Sets a value, resets fields that depend on it, and clears its errors. */
  function setValue(field: string, value: FieldValue) {
    setValues((prev) => {
      const next = { ...prev, [field]: value };
      for (const f of fields) if (dependsOn(f, field)) next[f.field] = defaultValue(f);
      return next;
    });
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) if (key === field || key.startsWith(`${field}.`)) delete next[key];
      return next;
    });
  }

  function reset() {
    setValues(initialValues(fields, record));
    setErrors({});
    setSaveError(null);
  }

  async function submit() {
    if (load.status !== 'ready') return;
    const found = validate(fields, values);
    setErrors(found);
    if (Object.keys(found).length) return;

    const { createApi, dataApi, mappings } = load.blueprint;
    const recordId = record ? (recordIdOf(mappings, record) ?? fallbackRecordId) : undefined;
    setSaving(true);
    setSaveError(null);
    try {
      if (!record) {
        if (!createApi) throw new Error('This form has no create API in its blueprint.');
        await createRecord(createApi, toFormData(fields, values));
      } else {
        if (!dataApi || !recordId) throw new Error('This form has no update API for this record.');
        await updateRecord(dataApi, recordId, toJson(fields, values));
      }
      onSaved();
    } catch (err) {
      setSaveError(message(err, 'Could not save.'));
    } finally {
      setSaving(false);
    }
  }

  return { load, fields, values, errors, setValue, reset, submit, saving, saveError };
}
