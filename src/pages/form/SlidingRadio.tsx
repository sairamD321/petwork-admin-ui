import { Input, SegmentedControl } from '@mantine/core';
import type { CSSProperties, ReactNode } from 'react';
import classes from './SlidingRadio.module.css';

interface SlidingRadioProps {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  withAsterisk?: boolean;
  /** Layout overrides for the wrapper; `wrapper` is applied to the segmented track. */
  styles?: { root?: CSSProperties; wrapper?: CSSProperties };
  options: string[];
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

/** Long option sets get a smaller size so they stay on one line in narrow columns. */
const sizeFor = (options: string[]) =>
  options.length >= 5 || options.join('').length > 34 ? 'sm' : 'md';

/**
 * A single-choice field as a segmented track: a filled pill glides behind the selected option.
 * Keyboard and screen readers get real radio inputs underneath (Mantine's SegmentedControl).
 */
export default function SlidingRadio({
  label,
  description,
  error,
  withAsterisk,
  styles,
  options,
  value,
  disabled,
  onChange,
}: SlidingRadioProps) {
  return (
    <Input.Wrapper
      label={label}
      description={description}
      error={error}
      withAsterisk={withAsterisk}
      styles={{ root: styles?.root }}
    >
      <SegmentedControl
        style={styles?.wrapper}
        data={options}
        // No choice yet: an unmatched value leaves the pill hidden instead of picking the first option.
        value={value}
        onChange={onChange}
        // Mantine writes `data-disabled="false"` for `false`, which still matches `[data-disabled]`
        // in CSS and faded every enabled control; pass undefined so the attribute is left off.
        disabled={disabled || undefined}
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
