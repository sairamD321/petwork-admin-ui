import { useEffect, useMemo, useState } from 'react';
import { fetchEditFormBlueprint, recordIdOf, type EditFormBlueprint } from '../../api/blueprint';
import { createRecord, fetchFormData, fetchRecord, updateRecord, type DataRecord } from '../../api/records';
import {
  defaultValue,
  dependsOn,
  existingImages,
  initialValues,
  prefillRecord,
  toFormData,
  toJson,
  usesMultipart,
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

/** A `dataApi` with a placeholder other than `{version}` (e.g. `{recordId}`) needs a record to call. */
const needsRecord = (api: string) => /\{(?!version\})[^}]+\}/i.test(api);

/** Loads a form blueprint and owns its values, validation and save. */
export function useBlueprintForm({ blueprintApi, record, fallbackRecordId, onSaved }: Options) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [values, setValues] = useState<FormValues>({});
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [prefillError, setPrefillError] = useState<string | null>(null);

  // When editing: the row from the table, overlaid with the full details from the form's `dataApi`.
  const [details, setDetails] = useState<DataRecord | undefined>(record);

  useEffect(() => {
    let cancelled = false;
    fetchEditFormBlueprint(blueprintApi)
      .then(async (blueprint) => {
        let full = record;
        const recordId = record ? (recordIdOf(blueprint.mappings, record) ?? fallbackRecordId) : undefined;
        if (record && blueprint.dataApi && recordId) {
          // GET {dataApi} with the record id; if it fails, prefill from the table row instead.
          full = await fetchRecord(blueprint.dataApi, recordId)
            .then((fetched) => ({ ...record, ...fetched }))
            .catch(() => record);
        } else if (!record && blueprint.dataApi && !needsRecord(blueprint.dataApi)) {
          // Opened without a record (e.g. the "Transfer" header button): GET {dataApi} and prefill from it,
          // e.g. the transfer cart's items into the form's items group. Saving still POSTs to `createApi`.
          full = await fetchFormData(blueprint.dataApi)
            .then((body) => prefillRecord(blueprint.editForm ?? [], body))
            .catch((err: unknown) => {
              if (!cancelled) setPrefillError(message(err, 'Could not load the data for this form.'));
              return undefined;
            });
        }
        if (cancelled) return;
        setDetails(full);
        setValues(initialValues(blueprint.editForm ?? [], full));
        setLoad({ status: 'ready', blueprint });
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoad({ status: 'error', message: message(err, 'Could not load the form.') });
      });
    return () => {
      cancelled = true;
    };
  }, [blueprintApi, record, fallbackRecordId]);

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
    setValues(initialValues(fields, details));
    setErrors({});
    setSaveError(null);
  }

  async function submit() {
    if (load.status !== 'ready') return;
    const found = validate(fields, values);
    setErrors(found);
    if (Object.keys(found).length) return;

    const { createApi, mappings } = load.blueprint;
    const recordId = details ? (recordIdOf(mappings, details) ?? fallbackRecordId) : undefined;
    setSaving(true);
    setSaveError(null);
    // Forms with file fields (e.g. products with variant images) are multipart endpoints; the rest read JSON.
    const body = usesMultipart(fields) ? toFormData(fields, values) : toJson(fields, values);
    try {
      if (!record) {
        if (!createApi) throw new Error('This form has no create API in its blueprint.');
        await createRecord(createApi, body);
      } else {
        // Edits are saved with a PATCH to the same `createApi`; `dataApi` is only used to prefill the form.
        if (!createApi) throw new Error('This form has no create API in its blueprint.');
        await updateRecord(createApi, recordId, body);
      }
      onSaved();
    } catch (err) {
      setSaveError(message(err, 'Could not save.'));
    } finally {
      setSaving(false);
    }
  }

  /** Product-level image URLs from the fetched details, per file-upload field (edit only). */
  const images = useMemo(() => existingImages(fields, details), [fields, details]);

  return { load, fields, values, errors, setValue, reset, submit, saving, saveError, prefillError, images };
}
