import type { FieldRule, FormFieldDef } from '../../api/blueprint';
import type { DataRecord } from '../../api/records';

/** One row of a repeatable group; file children (e.g. a variant's images) hold picked files. */
export type GroupItem = Record<string, string | boolean | File | File[] | null>;
export type FieldValue = string | boolean | File | File[] | GroupItem[] | null;
export type FormValues = Record<string, FieldValue>;
/** Keyed by field, or `group.index.child` for repeatable group children. */
export type FormErrors = Record<string, string>;

export const ruleOf = (f: FormFieldDef): FieldRule => f.rules?.[0] ?? {};

/**
 * Group fields hold child fields. `repeatableGroup` is a list of rows (e.g. variants);
 * `nonrepeatableGroup` is exactly one row, sent to the backend as a single object.
 * Internally both are a `GroupItem[]` (the single group always has one item), so they share
 * rendering, validation and image handling.
 */
export const isGroupField = (f: FormFieldDef) =>
  f.fieldType === 'repeatableGroup' || f.fieldType === 'nonrepeatableGroup';
export const isSingleGroup = (f: FormFieldDef) => f.fieldType === 'nonrepeatableGroup';

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

const isFileField = (f: FormFieldDef) => f.fieldType === 'fileUpload';
const fileDefault = (f: FormFieldDef) => (ruleOf(f).multiple ? [] : null);

export function newGroupItem(group: FormFieldDef): GroupItem {
  return Object.fromEntries(
    (group.childFields ?? []).map((c) => [c.field, isFileField(c) ? fileDefault(c) : simpleDefault(c)]),
  );
}

export function defaultValue(f: FormFieldDef): FieldValue {
  if (isFileField(f)) return fileDefault(f);
  if (isSingleGroup(f)) return [newGroupItem(f)];
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
 * Hidden key on a group row holding its server images (JSON), so they stay with their row when rows
 * are added or removed. Never sent itself: the kept URLs go out under their own file fields.
 */
export const ROW_IMAGES = '__images';

const URL_RE = /^https?:\/\/\S+$/i;
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg|avif|bmp)(\?\S*)?$/i;
const IMAGE_KEY = /image|img|photo|picture|thumbnail|gallery/i;

/** An image the record already has, with a name taken from the key it was found under. */
export interface ImageRef {
  url: string;
  label: string;
  /** In a group row: the file field the image belongs to. */
  field?: string;
}

/** Keys that only hold the link itself; the image keeps its parent's name (e.g. `images[0].url` → "Images 1"). */
const LINK_KEY = /^(url|uri|src|href|link|path|value|location|file|key)$/i;

/** `mainImage` / `main_image` → "Main Image". */
const humanize = (key: string) =>
  key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const uniqueByUrl = (refs: ImageRef[]) => {
  const seen = new Set<string>();
  return refs.filter((r) => !seen.has(r.url) && seen.add(r.url));
};

/**
 * Every image inside a record value (strings, lists, nested objects), without duplicate URLs.
 * A URL counts when it ends in an image extension, or sits under an image-like key (e.g. `mainImage`).
 */
export function imagesIn(value: unknown, imageKey = false, label = 'Image', depth = 0): ImageRef[] {
  if (depth > 4 || value === null || value === undefined) return [];
  if (typeof value === 'string') {
    const s = value.trim();
    return URL_RE.test(s) && (imageKey || IMAGE_EXT.test(s)) ? [{ url: s, label }] : [];
  }
  const found = Array.isArray(value)
    ? value.flatMap((v, i) => imagesIn(v, imageKey, value.length > 1 ? `${label} ${i + 1}` : label, depth + 1))
    : typeof value === 'object'
      ? Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
          imagesIn(v, imageKey || IMAGE_KEY.test(k), LINK_KEY.test(k) ? label : humanize(k), depth + 1),
        )
      : [];
  return uniqueByUrl(found);
}

/** Hidden key on a group row: URLs of its server images the user deleted (sent as `removeImages`). */
export const ROW_REMOVED = '__removedImages';

function parseList<T>(raw: unknown): T[] {
  if (typeof raw !== 'string') return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? (list as T[]) : [];
  } catch {
    return [];
  }
}

