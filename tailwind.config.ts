import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        "bg-2": "rgb(var(--bg-2) / <alpha-value>)",
        fg: "rgb(var(--fg) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        "card-2": "rgb(var(--card-2) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        "border-strong": "rgb(var(--border-strong) / <alpha-value>)",
        brand: "rgb(var(--brand) / <alpha-value>)",
        "brand-2": "rgb(var(--brand-2) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        "brand-fg": "rgb(var(--brand-fg) / <alpha-value>)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, rgb(var(--brand)) 0%, rgb(var(--brand-2)) 100%)",
        "hero-light": "radial-gradient(circle at 0% 0%, rgb(var(--brand) / 0.12), transparent 50%), radial-gradient(circle at 100% 0%, rgb(var(--brand-2) / 0.10), transparent 50%)",
        "hero-dark": "radial-gradient(circle at 20% 10%, rgb(var(--brand) / 0.20), transparent 60%), radial-gradient(circle at 90% 30%, rgb(var(--brand-2) / 0.14), transparent 60%)",
      },
      boxShadow: {
        soft: "0 1px 2px rgb(0 0 0 / 0.04), 0 6px 22px -6px rgb(15 23 42 / 0.10)",
        pop: "0 10px 30px -10px rgb(var(--brand) / 0.40)",
        ring: "0 0 0 4px rgb(var(--brand) / 0.18)",
        glow: "0 0 0 1px rgb(var(--brand) / 0.25), 0 18px 40px -12px rgb(var(--brand) / 0.35)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "pulse-soft": { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.5" } },
      },
      animation: {
        "fade-in": "fade-in 200ms ease-out",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
