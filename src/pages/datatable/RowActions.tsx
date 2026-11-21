import { ActionIcon, Button, Group, Tooltip } from '@mantine/core';
import type { BlueprintAction } from '../../api/blueprint';
import { actionIcon, actionLabel, isDeleteAction, isEditAction } from './actionDisplay';

interface RowActionsProps {
  actions: BlueprintAction[];
  onAction: (action: BlueprintAction) => void;
  /** `icons`: compact icon buttons (table rows). `buttons`: labelled boxes filling the width (cards). */
  variant?: 'icons' | 'buttons';
}

/** Button text: plain "Edit" / "Delete" for those, otherwise the action's own label, capitalised. */
function buttonText(a: BlueprintAction) {
  if (isEditAction(a)) return 'Edit';
  if (isDeleteAction(a)) return 'Delete';
  const label = actionLabel(a);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** A record's blueprint row-level actions. */
export default function RowActions({ actions, onAction, variant = 'icons' }: RowActionsProps) {
  const run = (a: BlueprintAction) => (event: React.MouseEvent) => {
    event.stopPropagation();
    onAction(a);
  };

  if (variant === 'buttons') {
    return (
      <Group gap="xs" wrap="nowrap" grow w="100%">
        {actions.map((a) => (
          <Button
            key={a.action}
            variant="light"
            size="xs"
            radius="sm"
            color={isDeleteAction(a) ? 'red' : 'indigo'}
            onClick={run(a)}
          >
            {buttonText(a)}
          </Button>
        ))}
      </Group>
    );
  }

  return (
    <Group gap={4} wrap="nowrap" justify="flex-end">
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
