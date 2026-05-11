import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "azul-eletrico": "#2F52D3",
        "roxo-luminoso": "#7B24C7",
        "rosa-vibrante": "#E83D89",
        "ciano-claro": "#17A2B8",
        "dourado-ifizinha": "#FFD700",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "#2F52D3",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#7B24C7",
          foreground: "#ffffff",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "#E83D89",
          foreground: "#ffffff",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      backgroundImage: {
        "hero-gradient":
          "linear-gradient(135deg, #2F52D3 0%, #7B24C7 60%, #E83D89 100%)",
        "hero-gradient-r":
          "linear-gradient(225deg, #2F52D3 0%, #7B24C7 60%, #E83D89 100%)",
        "card-gradient":
          "linear-gradient(135deg, rgba(47,82,211,0.1) 0%, rgba(123,36,199,0.1) 100%)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-in-out",
        "slide-up": "slideUp 0.4s ease-out",
        "pulse-glow": "pulseGlow 2s infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(47,82,211,0.4)" },
          "50%": { boxShadow: "0 0 0 10px rgba(47,82,211,0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
