import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { IconCash, IconCreditCard, IconMapPin, IconPlus, IconTrash } from '@tabler/icons-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { BlueprintAction } from '../../api/blueprint';
import {
  formatAddress,
  loadAddresses,
  loadSelectedId,
  saveAddresses,
  saveSelectedId,
  type Address,
} from './addressBook';
import { BillCard, ItemsCard } from './CartParts';
import classes from './Checkout.module.css';
import type { CartSummary } from './cartSummary';
import type { CartController } from './useCart';

interface CheckoutViewProps {
  summary: CartSummary;
  cart: CartController;
  updateAction: BlueprintAction | undefined;
  fallbackImages?: Record<string, string>;
  /** Told whenever the chosen delivery address changes (null: none yet). */
  onAddressChange: (address: Address | null) => void;
}

/** Checkout: delivery address, the cart (same as the cart screen), and the payment mode. */
export default function CheckoutView({ summary, cart, updateAction, fallbackImages, onAddressChange }: CheckoutViewProps) {
  return (
    <Stack gap="md">
      <AddressSection onAddressChange={onAddressChange} />
      <ItemsCard summary={summary} cart={cart} updateAction={updateAction} fallbackImages={fallbackImages} title="Order items" />
      <BillCard summary={summary} />
      <PaymentSection />
    </Stack>
  );
}

function SectionHeader({ icon, title, subtitle, right }: { icon: ReactNode; title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <Group gap="sm" mb="md" wrap="nowrap" justify="space-between">
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon size={44} radius="md" variant="light" color="indigo">
          {icon}
        </ThemeIcon>
        <div>
          <Text fw={700}>{title}</Text>
          {subtitle && (
            <Text size="sm" c="dimmed">
              {subtitle}
            </Text>
          )}
        </div>
      </Group>
      {right}
    </Group>
  );
}

/** A selectable card with a round radio mark (address or payment mode). */
function ChoiceCard({ active, onSelect, children, extra }: {
  active: boolean;
  onSelect: () => void;
  children: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div
      role="radio"
      aria-checked={active}
      tabIndex={0}
      className={classes.option}
      data-active={active || undefined}
      style={{ cursor: 'pointer' }}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <span className={classes.mark} aria-hidden />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      {extra}
    </div>
  );
}

// ---------- Delivery address ----------

