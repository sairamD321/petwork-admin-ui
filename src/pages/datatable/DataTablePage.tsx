import { Alert, Badge, Button, Group, Paper, SimpleGrid, Skeleton, Stack, Text, Title } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { createElement, lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { recordIdOf, type BlueprintAction } from '../../api/blueprint';
import { deleteRecord, type DataRecord } from '../../api/records';
import { actionIcon, actionLabel, isCartNamed, isDeleteAction, isEditAction, isViewAction } from './actionDisplay';
import CartDrawer from './CartDrawer';
import titleClasses from './PageTitle.module.css';
import { cartKeyOf, cartImagesByKey, cartTitlesByKey } from './cellValue';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import DataTableView from './DataTableView';
import { useCart } from './useCart';
import { useDataTable } from './useDataTable';

// The form is only downloaded the first time someone opens it.
const BlueprintFormPage = lazy(() => import('../form/BlueprintFormPage'));
const ProductViewPage = lazy(() => import('./ProductViewPage'));

interface DataTablePageProps {
  title: string;
  tableBlueprintUrl: string;
  searchBlueprintUrl?: string | null;
}

interface OpenForm {
  title: string;
  /** Shown under the title: the record's name when editing, the page name when creating. */
  subtitle?: string;
  blueprintApi: string;
  record?: DataRecord;
  recordId?: string;
}

/** The product page opened by a "view" action. */
interface OpenView {
  action: BlueprintAction;
  cartKey: string;
}

interface PendingDelete {
  action: BlueprintAction;
  recordId: string;
  name: string;
}

/** A page header button; cart buttons are brand blue and show how many units are in the cart. */
function HeaderActionButton({ action, units = 0, onClick }: { action: BlueprintAction; units?: number; onClick: () => void }) {
  const icon = actionIcon(action);
  return (
    <Button
      color="indigo"
      leftSection={icon ? createElement(icon, { size: 18 }) : undefined}
      title={action.action}
      onClick={onClick}
      rightSection={
        units > 0 ? (
          <Badge size="sm" circle={units < 10} color="white" c="indigo.7" variant="filled">
            {units}
          </Badge>
        ) : undefined
      }
    >
      {actionLabel(action)}
    </Button>
  );
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong.');

/** Any menu page backed by a data table blueprint: header actions, records, and row actions. */
export default function DataTablePage({ title, tableBlueprintUrl, searchBlueprintUrl }: DataTablePageProps) {
  const { state, reload, refresh, goToPage, pageLoading } = useDataTable(
    tableBlueprintUrl,
    searchBlueprintUrl,
  );
  const [form, setForm] = useState<OpenForm | null>(null);
  const [view, setView] = useState<OpenView | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const blueprint = state.status === 'ready' ? state.blueprint : null;

  // The cart is shared by the product cards (Add to Cart) and the cart panel (header "Cart").
  const cart = useCart(blueprint);
  const [cartOpen, setCartOpen] = useState(false);
  const cartHeaderAction = (blueprint?.actions ?? []).find((a) => isCartNamed(a) && !!a.dataApi && !a.blueprintApi);
  // Quantity changes in the panel go to the add action's createApi, else the cart's own endpoint.
  const cartUpdateAction =
    cart.addAction ?? (cartHeaderAction ? { ...cartHeaderAction, createApi: cartHeaderAction.dataApi } : undefined);
  // Pictures for cart lines whose cart data has none: the matching variant's image from the loaded products.
  const loadedRecords = state.status === 'ready' ? state.records : undefined;
  const cartFallbackImages = useMemo(() => cartImagesByKey(loadedRecords ?? []), [loadedRecords]);
  const cartProductTitles = useMemo(() => cartTitlesByKey(loadedRecords ?? []), [loadedRecords]);
  const cartUnits = Object.values(cart.quantities).reduce((n, q) => n + (q > 0 ? q : 0), 0);

  // The form is a page of its own: opening it adds a history entry, so the browser's
  // Back button (and our Back buttons, via history.back) return to the list.
  function openForm(next: OpenForm) {
    window.history.pushState({ blueprintForm: true }, '');
    window.scrollTo(0, 0);
    setForm(next);
  }
  // The product page works the same way: its own history entry, so Back returns to the list.
  function openView(next: OpenView) {
    window.history.pushState({ blueprintForm: true }, '');
    window.scrollTo(0, 0);
    setView(next);
  }
  const closeForm = () => window.history.back();

  const overlayOpen = !!form || !!view;
  useEffect(() => {
    if (!overlayOpen) return;
    const onPop = () => {
      setForm(null);
      setView(null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [overlayOpen]);

  function onHeaderAction(a: BlueprintAction) {
    // "Cart": GET its dataApi fresh and show the cart panel.
    if (a === cartHeaderAction) {
      cart.reload();
      setCartOpen(true);
      return;
    }
    if (a.blueprintApi) openForm({ title: a.action, blueprintApi: a.blueprintApi });
  }

  function onRowAction(a: BlueprintAction, record: DataRecord, name: string) {
    const recordId = recordIdOf(blueprint?.mappings, record);
    if (isViewAction(a)) {
      const cartKey = cartKeyOf(record);
      if (cartKey) openView({ action: a, cartKey });
    } else if (isDeleteAction(a) && recordId) {
      setDeleteError(null);
      setPendingDelete({ action: a, recordId, name: name || recordId });
    } else if (a.blueprintApi) {
      // The form finds the record id itself (its own `mappings`, then `recordId` as a fallback).
      // Title from the action's displayName (e.g. "Update Product"); the record's name goes underneath,
      // unless it's empty (formatValue's "—" placeholder).
      const recordName = name && name !== '—' ? name : undefined;
      openForm({ title: actionLabel(a), subtitle: recordName, blueprintApi: a.blueprintApi, record, recordId });
    }
  }

  async function confirmDelete() {
    if (!pendingDelete?.action.dataApi) return;
    setDeleting(true);
    try {
      await deleteRecord(pendingDelete.action.dataApi, pendingDelete.recordId);
      setPendingDelete(null);
      refresh();
    } catch (err) {
      setDeleteError(errorText(err));
    } finally {
      setDeleting(false);
    }
  }

  // The header "Cart" button and its panel; shown on the list and on the product page.
  const cartButton = cartHeaderAction ? (
    <HeaderActionButton action={cartHeaderAction} units={cartUnits} onClick={() => onHeaderAction(cartHeaderAction)} />
  ) : null;
  const cartDrawer = (
    <CartDrawer
      opened={cartOpen}
      onClose={() => setCartOpen(false)}
      cart={cart}
      updateAction={cartUpdateAction}
      fallbackImages={cartFallbackImages}
      productTitles={cartProductTitles}
    />
  );

  if (view) {
    return (
      <Suspense fallback={null}>
        <ProductViewPage
          action={view.action}
          cartKey={view.cartKey}
          title={actionLabel(view.action)}
          subtitle={title}
          cart={cart}
          onBack={closeForm}
          headerRight={cartButton}
        />
        {cartDrawer}
      </Suspense>
    );
  }

  if (form) {
    return (
      <Suspense fallback={null}>
        <BlueprintFormPage
          title={form.title}
          subtitle={form.record ? form.subtitle : title}
          blueprintApi={form.blueprintApi}
          record={form.record}
          fallbackRecordId={form.recordId}
          onBack={closeForm}
          onSaved={() => {
            closeForm();
            refresh();
            // e.g. a saved transfer empties the transfer cart: show the cart as the backend now has it.
            if (cart.load.status !== 'idle') cart.reload();
          }}
        />
      </Suspense>
    );
  }

  return (
    // Fills the screen below the header (60px) minus the shell's padding, so the page itself never
    // scrolls: the heading, cart button and search stay put and only the product list scrolls.
    <Stack gap="lg" style={{ height: 'calc(100dvh - 60px - 2 * var(--mantine-spacing-md))' }}>
      <Group justify="space-between" align="center" style={{ flexShrink: 0 }}>
        <div className={titleClasses.wrap}>
          <Title order={2} className={titleClasses.title}>
            {title}
          </Title>
          <span className={titleClasses.bar} aria-hidden />
        </div>
        <Group gap="sm">
          {(blueprint?.actions ?? []).map((a) =>
            a === cartHeaderAction ? (
              <span key={a.action}>{cartButton}</span>
            ) : (
              <HeaderActionButton key={a.action} action={a} onClick={() => onHeaderAction(a)} />
            ),
          )}
        </Group>
      </Group>

      {state.status === 'loading' && (
        <Paper withBorder radius="lg" p="lg" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 6 }} spacing="lg">
            {Array.from({ length: 12 }, (_, i) => (
              <Stack key={i} gap={8}>
                <Skeleton style={{ aspectRatio: '1' }} radius="md" />
                <Skeleton height={14} />
                <Skeleton height={10} width="60%" />
              </Stack>
            ))}
          </SimpleGrid>
        </Paper>
      )}

      {state.status === 'error' && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} title="Couldn't load this page">
          <Text size="sm" mb="sm">
            {state.message}
          </Text>
          <Button size="xs" variant="light" color="red" onClick={reload}>
            Try again
          </Button>
        </Alert>
      )}

      {state.status === 'ready' && (
        <DataTableView
          blueprint={state.blueprint}
          records={state.records}
          quickSearchFields={state.quickSearchFields}
          moreFilterFields={state.moreFilterFields}
          page={state.page}
          hasNext={state.hasNext}
          pageLoading={pageLoading}
          onPageChange={goToPage}
          onRecordClick={(record, name) => {
            // Clicking a record views it when there is a "view" action (shown or not), else edits it.
            const actions = state.blueprint.rowLevelactions ?? [];
            const clickAction =
              actions.find(isViewAction) ?? actions.find((action) => isEditAction(action) && !!action.blueprintApi);
            if (clickAction) onRowAction(clickAction, record, name);
          }}
          onRowAction={onRowAction}
          cart={cart}
        />
      )}

      {cartDrawer}

      {pendingDelete && (
        <ConfirmDeleteModal
          name={pendingDelete.name}
          deleting={deleting}
          error={deleteError}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </Stack>
  );
}
