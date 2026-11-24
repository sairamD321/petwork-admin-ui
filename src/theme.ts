import { createTheme, type MantineColorsTuple } from '@mantine/core';

/**
 * The site's signature blue, #2D518F, as a 10-shade scale (lightest to darkest).
 * Shade 6 is the exact brand colour; Mantine uses it for filled buttons, active states and headings.
 * It replaces the `indigo` palette, so every `indigo` colour in the app follows the brand.
 */
const brand: MantineColorsTuple = [
  '#eef2f9',
  '#dce4f1',
  '#b8c8e3',
  '#91a9d3',
  '#6f8dc2',
  '#4d6fab',
  '#2d518f',
  '#264579',
  '#1e3862',
  '#162a4a',
];

export const theme = createTheme({
  primaryColor: 'indigo',
  primaryShade: 6,
  colors: { indigo: brand },
  fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  headings: { fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  defaultRadius: 'md',
});
