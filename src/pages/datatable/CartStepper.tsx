import { ActionIcon, Button, Group, Loader, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { IconMinus, IconPlus, IconShoppingCartPlus, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { removeFromCart, setCartQuantity } from '../../api/records';
import type { BlueprintAction } from '../../api/blueprint';
import { actionLabel } from './actionDisplay';
import classes from './CartStepper.module.css';

interface CartStepperProps {
  action: BlueprintAction;
  cartKey: string | undefined;
  /** Quantity already in the cart (kept by the list, so it survives re-renders and searches). */
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  /** Fill the width (cards) or stay compact (table rows). */
  fullWidth?: boolean;
  /** `light`: brand-blue outline on a pale blue tint (product cards). `solid`: filled brand blue with white text (cart panel). */
  tone?: 'light' | 'solid';
  /** `lg`: a full-size button and stepper (the product page). */
  size?: 'sm' | 'lg';
}

/**
 * "Add to Cart", then a − qty + stepper. Every change POSTs `{ variantId, quantity }` or `{ upc, quantity }` (the new total)
 * to the action's `createApi`; the shown quantity only changes once the backend accepts it.
 */
export default function CartStepper({
  action,
  cartKey,
  quantity,
  onQuantityChange,
  fullWidth,
  tone = 'light',
  size = 'sm',
}: CartStepperProps) {
  const solid = tone === 'solid';
  const large = size === 'lg';
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(next: number) {
    if (!action.createApi || !cartKey || sending) return;
    setSending(true);
    setError(null);
    try {
      // Down to zero removes the line; any other change POSTs the new total.
      if (next <= 0) await removeFromCart(action.createApi, cartKey);
      else await setCartQuantity(action.createApi, cartKey, next);
      onQuantityChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the cart.');
    } finally {
      setSending(false);
    }
  }

  // Clicks here must not also open the record's edit form.
  const stop = (event: React.MouseEvent | React.KeyboardEvent) => event.stopPropagation();

  // Product page: a compact brand-blue pill with a soft glow; it opens into a − qty + stepper of the same size.
  const largeControl =
    quantity <= 0 ? (
      <UnstyledButton
        className={classes.add}
        data-sending={sending || undefined}
        disabled={!cartKey || sending}
        onClick={() => void send(1)}
      >
        <span className={classes.addIcon}>
          {sending ? <Loader size={13} color="white" /> : <IconShoppingCartPlus size={15} stroke={2.2} />}
        </span>
        <span>{actionLabel(action)}</span>
      </UnstyledButton>
    ) : (
      <div className={classes.stepper} data-sending={sending || undefined}>
        <UnstyledButton
          className={classes.stepBtn}
          aria-label="Decrease quantity"
          disabled={sending}
          onClick={() => void send(quantity - 1)}
        >
          {quantity === 1 ? <IconTrash size={14} /> : <IconMinus size={14} stroke={2.6} />}
        </UnstyledButton>
        <div className={classes.qty} aria-live="polite">
          {sending ? <Loader size={13} color="white" /> : <span key={quantity} className={classes.qtyValue}>{quantity}</span>}
          <span className={classes.qtyLabel}>in cart</span>
        </div>
        <UnstyledButton
          className={classes.stepBtn}
          aria-label="Increase quantity"
          disabled={sending}
          onClick={() => void send(quantity + 1)}
        >
          <IconPlus size={14} stroke={2.6} />
        </UnstyledButton>
      </div>
    );

  const control = large ? largeControl :
    quantity <= 0 ? (
      <Button
        size={large ? 'md' : 'compact-xs'}
        radius={large ? 'md' : 'sm'}
        variant="filled"
        color="indigo"
        fullWidth={fullWidth}
        leftSection={<IconShoppingCartPlus size={large ? 18 : 13} />}
        loading={sending}
        disabled={!cartKey}
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
          border: '1px solid var(--mantine-color-indigo-6)',
          borderRadius: large ? 'var(--mantine-radius-md)' : 'var(--mantine-radius-sm)',
          padding: large ? 4 : undefined,
          background: solid ? 'var(--mantine-color-indigo-6)' : 'var(--mantine-color-indigo-0)',
        }}
      >
        <ActionIcon
          variant={solid ? 'filled' : 'subtle'}
          color={solid ? 'indigo.6' : 'indigo'}
          size={large ? 34 : solid ? 'md' : 'sm'}
          aria-label="Decrease quantity"
          disabled={sending}
          onClick={() => void send(quantity - 1)}
        >
          <IconMinus size={large ? 16 : 13} />
        </ActionIcon>
        <Text size={large ? 'md' : solid ? 'sm' : 'xs'} fw={700} c={solid ? 'white' : 'indigo.7'} miw={large ? 40 : 22} ta="center" aria-live="polite">
          {sending ? <Loader size={12} color={solid ? 'white' : 'indigo'} /> : quantity}
        </Text>
        <ActionIcon
          variant={solid ? 'filled' : 'subtle'}
          color={solid ? 'indigo.6' : 'indigo'}
          size={large ? 34 : solid ? 'md' : 'sm'}
          aria-label="Increase quantity"
          disabled={sending}
          onClick={() => void send(quantity + 1)}
        >
          <IconPlus size={large ? 16 : 13} />
        </ActionIcon>
      </Group>
    );

  return (
    <div onClick={stop} onKeyDown={stop} style={{ width: fullWidth ? '100%' : undefined }}>
      <Tooltip label={error ?? 'This product has no variant to add'} disabled={!error && !!cartKey} withArrow color={error ? 'red' : undefined}>
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
