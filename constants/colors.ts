export const Colors = {
  noir: '#1A0A0E',
  burgundy: '#6B1A2A',
  paprika: '#C4452A',
  saffron: '#E8B87A',
  parchment: '#F7F0E6',
  surface: '#2A1218',
  // Dark warm-burgundy used for borders, dividers and track fills.
  muted: '#4A2830',
  // Readable warm taupe for secondary text (labels, sublabels, hints). `muted`
  // is far too dark for type on the dark backgrounds — use this for any text/icon
  // that needs to be legible but visually below the parchment headings (~6:1).
  mutedText: '#A89589',
} as const;

export type ColorKey = keyof typeof Colors;
