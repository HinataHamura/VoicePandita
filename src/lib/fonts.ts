import localFont from 'next/font/local'

const display = localFont({
  src: '../../node_modules/@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2',
  variable: '--font-display',
  display: 'swap',
  weight: '400',
  fallback: ['Georgia', 'serif'],
})

const body = localFont({
  src: '../../node_modules/@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff2',
  variable: '--font-body',
  display: 'swap',
  weight: '400',
  fallback: ['system-ui', 'sans-serif'],
})

const bangla = localFont({
  src: [
    {
      path: '../../node_modules/@fontsource/noto-sans-bengali/files/noto-sans-bengali-bengali-400-normal.woff2',
      weight: '400',
    },
    {
      path: '../../node_modules/@fontsource/noto-sans-bengali/files/noto-sans-bengali-bengali-500-normal.woff2',
      weight: '500',
    },
    {
      path: '../../node_modules/@fontsource/noto-sans-bengali/files/noto-sans-bengali-bengali-600-normal.woff2',
      weight: '600',
    },
    {
      path: '../../node_modules/@fontsource/noto-sans-bengali/files/noto-sans-bengali-bengali-700-normal.woff2',
      weight: '700',
    },
  ],
  variable: '--font-bangla',
  display: 'swap',
  fallback: ['sans-serif'],
})

const mono = localFont({
  src: '../../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2',
  variable: '--font-mono',
  display: 'swap',
  weight: '400',
  fallback: ['ui-monospace', 'monospace'],
})

export { display, body, bangla, mono }