const EMPTY_FORM = { tag: 'Home' as Address['tag'], name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' };
type AddressForm = typeof EMPTY_FORM;

function validate(f: AddressForm): Partial<Record<keyof AddressForm, string>> {
  const errors: Partial<Record<keyof AddressForm, string>> = {};
  if (!f.name.trim()) errors.name = 'Enter the full name';
  if (!/^\d{10}$/.test(f.phone.trim())) errors.phone = 'Enter a 10-digit phone number';
  if (!f.line1.trim()) errors.line1 = 'Enter the house / street';
  if (!f.city.trim()) errors.city = 'Enter the city';
  if (!f.state.trim()) errors.state = 'Enter the state';
  if (!/^\d{6}$/.test(f.pincode.trim())) errors.pincode = 'Enter a 6-digit pincode';
  return errors;
}

function AddressSection({ onAddressChange }: { onAddressChange: (address: Address | null) => void }) {
  const [addresses, setAddresses] = useState<Address[]>(loadAddresses);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const saved = loadSelectedId();
    const list = loadAddresses();
    return list.some((a) => a.id === saved) ? saved : (list[0]?.id ?? null);
  });
  const [adding, setAdding] = useState(addresses.length === 0);
  const [form, setForm] = useState<AddressForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<ReturnType<typeof validate>>({});

  const selected = addresses.find((a) => a.id === selectedId) ?? null;
  useEffect(() => onAddressChange(selected), [selected, onAddressChange]);

  function select(id: string | null) {
    setSelectedId(id);
    saveSelectedId(id);
  }

  function update(list: Address[]) {
    setAddresses(list);
    saveAddresses(list);
  }

  function field(key: keyof AddressForm) {
    return {
      value: form[key],
      error: errors[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.currentTarget.value;
        setForm((f) => ({ ...f, [key]: value }));
        setErrors((er) => ({ ...er, [key]: undefined }));
      },
    };
  }

  function save() {
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const address: Address = {
      id: `${Date.now()}`,
      tag: form.tag,
      name: form.name.trim(),
      phone: form.phone.trim(),
      line1: form.line1.trim(),
      line2: form.line2.trim() || undefined,
      city: form.city.trim(),
      state: form.state.trim(),
      pincode: form.pincode.trim(),
    };
    update([...addresses, address]);
    select(address.id);
    setForm(EMPTY_FORM);
    setAdding(false);
  }

  function remove(id: string) {
    const list = addresses.filter((a) => a.id !== id);
    update(list);
    if (selectedId === id) select(list[0]?.id ?? null);
    if (list.length === 0) setAdding(true);
  }

  return (
    <Paper radius="lg" p="md" withBorder>
      <SectionHeader
        icon={<IconMapPin size={24} />}
        title="Delivery address"
        subtitle={addresses.length > 0 ? 'Choose where to deliver' : 'Add an address to deliver to'}
        right={
          addresses.length > 0 && !adding ? (
            <Button size="xs" variant="light" color="indigo" leftSection={<IconPlus size={14} />} onClick={() => setAdding(true)}>
              Add new
            </Button>
          ) : undefined
        }
      />

      {addresses.length > 0 && (
        <Stack gap="sm" role="radiogroup" aria-label="Saved addresses">
          {addresses.map((a) => (
            <ChoiceCard
              key={a.id}
              active={a.id === selectedId}
              onSelect={() => select(a.id)}
              extra={
                <Tooltip label="Remove address" withArrow>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label="Remove address"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(a.id);
                    }}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Tooltip>
              }
            >
              <Group gap={6} mb={2}>
                <Badge size="xs" radius="sm" variant="light" color="indigo">
                  {a.tag}
                </Badge>
                <Text size="sm" fw={600}>
                  {a.name}
                </Text>
                <Text size="xs" c="dimmed">
                  {a.phone}
                </Text>
              </Group>
              <Text size="sm" c="gray.7" lineClamp={2}>
                {formatAddress(a)}
              </Text>
            </ChoiceCard>
          ))}
        </Stack>
      )}

      {adding && (
        <Stack gap="sm" mt={addresses.length > 0 ? 'md' : 0} className={classes.form}>
          <SegmentedControl
            size="xs"
            color="indigo"
            data={['Home', 'Work', 'Other']}
            value={form.tag}
            onChange={(tag) => setForm((f) => ({ ...f, tag: tag as Address['tag'] }))}
          />
          <SimpleGrid cols={2} spacing="sm">
            <TextInput label="Full name" withAsterisk {...field('name')} />
            <TextInput label="Phone" withAsterisk inputMode="numeric" maxLength={10} {...field('phone')} />
          </SimpleGrid>
          <TextInput label="House / flat / street" withAsterisk {...field('line1')} />
          <TextInput label="Area / landmark" {...field('line2')} />
          <SimpleGrid cols={3} spacing="sm">
            <TextInput label="City" withAsterisk {...field('city')} />
            <TextInput label="State" withAsterisk {...field('state')} />
            <TextInput label="Pincode" withAsterisk inputMode="numeric" maxLength={6} {...field('pincode')} />
          </SimpleGrid>
          <Group justify="flex-end" gap="xs">
            {addresses.length > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  setAdding(false);
                  setForm(EMPTY_FORM);
                  setErrors({});
                }}
              >
                Cancel
              </Button>
            )}
            <Button size="sm" color="indigo" onClick={save}>
              Save address
            </Button>
          </Group>
        </Stack>
      )}
    </Paper>
  );
}

// ---------- Payment mode ----------

function PaymentSection() {
  // Only cash on delivery for now; more modes can be added to this list later.
  const [mode, setMode] = useState('cod');
  return (
    <Paper radius="lg" p="md" withBorder>
      <SectionHeader icon={<IconCreditCard size={24} />} title="Payment mode" subtitle="How the customer will pay" />
      <Stack gap="sm" role="radiogroup" aria-label="Payment mode">
        <ChoiceCard active={mode === 'cod'} onSelect={() => setMode('cod')}>
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon size={32} radius="md" variant="light" color="green">
              <IconCash size={18} />
            </ThemeIcon>
            <div>
              <Text size="sm" fw={600}>
                Cash on delivery
              </Text>
              <Text size="xs" c="dimmed">
                Pay in cash when the order arrives
              </Text>
            </div>
          </Group>
        </ChoiceCard>
      </Stack>
    </Paper>
  );
}
