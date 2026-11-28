import { ActionIcon, Alert, Button, Grid, Group, Paper, Skeleton, Stack, Text, Title } from '@mantine/core';
import { IconAlertCircle, IconArrowLeft } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import type { DataRecord } from '../../api/records';
import { layoutSections, type FormSection } from './formLayout';
import { visibleFields } from './formRules';
import SectionFields from './SectionFields';
import { useBlueprintForm } from './useBlueprintForm';

interface BlueprintFormPageProps {
  title: string;
  subtitle?: string;
  blueprintApi: string;
  record?: DataRecord;
  fallbackRecordId?: string;
  onBack: () => void;
  onSaved: () => void;
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper withBorder radius="lg" p="lg">
      <Title order={4} c="indigo" mb="md">
        {title}
      </Title>
      {children}
    </Paper>
  );
}

/** A full-page create/edit form drawn entirely from a form blueprint. */
export default function BlueprintFormPage(props: BlueprintFormPageProps) {
  const { title, subtitle, blueprintApi, record, fallbackRecordId, onBack, onSaved } = props;
  const form = useBlueprintForm({ blueprintApi, record, fallbackRecordId, onSaved });
  const editing = !!record;
  const ready = form.load.status === 'ready';
  const { main, side } = layoutSections(visibleFields(form.fields, form.values));

  // The blueprint's `displayName` heads the form; below it the record's name (editing) or the page (creating).
  const displayName = form.load.status === 'ready' ? form.load.blueprint.displayName?.trim() : undefined;
  const heading = displayName || title;
  const subheading = displayName ? (editing ? title : subtitle) : subtitle;

  const renderCard = (s: FormSection, narrow?: boolean) => (
    <SectionCard key={s.key} title={s.title}>
      <SectionFields fields={s.fields} form={form} editing={editing} narrow={narrow} />
    </SectionCard>
  );

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.submit();
      }}
    >
      <Stack gap="lg">
        <Group gap="md" align="flex-start" wrap="nowrap">
          <ActionIcon variant="default" size={44} radius="md" aria-label="Back" onClick={onBack}>
            <IconArrowLeft size={20} />
          </ActionIcon>
          <div>
            <Title order={2} c="indigo">
              {heading}
            </Title>
            {subheading && (
              <Text size="sm" c="dimmed">
                {subheading}
              </Text>
            )}
          </div>
        </Group>

        {form.load.status === 'loading' && (
          <Grid gap="lg">
            <Grid.Col span={{ base: 12, lg: 8 }}>
              <Skeleton height={420} radius="lg" />
            </Grid.Col>
            <Grid.Col span={{ base: 12, lg: 4 }}>
              <Skeleton height={260} radius="lg" />
            </Grid.Col>
          </Grid>
        )}

        {form.load.status === 'error' && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} title="Couldn't load the form">
            {form.load.message}
          </Alert>
        )}

        {ready && (
          <Grid gap="lg">
            <Grid.Col span={{ base: 12, lg: 8 }}>
              <Stack gap="lg">{main.map((s) => renderCard(s))}</Stack>
            </Grid.Col>
            <Grid.Col span={{ base: 12, lg: 4 }}>
              <Stack gap="lg">{side.map((s) => renderCard(s, true))}</Stack>
            </Grid.Col>
          </Grid>
        )}

        {form.prefillError && (
          <Alert color="yellow" icon={<IconAlertCircle size={18} />} title="Couldn't load the form's data">
            {form.prefillError} The form opened empty; you can still fill it in.
          </Alert>
        )}

        {form.saveError && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} title="Couldn't save">
            {form.saveError}
          </Alert>
        )}

        {/* Sticky action bar, always reachable while scrolling a long form. */}
        <Paper
          withBorder
          radius="lg"
          p="sm"
          style={{ position: 'sticky', bottom: 'var(--mantine-spacing-md)', zIndex: 10 }}
          shadow="sm"
        >
          <Group justify="flex-end">
            {form.load.status === 'ready' && form.load.blueprint.resetButton && (
              <Button variant="subtle" color="gray" onClick={form.reset} disabled={form.saving} mr="auto">
                Reset
              </Button>
            )}
            <Button variant="default" onClick={onBack} disabled={form.saving}>
              Back
            </Button>
            <Button type="submit" loading={form.saving} disabled={!ready}>
              Save
            </Button>
          </Group>
        </Paper>
      </Stack>
    </form>
  );
}
