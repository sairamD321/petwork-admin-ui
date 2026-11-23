import { CloseButton, Group, Select, TextInput, type MantineTransition } from '@mantine/core';
import { IconAdjustmentsHorizontal, IconChevronDown, IconSearch } from '@tabler/icons-react';
import { useState } from 'react';
import type { SearchField } from '../../api/blueprint';
import { isActive, isDropdown, minLength, type QuickSearch } from './quickSearch';
import classes from './QuickSearchBar.module.css';
import { useSearchOptions } from './useSearchOptions';

interface QuickSearchBarProps {
  fields: SearchField[];
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

/** One filter per quick-search field, in blueprint order, all on one line. */
export default function QuickSearchBar({ fields, search, onChange, resultHint }: QuickSearchBarProps) {
  const lastActive = fields.filter((f) => isActive(f, search[f.field])).at(-1);

  return (
    <Group gap="xs" align="flex-start" wrap="nowrap" style={GROW}>
      {fields.map((f) => {
        const value = search[f.field] ?? '';
        const set = (v: string) => onChange({ ...search, [f.field]: v });
        const hint = f === lastActive ? resultHint : undefined;
        return isDropdown(f) ? (
          <DropdownFilter key={f.field} field={f} value={value} onChange={set} hint={hint} />
        ) : (
          <TextFilter key={f.field} field={f} value={value} onChange={set} hint={hint} />
        );
      })}
    </Group>
  );
}

interface FilterProps {
  field: SearchField;
  value: string;
  onChange: (value: string) => void;
}

function DropdownFilter({ field, value, onChange, hint }: FilterProps & { hint?: string }) {
  const { options, failed } = useSearchOptions(field);
  const [open, setOpen] = useState(false);
  return (
    <Select
      className={value ? classes.filled : undefined}
      leftSection={<IconAdjustmentsHorizontal size={16} />}
      // With a value, the clear (×) button takes this spot.
      rightSection={value ? undefined : <IconChevronDown size={16} className={classes.chevron} data-open={open || undefined} />}
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
      comboboxProps={DROPDOWN_PROPS}
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
