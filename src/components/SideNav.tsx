import { Alert, Box, Button, NavLink, Skeleton, Stack, Text } from '@mantine/core';
import { IconAlertCircle, IconHome, IconShoppingBag, IconTag } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { fetchMenu, type MenuItem } from '../api/menu';
import classes from './SideNav.module.css';

interface SideNavProps {
  activeId: string | null;
  onSelect: (item: MenuItem) => void;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; items: MenuItem[] };

function hasActiveDescendant(item: MenuItem, activeId: string | null): boolean {
  return !!item.children?.some((c) => c.id === activeId || hasActiveDescendant(c, activeId));
}

/** Icons for the main menus, matched on the backend's icon name or the menu label. */
const MENU_ICONS: { match: RegExp; Icon: typeof IconHome }[] = [
  { match: /home|dashboard/i, Icon: IconHome },
  { match: /inventory|catalog/i, Icon: IconTag },
  { match: /order/i, Icon: IconShoppingBag },
];

function menuIcon(item: MenuItem) {
  const found = MENU_ICONS.find(({ match }) => match.test(item.icon ?? '') || match.test(item.label));
  return found ? (
    <Box className={classes.iconTile}>
      <found.Icon size={18} stroke={1.8} />
    </Box>
  ) : undefined;
}

/** Mantine NavLink parts styled by SideNav.module.css. */
const linkClasses = {
  root: classes.root,
  label: classes.label,
  chevron: classes.chevron,
  children: classes.children,
};

function MenuEntry({ item, activeId, onSelect, depth = 0 }: { item: MenuItem; depth?: number } & SideNavProps) {
  const children = item.children ?? [];
  // Only top-level menus get an icon; sub-menu links stay text-only.
  const icon = depth === 0 ? menuIcon(item) : undefined;

  if (children.length > 0) {
    return (
      <NavLink
        label={item.label}
        leftSection={icon}
        classNames={linkClasses}
        childrenOffset={0}
        defaultOpened={hasActiveDescendant(item, activeId)}
        mod={{ 'has-active': hasActiveDescendant(item, activeId) }}
      >
        {children.map((child) => (
          <MenuEntry key={child.id} item={child} activeId={activeId} onSelect={onSelect} depth={depth + 1} />
        ))}
      </NavLink>
    );
  }

  return (
    <NavLink
      label={item.label}
      leftSection={icon}
      classNames={linkClasses}
      active={item.id === activeId}
      onClick={() => onSelect(item)}
    />
  );
}

export default function SideNav({ activeId, onSelect }: SideNavProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(() => {
    fetchMenu()
      .then((items) => setState({ status: 'ready', items }))
      .catch((err: unknown) =>
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Could not load the menu.',
        }),
      );
  }, []);

  useEffect(load, [load]);

  if (state.status === 'loading') {
    return (
      <Stack gap="xs">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} height={36} radius="sm" />
        ))}
      </Stack>
    );
  }

  if (state.status === 'error') {
    return (
      <Alert color="red" icon={<IconAlertCircle size={18} />} title="Menu unavailable">
        <Text size="sm" mb="sm">
          {state.message}
        </Text>
        <Button size="xs" variant="light" color="red" 
          onClick={() => {
            setState({ status: 'loading' });
            load();
          }}
        >
          Try again
        </Button>
      </Alert>
    );
  }

  if (state.items.length === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" mt="md">
        No menu items available.
      </Text>
    );
  }

  return (
    <nav className={classes.nav} aria-label="Main menu">
      {state.items.map((item) => (
        <MenuEntry key={item.id} item={item} activeId={activeId} onSelect={onSelect} />
      ))}
    </nav>
  );
}
