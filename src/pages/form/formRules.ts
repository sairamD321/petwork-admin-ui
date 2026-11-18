import type { FieldRule, FormFieldDef } from '../../api/blueprint';
import type { DataRecord } from '../../api/records';

export type GroupItem = Record<string, string | boolean>;
export type FieldValue = string | boolean | File | File[] | GroupItem[] | null;
export type FormValues = Record<string, FieldValue>;
/** Keyed by field, or `group.index.child` for repeatable group children. */
export type FormErrors = Record<string, string>;

export const ruleOf = (f: FormFieldDef): FieldRule => f.rules?.[0] ?? {};

// --- Visibility ---

/** Only `field.x == 'v'` / `field.x != 'v'` clauses joined by && and || are understood. */
const CLAUSE = /^field\.(\w+)\s*(==|!=)\s*'([^']*)'$/;

/** Evaluates `visibilityCriteria` without eval; an unreadable expression hides the field. */
export function isVisible(f: FormFieldDef, values: FormValues): boolean {
  const expr = f.visibilityCriteria?.trim();
  if (!expr) return true;
  return expr.split('||').some((any) =>
    any.split('&&').every((clause) => {
      const m = CLAUSE.exec(clause.trim());
      if (!m) return false;
      const actual = String(values[m[1]] ?? '');
      return m[2] === '==' ? actual === m[3] : actual !== m[3];
    }),
  );
}

export const visibleFields = (fields: FormFieldDef[], values: FormValues) =>
  fields.filter((f) => isVisible(f, values));

export function dependsOn(f: FormFieldDef, field: string): boolean {
  return !!f.valuesDependOnField?.split(',').some((d) => d.trim() === field);
}

// --- Initial values ---

function simpleDefault(f: FormFieldDef): string | boolean {
  const d = ruleOf(f).default ?? '';
  return f.fieldType === 'checkBox' ? d === 'true' : d;
}

export function newGroupItem(group: FormFieldDef): GroupItem {
  return Object.fromEntries((group.childFields ?? []).map((c) => [c.field, simpleDefault(c)]));
}

export function defaultValue(f: FormFieldDef): FieldValue {
  if (f.fieldType === 'fileUpload') return ruleOf(f).multiple ? [] : null;
  if (f.fieldType === 'repeatableGroup') {
    return Array.from({ length: Number(ruleOf(f).minItems) || 0 }, () => newGroupItem(f));
  }
  return simpleDefault(f);
}

function fromRecord(f: FormFieldDef, record: DataRecord): FieldValue | undefined {
  if (f.fieldType === 'fileUpload') return undefined; // files can't be prefilled
  if (f.fieldType === 'repeatableGroup') {
    const children = f.childFields ?? [];
    if (!children.some((c) => record[c.field] != null)) return undefined;
    const item = newGroupItem(f);
    for (const c of children) {
      const v = record[c.field];
      if (v != null) item[c.field] = typeof v === 'boolean' ? v : String(v);
    }
    return [item];
  }
  const v = record[f.field];
  if (v === null || v === undefined) return undefined;
  return f.fieldType === 'checkBox' ? Boolean(v) : String(v);
}

/** One value per field name; when editing, record values matching a field name are prefilled. */
export function initialValues(fields: FormFieldDef[], record?: DataRecord): FormValues {
  const values: FormValues = {};
  for (const f of fields) {
    if (f.field in values) continue;
    values[f.field] = (record && fromRecord(f, record)) ?? defaultValue(f);
  }
  return values;
}

// --- Validation ---

const ALLOWED: Record<string, { pattern: RegExp; hint: string }> = {
  alphaNumeric: { pattern: /^[A-Za-z0-9 ]+$/, hint: 'letters, numbers and spaces' },
  alphaDigital: { pattern: /^[A-Za-z0-9._-]+$/, hint: 'letters, numbers, ".", "-" and "_"' },
  onlyDigital: { pattern: /^\d+$/, hint: 'digits' },
};

const SIZE_UNITS: Record<string, number> = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 };

function parseBytes(size?: string): number | null {
  const m = /^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)?$/i.exec(size?.trim() ?? '');
  return m ? Number(m[1]) * SIZE_UNITS[(m[2] ?? 'B').toUpperCase()] : null;
}

function checkText(label: string, raw: string, r: FieldRule, siblings: Record<string, unknown>) {
  const v = raw.trim();
  if (!v) return r.mandatory ? `${label} is required` : null;
  if (r.minSize && v.length < Number(r.minSize)) return `${label} must be at least ${r.minSize} characters`;
  if (r.maxSize && v.length > Number(r.maxSize)) return `${label} must be at most ${r.maxSize} characters`;
  const allowed = r.allowValues ? ALLOWED[r.allowValues] : undefined;
  if (allowed && !allowed.pattern.test(v)) return `${label} can only contain ${allowed.hint}`;
  if (r.maxValueField) {
    const limit = Number(siblings[r.maxValueField]);
    if (!Number.isNaN(limit) && String(siblings[r.maxValueField] ?? '').trim() && Number(v) > limit) {
      return `${label} can't be more than ${siblings[r.maxValueField]}`;
    }
  }
  return null;
}

