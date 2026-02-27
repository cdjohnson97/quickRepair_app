/** @type {import('tailwindcss').Config} */
export default {
  // C'EST ICI LA MAGIE ! On dit à Tailwind de scanner tous les fichiers React
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}