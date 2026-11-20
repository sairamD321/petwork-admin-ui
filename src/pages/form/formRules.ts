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

const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** A record value as a simple form value: checkboxes as booleans, dropdown objects by their code. */
function simpleFromRecord(f: FormFieldDef, v: unknown): string | boolean | undefined {
  if (v === null || v === undefined) return undefined;
  if (f.fieldType === 'checkBox') return v === true || v === 'true' || v === 1 || v === '1';
  if (isPlainObject(v)) {
    const code = v[f.dropdownCode ?? 'code'] ?? v[f.field];
    return code === null || code === undefined ? undefined : String(code);
  }
  if (Array.isArray(v)) return v.join(',');
  return String(v);
}

// --- Existing images (edit) ---

/**
 * Hidden key on a group row holding the image URLs it was loaded with (newline-separated), so they
 * stay with their row when rows are added or removed. Display only: stripped from every payload.
 */
export const ROW_IMAGES = '__images';

const URL_RE = /^https?:\/\/\S+$/i;
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg|avif|bmp)(\?\S*)?$/i;
const IMAGE_KEY = /image|img|photo|picture|thumbnail|gallery/i;

/**
 * Every image URL inside a record value (strings, lists, nested objects), without duplicates.
 * A URL counts when it ends in an image extension, or sits under an image-like key (e.g. `mainImage`).
 */
export function imagesIn(value: unknown, imageKey = false, depth = 0): string[] {
  if (depth > 4 || value === null || value === undefined) return [];
  if (typeof value === 'string') {
    const s = value.trim();
    return URL_RE.test(s) && (imageKey || IMAGE_EXT.test(s)) ? [s] : [];
  }
  const found = Array.isArray(value)
    ? value.flatMap((v) => imagesIn(v, imageKey, depth + 1))
    : typeof value === 'object'
      ? Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => imagesIn(v, imageKey || IMAGE_KEY.test(k), depth + 1))
      : [];
  return [...new Set(found)];
}

export const rowImages = (item: GroupItem): string[] =>
  typeof item[ROW_IMAGES] === 'string' ? (item[ROW_IMAGES] as string).split('\n').filter(Boolean) : [];

/** A group row without the display-only image list, as sent to the backend. */
function stripRowImages(item: GroupItem): GroupItem {
  const { [ROW_IMAGES]: _images, ...rest } = item;
  return rest;
}

const isGroupList = (v: FieldValue): v is GroupItem[] =>
  Array.isArray(v) && !v.some((x) => x instanceof File);

/**
 * The product-level images from fetched details, per file-upload field: a field's own value first;
 * images found elsewhere at the top level (not inside groups like variants) go to the first file field.
 */
export function existingImages(fields: FormFieldDef[], record: DataRecord | undefined): Record<string, string[]> {
  if (!record) return {};
  const fileFields = fields.filter((f) => f.fieldType === 'fileUpload');
  if (!fileFields.length) return {};
  const groupFields = new Set(fields.filter((f) => f.fieldType === 'repeatableGroup').map((f) => f.field));
  const out: Record<string, string[]> = {};
  const claimed = new Set<string>();
  for (const f of fileFields) {
    out[f.field] = imagesIn(record[f.field], true);
    out[f.field].forEach((u) => claimed.add(u));
  }
  const leftover = Object.entries(record)
    .filter(([k]) => !groupFields.has(k) && !fileFields.some((f) => f.field === k))
    .flatMap(([k, v]) => imagesIn(v, IMAGE_KEY.test(k)))
    .filter((u) => !claimed.has(u));
  const first = fileFields[0].field;
  out[first] = [...new Set([...out[first], ...leftover])];
  return out;
}

function groupItemFrom(f: FormFieldDef, source: Record<string, unknown>): GroupItem {
  const item = newGroupItem(f);
  for (const c of f.childFields ?? []) {
    const v = simpleFromRecord(c, source[c.field]);
    if (v !== undefined) item[c.field] = v;
  }
  const images = imagesIn(source);
  if (images.length) item[ROW_IMAGES] = images.join('\n');
  return item;
}

function fromRecord(f: FormFieldDef, record: DataRecord): FieldValue | undefined {
  if (f.fieldType === 'fileUpload') return undefined; // files can't be prefilled
  if (f.fieldType === 'repeatableGroup') {
    // Full details carry the group as a list (e.g. `variants: [...]`); a list row may only have flat fields.
    const list = record[f.field];
    if (Array.isArray(list)) return list.filter(isPlainObject).map((row) => groupItemFrom(f, row));
    if (!(f.childFields ?? []).some((c) => record[c.field] != null)) return undefined;
    return [groupItemFrom(f, record)];
  }
  return simpleFromRecord(f, record[f.field]);
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
/** Every field in the blueprint, once each: the whole form goes to the backend, empty values included. */
const allNames = (fields: FormFieldDef[]) => [...new Set(fields.map((f) => f.field))];

const isFileList = (v: FieldValue): v is File[] => Array.isArray(v) && v.length > 0 && v.every((x) => x instanceof File);

/** Whether any field holds a newly picked file. */
export function hasFiles(values: FormValues): boolean {
  return Object.values(values).some((v) => v instanceof File || isFileList(v));
}

/**
 * Multipart body with every form field: files as parts, groups as JSON, checkboxes as "true"/"false",
 * text trimmed (empty text is sent as ""). Only file fields with no file picked are left out.
 */
export function toFormData(fields: FormFieldDef[], values: FormValues): FormData {
  const data = new FormData();
  for (const name of allNames(fields)) {
    const v = values[name];
    if (v instanceof File) data.append(name, v);
    else if (isFileList(v)) v.forEach((file) => data.append(name, file));
    else if (Array.isArray(v)) {
      if (isGroupList(v)) data.append(name, JSON.stringify(v.map(stripRowImages)));
    } else if (typeof v === 'boolean') data.append(name, String(v));
    else if (typeof v === 'string') data.append(name, v.trim());
  }
  return data;
}

/** JSON body with every form field (empty text as "", unset values as null). Files need `toFormData`. */
export function toJson(fields: FormFieldDef[], values: FormValues): Record<string, unknown> {
  const fileFields = new Set(fields.filter((f) => f.fieldType === 'fileUpload').map((f) => f.field));
  const body: Record<string, unknown> = {};
  for (const name of allNames(fields)) {
    if (fileFields.has(name)) continue;
    const v = values[name] ?? null;
    body[name] = typeof v === 'string' ? v.trim() : isGroupList(v) ? v.map(stripRowImages) : v;
  }
  return body;
}
