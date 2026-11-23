import { ActionIcon, Button, Group, Loader, Text, Tooltip } from '@mantine/core';
import { IconMinus, IconPlus, IconShoppingCartPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { removeFromCart, setCartQuantity } from '../../api/records';
import type { BlueprintAction } from '../../api/blueprint';
import { actionLabel } from './actionDisplay';

interface CartStepperProps {
  action: BlueprintAction;
  variantId: string | undefined;
  /** Quantity already in the cart (kept by the list, so it survives re-renders and searches). */
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  /** Fill the width (cards) or stay compact (table rows). */
  fullWidth?: boolean;
  /** `light`: green outline on pale green (product cards). `solid`: filled green with white text (cart panel). */
  tone?: 'light' | 'solid';
}

/**
 * "Add to Cart", then a − qty + stepper. Every change POSTs `{ variantId, quantity }` (the new total)
 * to the action's `createApi`; the shown quantity only changes once the backend accepts it.
 */
export default function CartStepper({
  action,
  variantId,
  quantity,
  onQuantityChange,
  fullWidth,
  tone = 'light',
}: CartStepperProps) {
  const solid = tone === 'solid';
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(next: number) {
    if (!action.createApi || !variantId || sending) return;
    setSending(true);
    setError(null);
    try {
      // Down to zero removes the line; any other change POSTs the new total.
      if (next <= 0) await removeFromCart(action.createApi, variantId);
      else await setCartQuantity(action.createApi, variantId, next);
      onQuantityChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the cart.');
    } finally {
      setSending(false);
    }
  }

  // Clicks here must not also open the record's edit form.
  const stop = (event: React.MouseEvent | React.KeyboardEvent) => event.stopPropagation();

  const control =
    quantity <= 0 ? (
      <Button
        size="compact-xs"
        radius="sm"
        variant="filled"
        color="green"
        fullWidth={fullWidth}
        leftSection={<IconShoppingCartPlus size={13} />}
        loading={sending}
        disabled={!variantId}
        onClick={() => void send(1)}
      >
        {actionLabel(action)}
      </Button>
    ) : (
      <Group
        gap={0}
        wrap="nowrap"
        justify="space-between"
        w={fullWidth ? '100%' : undefined}
        style={{
          border: '1px solid var(--mantine-color-green-7)',
          borderRadius: 'var(--mantine-radius-sm)',
          background: solid ? 'var(--mantine-color-green-7)' : 'var(--mantine-color-green-0)',
        }}
      >
        <ActionIcon
          variant={solid ? 'filled' : 'subtle'}
          color={solid ? 'green.7' : 'green'}
          size={solid ? 'md' : 'sm'}
          aria-label="Decrease quantity"
          disabled={sending}
          onClick={() => void send(quantity - 1)}
        >
          <IconMinus size={13} />
        </ActionIcon>
        <Text size={solid ? 'sm' : 'xs'} fw={700} c={solid ? 'white' : 'green.8'} miw={22} ta="center" aria-live="polite">
          {sending ? <Loader size={12} color={solid ? 'white' : 'green'} /> : quantity}
        </Text>
        <ActionIcon
          variant={solid ? 'filled' : 'subtle'}
          color={solid ? 'green.7' : 'green'}
          size={solid ? 'md' : 'sm'}
          aria-label="Increase quantity"
          disabled={sending}
          onClick={() => void send(quantity + 1)}
        >
          <IconPlus size={13} />
        </ActionIcon>
      </Group>
    );

  return (
    <div onClick={stop} onKeyDown={stop} style={{ width: fullWidth ? '100%' : undefined }}>
      <Tooltip label={error ?? 'This product has no variant to add'} disabled={!error && !!variantId} withArrow color={error ? 'red' : undefined}>
        <div>{control}</div>
      </Tooltip>
      {error && (
        <Text size="xs" c="red" mt={4} lineClamp={2}>
          {error}
        </Text>
      )}
    </div>
  );
}
