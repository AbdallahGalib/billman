import daisyui from 'daisyui';
import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      maxWidth: {
        '7xl': '80rem',
      }
    },
  },
  plugins: [daisyui, typography],
  daisyui: {
    themes: [
      'light',
      'dark', 
      'corporate',
      'business',
      'emerald',
      'forest',
      'lofi',
      'pastel',
      'fantasy',
      'wireframe',
      'luxury',
      'dracula'
    ],
    darkTheme: 'dark',
    base: true,
    styled: true,
    utils: true,
    prefix: '',
    logs: true,
    themeRoot: ':root',
  },
}