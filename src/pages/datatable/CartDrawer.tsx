import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Center,
  Divider,
  Drawer,
  Group,
  Image,
  Paper,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconArrowLeft,
  IconPhotoOff,
  IconPrinter,
  IconReceipt,
  IconShoppingBag,
  IconShoppingCartOff,
} from '@tabler/icons-react';
import { useState } from 'react';
import type { BlueprintAction } from '../../api/blueprint';
import type { CartItem } from '../../api/records';
import CartStepper from './CartStepper';
import type { CartController } from './useCart';

interface CartDrawerProps {
  opened: boolean;
  onClose: () => void;
  cart: CartController;
  /** Endpoint for quantity changes made here; the add action's `createApi`, else the cart's own endpoint. */
  updateAction: BlueprintAction | undefined;
  /** Variant id -> picture, used when the cart response has no image for a line. */
  fallbackImages?: Record<string, string>;
}

const currency = (value: number) =>
  `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value)}`;

function ItemRow({ item, quantity, cart, updateAction, imageUrl }: {
  item: CartItem;
  quantity: number;
  cart: CartController;
  updateAction: BlueprintAction | undefined;
  imageUrl: string | undefined;
}) {
  const [broken, setBroken] = useState(false);
  return (
    <Group wrap="nowrap" align="center" gap="md">
      <Box
        w={64}
        h={64}
        style={{
          flexShrink: 0,
          overflow: 'hidden',
          borderRadius: 'var(--mantine-radius-md)',
          border: '1px solid var(--mantine-color-gray-2)',
          background: 'var(--mantine-color-white)',
        }}
      >
        {imageUrl && !broken ? (
          <Image src={imageUrl} alt="" w="100%" h="100%" fit="contain" loading="lazy" onError={() => setBroken(true)} />
        ) : (
          <Center h="100%">
            <IconPhotoOff size={22} color="var(--mantine-color-gray-5)" />
          </Center>
        )}
      </Box>

      <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
        <Text size="sm" fw={500} lineClamp={2}>
          {item.name ?? 'Product'}
        </Text>
        {item.size && (
          <Text size="xs" c="dimmed">
            {item.size}
          </Text>
        )}
        {item.price !== undefined && (
          <Group gap={6}>
            <Text size="sm" fw={700}>
              {currency(item.price)}
            </Text>
            {item.mrp !== undefined && item.mrp > item.price && (
              <Text size="xs" c="dimmed" td="line-through">
                {currency(item.mrp)}
              </Text>
            )}
          </Group>
        )}
      </Stack>

      {updateAction && (
        <Box style={{ flexShrink: 0 }}>
          <CartStepper
            action={updateAction}
            variantId={item.variantId}
            quantity={quantity}
            tone="solid"
            onQuantityChange={(q) => cart.setQuantity(item.variantId, q)}
          />
        </Box>
      )}
    </Group>
  );
}

