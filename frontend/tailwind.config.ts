import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Satoshi", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
        rakshak: {
          blue: "#1a3c6e",
          navy: "#0f2447",
          saffron: "#ff7a1a",
          gold: "#f4c430",
          green: "#16a34a",
          yellow: "#ca8a04",
          red: "#dc2626",
        },
        glass: "rgba(255,255,255,0.85)",
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      backgroundImage: {
        "gradient-hero": "linear-gradient(135deg, #f0f7ff 0%, #e8f4fd 30%, #fef9ee 70%, #fff8f0 100%)",
        "gradient-card": "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(240,247,255,0.9) 100%)",
        "gradient-sidebar": "linear-gradient(180deg, #0f2447 0%, #1a3c6e 100%)",
      },
      boxShadow: {
        glass: "0 8px 32px rgba(31,38,135,0.08)",
        "glass-hover": "0 16px 48px rgba(31,38,135,0.14)",
        card: "0 2px 16px rgba(26,60,110,0.08)",
        "card-hover": "0 8px 32px rgba(26,60,110,0.14)",
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "slide-up": "slideUp 0.4s ease-out",
        "fade-in": "fadeIn 0.5s ease-out",
        counter: "counter 2s ease-out forwards",
        "ping-slow": "ping 2s cubic-bezier(0,0,0.2,1) infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
export default config;

