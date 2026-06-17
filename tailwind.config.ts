import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B0A0F", panel: "#16141D", panel2: "#1E1B27", line: "#2A2733",
        muted: "#8B8696", magenta: "#FF2D78", violet: "#7C5CFF", gold: "#F5C04E",
        ok: "#34D399", bad: "#FB5C5C",
      },
      fontFamily: { display: ["Syne", "system-ui"], mono: ["'Space Mono'", "monospace"] },
    },
  },
  plugins: [],
};
export default config;
