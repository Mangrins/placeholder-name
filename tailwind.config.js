/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#07090f",
        panel: "#0e1322",
        line: "#1f2d4d",
        neon: "#3ef3ff",
        accent: "#8dfcaa",
        text: "#edf3ff",
        muted: "#93a2bf"
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(62,243,255,.35), 0 0 35px rgba(62,243,255,.08)"
      },
      borderRadius: {
        xl2: "1.25rem"
      }
    }
  },
  plugins: []
};
