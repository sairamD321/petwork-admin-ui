import { cacheByKey } from './cache';
import { ApiError, apiRequest } from './client';

const API_VERSION = import.meta.env.VITE_API_VERSION || 'v1';

/** One column of a data table blueprint. */
export interface GridColumn {
  field: string;
  displayName: string;
  /** Shown on small screens. */
  mobileDisplay?: boolean;
  /** `false` hides the column entirely. */
  display?: boolean;
}

export interface BlueprintAction {
  action: string;
  displayName: string;
  iconName?: string;
  iconToolTip?: string;
  /** Form blueprint this action opens. */
  blueprintApi?: string;
  /** Endpoint this action calls directly, may contain `{recordId}`. */
  dataApi?: string;
}

export type DisplayMode = 'table' | 'cards';

/** GET {dataTableBluePrintUrl} */
export interface DataTableBlueprint {
  dataGrid: GridColumn[];
  /** Records endpoint, may contain `{version}`. */
  dataApi: string;
  actions?: BlueprintAction[];
  rowLevelactions?: BlueprintAction[];
  enableMultipleDisplayModes?: boolean;
  defaultDisplayMode?: DisplayMode;
  availableDisplayModes?: { label: string; value: DisplayMode }[];
  /** e.g. { recordId: 'sku' } — which record field identifies a row. */
  mappings?: Record<string, string>;
}

/** One field of a search blueprint; `quickSearchFilter: true` puts it in the table's search bar. */
export interface SearchField {
  field: string;
  displayName: string;
  /** `dropDown` or `textBox`. */
  fieldType: string;
  toolTip?: string;
  placeholder?: string;
  editable?: boolean;
  quickSearchFilter?: boolean;
  /** Options endpoint for dropdowns; `staticDropDownValues` is used when empty. */
  api?: string;
  staticDropDownValues?: Record<string, string>[];
  dropdownCode?: string;
  dropdownValue?: string;
  rules?: FieldRule[];
}

/** GET {searchBluePrintUrl} */
export interface SearchBlueprint {
  searchForm: SearchField[];
}

/** Validation rules of a form field; sizes and numbers arrive as strings. */
export interface FieldRule {
  mandatory?: boolean;
  maxSize?: string;
  minSize?: string;
  allowValues?: string;
  default?: string;
  multiple?: boolean;
  maxValueField?: string;
  minItems?: string;
  maxItems?: string;
  uniqueBy?: string;
  uniqueTogether?: string;
  singleTrueField?: string;
}

export interface FormFieldDef {
  field: string;
  displayName: string;
  fieldType: string;
  toolTip?: string;
  placeholder?: string;
  editable?: boolean;
  /** Options endpoint for dropdowns. */
  api?: string;
  values?: { radioValue: string }[];
  /** e.g. ` field.petType =='Cat' && field.productType == 'Food'` */
  visibilityCriteria?: string;
  /** Comma-separated fields whose change resets this one. */
  valuesDependOnField?: string;
  dropdownCode?: string;
  dropdownValue?: string;
  rules?: FieldRule[];
  childFields?: FormFieldDef[];
  addButtonLabel?: string;
}

/** GET {action.blueprintApi} */
export interface EditFormBlueprint {
  /** Heading shown at the top of the form. */
  displayName?: string;
  editForm: FormFieldDef[];
  /** POST target for new records (multipart). */
  createApi?: string;
  /** GET (prefill) and PUT (save) target for existing records, contains `{recordId}`. */
  dataApi?: string;
  refreshOnSave?: boolean;
  resetButton?: boolean;
  mappings?: Record<string, string>;
}

/** Turns a blueprint path (`products/platform/{version}/api/products`) into an API path. */
export function resolveApiPath(path: string): string {
  const withVersion = path.replaceAll('{version}', API_VERSION);
  return withVersion.startsWith('/') ? withVersion : `/${withVersion}`;
}

/** Fills `{recordId}` in a blueprint path and resolves it. */
export function resolveRecordPath(path: string, recordId: string): string {
  return resolveApiPath(path.replaceAll('{recordId}', encodeURIComponent(recordId)));
}

/** The value of the record field the blueprint's `mappings.recordId` points at. */
export function recordIdOf(
  mappings: Record<string, string> | undefined,
  record: Record<string, unknown>,
): string | undefined {
  const field = mappings?.recordId;
  const value = field ? record[field] : undefined;
  return value === null || value === undefined ? undefined : String(value);
}

/**
 * Action blueprints are referenced as `{service}/blueprint/{version}/{name}` and served under `/api`:
 * `products/blueprint/{version}/categoriesEditForm` -> `/api/products/blueprint/v1/categoriesEditForm`.
 * If that 404s, the older gateway route `/{service}/api/blueprint/{name}` is tried.
 */
const ACTION_BLUEPRINT_PATH = /^\/?([\w-]+)\/blueprint\/\{version\}\/([\w-]+)$/;

async function loadBlueprint(path: string): Promise<unknown> {
  const match = ACTION_BLUEPRINT_PATH.exec(path);
  if (!match) return apiRequest<unknown>(resolveApiPath(path));
  try {
    return await apiRequest<unknown>(`/api${resolveApiPath(path)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return apiRequest<unknown>(`/${match[1]}/api/blueprint/${match[2]}`);
    }
    throw err;
  }
}

// Blueprints describe layout, not data, so they're cached for the whole session.
const blueprints = cacheByKey(loadBlueprint);

/**
 * The backend isn't consistent about casing (the menu sends `dataTableBluePrintUrl`), so an action's
 * form link may arrive as `bluePrintApi` etc. Without it, Create/Edit would silently do nothing.
 */
const BLUEPRINT_API_KEYS = ['blueprintApi', 'bluePrintApi', 'blueprintUrl', 'bluePrintUrl', 'blueprintAPI', 'bluePrintAPI'];

function normalizeAction(a: BlueprintAction): BlueprintAction {
  const raw = a as unknown as Record<string, unknown>;
  const api = BLUEPRINT_API_KEYS.map((k) => raw[k]).find((v): v is string => typeof v === 'string' && v.trim() !== '');
  return api ? { ...a, blueprintApi: api.trim() } : a;
}

export function fetchDataTableBlueprint(url: string): Promise<DataTableBlueprint> {
  return (blueprints.get(url) as Promise<DataTableBlueprint>).then((bp) => ({
    ...bp,
    actions: bp.actions?.map(normalizeAction),
    rowLevelactions: bp.rowLevelactions?.map(normalizeAction),
  }));
}

export function fetchSearchBlueprint(url: string): Promise<SearchBlueprint> {
  return blueprints.get(url) as Promise<SearchBlueprint>;
}

export function fetchEditFormBlueprint(url: string): Promise<EditFormBlueprint> {
  return blueprints.get(url) as Promise<EditFormBlueprint>;
}

export const clearBlueprintCache = blueprints.clear;
