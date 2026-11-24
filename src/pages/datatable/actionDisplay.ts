import {
  IconEye,
  IconPencil,
  IconPlus,
  IconShoppingCart,
  IconShoppingCartPlus,
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
  'fa-shopping-cart': IconShoppingCart,
  'fa-cart-shopping': IconShoppingCart,
  'fa-cart-plus': IconShoppingCartPlus,
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

/** Any cart-related action (the header "Cart", a row's "Add to Cart"); these use the brand blue. */
export const isCartNamed = (a: BlueprintAction) =>
  /cart/i.test(`${a.action} ${a.displayName} ${a.iconName ?? ''} ${a.iconToolTip ?? ''}`);

/** "Add to Cart" style row actions: they POST to `createApi` and show a quantity stepper. */
export const isCartAction = (a: BlueprintAction) => !!a.createApi && isCartNamed(a);

/** Edit actions may use a different backend action name but still expose an edit icon or label. */
export const isEditAction = (a: BlueprintAction) =>
  a.action.trim().toLowerCase() === 'edit' ||
  actionLabel(a).trim().toLowerCase() === 'edit' ||
  actionIcon(a) === IconPencil;

/** "View" row actions GET `dataApi` (with `{variantId}` filled in) and show the product page. */
export const isViewAction = (a: BlueprintAction) => a.action.trim().toLowerCase() === 'view' && !!a.dataApi;
