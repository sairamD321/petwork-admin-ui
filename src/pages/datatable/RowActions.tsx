import { ActionIcon, Button, Group, Tooltip } from '@mantine/core';
import { IconPencil, IconTrash } from '@tabler/icons-react';
import type { BlueprintAction } from '../../api/blueprint';
import { actionIcon, actionLabel, isCartAction, isDeleteAction, isEditAction } from './actionDisplay';
import CartStepper from './CartStepper';

/** The record's cart line, for "Add to Cart" actions. */
export interface CartState {
  variantId: string | undefined;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
}

interface RowActionsProps {
  actions: BlueprintAction[];
  onAction: (action: BlueprintAction) => void;
  /** `icons`: compact icon buttons (table rows). `buttons`: labelled boxes filling the width (cards). */
  variant?: 'icons' | 'buttons';
  cart?: CartState;
}

/** A record's blueprint row-level actions. */
export default function RowActions({ actions, onAction, variant = 'icons', cart }: RowActionsProps) {
  const run = (a: BlueprintAction) => (event: React.MouseEvent) => {
    event.stopPropagation();
    onAction(a);
  };

  // "Add to Cart" actions become a quantity stepper; the others stay buttons.
  const cartActions = cart ? actions.filter(isCartAction) : [];
  const steppers = cartActions.map((a) => (
    <CartStepper
      key={a.action}
      action={a}
      variantId={cart!.variantId}
      quantity={cart!.quantity}
      onQuantityChange={cart!.onQuantityChange}
    />
  ));
  if (cartActions.length) actions = actions.filter((a) => !cartActions.includes(a));

  if (variant === 'buttons') {
    return (
      <Group gap={6} wrap="nowrap" justify="flex-end" w="100%">
        {steppers}
        {actions.map((a) => {
          const Icon = isDeleteAction(a)
            ? IconTrash
            : isEditAction(a)
              ? IconPencil
              : actionIcon(a);
          const label = isEditAction(a) ? 'Edit' : isDeleteAction(a) ? 'Delete' : actionLabel(a);
          return Icon ? (
            <Tooltip key={a.action} label={label} withArrow>
              <ActionIcon
                variant="subtle"
                size="md"
                radius="md"
                color={isDeleteAction(a) ? 'red' : 'indigo'}
                aria-label={label}
                onClick={run(a)}
              >
                <Icon size={17} />
              </ActionIcon>
            </Tooltip>
          ) : (
            <Button key={a.action} variant="subtle" size="compact-xs" onClick={run(a)}>
              {label}
            </Button>
          );
        })}
      </Group>
    );
  }

  return (
    <Group gap={4} wrap="nowrap" justify="flex-end">
      {steppers}
      {actions.map((a) => {
        const Icon = actionIcon(a);
        const label = actionLabel(a);
        const color = isDeleteAction(a) ? 'red' : undefined;
        return Icon ? (
          <Tooltip key={a.action} label={label} withArrow>
            <ActionIcon variant="subtle" color={color} aria-label={label} onClick={run(a)}>
              <Icon size={18} />
            </ActionIcon>
          </Tooltip>
        ) : (
          <Button key={a.action} variant="subtle" size="compact-xs" color={color} onClick={run(a)}>
            {label}
          </Button>
        );
      })}
    </Group>
  );
}
