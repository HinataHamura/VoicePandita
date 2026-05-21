import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink:    '#14201E',
        paper:  '#EAF3EC',
        saffron:'#F27457',
        forest: '#0F6B5C',
        mist:   '#8DB5AC',
        clay:   '#9E5A4F',
        gold:   '#D2B34C',
        cream:  '#F8FBF5',
        indigo: '#263C7A',
        aqua:   '#58C2B1',
      },
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        body:    ['var(--font-body)', 'sans-serif'],
        bangla:  ['var(--font-bangla)', 'sans-serif'],
        mono:    ['var(--font-mono)', 'monospace'],
      },
      animation: {
        'pulse-slow':   'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'float':        'float 6s ease-in-out infinite',
        'wave':         'wave 1.5s ease-in-out infinite',
        'slide-up':     'slideUp 0.6s cubic-bezier(0.16,1,0.3,1) forwards',
        'fade-in':      'fadeIn 0.8s ease forwards',
        'ripple':       'ripple 1s ease-out forwards',
      },
      keyframes: {
        float: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%':     { transform: 'translateY(-12px)' },
        },
        wave: {
          '0%,100%': { transform: 'scaleY(0.5)' },
          '50%':     { transform: 'scaleY(1.5)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        ripple: {
          '0%':   { transform: 'scale(0)', opacity: '1' },
          '100%': { transform: 'scale(4)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}

export default config
