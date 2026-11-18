import { Alert, Button, NavLink, Skeleton, Stack, Text } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { fetchMenu, type MenuItem } from '../api/menu';

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

function MenuEntry({ item, activeId, onSelect }: { item: MenuItem } & SideNavProps) {
  const children = item.children ?? [];

  if (children.length > 0) {
    return (
      <NavLink
        label={item.label}
        childrenOffset={16}
        defaultOpened={hasActiveDescendant(item, activeId)}
      >
        {children.map((child) => (
          <MenuEntry key={child.id} item={child} activeId={activeId} onSelect={onSelect} />
        ))}
      </NavLink>
    );
  }

  return (
    <NavLink label={item.label} active={item.id === activeId} onClick={() => onSelect(item)} />
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
    <>
      {state.items.map((item) => (
        <MenuEntry key={item.id} item={item} activeId={activeId} onSelect={onSelect} />
      ))}
    </>
  );
}
