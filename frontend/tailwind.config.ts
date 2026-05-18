import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      colors: {
        ink:    "#161A1D",
        muted:  "#6B7280",
        panel:  "#F6F5F1",
        line:   "#E0DDD6",
        bg:     "#EDEAE2",
        buy:    "#0D7A5F",
        sell:   "#B03040",
        wait:   "#9A6412",
        gold:   "#C9A84C",
        surface: "#FDFCF9",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
