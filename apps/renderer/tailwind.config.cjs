/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  corePlugins: {
    preflight: false, // avoid clobbering MUI's CSS baseline — see docs/07-ui-wireframes.md
  },
  theme: {
    extend: {},
  },
  plugins: [],
};
