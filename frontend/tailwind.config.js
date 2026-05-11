/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        display: ['"Outfit"', '"Noto Sans SC"', 'sans-serif'],
        body: ['"Plus Jakarta Sans"', '"Noto Sans SC"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'Monaco', '"Courier New"', 'monospace'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: "#10B981",
        primaryHover: "#059669",
        secondary: "#8B5CF6",
        "background-light": "#F3F4F6",
        "background-dark": "#0F172A",
        "surface-light": "#FFFFFF",
        "surface-dark": "#1E293B",
        "sidebar-dark": "#111827",
        "sidebar-highlight": "#1F2937",
        // New brand colors - LeetCode/Duolingo style
        brand: {
          green: "#10B981",
          "green-light": "#D1FAE5",
          "green-dark": "#059669",
          orange: "#F97316",
          "orange-light": "#FFEDD5",
          "orange-dark": "#EA580C",
          blue: "#3B82F6",
        },
        surface: {
          DEFAULT: "#FAFAFA",
          elevated: "#FFFFFF",
          muted: "#F3F4F6",
        },
        ios: {
          gray: "#F3F4F6",
          bg: "#FAFAFA",
          dark: "#1F2937",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
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
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        'ios-lg': "24px",
        'ios-md': "16px",
        'ios-sm': "12px",
        DEFAULT: "1rem",
        'xl': "1.5rem",
        '2xl': "2rem",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        'ios-float': '0 24px 48px -12px rgba(0,0,0,0.08)',
        'ios-card': '0 2px 8px rgba(0,0,0,0.04)',
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        'glow': '0 0 15px rgba(16, 185, 129, 0.4)',
        'purple-glow': '0 0 15px rgba(139, 92, 246, 0.4)',
        'indigo-glow': '0 0 15px rgba(79, 70, 229, 0.3)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        fadeIn: {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        marquee: "marquee 20s linear infinite",
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'smooth-scale': 'smoothScale 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
