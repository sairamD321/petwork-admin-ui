import type { FormFieldDef } from '../../api/blueprint';
import { isGroupField, ruleOf } from './formRules';

export interface FormSection {
  key: string;
  title: string;
  fields: FormFieldDef[];
}

/** Choice fields describe what a record *is*, so they go in the side column. */
const SIDE_TYPES = new Set(['radioButton', 'dropDown', 'cascadeDropDown']);

/**
 * Splits visible fields into page cards by field type, since the blueprint has no sections:
 * main = text/checkbox fields, then one card per group (repeatable or not), then uploads; side = choices.
 */
export function layoutSections(fields: FormFieldDef[]): { main: FormSection[]; side: FormSection[] } {
  const general = fields.filter(
    (f) => !SIDE_TYPES.has(f.fieldType) && !isGroupField(f) && f.fieldType !== 'fileUpload',
  );
  const groups = fields.filter(isGroupField);
  const media = fields.filter((f) => f.fieldType === 'fileUpload');
  const choices = fields.filter((f) => SIDE_TYPES.has(f.fieldType));

  const main: FormSection[] = [
    { key: 'general', title: 'General Information', fields: general },
    ...groups.map((g) => ({ key: `group-${g.field}`, title: g.displayName, fields: [g] })),
    { key: 'media', title: 'Media', fields: media },
  ];
  const side: FormSection[] = [{ key: 'organize', title: 'Organize', fields: choices }];

  const nonEmpty = (s: FormSection) => s.fields.length > 0;
  return { main: main.filter(nonEmpty), side: side.filter(nonEmpty) };
}

/** Long or unbounded text gets a full row; short codes and names share a row. */
export function isWideField(f: FormFieldDef): boolean {
  if (f.fieldType !== 'textBox') return true;
  const max = Number(ruleOf(f).maxSize);
  return !max || max > 100;
}
