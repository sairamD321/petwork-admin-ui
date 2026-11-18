import { cacheRequest } from './cache';
import { apiRequest } from './client';

/** A main-menu or sub-menu entry used by the sidebar. */
export interface MenuItem {
  id: string;
  label: string;
  /** Icon name sent by the backend (main menus only). */
  icon?: string | null;
  /** Route/URL the item opens. */
  path?: string | null;
  /** Sub-menu entries. */
  children?: MenuItem[];
  /** Blueprint describing the data table this item opens (columns, data API, actions). */
  dataTableBlueprintUrl?: string | null;
  /** Blueprint describing the search form for that table. */
  searchBlueprintUrl?: string | null;
}

// --- Backend DTOs (GET /users/api/menulinks) ---

interface SubMenuDto {
  subMenuCode: string;
  subMenuName: string;
  url?: string | null;
  order?: number | null;
  dataTableBluePrintUrl?: string | null;
  searchBluePrintUrl?: string | null;
}

interface MainMenuDto {
  mainMenuCode: string;
  mainMenuName: string;
  icon?: string | null;
  subMenuList?: SubMenuDto[];
}

interface MenuResponseDto {
  records?: MainMenuDto[];
  errorMessages?: string[] | null;
}

const menuCache = cacheRequest(loadMenu);

/** The main menu and sub-menus the signed-in admin may see. Fetched once per sign-in. */
export const fetchMenu = menuCache.get;
export const clearMenuCache = menuCache.clear;

async function loadMenu(): Promise<MenuItem[]> {
  const res = await apiRequest<MenuResponseDto>('/users/api/menulinks');

  if (res?.errorMessages?.length && !res.records?.length) {
    throw new Error(res.errorMessages.join('. '));
  }

  return (res?.records ?? []).map((main) => ({
    id: main.mainMenuCode,
    label: main.mainMenuName,
    icon: main.icon,
    children: [...(main.subMenuList ?? [])]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((sub) => ({
        id: sub.subMenuCode,
        label: sub.subMenuName,
        path: sub.url,
        dataTableBlueprintUrl: sub.dataTableBluePrintUrl,
        searchBlueprintUrl: sub.searchBluePrintUrl,
      })),
  }));
}
