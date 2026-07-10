import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: {
          primary: '#1F2348',    // Nimiq Blue
          secondary: '#151833',  // Nimiq Blue Darkened
          tertiary: '#0E0E1A',
        },
        // Nimiq brand palette from @nimiq/style
        nimiq: {
          blue: '#1F2348',
          'light-blue': '#0582CA',
          'light-blue-on-dark': '#0CA6FE',
          gold: '#E9B213',
          green: '#21BCA5',
          orange: '#FC8702',
          red: '#D94432',
          'red-on-dark': '#FF5C48',
          purple: '#5F4B8B',
          pink: '#FA7268',
          'light-green': '#88B04B',
          brown: '#795548',
          gray: '#F4F4F4',
          'light-gray': '#FAFAFA',
          white: '#FFFFFF',
        },
        // Simplified aliases for the two-accent system
        gold: {
          DEFAULT: '#E9B213', // Nimiq Gold
          bright: '#FC8702',  // Orange accent
          dim: '#C9881A',
        },
        brand: {
          blue: '#0582CA',         // Light Blue
          'blue-light': '#0CA6FE', // Light Blue On Dark
          'blue-dim': '#0071C3',   // Light Blue Darkened
          navy: '#1F2348',         // Nimiq Blue
        },
        // Status colors
        success: '#21BCA5', // Nimiq Green
        error: '#D94432',   // Nimiq Red
        warning: '#E9B213', // Nimiq Gold
        info: '#0582CA',    // Nimiq Light Blue
        // Crypto colors
        bitcoin: '#F7931A',
        usdc: '#2775CA',
        usdt: '#009393',
        // Legacy aliases
        accent: {
          purple: '#0582CA',
          'purple-light': '#0CA6FE',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Muli', 'system-ui', 'sans-serif'],
        mono: ['Fira Mono', 'Space Mono', 'monospace'],
      },
      animation: {
        'fade-up': 'fadeUp 0.4s cubic-bezier(0.25, 0, 0, 1) both',
        'fade-up-delay-1': 'fadeUp 0.4s 0.08s cubic-bezier(0.25, 0, 0, 1) both',
        'fade-up-delay-2': 'fadeUp 0.4s 0.16s cubic-bezier(0.25, 0, 0, 1) both',
        'fade-up-delay-3': 'fadeUp 0.4s 0.24s cubic-bezier(0.25, 0, 0, 1) both',
        'fade-up-delay-4': 'fadeUp 0.4s 0.32s cubic-bezier(0.25, 0, 0, 1) both',
        'scale-in': 'scaleIn 0.4s cubic-bezier(0.25, 0, 0, 1) both',
        'pulse-gold': 'pulseGold 2.5s cubic-bezier(0.25, 0, 0, 1) infinite',
        'shimmer': 'shimmer 3s cubic-bezier(0.25, 0, 0, 1) infinite',
        'ticker': 'ticker 28s linear infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeUp: {
          'from': { opacity: '0', transform: 'translateY(16px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          'from': { opacity: '0', transform: 'scale(0.92)' },
          'to': { opacity: '1', transform: 'scale(1)' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(233, 178, 19, 0.4)' },
          '50%': { boxShadow: '0 0 0 10px rgba(233, 178, 19, 0)' },
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
      spacing: {
        // Nimiq 8px grid
        '1': '8px',
        '2': '16px',
        '3': '24px',
        '4': '32px',
        '5': '40px',
        '6': '48px',
        '7': '56px',
        '8': '64px',
      },
      borderRadius: {
        'nimiq-input': '4px',
        'nimiq-card': '10px',
        'nimiq-btn': '13.5px',
        'nimiq-btn-pill': '500px',
      },
    },
  },
  plugins: [],
}

export default config