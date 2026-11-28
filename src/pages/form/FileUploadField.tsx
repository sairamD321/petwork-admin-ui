import {
  ActionIcon,
  Box,
  CloseButton,
  FileButton,
  Group,
  Image,
  Input,
  Modal,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconFile, IconPhotoPlus } from '@tabler/icons-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import classes from './FileUploadField.module.css';

interface FileUploadFieldProps {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  /** e.g. ".jpg,.png" */
  accept?: string;
  /** Multiple files: each pick adds to the list (one by one). Single: a pick replaces the file. */
  multiple?: boolean;
  disabled?: boolean;
  value: File | File[] | null;
  onChange: (value: File | File[] | null) => void;
}

const sameFile = (a: File, b: File) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
const isImage = (f: File) => f.type.startsWith('image/');

/**
 * File picker that shows what was picked: small thumbnails inside the upload box, a "+" tile to add
 * another file, a × to remove one, and a click on a thumbnail opens a large preview.
 */
export default function FileUploadField({
  label,
  description,
  error,
  required,
  accept,
  multiple,
  disabled,
  value,
  onChange,
}: FileUploadFieldProps) {
  const files = useMemo(
    () => (Array.isArray(value) ? value : value instanceof File ? [value] : []),
    [value],
  );
  // Browser-local preview links for the picked files; released when the files change.
  const urls = useMemo(() => files.map((f) => (isImage(f) ? URL.createObjectURL(f) : null)), [files]);
  useEffect(() => () => urls.forEach((u) => u && URL.revokeObjectURL(u)), [urls]);

  const [open, setOpen] = useState<number | null>(null);

  function add(picked: File | File[] | null) {
    const list = Array.isArray(picked) ? picked : picked ? [picked] : [];
    if (!list.length) return;
    if (!multiple) {
      onChange(list[0]);
      return;
    }
    onChange([...files, ...list.filter((f) => !files.some((g) => sameFile(f, g)))]);
  }

  function remove(index: number) {
    if (!multiple) {
      onChange(null);
      return;
    }
    onChange(files.filter((_, i) => i !== index));
  }

  const previewable = files.map((f, i) => ({ file: f, url: urls[i], index: i })).filter((p) => p.url);
  const current = open === null ? null : previewable.find((p) => p.index === open) ?? null;
  const step = (by: number) => {
    if (!current) return;
    const at = previewable.indexOf(current);
    setOpen(previewable[(at + by + previewable.length) % previewable.length].index);
  };

  const addLabel = !multiple && files.length ? 'Replace' : multiple && files.length ? 'Add more' : 'Upload';

  return (
    <Input.Wrapper label={label} description={description} error={error} required={required}>
      <Box className={classes.box} data-error={error ? true : undefined} data-disabled={disabled || undefined} mt={4}>
        <Group gap="sm" align="flex-start">
          {files.map((f, i) => (
            <div key={`${f.name}-${f.size}-${f.lastModified}`} className={classes.item}>
              <div className={classes.thumbWrap}>
                {!disabled && (
                  <CloseButton
                    size="xs"
                    radius="xl"
                    variant="filled"
                    className={classes.remove}
                    aria-label={`Remove ${f.name}`}
                    onClick={() => remove(i)}
                  />
                )}
                {urls[i] ? (
                  <UnstyledButton
                    type="button"
                    className={classes.thumb}
                    onClick={() => setOpen(i)}
                    aria-label={`Preview ${f.name}`}
                    title="Preview"
                  >
                    <Image src={urls[i]!} alt={f.name} w="100%" h="100%" fit="cover" />
                  </UnstyledButton>
                ) : (
                  <div className={classes.thumb} title={f.name}>
                    <IconFile size={28} color="var(--mantine-color-gray-5)" />
                  </div>
                )}
              </div>
              <Tooltip label={f.name} openDelay={300}>
                <Text size="xs" c="dimmed" ta="center" truncate className={classes.name}>
                  {f.name}
                </Text>
              </Tooltip>
            </div>
          ))}

          <FileButton onChange={add} accept={accept} disabled={disabled}>
            {(props) => (
              <UnstyledButton {...props} type="button" className={classes.addTile} disabled={disabled}>
                <IconPhotoPlus size={22} />
                <Text size="xs" fw={600}>
                  {addLabel}
                </Text>
              </UnstyledButton>
            )}
          </FileButton>
        </Group>
        {multiple && files.length > 0 && (
          <Text size="xs" c="dimmed" mt={8}>
            {files.length} {files.length === 1 ? 'file' : 'files'} selected
          </Text>
        )}
      </Box>

      <Modal
        opened={current !== null}
        onClose={() => setOpen(null)}
        size="xl"
        centered
        title={
          current && (
            <Group gap="xs">
              <Text fw={600}>{current.file.name}</Text>
              {previewable.length > 1 && (
                <Text size="sm" c="dimmed">
                  {previewable.indexOf(current) + 1} / {previewable.length}
                </Text>
              )}
            </Group>
          )
        }
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') step(1);
          if (e.key === 'ArrowLeft') step(-1);
        }}
        transitionProps={{ transition: 'pop', duration: 200 }}
      >
        {current && (
          <Group wrap="nowrap" gap="xs" align="center">
            {previewable.length > 1 && (
              <ActionIcon variant="light" size="lg" radius="xl" aria-label="Previous" onClick={() => step(-1)}>
                <IconChevronLeft size={20} />
              </ActionIcon>
            )}
            <Box flex={1} className={classes.previewStage}>
              <Image src={current.url!} alt={current.file.name} h="70vh" fit="contain" />
            </Box>
            {previewable.length > 1 && (
              <ActionIcon variant="light" size="lg" radius="xl" aria-label="Next" onClick={() => step(1)}>
                <IconChevronRight size={20} />
              </ActionIcon>
            )}
          </Group>
        )}
      </Modal>
    </Input.Wrapper>
  );
}
