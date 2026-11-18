import { ActionIcon, Button, Group, Tooltip } from '@mantine/core';
import type { BlueprintAction } from '../../api/blueprint';
import { actionIcon, actionLabel, isDeleteAction } from './actionDisplay';

interface RowActionsProps {
  actions: BlueprintAction[];
  onAction: (action: BlueprintAction) => void;
}

/** A record's blueprint row-level actions, as icon buttons where an icon is known. */
export default function RowActions({ actions, onAction }: RowActionsProps) {
  return (
    <Group gap={4} wrap="nowrap" justify="flex-end">
      {actions.map((a) => {
        const Icon = actionIcon(a);
        const label = actionLabel(a);
        const color = isDeleteAction(a) ? 'red' : undefined;
        return Icon ? (
          <Tooltip key={a.action} label={label} withArrow>
            <ActionIcon variant="subtle" color={color} aria-label={label} onClick={() => onAction(a)}>
              <Icon size={18} />
            </ActionIcon>
          </Tooltip>
        ) : (
          <Button key={a.action} variant="subtle" size="compact-xs" color={color} onClick={() => onAction(a)}>
            {label}
          </Button>
        );
      })}
    </Group>
  );
}
