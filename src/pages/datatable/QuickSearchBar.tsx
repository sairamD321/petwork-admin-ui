import {
  ActionIcon,
  Button,
  CloseButton,
  Group,
  Indicator,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  type MantineTransition,
} from '@mantine/core';
import { IconAdjustmentsHorizontal, IconChevronDown, IconFilter, IconSearch } from '@tabler/icons-react';
import { useClickOutside } from '@mantine/hooks';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { SearchField } from '../../api/blueprint';
import { isActive, isDropdown, minLength, type QuickSearch } from './quickSearch';
import classes from './QuickSearchBar.module.css';
import { useSearchOptions } from './useSearchOptions';

interface QuickSearchBarProps {
  /** Shown inline in the bar (`quickSearchFilter: true`). */
  fields: SearchField[];
  /** Every other search field; shown in the filter button's panel. No button when empty. */
  moreFields?: SearchField[];
  search: QuickSearch;
  onChange: (search: QuickSearch) => void;
  /** Search status ("Searching...", "20 results"), shown under the last active filter. */
  resultHint?: string;
}

/** Hints go below the inputs so every filter stays top-aligned in one line. */
const HINT_BELOW: ('label' | 'input' | 'description' | 'error')[] = ['label', 'input', 'description', 'error'];
const GROW = { flex: 1, minWidth: 0 };

/** Dropdown menus slide down from the input while fading in. */
const SLIDE_DOWN: MantineTransition = {
  in: { opacity: 1, transform: 'translateY(0) scaleY(1)' },
  out: { opacity: 0, transform: 'translateY(-8px) scaleY(0.96)' },
  common: { transformOrigin: 'top' },
  transitionProperty: 'opacity, transform',
};
const DROPDOWN_PROPS = {
  offset: 6,
  transitionProps: { transition: SLIDE_DOWN, duration: 240, timingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' },
};
/** Shared look for every search/filter input; see QuickSearchBar.module.css. */
const INPUT_CLASSES = {
  root: classes.root,
  input: classes.input,
  section: classes.section,
};
const DROPDOWN_CLASSES = {
  ...INPUT_CLASSES,
  dropdown: classes.dropdown,
  option: classes.option,
  empty: classes.empty,
};

/**
 * One filter per quick-search field, in blueprint order, all on one line.
 * The remaining fields sit behind a square filter button at the right end of the bar.
 */
export default function QuickSearchBar({ fields, moreFields = [], search, onChange, resultHint }: QuickSearchBarProps) {
  const lastActive = fields.filter((f) => isActive(f, search[f.field])).at(-1);
  const renderFilter = (f: SearchField, hint?: string, inPopover?: boolean) => {
    const value = search[f.field] ?? '';
    const set = (v: string) => onChange({ ...search, [f.field]: v });
    return isDropdown(f) ? (
      <DropdownFilter key={f.field} field={f} value={value} onChange={set} hint={hint} inPopover={inPopover} />
    ) : (
      <TextFilter key={f.field} field={f} value={value} onChange={set} hint={hint} />
    );
  };

  return (
    <Group gap="xs" align="flex-start" wrap="nowrap" style={GROW}>
      {fields.map((f) => renderFilter(f, f === lastActive ? resultHint : undefined))}
      {moreFields.length > 0 && (
        <MoreFilters
          fields={moreFields}
          search={search}
          onChange={onChange}
          renderFilter={(f) => renderFilter(f, undefined, true)}
          // With no quick filter in use, the result count would have nowhere to go; show it in the panel.
          resultHint={lastActive ? undefined : resultHint}
        />
      )}
    </Group>
  );
}

interface MoreFiltersProps {
  fields: SearchField[];
  search: QuickSearch;
  onChange: (search: QuickSearch) => void;
  renderFilter: (f: SearchField) => ReactNode;
  resultHint?: string;
}

/**
 * Square filter button with a box of the non-quick search fields right below it; a badge counts the active ones.
 * Hovering shows the box; clicking the button (or anything in the box) keeps it open until you click outside.
 */
function MoreFilters({ fields, search, onChange, renderFilter, resultHint }: MoreFiltersProps) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const opened = hovered || pinned;
  // Whether the box was already pinned when the current press started (the press itself pins it).
  const wasPinned = useRef(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  const activeCount = fields.filter((f) => isActive(f, search[f.field])).length;
  const clearAll = () => {
    const next = { ...search };
    for (const f of fields) delete next[f.field];
    onChange(next);
  };
  const close = () => {
    clearTimeout(hoverTimer.current);
    setHovered(false);
    setPinned(false);
  };

  // Close when clicking anywhere outside the button and its box (option menus render inside the box).
  const ref = useClickOutside(close);

  return (
    <div
      ref={ref}
      className={classes.moreFilters}
      onKeyDown={(e) => e.key === 'Escape' && close()}
      onMouseEnter={() => {
        clearTimeout(hoverTimer.current);
        setHovered(true);
      }}
      // A short delay so moving from the button into the box doesn't flicker it shut.
      onMouseLeave={() => {
        hoverTimer.current = setTimeout(() => setHovered(false), 200);
      }}
      // Using anything in the box keeps it open after the mouse leaves.
      onMouseDownCapture={() => {
        wasPinned.current = pinned;
        setPinned(true);
      }}
    >
      <Indicator label={activeCount} size={18} disabled={activeCount === 0} color="indigo" offset={4}>
        <ActionIcon
          type="button"
          size={42}
          radius="md"
          variant={activeCount > 0 || opened ? 'light' : 'default'}
          color="indigo"
          aria-label="More filters"
          aria-expanded={opened}
          title="More filters"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Clicking while it is pinned open closes it; otherwise it pins it open.
            // Keyboard presses (detail 0) skip mousedown, so they toggle here.
            if (e.detail === 0) setPinned((p) => !p);
            else if (wasPinned.current) close();
          }}
        >
          <IconFilter size={18} />
        </ActionIcon>
      </Indicator>
      {opened && (
        <Paper withBorder shadow="md" radius="md" p="sm" className={classes.moreFiltersBox}>
          <Stack gap="sm">
            <Group justify="space-between">
              <Text fw={600} size="sm">
                Filters
              </Text>
              {activeCount > 0 && (
                <Button variant="subtle" size="compact-xs" onClick={clearAll}>
                  Clear all
                </Button>
              )}
            </Group>
            {fields.map(renderFilter)}
            {activeCount > 0 && resultHint && (
              <Text size="xs" c="dimmed">
                {resultHint}
              </Text>
            )}
          </Stack>
        </Paper>
      )}
    </div>
  );
}

