/** Tokens mirror superfine/docs/DESIGN-SYSTEM.md (extracted from the corporate employee app). */
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#F5F6F5", // neutral off-white (was cream #FBF7EC, dropped Oct 15 2026)
        foreground: "#2B2E2C",
        card: { DEFAULT: "#FFFFFF", foreground: "#2B2E2C" },
        muted: { DEFAULT: "#EDEFEE", foreground: "#646866" },
        secondary: { DEFAULT: "#ECEEED", foreground: "#2B2E2C" },
        teal: { DEFAULT: "#007078", deep: "#004045", soft: "#DCEDED", wash: "#EFF6F5" },
        yellow: { DEFAULT: "#F5E516", soft: "#FBF3A0", wash: "#FBF6CB", deep: "#C9B800" },
        coral: { DEFAULT: "#B85C36", deep: "#A34E2C", soft: "#FBE4D6" },
        sidebar: { DEFAULT: "#01413F", foreground: "#E8F1EE", muted: "#ADC7C3", border: "#0A534F", active: "#0A5A55" },
        success: { DEFAULT: "#2D7B53", bg: "#E7F3EA", border: "#BEE0C8" },
        warning: { DEFAULT: "#98641A", bg: "#FBF3D6", border: "#F0DCA0" },
        danger: { DEFAULT: "#B24A2B", bg: "#FBE7DF", border: "#F2C3AE" },
        info: { DEFAULT: "#0B6E76", bg: "#DCEDED", border: "#A9D6D6" },
        border: { DEFAULT: "#E6E8E7", strong: "#D3D7D5" },
        control: "#868A88",
      },
      fontFamily: {
        sans: ['"Hanken Grotesk"', "system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"],
      },
      fontSize: {
        "2xs": ["0.6875rem", "0.9rem"],
      },
      borderRadius: {
        lg: "1rem",
        xl: "1.25rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
      boxShadow: {
        card: "0 2px 14px rgba(43, 46, 44, 0.05)",
        raised: "0 14px 40px rgba(1, 65, 63, 0.16)",
        pop: "0 6px 0 0 #004045",
      },
    },
  },
  plugins: [],
};
