/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    // Custom screens — covers every major device category
    screens: {
      "xs":  "375px",   // iPhone SE / small Android
      "sm":  "640px",   // large phones
      "md":  "768px",   // tablets portrait
      "lg":  "1024px",  // tablets landscape / small laptops
      "xl":  "1280px",  // standard desktop
      "2xl": "1440px",  // large desktop
      "3xl": "1920px",  // full HD
      "4xl": "2560px",  // 4K
    },
    extend: {
      colors: {
        primary: {
          50:  "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
          950: "#2e1065",
        },
        lavender: {
          50:  "#faf5ff",
          100: "#f3e8ff",
          200: "#e9d5ff",
          300: "#d8b4fe",
          400: "#c084fc",
          500: "#9B89C4",
          600: "#7B5EA7",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
          950: "#2e1065",
        },
        secondary: {
          50:  "#f2f9ee",
          100: "#e0f1d5",
          200: "#c3e4ae",
          300: "#9dd17f",
          400: "#76bb52",
          500: "#569e35",
          600: "#3B6D11",
          700: "#356110",
          800: "#2d530e",
          900: "#25430c",
          950: "#132506",
        },
        accent: {
          50:  "#fef2f2",
          100: "#fee2e2",
          200: "#fecaca",
          300: "#fca5a5",
          400: "#f87171",
          500: "#ef4444",
          600: "#C0392B",
          700: "#b91c1c",
          800: "#991b1b",
          900: "#7f1d1d",
          950: "#450a0a",
        },
        brand: {
          purple:   "#7B5EA7",
          lavender: "#9B89C4",
          green:    "#3B6D11",
          red:      "#C0392B",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      fontSize: {
        // Fluid type scale
        "2xs": ["0.625rem", { lineHeight: "1rem" }],
      },
      spacing: {
        "safe-top":    "env(safe-area-inset-top)",
        "safe-bottom": "env(safe-area-inset-bottom)",
        "safe-left":   "env(safe-area-inset-left)",
        "safe-right":  "env(safe-area-inset-right)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        card:       "0 2px 8px 0 rgba(0,0,0,0.08)",
        "card-hover": "0 4px 16px 0 rgba(0,0,0,0.12)",
      },
      maxWidth: {
        "8xl": "88rem",
        "9xl": "96rem",
      },
      animation: {
        "fade-in":    "fadeIn 0.2s ease-in-out",
        "slide-up":   "slideUp 0.3s ease-out",
        "slide-down": "slideDown 0.3s ease-out",
      },
      keyframes: {
        fadeIn:    { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp:   { "0%": { opacity: "0", transform: "translateY(10px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        slideDown: { "0%": { opacity: "0", transform: "translateY(-10px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
};