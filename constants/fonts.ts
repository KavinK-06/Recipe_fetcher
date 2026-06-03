export const Fonts = {
  displayRegular: 'CormorantGaramond_400Regular',
  displayMedium: 'CormorantGaramond_500Medium',
  displaySemiBold: 'CormorantGaramond_600SemiBold',
  displayBold: 'CormorantGaramond_700Bold',

  bodyRegular: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',

  monoRegular: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

export type FontKey = keyof typeof Fonts;
