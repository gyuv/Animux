/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#08060D',
          900: '#0E0B16',
          800: '#16121F',
          700: '#211A2E',
          600: '#2E2540',
          500: '#3D3154',
        },
        haze: '#B6ADC8',
        paper: '#F2EDF7',
        signal: '#FF4D6D',
        gold: '#F5C542',
        // Resolved at runtime from the artwork of whatever is on screen.
        chroma: 'rgb(var(--chroma) / <alpha-value>)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-ui)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Scales with --density so TV gets 10-foot type from the same classes.
        micro: ['calc(0.6875rem * var(--density))', { lineHeight: '1.4', letterSpacing: '0.01em' }],
        meta: ['calc(0.8125rem * var(--density))', { lineHeight: '1.45' }],
        body: ['calc(0.9375rem * var(--density))', { lineHeight: '1.6' }],
        lead: ['calc(1.0625rem * var(--density))', { lineHeight: '1.65' }],
        title: ['calc(1.375rem * var(--density))', { lineHeight: '1.25', letterSpacing: '-0.01em' }],
        hero: ['calc(2.75rem * var(--density))', { lineHeight: '1.02', letterSpacing: '-0.03em' }],
        mega: ['calc(4rem * var(--density))', { lineHeight: '0.95', letterSpacing: '-0.04em' }],
        colossal: ['calc(6.5rem * var(--density))', { lineHeight: '0.82', letterSpacing: '-0.05em' }],
      },
      borderRadius: {
        // Deliberately unequal: artwork is soft, controls are crisp.
        art: '14px',
        panel: '20px',
        key: '10px',
      },
      spacing: {
        gutter: 'var(--gutter)',
        rail: 'var(--rail-w)',
        topbar: 'var(--topbar-h)',
      },
      transitionTimingFunction: {
        physical: 'cubic-bezier(0.22, 1, 0.36, 1)',
        snap: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        pulseSignal: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
        sheen: {
          from: { transform: 'translateX(-120%)' },
          to: { transform: 'translateX(220%)' },
        },
        rise: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fade: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        drift: {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(2%, -2%, 0) scale(1.06)' },
        },
      },
      animation: {
        'pulse-signal': 'pulseSignal 2.4s ease-in-out infinite',
        sheen: 'sheen 1.8s var(--ease-physical, ease) infinite',
        rise: 'rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        fade: 'fade 0.4s ease both',
        'scale-in': 'scaleIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) both',
        drift: 'drift 24s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
