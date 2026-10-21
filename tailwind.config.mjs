/** @type {import("tailwindcss").Config} */
const config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // DEFAULT is decorative (icons, rings, gradients). Text and filled buttons
        // use dark/deep: >= 4.5:1 with white and on soft/lavender surfaces (WCAG AA).
        accent: { DEFAULT: "#8B7FD6", soft: "#EDE9FB", dark: "#6457B3", deep: "#54489F" },
        period: "#C89BC4",
        text: {
          DEFAULT: "#1A1A1F",
          muted: "#64646C",
          subtle: "#6E6E77",
        },
        border: "#EFEFF2",
        ink: {
          DEFAULT: "#1A1A1F",
          muted: "#64646C",
          subtle: "#6E6E77",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          soft: "#FAFAFB",
          lavender: "#F5F3FB",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: { card: "20px", pill: "9999px" },
      boxShadow: {
        card: "0 2px 8px rgba(0,0,0,0.04)",
        float: "0 4px 16px rgba(0,0,0,0.06)",
        lg: "0 8px 32px rgba(0,0,0,0.08)",
      },
    },
  },
};

export default config;