/** "My Cart": the saved cart's items with − qty + steppers, the bill, and a Print receipt bar. */
export default function CartDrawer({ opened, onClose, cart, updateAction, fallbackImages }: CartDrawerProps) {
  const { load } = cart;
  const saved = load.status === 'ready' ? load.cart : null;

  // Quantities come from the shared cart state, so changes here and on the product cards stay in step.
  const lines = (saved?.items ?? [])
    .map((item) => ({ item, quantity: cart.quantities[item.variantId] ?? item.quantity }))
    .filter((l) => l.quantity > 0);
  const unitCount = lines.reduce((n, l) => n + l.quantity, 0);
  const itemsTotal = lines.reduce((sum, l) => sum + (l.item.price ?? 0) * l.quantity, 0);
  const charges = saved?.charges ?? [];
  // Worked out here, so it follows every +/− straight away.
  const grandTotal = charges.reduce(
    (sum, c) => sum + (c.label === 'Discount' ? -Math.abs(c.amount) : c.amount),
    itemsTotal,
  );

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size={440}
      padding={0}
      withCloseButton={false}
      // Header and footer stay put; only the middle scrolls.
      styles={{
        content: { display: 'flex', flexDirection: 'column' },
        body: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
      }}
    >
      {/* Header */}
      <Group gap="sm" px="md" py="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
        <ActionIcon variant="subtle" color="dark" size="lg" aria-label="Close cart" onClick={onClose}>
          <IconArrowLeft size={22} />
        </ActionIcon>
        <Text fw={700} size="lg">
          My Cart
        </Text>
      </Group>

      {/* Body */}
      <Box p="md" bg="var(--mantine-color-gray-0)" style={{ flex: 1, overflowY: 'auto' }}>
        {(load.status === 'loading' || load.status === 'idle') && (
          <Paper radius="lg" p="md" withBorder>
            <Stack gap="md">
              {Array.from({ length: 3 }, (_, i) => (
                <Group key={i} wrap="nowrap">
                  <Skeleton w={64} h={64} radius="md" />
                  <Stack gap={6} style={{ flex: 1 }}>
                    <Skeleton h={12} />
                    <Skeleton h={10} w="40%" />
                  </Stack>
                </Group>
              ))}
            </Stack>
          </Paper>
        )}

        {load.status === 'error' && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} title="Couldn't load the cart">
            <Text size="sm" mb="sm">
              {load.message}
            </Text>
            <Button size="xs" variant="light" color="red" onClick={cart.reload}>
              Try again
            </Button>
          </Alert>
        )}

        {saved && lines.length === 0 && (
          <Center py={60}>
            <Stack align="center" gap="xs">
              <ThemeIcon size={56} radius="xl" variant="light" color="gray">
                <IconShoppingCartOff size={28} />
              </ThemeIcon>
              <Text fw={600}>Your cart is empty</Text>
              <Text size="sm" c="dimmed">
                Add products to see them here.
              </Text>
            </Stack>
          </Center>
        )}

        {saved && lines.length > 0 && (
          <Stack gap="md">
            <Paper radius="lg" p="md" withBorder>
              <Group gap="sm" mb="md" wrap="nowrap">
                <ThemeIcon size={44} radius="md" variant="light" color="green">
                  <IconShoppingBag size={24} />
                </ThemeIcon>
                <div>
                  <Text fw={700}>Items in cart</Text>
                  <Text size="sm" c="dimmed">
                    {lines.length} {lines.length === 1 ? 'product' : 'products'} · {unitCount}{' '}
                    {unitCount === 1 ? 'unit' : 'units'}
                  </Text>
                </div>
              </Group>
              <Stack gap="md">
                {lines.map((l, i) => (
                  <Box key={l.item.variantId}>
                    {i > 0 && <Divider mb="md" color="gray.1" />}
                    <ItemRow
                      item={l.item}
                      quantity={l.quantity}
                      cart={cart}
                      updateAction={updateAction}
                      imageUrl={l.item.imageUrl ?? fallbackImages?.[l.item.variantId]}
                    />
                  </Box>
                ))}
              </Stack>
            </Paper>

            <Paper radius="lg" p="md" withBorder>
              <Text fw={700} mb="sm">
                Bill details
              </Text>
              <Stack gap={8}>
                <Group justify="space-between">
                  <Group gap={6}>
                    <IconReceipt size={16} color="var(--mantine-color-gray-7)" />
                    <Text size="sm">Items total</Text>
                  </Group>
                  <Text size="sm">{currency(itemsTotal)}</Text>
                </Group>
                {charges.map((c) => (
                  <Group key={c.label} justify="space-between">
                    <Text size="sm" pl={22}>
                      {c.label}
                    </Text>
                    <Text size="sm" c={c.label === 'Discount' ? 'green.7' : undefined}>
                      {c.label === 'Discount' ? `−${currency(Math.abs(c.amount))}` : currency(c.amount)}
                    </Text>
                  </Group>
                ))}
                <Divider my={4} color="gray.2" />
                <Group justify="space-between">
                  <Text fw={700}>Grand total</Text>
                  <Text fw={700} size="lg">
                    {currency(grandTotal)}
                  </Text>
                </Group>
              </Stack>
            </Paper>
          </Stack>
        )}
      </Box>

      {/* Footer: total and Print receipt (no action yet). */}
      {saved && lines.length > 0 && (
        <Box p="md" style={{ borderTop: '1px solid var(--mantine-color-gray-2)', background: 'var(--mantine-color-white)' }}>
          <Group
            justify="space-between"
            wrap="nowrap"
            px="md"
            py="sm"
            style={{ background: 'var(--mantine-color-green-7)', borderRadius: 'var(--mantine-radius-md)' }}
          >
            <div>
              <Text c="white" fw={700} size="lg" lh={1.2}>
                {currency(grandTotal)}
              </Text>
              <Text c="white" size="xs" tt="uppercase" style={{ opacity: 0.85, letterSpacing: '0.04em' }}>
                Total
              </Text>
            </div>
            <Button variant="white" color="green.8" leftSection={<IconPrinter size={18} />} radius="md">
              Print receipt
            </Button>
          </Group>
        </Box>
      )}
    </Drawer>
  );
}
