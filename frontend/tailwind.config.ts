import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#FAF9F6",
        ink: "#2c2a26",
        muted: "#6b6560",
        accent: "#b86b52",
        sage: "#7d9b76",
        line: "#e8e4dc",
      },
      fontFamily: {
        serif: ["var(--font-crimson)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 10px 40px -12px rgba(44, 42, 38, 0.12)",
        card: "0 4px 24px -8px rgba(44, 42, 38, 0.08)",
      },
    },
  },
  plugins: [],
} satisfies Config;