interface FilterProps {
  field: SearchField;
  value: string;
  onChange: (value: string) => void;
}

function DropdownFilter({ field, value, onChange, hint, inPopover }: FilterProps & { hint?: string; inPopover?: boolean }) {
  const { options, failed } = useSearchOptions(field);
  const [open, setOpen] = useState(false);
  return (
    <Select
      className={value ? classes.filled : undefined}
      leftSection={<IconAdjustmentsHorizontal size={16} />}
      // Our arrow replaces Mantine's ⇅ (it sits next to the × clear button when there is a value).
      rightSection={<IconChevronDown size={16} className={classes.chevron} data-open={open || undefined} />}
      onDropdownOpen={() => setOpen(true)}
      onDropdownClose={() => setOpen(false)}
      checkIconPosition="right"
      aria-label={field.displayName}
      placeholder={field.placeholder || field.displayName}
      title={field.toolTip || undefined}
      data={options}
      value={value || null}
      onChange={(v) => onChange(v ?? '')}
      disabled={field.editable === false}
      description={failed ? 'Could not load options' : hint}
      error={failed || undefined}
      inputWrapperOrder={HINT_BELOW}
      searchable
      clearable
      nothingFoundMessage="No matches"
      // Inside the filter panel the menu must not portal out, or picking an option would close the panel.
      comboboxProps={inPopover ? { ...DROPDOWN_PROPS, withinPortal: false } : DROPDOWN_PROPS}
      classNames={DROPDOWN_CLASSES}
      style={GROW}
    />
  );
}

function TextFilter({ field, value, onChange, hint: resultHint }: FilterProps & { hint?: string }) {
  const min = minLength(field);
  const maxSize = Number(field.rules?.[0]?.maxSize);
  const typed = value.trim().length;
  const hint = typed > 0 && typed < min ? `Type at least ${min} characters` : resultHint;

  return (
    <TextInput
      aria-label={field.displayName}
      placeholder={field.placeholder || `Search ${field.displayName.toLowerCase()}...`}
      title={field.toolTip || undefined}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      maxLength={maxSize > 0 ? maxSize : undefined}
      disabled={field.editable === false}
      description={hint}
      inputWrapperOrder={HINT_BELOW}
      classNames={INPUT_CLASSES}
      className={value ? classes.filled : undefined}
      leftSection={<IconSearch size={16} />}
      rightSection={value ? <CloseButton size="sm" aria-label={`Clear ${field.displayName}`} onClick={() => onChange('')} /> : null}
      style={GROW}
    />
  );
}
