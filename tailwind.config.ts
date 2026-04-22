import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg:      "#07060f",
        surface: "#0f0e1a",
        surface2:"#161525",
        violet:  "#7c6af7",
        "violet-l": "#a89ef7",
        teal:    "#34d399",
        amber:   "#fbbf24",
        rose:    "#f87171",
        gold:    "#f59e0b",
        muted:   "#64748b",
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "monospace"],
        display: ["Syne", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
