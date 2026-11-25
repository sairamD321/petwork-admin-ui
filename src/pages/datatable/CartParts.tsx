import {
  Alert,
  Box,
  Button,
  Center,
  Divider,
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
  IconPhotoOff,
  IconReceipt,
  IconShoppingBag,
  IconShoppingCartOff,
} from '@tabler/icons-react';
import { useState, type ReactNode } from 'react';
import type { BlueprintAction } from '../../api/blueprint';
import type { CartItem } from '../../api/records';
import CartStepper from './CartStepper';
import { currency, type CartSummary } from './cartSummary';
import type { CartController } from './useCart';

/** Shared pieces of the cart and checkout screens, so both show the cart exactly the same way. */

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
        <Text size="sm" fw={500} style={{ overflowWrap: 'anywhere' }}>
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

export function CartSkeleton() {
  return (
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
  );
}

export function CartError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert color="red" icon={<IconAlertCircle size={18} />} title="Couldn't load the cart">
      <Text size="sm" mb="sm">
        {message}
      </Text>
      <Button size="xs" variant="light" color="red" onClick={onRetry}>
        Try again
      </Button>
    </Alert>
  );
}

export function CartEmpty() {
  return (
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
  );
}

export function ItemsCard({ summary, cart, updateAction, fallbackImages, title = 'Items in cart' }: {
  summary: CartSummary;
  cart: CartController;
  updateAction: BlueprintAction | undefined;
  fallbackImages?: Record<string, string>;
  title?: string;
}) {
  const { lines, unitCount } = summary;
  return (
    <Paper radius="lg" p="md" withBorder>
      <Group gap="sm" mb="md" wrap="nowrap">
        <ThemeIcon size={44} radius="md" variant="light" color="indigo">
          <IconShoppingBag size={24} />
        </ThemeIcon>
        <div>
          <Text fw={700}>{title}</Text>
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
  );
}

export function BillCard({ summary }: { summary: CartSummary }) {
  const { itemsTotal, charges, grandTotal } = summary;
  return (
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
  );
}

/** The blue bar pinned at the bottom: total on the left, the step's button on the right. */
export function TotalBar({ total, children }: { total: number; children: ReactNode }) {
  return (
    <Box p="md" style={{ borderTop: '1px solid var(--mantine-color-gray-2)', background: 'var(--mantine-color-white)' }}>
      <Group
        justify="space-between"
        wrap="nowrap"
        px="md"
        py="sm"
        style={{ background: 'var(--mantine-color-indigo-6)', borderRadius: 'var(--mantine-radius-md)' }}
      >
        <div>
          <Text c="white" fw={700} size="lg" lh={1.2}>
            {currency(total)}
          </Text>
          <Text c="white" size="xs" tt="uppercase" style={{ opacity: 0.85, letterSpacing: '0.04em' }}>
            Total
          </Text>
        </div>
        {children}
      </Group>
    </Box>
  );
}
