import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "#161A1D",
        panel: "#F6F5F1",
        line: "#D9D6CC",
        buy: "#147D64",
        sell: "#B23A48",
        wait: "#B7791F",
      },
    },
  },
  plugins: [],
};

export default config;
