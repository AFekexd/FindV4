/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          DEFAULT: '#1A3C2B',
          50: '#F0F5F2',
          100: '#DCE8E1',
          200: '#BAD1C4',
          300: '#90B4A0',
          400: '#64927A',
          500: '#3D7157',
          600: '#2A533E',
          700: '#1A3C2B', // Main Forest Green
          800: '#142E21',
          900: '#0E2017',
          950: '#08130D',
        },
        paper: {
          light: '#FAFAF8',
          DEFAULT: '#F7F7F5',
          subtle: '#EFEFEA',
          darker: '#E5E5DE',
          card: '#FFFFFF',
          border: '#D0D0C7',
          borderDark: '#1A3C2B',
        },
        cad: {
          cyan: '#0E7490',
          amber: '#B45309',
          red: '#B91C1C',
          blue: '#1D4ED8',
          emerald: '#047857',
          purple: '#6D28D9',
          orange: '#C2410C',
        }
      },
      fontFamily: {
        sans: ['Space Grotesk', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Space Grotesk', 'sans-serif'],
      },
      boxShadow: {
        'none': 'none',
      },
      borderRadius: {
        'none': '0px',
        'sm': '2px',
        'md': '4px',
        'lg': '6px',
      }
    },
  },
  plugins: [],
}

