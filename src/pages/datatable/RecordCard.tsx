import { AspectRatio, Box, Center, Group, Image, Stack, Text } from '@mantine/core';
import { IconPhotoOff } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { formatValue } from './cellValue';

export interface CardField {
  label: string;
  value: unknown;
}

interface RecordCardProps {
  title: string;
  imageUrl?: string;
  /** Extra label/value lines under the title. */
  fields: CardField[];
  /** Row-level action buttons, shown at the bottom right. */
  actions?: ReactNode;
  /** Outlines the card, e.g. for a search match. */
  highlighted?: boolean;
}

export default function RecordCard({ title, imageUrl, fields, actions, highlighted }: RecordCardProps) {
  return (
    <Stack
      gap={4}
      h="100%"
      p={highlighted ? 6 : undefined}
      m={highlighted ? -6 : undefined}
      bg={highlighted ? 'var(--mantine-primary-color-light)' : undefined}
      style={highlighted ? { borderRadius: 'var(--mantine-radius-md)' } : undefined}
    >
      <AspectRatio ratio={1}>
        <Box
          bg="var(--mantine-color-default-hover)"
          style={{ borderRadius: 'var(--mantine-radius-md)', overflow: 'hidden' }}
        >
          {imageUrl ? (
            <Image src={imageUrl} alt={title} h="100%" w="100%" fit="contain" loading="lazy" />
          ) : (
            <Center h="100%">
              <IconPhotoOff size={32} color="var(--mantine-color-dimmed)" />
            </Center>
          )}
        </Box>
      </AspectRatio>

      <Text fw={500} truncate title={title} mt={6}>
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

      {actions && (
        <Group justify="flex-end" mt="auto" pt={4}>
          {actions}
        </Group>
      )}
    </Stack>
  );
}
