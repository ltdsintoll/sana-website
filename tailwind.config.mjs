/** @type {import("tailwindcss").Config} */
const config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: { DEFAULT: "#8B7FD6", soft: "#EDE9FB", dark: "#6B5FB8" },
        period: "#C89BC4",
        text: {
          DEFAULT: "#1A1A1F",
          muted: "#6B6B73",
          subtle: "#A0A0A8",
        },
        border: "#EFEFF2",
        ink: {
          DEFAULT: "#1A1A1F",
          muted: "#6B6B73",
          subtle: "#A0A0A8",
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
