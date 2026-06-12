/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: '#0B1120', // bg-slate-950
        surface: '#1E293B',    // bg-slate-800
        primary: '#0EA5E9',    // sky-500
        secondary: '#8B5CF6',  // violet-500
        text: {
          primary: '#F1F5F9',  // slate-100
          secondary: '#94A3B8',// slate-400
        },
        alert: '#EAB308',      // yellow-500
      },
    },
  },
  plugins: [],
}
