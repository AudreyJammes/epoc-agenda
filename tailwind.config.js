/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'epoc-navy':   '#090253',
        'epoc-rose':   '#eb3678',
        'epoc-violet': '#4F1787',
        'epoc-orange': '#FB773C',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
