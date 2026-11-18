import {
  IconEye,
  IconPencil,
  IconPlus,
  IconTrash,
  type Icon,
} from '@tabler/icons-react';
import type { BlueprintAction } from '../../api/blueprint';

/** The backend names Font Awesome icons; these are the matching icons this app ships. */
const FA_ICONS: Record<string, Icon> = {
  'fa-add': IconPlus,
  'fa-plus': IconPlus,
  'fa-edit': IconPencil,
  'fa-pen': IconPencil,
  'fa-pencil': IconPencil,
  'fa-pencil-alt': IconPencil,
  'fa-trash': IconTrash,
  'fa-trash-alt': IconTrash,
  'fa-eye': IconEye,
};

const isFaName = (s?: string): s is string => !!s && s.startsWith('fa-');

/** Icon names may arrive in `iconName`, `iconToolTip` or `displayName`; take the first one. */
export function actionIcon(a: BlueprintAction): Icon | undefined {
  const name = [a.iconName, a.iconToolTip, a.displayName].find(isFaName);
  return name ? FA_ICONS[name] : undefined;
}

/** The first of `displayName` / `iconToolTip` that is text rather than an icon name. */
export function actionLabel(a: BlueprintAction): string {
  return [a.displayName, a.iconToolTip].find((s) => s && !isFaName(s)) ?? a.action;
}

/** Row actions that call `dataApi` with action `delete` remove the record (after confirming). */
export const isDeleteAction = (a: BlueprintAction) => a.action.toLowerCase() === 'delete' && !!a.dataApi;
