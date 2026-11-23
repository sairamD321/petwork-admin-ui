import { Input, SegmentedControl, UnstyledButton } from '@mantine/core';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
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

/** Long option sets start from a smaller text size. */
const maxFontFor = (options: string[]) => (options.length >= 5 || options.join('').length > 34 ? 14 : 16);
/** Never shrink text below this; when even this won't fit on one line, the options wrap instead. */
const MIN_FONT = 12;
/** Room each option needs besides its text (side padding), and the track's own padding + border. */
const OPTION_PAD = 22;
const TRACK_PAD = 14;

let canvas: HTMLCanvasElement | undefined;
/** Width of the options' text at 1px font size (scales linearly), measured in the page's real font. */
function textUnits(options: string[], fontFamily: string): number {
  canvas ??= document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return options.join('').length * 0.62;
  ctx.font = `600 100px ${fontFamily}`;
  return options.reduce((sum, o) => sum + ctx.measureText(o).width, 0) / 100;
}

/** Width of the box the track sits in; that width never depends on the track itself. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Re-measures once web fonts finish loading (their widths differ from the fallback font's). */
function useFontsReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    void document.fonts?.ready.then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}

/**
 * A single-choice field as a segmented track: a filled pill glides behind the selected option.
 * Every option is always shown in full: text shrinks a little in narrow columns (e.g. when zoomed
 * in), and when even that isn't enough the options wrap onto more lines.
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
  const [boxRef, width] = useWidth();
  const fontsReady = useFontsReady();
  const maxFont = maxFontFor(options);

  const units = useMemo(() => {
    const family = boxRef.current ? getComputedStyle(boxRef.current).fontFamily : 'sans-serif';
    return textUnits(options, family);
    // fontsReady: measure again with the loaded font.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.join('\u0000'), fontsReady, width > 0]);

  const fitted = width > 0 ? (width - TRACK_PAD - options.length * OPTION_PAD) / units : maxFont;
  const fontSize = Math.min(maxFont, Math.floor(fitted * 10) / 10);
  const wrap = width > 0 && fontSize < MIN_FONT;

  return (
    <Input.Wrapper
      label={label}
      description={description}
      error={error}
      withAsterisk={withAsterisk}
      styles={{ root: styles?.root }}
    >
      <div ref={boxRef} className={classes.box}>
        {wrap ? (
          // Too narrow for one line: the same pills, wrapped onto as many lines as needed.
          <div
            role="radiogroup"
            className={classes.wrapTrack}
            style={styles?.wrapper}
            data-error={error ? true : undefined}
            data-disabled={disabled ? 'true' : undefined}
          >
            {options.map((o) => (
              <UnstyledButton
                key={o}
                role="radio"
                aria-checked={o === value}
                disabled={disabled}
                className={classes.wrapOption}
                data-active={o === value || undefined}
                onClick={() => onChange(o)}
              >
                {o}
              </UnstyledButton>
            ))}
          </div>
        ) : (
          <SegmentedControl
            style={{ ...styles?.wrapper, ['--sr-font' as string]: `${fontSize}px` }}
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
            size={maxFont === 14 ? 'sm' : 'md'}
            transitionDuration={350}
            transitionTimingFunction="cubic-bezier(0.34, 1.3, 0.64, 1)"
            classNames={classes}
            data-error={error ? true : undefined}
          />
        )}
      </div>
    </Input.Wrapper>
  );
}
