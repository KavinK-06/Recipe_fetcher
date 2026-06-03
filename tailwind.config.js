/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        noir: '#1A0A0E',
        burgundy: '#6B1A2A',
        paprika: '#C4452A',
        saffron: '#E8B87A',
        parchment: '#F7F0E6',
        surface: '#2A1218',
        muted: '#4A2830',
      },
      fontFamily: {
        display: ['CormorantGaramond_400Regular'],
        'display-medium': ['CormorantGaramond_500Medium'],
        'display-semibold': ['CormorantGaramond_600SemiBold'],
        'display-bold': ['CormorantGaramond_700Bold'],
        body: ['DMSans_400Regular'],
        'body-medium': ['DMSans_500Medium'],
        'body-bold': ['DMSans_700Bold'],
        mono: ['JetBrainsMono_400Regular'],
        'mono-medium': ['JetBrainsMono_500Medium'],
        'mono-bold': ['JetBrainsMono_700Bold'],
      },
      borderRadius: {
        card: '20px',
        chip: '12px',
        pill: '50px',
      },
    },
  },
  plugins: [],
};
