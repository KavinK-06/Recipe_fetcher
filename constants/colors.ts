export const Colors = {
  noir: '#1A0A0E',
  burgundy: '#6B1A2A',
  paprika: '#C4452A',
  saffron: '#E8B87A',
  parchment: '#F7F0E6',
  surface: '#2A1218',
  muted: '#4A2830',
} as const;

export type ColorKey = keyof typeof Colors;