export const rowImages = (item: GroupItem): ImageRef[] => parseList<ImageRef>(item[ROW_IMAGES]);
export const removedImages = (item: GroupItem): string[] => parseList<string>(item[ROW_REMOVED]);

/** The row with one server image deleted: gone from its images, remembered for `removeImages`. */
export function removeRowImage(item: GroupItem, url: string): GroupItem {
  return {
    ...item,
    [ROW_IMAGES]: JSON.stringify(rowImages(item).filter((r) => r.url !== url)),
    [ROW_REMOVED]: JSON.stringify([...new Set([...removedImages(item), url])]),
  };
}

/** A group row without the display-only image bookkeeping, as sent to the backend. */
function stripRowImages(item: GroupItem): GroupItem {
  const { [ROW_IMAGES]: _images, [ROW_REMOVED]: _removed, ...rest } = item;
  return rest;
}

const isGroupList = (v: FieldValue): v is GroupItem[] =>
  Array.isArray(v) && !v.some((x) => x instanceof File);

/**
 * A group row for the JSON part of the payload. Picked files are left out (they travel as their own
 * multipart parts); a row loaded from the server carries the image URLs it still keeps instead, e.g.
 * `mainImage: "https://…"` / `subImages: ["https://…"]` with deleted URLs removed.
 */
function withoutFiles(group: FormFieldDef, item: GroupItem): Record<string, unknown> {
  const row: Record<string, unknown> = stripRowImages(item);
  const loaded = typeof item[ROW_IMAGES] === 'string';
  const kept = rowImages(item);
  for (const c of group.childFields ?? []) {
    if (!isFileField(c)) continue;
    if (!loaded) {
      delete row[c.field];
      continue;
    }
    const urls = kept.filter((r) => r.field === c.field).map((r) => r.url);
    row[c.field] = ruleOf(c).multiple ? urls : (urls[0] ?? null);
  }
  return row;
}

/** Every deleted server image URL across the form's group rows. */
function allRemovedImages(fields: FormFieldDef[], values: FormValues): string[] {
  return fields.flatMap((f) => {
    const v = values[f.field];
    return isGroupField(f) && isGroupList(v) ? v.flatMap(removedImages) : [];
  });
}

/**
 * The product-level images from fetched details, per file-upload field: a field's own value first;
 * images found elsewhere at the top level (not inside groups like variants) go to the first file field.
 */
export function existingImages(fields: FormFieldDef[], record: DataRecord | undefined): Record<string, ImageRef[]> {
  if (!record) return {};
  const fileFields = fields.filter((f) => f.fieldType === 'fileUpload');
  if (!fileFields.length) return {};
  const groupFields = new Set(fields.filter(isGroupField).map((f) => f.field));
  const out: Record<string, ImageRef[]> = {};
  const claimed = new Set<string>();
  for (const f of fileFields) {
    out[f.field] = imagesIn(record[f.field], true, f.displayName || humanize(f.field));
    out[f.field].forEach((r) => claimed.add(r.url));
  }
  const leftover = Object.entries(record)
    .filter(([k]) => !groupFields.has(k) && !fileFields.some((f) => f.field === k))
    .flatMap(([k, v]) => imagesIn(v, IMAGE_KEY.test(k), humanize(k)))
    .filter((r) => !claimed.has(r.url));
  const first = fileFields[0].field;
  out[first] = uniqueByUrl([...out[first], ...leftover]);
  return out;
}

