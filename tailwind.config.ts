import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#2db30e',
        'primary-container': '#2db30e',
        'primary-fixed': '#5fff44',
        'primary-fixed-dim': '#248f0b',
        'inverse-primary': '#0a4504',
        'on-primary': '#FFFFFF',
        'on-primary-container': '#0a4504',
        'on-primary-fixed': '#011400',
        'on-primary-fixed-variant': '#073500',
        'surface-tint': '#248f0b',

        'secondary': '#CBD5E1',
        'secondary-container': '#3e4852',
        'secondary-fixed': '#dae3f0',
        'secondary-fixed-dim': '#bdc8d3',
        'on-secondary': '#28313b',
        'on-secondary-container': '#acb6c2',
        'on-secondary-fixed': '#131d25',
        'on-secondary-fixed-variant': '#3e4852',

        'tertiary': '#fff8f7',
        'tertiary-container': '#ffd3ce',
        'tertiary-fixed': '#ffdad6',
        'tertiary-fixed-dim': '#e7bdb8',
        'on-tertiary': '#442927',
        'on-tertiary-container': '#7a5955',
        'on-tertiary-fixed': '#2c1513',
        'on-tertiary-fixed-variant': '#5d3f3c',

        'error': '#ffb4ab',
        'error-container': '#93000a',
        'on-error': '#690005',
        'on-error-container': '#ffdad6',

        'background': '#050a04',
        'on-background': '#FFFFFF',
        'surface': '#050a04',
        'surface-dim': '#050a04',
        'surface-bright': '#222d1e',
        'surface-variant': '#1c2619',
        'surface-container-lowest': '#040803',
        'surface-container-low': '#0a1208',
        'surface-container': '#0e150b',
        'surface-container-high': '#151e12',
        'surface-container-highest': '#1c2619',
        'inverse-surface': '#dae6d0',
        'inverse-on-surface': '#1e291a',
        'on-surface': '#FFFFFF',
        'on-surface-variant': '#BCC4B9',

        'outline': '#6d7d65',
        'outline-variant': '#2a3624',

        'accent-gold': '#d4b106',
        'accent-gold-dim': '#8a7404',
        'accent-gold-bright': '#f0c920',
        'on-accent-gold': '#0d0800',
        'accent-gold-container': '#3a2f02',
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        full: '9999px',
      },
      spacing: {
        unit: '8px',
        'margin-desktop': '40px',
        'margin-mobile': '16px',
        gutter: '24px',
        'container-max': '1440px',
      },
      fontFamily: {
        sans: ['var(--font-jakarta)', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        'display-lg': ['var(--font-jakarta)', 'Plus Jakarta Sans', 'sans-serif'],
        'headline-md': ['var(--font-jakarta)', 'Plus Jakarta Sans', 'sans-serif'],
        'body-md': ['var(--font-jakarta)', 'Plus Jakarta Sans', 'sans-serif'],
        'body-lg': ['var(--font-jakarta)', 'Plus Jakarta Sans', 'sans-serif'],
        'label-sm': ['var(--font-jakarta)', 'Plus Jakarta Sans', 'sans-serif'],
      },
      fontSize: {
        'display-lg': ['48px', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '800' }],
        'display-lg-mobile': ['32px', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-md': ['24px', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '600' }],
        'body-lg': ['18px', { lineHeight: '1.6', fontWeight: '400' }],
        'body-md': ['16px', { lineHeight: '1.6', fontWeight: '400' }],
        'label-sm': ['12px', { lineHeight: '1', letterSpacing: '0.05em', fontWeight: '600' }],
      },
      keyframes: {
        'pulse-glow': {
          '0%,100%': { opacity: '0.4', transform: 'scaleX(1)' },
          '50%': { opacity: '1', transform: 'scaleX(1.1)' },
        },
        'pulse-wipe': {
          '0%': { height: '0%', top: '0', opacity: '0' },
          '50%': { height: '100%', top: '0', opacity: '1' },
          '100%': { height: '0%', top: '100%', opacity: '0' },
        },
        'glow-pulse': {
          '0%,100%': { boxShadow: '0 0 5px #2db30e', transform: 'scale(1)' },
          '50%': { boxShadow: '0 0 25px rgba(45,179,14,0.4)', transform: 'scale(1.05)' },
        },
        draw: {
          to: { strokeDashoffset: '0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        heartbeat: {
          '0%,100%': { transform: 'scale(1)', opacity: '0.3' },
          '10%': { transform: 'scale(1.05)', opacity: '0.5' },
          '30%': { transform: 'scale(1.1)', opacity: '0.6' },
          '40%': { transform: 'scale(1)', opacity: '0.3' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'subtle-pulse': {
          '0%,100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.05)' },
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4,0,0.2,1) infinite',
        'pulse-wipe': 'pulse-wipe 2.5s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        draw: 'draw 8s linear infinite',
        shimmer: 'shimmer 2s linear infinite',
        heartbeat: 'heartbeat 3s ease-in-out infinite',
        marquee: 'marquee 30s linear infinite',
        'subtle-pulse': 'subtle-pulse 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
