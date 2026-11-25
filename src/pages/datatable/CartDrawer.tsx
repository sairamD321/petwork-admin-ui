import { ActionIcon, Box, Button, Drawer, Group, Stack, Text, Tooltip } from '@mantine/core';
import { IconArrowLeft, IconArrowRight, IconPrinter } from '@tabler/icons-react';
import { useState } from 'react';
import type { BlueprintAction } from '../../api/blueprint';
import type { Address } from './addressBook';
import { BillCard, CartEmpty, CartError, CartSkeleton, ItemsCard, TotalBar } from './CartParts';
import classes from './Checkout.module.css';
import CheckoutView from './CheckoutView';
import { summarizeCart } from './cartSummary';
import { printInvoice } from './printInvoice';
import type { CartController } from './useCart';

interface CartDrawerProps {
  opened: boolean;
  onClose: () => void;
  cart: CartController;
  /** Endpoint for quantity changes made here; the add action's `createApi`, else the cart's own endpoint. */
  updateAction: BlueprintAction | undefined;
  /** Variant id -> picture, used when the cart response has no image for a line. */
  fallbackImages?: Record<string, string>;
  /** Variant id -> the product card's title, so cart lines and the invoice use the same full name. */
  productTitles?: Record<string, string>;
}

type Step = 'cart' | 'checkout';

/**
 * "My Cart": the saved cart's items with − qty + steppers, the bill, and a Checkout bar.
 * Checkout opens a second screen in the same panel: address, the cart again, payment mode, Print invoice.
 */
export default function CartDrawer({ opened, onClose, cart, updateAction, fallbackImages, productTitles }: CartDrawerProps) {
  const [step, setStep] = useState<Step>('cart');
  const [address, setAddress] = useState<Address | null>(null);
  const summary = summarizeCart(cart, productTitles);
  const { load } = cart;
  const hasItems = summary.saved !== null && summary.lines.length > 0;

  function goToCheckout() {
    setStep('checkout');
    cart.reload(); // fresh prices and quantities from the cart API for the checkout screen
  }

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      // The next time the cart opens, it starts on the cart again.
      onExitTransitionEnd={() => setStep('cart')}
      position="right"
      size={480}
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
        <ActionIcon
          variant="subtle"
          color="dark"
          size="lg"
          aria-label={step === 'checkout' ? 'Back to cart' : 'Close cart'}
          onClick={step === 'checkout' ? () => setStep('cart') : onClose}
        >
          <IconArrowLeft size={22} />
        </ActionIcon>
        <Text fw={700} size="lg">
          {step === 'checkout' ? 'Checkout' : 'My Cart'}
        </Text>
      </Group>

      {/* Body; key: each step slides in and starts scrolled to the top. */}
      <Box key={step} p="md" bg="var(--mantine-color-gray-0)" className={classes.step} style={{ flex: 1, overflowY: 'auto' }}>
        {(load.status === 'loading' || load.status === 'idle') && <CartSkeleton />}
        {load.status === 'error' && <CartError message={load.message} onRetry={cart.reload} />}
        {summary.saved && !hasItems && <CartEmpty />}
        {hasItems &&
          (step === 'checkout' ? (
            <CheckoutView
              summary={summary}
              cart={cart}
              updateAction={updateAction}
              fallbackImages={fallbackImages}
              onAddressChange={setAddress}
            />
          ) : (
            <Stack gap="md">
              <ItemsCard summary={summary} cart={cart} updateAction={updateAction} fallbackImages={fallbackImages} />
              <BillCard summary={summary} />
            </Stack>
          ))}
      </Box>

      {/* Footer: total plus Checkout, or Print invoice on the checkout screen. */}
      {hasItems && (
        <TotalBar total={summary.grandTotal}>
          {step === 'checkout' ? (
            <Tooltip label="Add a delivery address first" disabled={address !== null} withArrow>
              <Button
                variant="white"
                color="indigo.7"
                leftSection={<IconPrinter size={18} />}
                radius="md"
                // data-disabled (not disabled): keeps the tooltip working while it can't print yet.
                data-disabled={address === null || undefined}
                onClick={() => address && printInvoice(summary)}
              >
                Print invoice
              </Button>
            </Tooltip>
          ) : (
            <Button
              variant="white"
              color="indigo.7"
              rightSection={<IconArrowRight size={18} />}
              radius="md"
              onClick={goToCheckout}
            >
              Checkout
            </Button>
          )}
        </TotalBar>
      )}
    </Drawer>
  );
}
