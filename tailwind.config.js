/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx}',
    './*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#0E0B16',
          800: '#16121F',
          700: '#211A2E',
          600: '#2E2540',
        },
        haze: '#B6ADC8',
        paper: '#F2EDF7',
        signal: '#FF4D6D',
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
      },
      transitionTimingFunction: {
        physical: 'cubic-bezier(0.22, 1, 0.36, 1)',
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
      },
      animation: {
        'pulse-signal': 'pulseSignal 2.4s ease-in-out infinite',
        sheen: 'sheen 1.8s var(--ease-physical, ease) infinite',
      },
    },
  },
  plugins: [],
};
