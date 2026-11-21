import { AspectRatio, Box, Center, Group, Image, Stack, Text } from '@mantine/core';
import { IconPhotoOff } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { formatValue } from './cellValue';
import classes from './RecordCard.module.css';

export interface CardField {
  label: string;
  value: unknown;
}

interface RecordCardProps {
  title: string;
  imageUrl?: string;
  onClick: () => void;
  /** Extra label/value lines under the title. */
  fields: CardField[];
  size?: string;
  mrp?: number;
  price?: number;
  discount?: number;
  /** Row-level action buttons, shown at the bottom right. */
  actions?: ReactNode;
}

const currency = (value: number) =>
  `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value)}`;

export default function RecordCard({
  title,
  imageUrl,
  onClick,
  fields,
  size,
  mrp,
  price,
  discount,
  actions,
}: RecordCardProps) {
  return (
    <Stack gap={4} h="100%" className={classes.card}>
      <Stack
        gap={4}
        role="button"
        tabIndex={0}
        aria-label={`Edit ${title}`}
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick();
          }
        }}
        style={{ cursor: 'pointer' }}
      >
        <AspectRatio ratio={1}>
          <Box
            bg="var(--mantine-color-default-hover)"
            style={{ position: 'relative', borderRadius: 'var(--mantine-radius-md)', overflow: 'hidden' }}
          >
            {discount !== undefined && discount > 0 && (
              <Box className={classes.discountBadge}>
                {Math.round(discount)}%<br />OFF
              </Box>
            )}
            {imageUrl ? (
              <Image src={imageUrl} alt={title} h="100%" w="100%" fit="contain" loading="lazy" />
            ) : (
              <Center h="100%">
                <IconPhotoOff size={32} color="var(--mantine-color-dimmed)" />
              </Center>
            )}
          </Box>
        </AspectRatio>

        <Text size="14px" fw={600} lineClamp={2} title={title} mt={6} className={classes.title}>
          {title}
        </Text>

        {fields.map((f) => (
          <Group key={f.label} gap={6} wrap="nowrap">
            <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
              {f.label}
            </Text>
            <Text size="xs" truncate>
              {formatValue(f.value)}
            </Text>
          </Group>
        ))}

        {(size || mrp !== undefined || price !== undefined) && (
          <Group justify="space-between" align="flex-end" wrap="nowrap" mt={4}>
            <Text size="12px" fw={600}>
              {size ?? ''}
            </Text>
            {(mrp !== undefined || price !== undefined) && (
              <Stack gap={0} align="flex-end">
                {mrp !== undefined && mrp !== price && (
                  <Text size="10px" c="dimmed" td="line-through">
                    {currency(mrp)}
                  </Text>
                )}
                {price !== undefined && (
                  <Text size="14px" fw={700}>
                    {currency(price)}
                  </Text>
                )}
              </Stack>
            )}
          </Group>
        )}
      </Stack>

      {actions && (
        <Group mt="auto" pt={8}>
          {actions}
        </Group>
      )}
    </Stack>
  );
}
