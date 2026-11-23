import { Alert, Badge, Button, Group, Paper, SimpleGrid, Skeleton, Stack, Text, Title } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { recordIdOf, type BlueprintAction } from '../../api/blueprint';
import { deleteRecord, type DataRecord } from '../../api/records';
import { actionIcon, actionLabel, isCartNamed, isDeleteAction, isEditAction } from './actionDisplay';
import CartDrawer from './CartDrawer';
import titleClasses from './PageTitle.module.css';
import { variantImagesById } from './cellValue';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import DataTableView from './DataTableView';
import { useCart } from './useCart';
import { useDataTable } from './useDataTable';

// The form is only downloaded the first time someone opens it.
const BlueprintFormPage = lazy(() => import('../form/BlueprintFormPage'));

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

interface PendingDelete {
  action: BlueprintAction;
  recordId: string;
  name: string;
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong.');

/** Any menu page backed by a data table blueprint: header actions, records, and row actions. */
export default function DataTablePage({ title, tableBlueprintUrl, searchBlueprintUrl }: DataTablePageProps) {
  const { state, reload, refresh, goToPage, pageLoading } = useDataTable(
    tableBlueprintUrl,
    searchBlueprintUrl,
  );
  const [form, setForm] = useState<OpenForm | null>(null);
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
  const cartFallbackImages = useMemo(() => variantImagesById(loadedRecords ?? []), [loadedRecords]);
  const cartUnits = Object.values(cart.quantities).reduce((n, q) => n + (q > 0 ? q : 0), 0);

  // The form is a page of its own: opening it adds a history entry, so the browser's
  // Back button (and our Back buttons, via history.back) return to the list.
  function openForm(next: OpenForm) {
    window.history.pushState({ blueprintForm: true }, '');
    window.scrollTo(0, 0);
    setForm(next);
  }
  const closeForm = () => window.history.back();

  useEffect(() => {
    if (!form) return;
    const onPop = () => setForm(null);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [form]);

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
    if (isDeleteAction(a) && recordId) {
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
          }}
        />
      </Suspense>
    );
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <div className={titleClasses.wrap}>
          <Title order={2} className={titleClasses.title}>
            {title}
          </Title>
          <span className={titleClasses.bar} aria-hidden />
        </div>
        <Group gap="sm">
          {(blueprint?.actions ?? []).map((a) => {
            const Icon = actionIcon(a);
            return (
              <Button
                key={a.action}
                color={isCartNamed(a) ? 'green' : undefined}
                leftSection={Icon ? <Icon size={18} /> : undefined}
                title={a.action}
                onClick={() => onHeaderAction(a)}
                rightSection={
                  a === cartHeaderAction && cartUnits > 0 ? (
                    <Badge size="sm" circle={cartUnits < 10} color="white" c="green.8" variant="filled">
                      {cartUnits}
                    </Badge>
                  ) : undefined
                }
              >
                {actionLabel(a)}
              </Button>
            );
          })}
        </Group>
      </Group>

      {state.status === 'loading' && (
        <Paper withBorder radius="lg" p="lg">
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
          page={state.page}
          hasNext={state.hasNext}
          pageLoading={pageLoading}
          onPageChange={goToPage}
          onRecordClick={(record, name) => {
            const editAction = state.blueprint.rowLevelactions?.find(
              (action) => isEditAction(action) && !!action.blueprintApi,
            );
            if (editAction) onRowAction(editAction, record, name);
          }}
          onRowAction={onRowAction}
          cart={cart}
        />
      )}

      <CartDrawer
        opened={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        updateAction={cartUpdateAction}
        fallbackImages={cartFallbackImages}
      />

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
