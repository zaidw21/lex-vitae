import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#ecfdf7",
          100: "#d1faec",
          200: "#a7f3da",
          500: "#10b48a",
          600: "#059671",
          700: "#04785c",
          800: "#065f4b",
          900: "#064e3e",
        },
      },
      fontFamily: {
        sans: ["Inter", "Noto Sans Devanagari", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
