/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      // --- KitchenBase Design Tokens -------------------------------------
      colors: {
        // Brand
        brand: {
          DEFAULT: "#C2714F", // terracotta — primary actions, active states
          light: "#FDF3EF", // selected/active backgrounds
        },
        // Surfaces
        surface: {
          DEFAULT: "#FFFFFF", // cards and main surfaces
          secondary: "#F5F5F4", // screen background, separators
        },
        // Typography
        ink: {
          DEFAULT: "#1F2937", // text primary
          secondary: "#6B6B6B", // text secondary, labels
        },
        // Borders
        line: "#E5E7EB",
        // Semaphore (recipe states ONLY — never decorative)
        semaphore: {
          green: "#22C55E",
          yellow: "#EAB308",
          orange: "#F97316",
        },
        // Backwards-compat shadcn variables — mapped to KitchenBase tokens
        background: "#F5F5F4",
        foreground: "#1F2937",
        card: { DEFAULT: "#FFFFFF", foreground: "#1F2937" },
        popover: { DEFAULT: "#FFFFFF", foreground: "#1F2937" },
        primary: { DEFAULT: "#C2714F", foreground: "#FFFFFF" },
        secondary: { DEFAULT: "#FDF3EF", foreground: "#1F2937" },
        muted: { DEFAULT: "#F5F5F4", foreground: "#6B6B6B" },
        accent: { DEFAULT: "#FDF3EF", foreground: "#C2714F" },
        destructive: { DEFAULT: "#DC2626", foreground: "#FFFFFF" },
        border: "#E5E7EB",
        input: "#E5E7EB",
        ring: "#C2714F",
      },
      fontFamily: {
        serif: ['"Playfair Display"', "ui-serif", "Georgia", "serif"],
        sans: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
        display: ['"Playfair Display"', "ui-serif", "Georgia", "serif"],
      },
      fontSize: {
        // Mobile-first typographic scale
        "display-lg": [
          "2rem",
          { lineHeight: "2.4rem", letterSpacing: "-0.01em" },
        ],
        display: ["1.5rem", { lineHeight: "1.9rem" }],
        title: [
          "1.125rem",
          { lineHeight: "1.5rem", letterSpacing: "-0.005em" },
        ],
        body: ["0.9375rem", { lineHeight: "1.4rem" }],
        caption: ["0.8125rem", { lineHeight: "1.15rem" }],
      },
      borderRadius: {
        // Per design system: 8px components, 12px cards
        sm: "6px",
        DEFAULT: "8px",
        md: "8px",
        lg: "12px",
        xl: "14px",
      },
      borderWidth: {
        hairline: "0.5px",
      },
      spacing: {
        "safe-bottom": "env(safe-area-inset-bottom)",
      },
      maxWidth: {
        mobile: "430px",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.24s ease-out",
      },
      boxShadow: {
        // Explicitly empty — design system forbids shadows.
        // Use these placeholders to override any inherited shadow utility.
        none: "none",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
