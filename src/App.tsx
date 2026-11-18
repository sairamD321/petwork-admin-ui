import {
  ActionIcon,
  AppShell,
  Burger,
  Center,
  Group,
  Loader,
  Text,
  Title,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconLogout, IconMoon, IconPaw, IconSun } from '@tabler/icons-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { clearBlueprintCache } from './api/blueprint';
import { clearMenuCache, type MenuItem } from './api/menu';
import { clearRecordsCache } from './api/records';
import { clearSession, getSession, onUnauthorized, saveSession } from './api/session';
import SideNav from './components/SideNav';

// Split into their own chunks: only downloaded when actually shown.
const LoginPage = lazy(() => import('./pages/LoginPage'));
const DataTablePage = lazy(() => import('./pages/datatable/DataTablePage'));

/** Cached API data belongs to the signed-in admin; drop it when they leave. */
function signOut() {
  clearSession();
  clearMenuCache();
  clearBlueprintCache();
  clearRecordsCache();
}

const pageFallback = (
  <Center h="60vh">
    <Loader />
  </Center>
);

export default function App() {
  const [signedIn, setSignedIn] = useState(() => getSession() !== null);

  // Return to the login page if the backend rejects or expires the token.
  useEffect(
    () =>
      onUnauthorized(() => {
        signOut();
        setSignedIn(false);
      }),
    [],
  );

  if (!signedIn) {
    return (
      <Suspense fallback={pageFallback}>
        <LoginPage
          onLogin={(session, remember) => {
            saveSession(session, remember);
            setSignedIn(true);
          }}
        />
      </Suspense>
    );
  }

  return (
    <Dashboard
      onLogout={() => {
        signOut();
        setSignedIn(false);
      }}
    />
  );
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [opened, { toggle }] = useDisclosure();
  const [active, setActive] = useState<MenuItem | null>(null);
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <IconPaw size={24} />
            <Title order={4}>PetWork Admin</Title>
          </Group>
          <Group gap="xs">
            <ActionIcon
              variant="default"
              size="lg"
              onClick={toggleColorScheme}
              aria-label="Toggle color scheme"
            >
              {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
            </ActionIcon>
            <ActionIcon variant="default" size="lg" onClick={onLogout} aria-label="Sign out">
              <IconLogout size={18} />
            </ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <AppShell.Section grow style={{ overflowY: 'auto' }}>
          <SideNav activeId={active?.id ?? null} onSelect={setActive} />
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main bg="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))">
        {active?.dataTableBlueprintUrl ? (
          <Suspense fallback={pageFallback}>
            {/* key: switching menu items starts the page fresh */}
            <DataTablePage
              key={active.id}
              title={active.label}
              tableBlueprintUrl={active.dataTableBlueprintUrl}
              searchBlueprintUrl={active.searchBlueprintUrl}
            />
          </Suspense>
        ) : (
          <>
            <Title order={2} mb="xs">
              {active?.label ?? 'Welcome'}
            </Title>
            {!active && <Text c="dimmed">Select an item from the menu to get started.</Text>}
          </>
        )}
      </AppShell.Main>
    </AppShell>
  );
}
