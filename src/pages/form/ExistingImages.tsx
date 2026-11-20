import { Anchor, Box, Group, Image, Stack, Text } from '@mantine/core';

interface ExistingImagesProps {
  urls: string[];
  label?: string;
  size?: number;
}

/** The images a record already has on the server; click one to open it full size. */
export default function ExistingImages({ urls, label = 'Current images', size = 88 }: ExistingImagesProps) {
  if (!urls.length) return null;
  return (
    <Stack gap={6}>
      <Text size="xs" c="dimmed">
        {label} ({urls.length})
      </Text>
      <Group gap="xs">
        {urls.map((url) => (
          <Anchor key={url} href={url} target="_blank" rel="noreferrer" title="Open full size">
            <Box
              w={size}
              h={size}
              bg="var(--mantine-color-default-hover)"
              style={{
                borderRadius: 'var(--mantine-radius-md)',
                border: '1px solid var(--mantine-color-default-border)',
                overflow: 'hidden',
              }}
            >
              <Image src={url} alt="" w="100%" h="100%" fit="contain" loading="lazy" />
            </Box>
          </Anchor>
        ))}
      </Group>
    </Stack>
  );
}
