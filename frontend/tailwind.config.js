/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#0f6df0",
        "secondary": "#8b5cf6",
        "background-light": "#f5f7f8",
        "background-dark": "#111822",
        "surface-light": "#ffffff",
        "surface-dark": "#1d2633",
        "surface-highlight": "#253041",
      },
      fontFamily: {
        "display": ["Inter", "sans-serif"],
        "body": ["Inter", "sans-serif"],
      },
      borderRadius: { "DEFAULT": "0.25rem", "lg": "0.5rem", "xl": "0.75rem", "2xl": "1rem", "full": "9999px" },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
