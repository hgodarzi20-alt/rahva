import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#2E2E2E", 2: "#57575F", 3: "#8A8A95" },
        paper: "#FFFFFF",
        line: { DEFAULT: "#E6E6EA", 2: "#EAEAEF" },
        accent: {
          DEFAULT: "#424BED",
          dark: "#000099",
          navy: "#020247",
          soft: "#F7FAFF",
          ring: "#B6DBFF",
        },
        brandYellow: "#FFC60B",
        signal: { DEFAULT: "#8A4008", ring: "#F27E31", soft: "#FEF6EF" },
        danger: { DEFAULT: "#CB2C30", ring: "#E8A9AB", soft: "#FDECEC" },
        ok: { DEFAULT: "#14664A", ring: "#A9D8C4", soft: "#EEF8F3" },
        info: { DEFAULT: "#2E2E2E", soft: "#F7FAFF", ring: "#B6DBFF" },
      },
      fontFamily: { sans: ["Vazirmatn", "Tahoma", "system-ui", "sans-serif"] },
      borderRadius: { DEFAULT: "8px", card: "12px", sheet: "16px" },
      boxShadow: {
        sh1: "0 1px 2px rgba(2,2,71,.06)",
        sh2: "0 6px 18px rgba(2,2,71,.10)",
      },
    },
  },
  plugins: [],
};

export default config;