function checkFiles(label: string, value: FieldValue, r: FieldRule) {
  const files = Array.isArray(value) ? (value as File[]) : value instanceof File ? [value] : [];
  if (!files.length) return r.mandatory ? `${label} is required` : null;
  const exts = r.allowValues?.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean) ?? [];
  const max = parseBytes(r.maxSize);
  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (exts.length && !exts.includes(ext)) return `${file.name}: only ${exts.join(', ')} allowed`;
    if (max && file.size > max) return `${file.name} is larger than ${r.maxSize}`;
  }
  return null;
}

function checkGroup(f: FormFieldDef, items: GroupItem[], errors: FormErrors) {
  const r = ruleOf(f);
  const children = f.childFields ?? [];
  if (r.minItems && items.length < Number(r.minItems)) errors[f.field] = `Add at least ${r.minItems}`;
  if (r.maxItems && items.length > Number(r.maxItems)) errors[f.field] = `At most ${r.maxItems} allowed`;

  items.forEach((item, i) => {
    for (const c of children) {
      if (c.fieldType === 'checkBox') continue;
      const msg = checkText(c.displayName, String(item[c.field] ?? ''), ruleOf(c), item);
      if (msg) errors[`${f.field}.${i}.${c.field}`] = msg;
    }
  });

  const label = (field: string) => children.find((c) => c.field === field)?.displayName ?? field;
  const duplicated = (key: (item: GroupItem) => string) => {
    const keys = items.map(key).filter((k) => k.replaceAll('|', '').trim());
    return new Set(keys).size !== keys.length;
  };
  if (r.uniqueBy && duplicated((it) => String(it[r.uniqueBy!] ?? ''))) {
    errors[f.field] = `Each ${label(r.uniqueBy)} must be unique`;
  }
  const together = r.uniqueTogether?.split(',').map((s) => s.trim()) ?? [];
  if (together.length && duplicated((it) => together.map((t) => String(it[t] ?? '')).join('|'))) {
    errors[f.field] = `Each ${together.map(label).join(' + ')} combination must be unique`;
  }
  if (r.singleTrueField && items.filter((it) => it[r.singleTrueField!] === true).length > 1) {
    errors[f.field] = `Only one ${label(r.singleTrueField)} allowed`;
  }
}

/** Validates the visible fields against their blueprint rules. */
export function validate(fields: FormFieldDef[], values: FormValues): FormErrors {
  const errors: FormErrors = {};
  for (const f of visibleFields(fields, values)) {
    const value = values[f.field];
    const r = ruleOf(f);
    let msg: string | null = null;
    if (f.fieldType === 'repeatableGroup') checkGroup(f, (value as GroupItem[]) ?? [], errors);
    else if (f.fieldType === 'fileUpload') msg = checkFiles(f.displayName, value, r);
    else if (f.fieldType === 'checkBox') msg = r.mandatory && value !== true ? `${f.displayName} is required` : null;
    else msg = checkText(f.displayName, String(value ?? ''), r, values);
    if (msg) errors[f.field] = msg;
  }
  return errors;
}

// --- Payloads ---

/** Field names that are currently visible (a name can belong to several conditional fields). */
function visibleNames(fields: FormFieldDef[], values: FormValues) {
  return [...new Set(visibleFields(fields, values).map((f) => f.field))];
}

/** Multipart body for `createApi`: files as parts, groups as JSON, empty values skipped. */
export function toFormData(fields: FormFieldDef[], values: FormValues): FormData {
  const data = new FormData();
  for (const name of visibleNames(fields, values)) {
    const v = values[name];
    if (v instanceof File) data.append(name, v);
    else if (Array.isArray(v) && v.every((x) => x instanceof File)) (v as File[]).forEach((file) => data.append(name, file));
    else if (Array.isArray(v)) data.append(name, JSON.stringify(v));
    else if (typeof v === 'boolean') data.append(name, String(v));
    else if (typeof v === 'string' && v.trim()) data.append(name, v.trim());
  }
  return data;
}

/** JSON body for updates; files can't travel in JSON so they're left out. */
export function toJson(fields: FormFieldDef[], values: FormValues): Record<string, unknown> {
  const fileFields = new Set(fields.filter((f) => f.fieldType === 'fileUpload').map((f) => f.field));
  const body: Record<string, unknown> = {};
  for (const name of visibleNames(fields, values)) {
    const v = values[name];
    if (fileFields.has(name) || v === null) continue;
    if (typeof v !== 'string') body[name] = v;
    else if (v.trim()) body[name] = v.trim();
  }
  return body;
}
