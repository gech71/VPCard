import type {Config} from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.5rem',
        lg: '2rem',
      },
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        body: ['Inter', 'system-ui', 'sans-serif'],
        headline: ['Inter', 'system-ui', 'sans-serif'],
        code: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          muted: 'hsl(var(--primary-muted))',
          'muted-foreground': 'hsl(var(--primary-muted-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
          muted: 'hsl(var(--destructive-muted))',
          'muted-foreground': 'hsl(var(--destructive-muted-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
          muted: 'hsl(var(--success-muted))',
          'muted-foreground': 'hsl(var(--success-muted-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
          muted: 'hsl(var(--warning-muted))',
          'muted-foreground': 'hsl(var(--warning-muted-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
          muted: 'hsl(var(--info-muted))',
          'muted-foreground': 'hsl(var(--info-muted-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
      },
      borderRadius: {
        xl: 'calc(var(--radius) + 4px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        xs: '0 1px 2px 0 hsl(var(--shadow-color) / 0.05)',
        sm: '0 1px 3px 0 hsl(var(--shadow-color) / 0.08), 0 1px 2px -1px hsl(var(--shadow-color) / 0.06)',
        DEFAULT:
          '0 1px 3px 0 hsl(var(--shadow-color) / 0.09), 0 1px 2px -1px hsl(var(--shadow-color) / 0.06)',
        md: '0 4px 10px -2px hsl(var(--shadow-color) / 0.09), 0 2px 6px -2px hsl(var(--shadow-color) / 0.06)',
        lg: '0 10px 24px -6px hsl(var(--shadow-color) / 0.12), 0 4px 10px -4px hsl(var(--shadow-color) / 0.07)',
        xl: '0 20px 40px -12px hsl(var(--shadow-color) / 0.16), 0 8px 16px -8px hsl(var(--shadow-color) / 0.08)',
      },
      keyframes: {
        'accordion-down': {
          from: {height: '0', opacity: '0'},
          to: {height: 'var(--radix-accordion-content-height)', opacity: '1'},
        },
        'accordion-up': {
          from: {height: 'var(--radix-accordion-content-height)', opacity: '1'},
          to: {height: '0', opacity: '0'},
        },
        'fade-in': {
          from: {opacity: '0'},
          to: {opacity: '1'},
        },
        'fade-in-up': {
          from: {opacity: '0', transform: 'translateY(8px)'},
          to: {opacity: '1', transform: 'translateY(0)'},
        },
        'fade-in-down': {
          from: {opacity: '0', transform: 'translateY(-8px)'},
          to: {opacity: '1', transform: 'translateY(0)'},
        },
        'scale-in': {
          from: {opacity: '0', transform: 'scale(0.97)'},
          to: {opacity: '1', transform: 'scale(1)'},
        },
        shimmer: {
          '100%': {transform: 'translateX(100%)'},
        },
        'check-pop': {
          '0%': {opacity: '0', transform: 'scale(0.4)'},
          '60%': {opacity: '1', transform: 'scale(1.08)'},
          '100%': {opacity: '1', transform: 'scale(1)'},
        },
        'pulse-ring': {
          '0%': {transform: 'scale(0.9)', opacity: '0.7'},
          '70%': {transform: 'scale(1.35)', opacity: '0'},
          '100%': {transform: 'scale(1.35)', opacity: '0'},
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.22s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-in',
        'fade-in': 'fade-in 0.25s ease-out both',
        'fade-in-up': 'fade-in-up 0.32s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in-down': 'fade-in-down 0.32s cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scale-in 0.2s cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 1.6s infinite',
        'check-pop': 'check-pop 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.24, 0, 0.38, 1) infinite',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
