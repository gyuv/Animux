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
        /*
         * The neon-void scale. 900/800/700 are the three named tones of the
         * identity itself (Deep Void, Onyx Dark, Obsidian); 950/600/500 are
         * interpolated so every existing ink-* class in the app — nothing
         * here was renamed — repaints into the new identity for free.
         */
        ink: {
          950: '#050508',
          900: '#080810',
          800: '#0F0F1A',
          700: '#141426',
          600: '#1E1E38',
          500: '#2A2A4A',
        },
        haze: '#9C94BE',
        paper: '#F5F4FF',
        signal: '#FF2E63',
        gold: '#FFD700',
        violet: '#8B5CF6',
        cyan: '#00F2FE',
        // Resolved at runtime from the artwork of whatever is on screen.
        chroma: 'rgb(var(--chroma) / <alpha-value>)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-ui)', 'system-ui', 'sans-serif'],
        // Orbitron has no CJK glyphs, so native-language titles (進撃の巨人)
        // get their own face rather than silently falling back mid-string.
        native: ['var(--font-native)', 'system-ui', 'sans-serif'],
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
        // Neon-identity motion primitives — transform/opacity only, so every
        // one of these is compositor-only and cheap on low-end mobile GPUs.
        glowPulse: {
          '0%, 100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.08)' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0) rotate(var(--tilt, 0deg))' },
          '50%': { transform: 'translateY(-10px) rotate(calc(var(--tilt, 0deg) + 1deg))' },
        },
        shimmerSweep: {
          from: { transform: 'translateX(-120%) rotate(8deg)' },
          to: { transform: 'translateX(220%) rotate(8deg)' },
        },
        conicShine: {
          to: { '--shine-angle': '360deg' },
        },
        chargeBar: {
          from: { transform: 'scaleX(0)' },
          to: { transform: 'scaleX(1)' },
        },
        ripple: {
          from: { transform: 'scale(0.3)', opacity: '0.9' },
          to: { transform: 'scale(2.6)', opacity: '0' },
        },
      },
      animation: {
        'pulse-signal': 'pulseSignal 2.4s ease-in-out infinite',
        sheen: 'sheen 1.8s var(--ease-physical, ease) infinite',
        rise: 'rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        fade: 'fade 0.4s ease both',
        'scale-in': 'scaleIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) both',
        drift: 'drift 24s ease-in-out infinite',
        'glow-pulse': 'glowPulse 2.6s ease-in-out infinite',
        'float-slow': 'floatSlow 7s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        'shimmer-sweep': 'shimmerSweep 1.4s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        'conic-shine': 'conicShine 2.2s linear infinite',
        'charge-bar': 'chargeBar 1.1s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        ripple: 'ripple 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
    },
  },
  plugins: [],
};
