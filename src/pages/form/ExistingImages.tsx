import {
  ActionIcon,
  Badge,
  Box,
  CloseButton,
  Group,
  Image,
  Modal,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useState } from "react";
import type { ImageRef } from "./formRules";

interface ExistingImagesProps {
  images: ImageRef[];
  /** What these images belong to, e.g. "Main product images" or "Current Sub Images". */
  title: string;
  /** Badge colour, so main and variant images are told apart at a glance. */
  color?: string;
  size?: number;
  /** Shows a × on each image; called with the image's URL. */
  onRemove?: (url: string) => void;
}

/**
 * The images a record already has on the server, each with its name. Clicking one previews it in the
 * app: the storage links are served as downloads, so they're never opened directly.
 */
export default function ExistingImages({
  images,
  title,
  color = "indigo",
  size = 88,
  onRemove,
}: ExistingImagesProps) {
  const [open, setOpen] = useState<number | null>(null);
  if (!images.length) return null;

  const current = open === null ? null : images[open];
  const step = (by: number) =>
    setOpen((i) => (i === null ? i : (i + by + images.length) % images.length));

  return (
    <Stack gap={6}>
      <Group gap={6}>
        <Badge color={color} variant="light" radius="sm">
          {title}
        </Badge>
        <Text size="xs" c="dimmed">
          {images.length} {images.length === 1 ? "image" : "images"}
        </Text>
      </Group>
      <Group gap="sm" align="flex-start">
        {images.map(({ url, label }, i) => (
          <Stack key={url} gap={4} w={size} align="center">
            <Box pos="relative">
              {onRemove && (
                <Tooltip label="Delete image" openDelay={300}>
                  <CloseButton
                    size="sm"
                    radius="xl"
                    variant="filled"
                    aria-label={`Delete ${label}`}
                    onClick={() => onRemove(url)}
                    pos="absolute"
                    top={-7}
                    right={-7}
                    style={{
                      zIndex: 1,
                      background: "var(--mantine-color-red-6)",
                      color: "var(--mantine-color-white)",
                      border: "2px solid var(--mantine-color-body)",
                      boxShadow: "var(--mantine-shadow-xs)",
                    }}
                  />
                </Tooltip>
              )}
              <UnstyledButton
                type="button"
                onClick={() => setOpen(i)}
                aria-label={`Preview ${label}`}
                title="Preview"
              >
                <Box
                  w={size}
                  h={size}
                  bg="var(--mantine-color-default-hover)"
                  style={{
                    borderRadius: "var(--mantine-radius-md)",
                    border: `1px solid var(--mantine-color-${color}-3)`,
                    overflow: "hidden",
                    cursor: "zoom-in",
                  }}
                >
                  <Image
                    src={url}
                    alt={label}
                    w="100%"
                    h="100%"
                    fit="contain"
                    loading="lazy"
                  />
                </Box>
              </UnstyledButton>
            </Box>
            <Tooltip label={label} openDelay={300}>
              <Text size="xs" fw={600} ta="center" w="100%" truncate>
                {label}
              </Text>
            </Tooltip>
          </Stack>
        ))}
      </Group>

      <Modal
        opened={current !== null}
        onClose={() => setOpen(null)}
        size="xl"
        centered
        title={
          current && (
            <Group gap="xs">
              <Badge color={color} variant="light" radius="sm">
                {title}
              </Badge>
              <Text fw={600}>{current.label}</Text>
              {images.length > 1 && (
                <Text size="sm" c="dimmed">
                  {open! + 1} / {images.length}
                </Text>
              )}
            </Group>
          )
        }
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") step(1);
          if (e.key === "ArrowLeft") step(-1);
        }}
        transitionProps={{ transition: "pop", duration: 200 }}
      >
        {current && (
          <Group wrap="nowrap" gap="xs" align="center">
            {images.length > 1 && (
              <ActionIcon
                variant="light"
                color={color}
                size="lg"
                radius="xl"
                aria-label="Previous"
                onClick={() => step(-1)}
              >
                <IconChevronLeft size={20} />
              </ActionIcon>
            )}
            <Box
              flex={1}
              bg="var(--mantine-color-default-hover)"
              style={{
                borderRadius: "var(--mantine-radius-md)",
                overflow: "hidden",
              }}
            >
              <Image
                src={current.url}
                alt={current.label}
                h="70vh"
                fit="contain"
              />
            </Box>
            {images.length > 1 && (
              <ActionIcon
                variant="light"
                color={color}
                size="lg"
                radius="xl"
                aria-label="Next"
                onClick={() => step(1)}
              >
                <IconChevronRight size={20} />
              </ActionIcon>
            )}
          </Group>
        )}
      </Modal>
    </Stack>
  );
}
