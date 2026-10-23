/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        fredoka: ['Fredoka', 'sans-serif'],
        nunito: ['Nunito', 'sans-serif'],
      },
      colors: {
        skribbl: {
          bg: '#0b1a30',
          panel: '#152b47',
          panelLight: '#1f3c63',
          border: '#2c5282',
          yellow: '#fadb14',
          yellowHover: '#ffec3d',
          blue: '#1890ff',
          green: '#52c41a',
          red: '#ff4d4f',
          cream: '#fefefe',
          board: '#ffffff'
        }
      },
      boxShadow: {
        'game': '0 6px 0 0 rgba(0, 0, 0, 0.25)',
        'game-sm': '0 3px 0 0 rgba(0, 0, 0, 0.2)',
        'game-lg': '0 8px 0 0 rgba(0, 0, 0, 0.3)',
        'game-pressed': '0 1px 0 0 rgba(0, 0, 0, 0.25)',
      },
      animation: {
        'bounce-subtle': 'bounceSubtle 2s infinite ease-in-out',
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'wiggle': 'wiggle 0.3s ease-in-out',
      },
      keyframes: {
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-4deg)' },
          '75%': { transform: 'rotate(4deg)' },
        }
      }
    },
  },
  plugins: [],
}