function groupItemFrom(f: FormFieldDef, source: Record<string, unknown>): GroupItem {
  const item = newGroupItem(f);
  const children = f.childFields ?? [];
  for (const c of children) {
    if (isFileField(c)) continue; // stays empty: only newly picked files go in the value
    const v = simpleFromRecord(c, source[c.field]);
    if (v !== undefined) item[c.field] = v;
  }
  // The row's current images, kept with the file field they belong to (e.g. mainImage, subImages).
  const fileChildren = children.filter(isFileField);
  const own = fileChildren.flatMap((c) =>
    imagesIn(source[c.field], true, c.displayName || humanize(c.field)).map((r) => ({ ...r, field: c.field })),
  );
  const claimed = new Set(own.map((r) => r.url));
  const other = Object.entries(source)
    .filter(([k]) => !fileChildren.some((c) => c.field === k))
    .flatMap(([k, v]) => imagesIn(v, IMAGE_KEY.test(k), humanize(k)))
    .filter((r) => !claimed.has(r.url))
    .map((r) => ({ ...r, field: fileChildren[0]?.field }));
  // Always set on loaded rows (even when empty), so the payload knows the row came from the server.
  item[ROW_IMAGES] = JSON.stringify(uniqueByUrl([...own, ...other]));
  return item;
}

function fromRecord(f: FormFieldDef, record: DataRecord): FieldValue | undefined {
  if (f.fieldType === 'fileUpload') return undefined; // files can't be prefilled
  if (isSingleGroup(f)) {
    // Full details carry the group as one object (e.g. `dimensions: {...}`); a list's first row is accepted too.
    const own = record[f.field];
    const source = isPlainObject(own) ? own : Array.isArray(own) ? own.find(isPlainObject) : undefined;
    if (source) return [groupItemFrom(f, source)];
    if (!(f.childFields ?? []).some((c) => record[c.field] != null)) return undefined;
    return [groupItemFrom(f, record)];
  }
  if (f.fieldType === 'repeatableGroup') {
    // Full details carry the group as a list (e.g. `variants: [...]`); a list row may only have flat fields.
    const list = record[f.field];
    if (Array.isArray(list)) return list.filter(isPlainObject).map((row) => groupItemFrom(f, row));
    if (!(f.childFields ?? []).some((c) => record[c.field] != null)) return undefined;
    return [groupItemFrom(f, record)];
  }
  return simpleFromRecord(f, record[f.field]);
}

// --- Prefill from a form's `dataApi` (forms opened without a record) ---

/** Every list of objects in a response (up to a few levels deep), with the key it sits under. */
function objectLists(node: unknown, key = '', depth = 0, out: { key: string; rows: Record<string, unknown>[] }[] = []) {
  if (depth > 5 || !node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    const rows = node.filter(isPlainObject);
    if (rows.length) out.push({ key, rows });
    rows.forEach((r) => objectLists(r, key, depth + 1, out));
    return out;
  }
  for (const [k, v] of Object.entries(node)) objectLists(v, k, depth + 1, out);
  return out;
}

/** A row with its nested objects' values lifted up (e.g. `variant.upc` -> `upc`); the row's own values win. */
function flattenRow(row: Record<string, unknown>): Record<string, unknown> {
  const lifted: Record<string, unknown> = {};
  for (const v of Object.values(row)) {
    if (isPlainObject(v)) Object.assign(lifted, Object.fromEntries(Object.entries(v).filter(([, x]) => !isPlainObject(x))));
  }
  return { ...lifted, ...row };
}

/**
 * Turns a `dataApi` response into a record for `initialValues`, whatever its shape:
 * - top-level fields come from the object (the body, `data`, `record`, or a single `records[0]`)
 *   that has the most of the form's field names;
 * - each group field (e.g. the transfer's items) takes the list stored under its own name, else the
 *   list whose rows share the most child field names with it, else the only list in the response.
 */
