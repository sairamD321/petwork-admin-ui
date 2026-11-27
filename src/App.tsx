import {
  ActionIcon,
  AppShell,
  Burger,
  Center,
  Group,
  Loader,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconLogout } from '@tabler/icons-react';
import logoUrl from './assets/petwork-logo.png';
import { lazy, Suspense, useEffect, useState } from 'react';
import { fetchMenu, type MenuItem } from './api/menu';
import { clearSession, getSession, onUnauthorized, saveSession } from './api/session';
import SideNav from './components/SideNav';
import titleClasses from './pages/datatable/PageTitle.module.css';

// Split into their own chunks: only downloaded when actually shown.
const LoginPage = lazy(() => import('./pages/LoginPage'));
const DataTablePage = lazy(() => import('./pages/datatable/DataTablePage'));

/** Nothing from the API is cached, so signing out only ends the session. */
function signOut() {
  clearSession();
}

/** The open menu item is kept in the URL (`#/categories`) so a reload returns to the same page. */
function readPageId(): string | null {
  const id = window.location.hash.replace(/^#\/?/, '');
  return id ? decodeURIComponent(id) : null;
}

function writePageId(id: string | null) {
  const url = id ? `#/${encodeURIComponent(id)}` : window.location.pathname + window.location.search;
  // replaceState: keeps the form's Back-button history entries intact.
  window.history.replaceState(window.history.state, '', url);
}

function findItem(items: MenuItem[], id: string): MenuItem | undefined {
  for (const item of items) {
    if (item.id === id) return item;
    const found = findItem(item.children ?? [], id);
    if (found) return found;
  }
  return undefined;
}

/** The page opened after signing in: the Dashboard menu item, or else the first item. */
function findStartItem(items: MenuItem[]): MenuItem | undefined {
  const isDashboard = (item: MenuItem) => /dashboard|home/i.test(`${item.id} ${item.label}`);
  const search = (list: MenuItem[]): MenuItem | undefined => {
    for (const item of list) {
      if (isDashboard(item)) return item;
      const found = search(item.children ?? []);
      if (found) return found;
    }
    return undefined;
  };
  return search(items) ?? items[0];
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
  const [activeId, setActiveId] = useState<string | null>(readPageId);
  const [active, setActive] = useState<MenuItem | null>(null);

  const [menuFailed, setMenuFailed] = useState(false);

  // On start only the id from the URL is known (or none, right after signing in): look the item
  // up in the menu, falling back to the Dashboard.
  useEffect(() => {
    if (active) return;
    let cancelled = false;
    fetchMenu()
      .then((items) => {
        if (cancelled) return;
        const item = (activeId ? findItem(items, activeId) : undefined) ?? findStartItem(items);
        if (item) {
          setActive(item);
          setActiveId(item.id);
          writePageId(item.id);
        } else {
          setActiveId(null);
          writePageId(null);
        }
      })
      .catch(() => {
        if (!cancelled) setMenuFailed(true); // the sidebar shows the menu error
      });
    return () => {
      cancelled = true;
    };
  }, [activeId, active]);

  // Bumped on every menu click, so clicking the item you're already on still reopens its list.
  const [navCount, setNavCount] = useState(0);

  function select(item: MenuItem) {
    const go = () => {
      setActive(item);
      setActiveId(item.id);
      setNavCount((n) => n + 1);
      writePageId(item.id);
    };
    // A form is open (it added a history entry): step back off it first, so Back doesn't
    // land on a stale form entry, then show the page.
    if (window.history.state?.blueprintForm) {
      window.addEventListener('popstate', go, { once: true });
      window.history.back();
    } else {
      go();
    }
  }

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
            <img src={logoUrl} alt="PetWork" width={32} height={32} style={{ borderRadius: 8, display: 'block' }} />
            <Title order={4}>PetWork Admin</Title>
          </Group>
          <Group gap="xs">
            <ActionIcon variant="default" size="lg" onClick={onLogout} aria-label="Sign out">
              <IconLogout size={18} />
            </ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <AppShell.Section grow style={{ overflowY: 'auto' }}>
          <SideNav activeId={activeId} onSelect={select} />
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main bg="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))">
        {active?.dataTableBlueprintUrl ? (
          <Suspense fallback={pageFallback}>
            {/* key: any menu click, even on the current item, starts the page fresh */}
            <DataTablePage
              key={`${active.id}:${navCount}`}
              title={active.label}
              tableBlueprintUrl={active.dataTableBlueprintUrl}
              searchBlueprintUrl={active.searchBlueprintUrl}
            />
          </Suspense>
        ) : active ? (
          // Same heading style as the list pages: gradient text and a growing accent bar.
          <div className={titleClasses.wrap} key={active.id}>
            <Title order={2} className={titleClasses.title}>
              {active.label}
            </Title>
            <span className={titleClasses.bar} aria-hidden />
          </div>
        ) : menuFailed ? null : (
          pageFallback
        )}
      </AppShell.Main>
    </AppShell>
  );
}
