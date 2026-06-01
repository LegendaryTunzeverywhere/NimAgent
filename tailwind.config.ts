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
        background: {
          primary: '#0A0C17',
          secondary: '#10121F',
          tertiary: '#0E0E1A',
        },
        // Nimiq brand palette — keep the app to these accents only.
        gold: {
          DEFAULT: '#F5A623', // NIM-native actions: send, receive, QR, swap, balance
          bright: '#FBBF4D',
          dim: '#C9881A',
        },
        brand: {
          blue: '#2B6BD6',        // Commerce + AI: gift cards, airtime, bills, agent
          'blue-light': '#5B8FE6',
          'blue-dim': '#1F4FA0',
          navy: '#1F1C3E',        // Elevated dark surfaces
        },
        // Status only — never decorative
        success: '#34D399',
        error: '#F87171',
        // Aliased to the two brand accents so legacy classes stay on-palette
        accent: {
          purple: '#2B6BD6',
          'purple-light': '#5B8FE6',
        },
        warning: '#F5A623',
        info: '#2B6BD6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
      animation: {
        'fade-up': 'fadeUp 0.55s ease both',
        'fade-up-delay-1': 'fadeUp 0.55s 0.08s ease both',
        'fade-up-delay-2': 'fadeUp 0.55s 0.16s ease both',
        'fade-up-delay-3': 'fadeUp 0.55s 0.24s ease both',
        'fade-up-delay-4': 'fadeUp 0.55s 0.32s ease both',
        'scale-in': 'scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        'pulse-gold': 'pulseGold 2s ease infinite',
        'shimmer': 'shimmer 3s linear infinite',
        'ticker': 'ticker 28s linear infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeUp: {
          'from': { opacity: '0', transform: 'translateY(18px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          'from': { opacity: '0', transform: 'scale(0.94)' },
          'to': { opacity: '1', transform: 'scale(1)' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(245, 166, 35, 0.35)' },
          '50%': { boxShadow: '0 0 0 8px rgba(245, 166, 35, 0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}

export default config