export function prefillRecord(fields: FormFieldDef[], body: unknown): DataRecord {
  if (!body || typeof body !== 'object') return {};
  const names = fields.map((f) => f.field);
  const b = body as Record<string, unknown>;
  const candidates = [
    Array.isArray(body) ? undefined : b,
    b.data,
    b.record,
    Array.isArray(b.records) && b.records.length === 1 ? b.records[0] : undefined,
  ].filter(isPlainObject);
  const score = (o: Record<string, unknown>) => names.filter((n) => n in o).length;
  const base: DataRecord = { ...(candidates.sort((x, y) => score(y) - score(x))[0] ?? {}) } as DataRecord;

  const lists = objectLists(body);
  for (const g of fields.filter(isGroupField)) {
    if (Array.isArray(base[g.field]) || (isSingleGroup(g) && isPlainObject(base[g.field]))) continue;
    const children = (g.childFields ?? []).map((c) => c.field);
    const overlap = (rows: Record<string, unknown>[]) =>
      rows.reduce((n, r) => n + children.filter((c) => c in flattenRow(r)).length, 0);
    const best =
      lists.find((l) => l.key === g.field) ??
      [...lists].sort((x, y) => overlap(y.rows) - overlap(x.rows)).find((l) => overlap(l.rows) > 0) ??
      (lists.length === 1 ? lists[0] : undefined);
    if (best) base[g.field] = best.rows.map(flattenRow) as unknown as DataRecord[string];
  }
  return base;
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
      const msg = isFileField(c)
        ? // A row that already has images on the server doesn't need a new upload.
          checkFiles(c.displayName, item[c.field] ?? null, rowImages(item).some((r) => r.field === c.field) ? { ...ruleOf(c), mandatory: false } : ruleOf(c))
        : checkText(c.displayName, String(item[c.field] ?? ''), ruleOf(c), item as Record<string, unknown>);
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
    if (isGroupField(f)) checkGroup(f, (value as GroupItem[]) ?? [], errors);
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

/**
 * Whether the form has file fields, at the top level or inside a group (e.g. variant images).
 * Such forms are multipart endpoints on the backend, so they are always sent as multipart,
 * with or without a newly picked file; every other form is sent as JSON.
 */
export function usesMultipart(fields: FormFieldDef[]): boolean {
  return fields.some((f) => isFileField(f) || (f.childFields ?? []).some(isFileField));
}

const groupOf = (fields: FormFieldDef[], name: string) =>
  fields.find((f) => f.field === name && isGroupField(f));

/** A group's JSON value: a list of rows, or one object for a `nonrepeatableGroup`. */
function groupJson(group: FormFieldDef, items: GroupItem[]): unknown {
  const rows = items.map((item) => withoutFiles(group, item));
  return isSingleGroup(group) ? (rows[0] ?? {}) : rows;
}

/**
 * Multipart body with every form field: files as parts, groups as JSON, checkboxes as "true"/"false",
 * text trimmed (empty text is sent as ""). Files picked in a group row go as `group[i][field]`
 * (e.g. `variants[0][mainImage]`, `variants[0][subImages]` repeated per file);
 * files in a `nonrepeatableGroup` go as `group[field]`.
 */
export function toFormData(fields: FormFieldDef[], values: FormValues): FormData {
  const data = new FormData();
  for (const name of allNames(fields)) {
    const v = values[name];
    if (v instanceof File) data.append(name, v);
    else if (isFileList(v)) v.forEach((file) => data.append(name, file));
    else if (Array.isArray(v)) {
      const group = groupOf(fields, name);
      if (!group || !isGroupList(v)) continue;
      data.append(name, JSON.stringify(groupJson(group, v)));
      v.forEach((item, i) => {
        for (const c of group.childFields ?? []) {
          if (!isFileField(c)) continue;
          const picked = item[c.field];
          const files = picked instanceof File ? [picked] : Array.isArray(picked) ? picked : [];
          const key = isSingleGroup(group) ? `${name}[${c.field}]` : `${name}[${i}][${c.field}]`;
          files.forEach((file) => data.append(key, file));
        }
      });
    } else if (typeof v === 'boolean') data.append(name, String(v));
    else if (typeof v === 'string') data.append(name, v.trim());
  }
  // Deleted server images: one `removeImages` part per URL, as the backend's update expects.
  allRemovedImages(fields, values).forEach((url) => data.append('removeImages', url));
  return data;
}

/** JSON body with every form field (empty text as "", unset values as null). Files need `toFormData`. */
export function toJson(fields: FormFieldDef[], values: FormValues): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const name of allNames(fields)) {
    if (fields.some((f) => f.field === name && isFileField(f))) continue;
    const v = values[name] ?? null;
    const group = groupOf(fields, name);
    body[name] =
      typeof v === 'string' ? v.trim() : group && isGroupList(v) ? groupJson(group, v) : v;
  }
  const removed = allRemovedImages(fields, values);
  if (removed.length) body.removeImages = removed;
  return body;
}
