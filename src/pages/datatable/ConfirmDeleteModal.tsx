import { Alert, Button, Group, Modal, Text } from '@mantine/core';

interface ConfirmDeleteModalProps {
  name: string;
  deleting: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmDeleteModal({ name, deleting, error, onCancel, onConfirm }: ConfirmDeleteModalProps) {
  return (
    <Modal opened onClose={onCancel} title="Delete?" centered closeOnClickOutside={!deleting}>
      <Text size="sm">
        <Text span fw={600}>
          {name}
        </Text>{' '}
        will be permanently deleted. This can't be undone.
      </Text>
      {error && (
        <Alert color="red" mt="md">
          {error}
        </Alert>
      )}
      <Group justify="flex-end" mt="lg">
        <Button variant="default" onClick={onCancel} disabled={deleting}>
          Cancel
        </Button>
        <Button color="red" onClick={onConfirm} loading={deleting}>
          Delete
        </Button>
      </Group>
    </Modal>
  );
}
