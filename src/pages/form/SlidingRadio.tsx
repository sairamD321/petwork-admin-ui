import { Input, SegmentedControl } from '@mantine/core';
import type { ReactNode } from 'react';
import classes from './SlidingRadio.module.css';

interface SlidingRadioProps {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  withAsterisk?: boolean;
  options: string[];
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

/** Long option sets get a smaller size so they stay on one line in narrow columns. */
const sizeFor = (options: string[]) =>
  options.length >= 5 || options.join('').length > 34 ? 'xs' : 'sm';

/**
 * A single-choice field as a segmented track: a filled pill glides behind the selected option.
 * Keyboard and screen readers get real radio inputs underneath (Mantine's SegmentedControl).
 */
export default function SlidingRadio({
  label,
  description,
  error,
  withAsterisk,
  options,
  value,
  disabled,
  onChange,
}: SlidingRadioProps) {
  return (
    <Input.Wrapper label={label} description={description} error={error} withAsterisk={withAsterisk}>
      <SegmentedControl
        data={options}
        // No choice yet: an unmatched value leaves the pill hidden instead of picking the first option.
        value={value}
        onChange={onChange}
        disabled={disabled}
        fullWidth
        radius="xl"
        // Same indigo as the card headings; set here so it wins over Mantine's default indicator colour.
        color="indigo"
        size={sizeFor(options)}
        transitionDuration={350}
        transitionTimingFunction="cubic-bezier(0.34, 1.3, 0.64, 1)"
        classNames={classes}
        data-error={error ? true : undefined}
      />
    </Input.Wrapper>
  );
}
