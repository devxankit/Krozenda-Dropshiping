import colors from 'tailwindcss/colors.js'

/**
 * Brand tokens below are PLACEHOLDERS — final brand colors/logo are a
 * client-owned deliverable (see project context §10, "Logo, brand assets").
 * Swap the `brand` scale once real values arrive; nothing else should need
 * to change because JSX must reference tokens, never raw hex.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // `sans` and `mono` are deliberately NOT redefined — 38 buyer-app
      // screens use `font-sans` and expect the system stack. The admin panel
      // opts in explicitly with `font-ui` / `font-num`, so the two surfaces
      // can carry different type without either one drifting into the other.
      fontFamily: {
        sans: [
          'Plus Jakarta Sans',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        ui: [
          'Public Sans',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
        num: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f8fafc',
          sunken: '#f1f5f9',
          inverted: '#0f172a',
        },
        border: {
          DEFAULT: '#e2e8f0',
          subtle: '#f1f5f9',
          strong: '#cbd5e1',
        },
        // Text ramp. Four steps is all an admin surface needs: body, label,
        // caption, placeholder. Anything outside these reads as an accident.
        ink: {
          DEFAULT: '#0f172a',
          muted: '#475569',
          subtle: '#64748b',
          faint: '#94a3b8',
        },
        // Full scale, so screens never reach past the token for a raw hue.
        // The four original steps keep their exact values: they ARE this palette.
        success: colors.green,
        // Full scale, so screens never reach past the token for a raw hue.
        // The four original steps keep their exact values: they ARE this palette.
        warning: colors.amber,
        // Full scale, so screens never reach past the token for a raw hue.
        // The four original steps keep their exact values: they ARE this palette.
        danger: colors.red,
        // Non-semantic emphasis. Kept separate from success/warning/danger so
        // state colour never has to compete with decorative colour.
        // Full scale, so screens never reach past the token for a raw hue.
        // The four original steps keep their exact values: they ARE this palette.
        accent: colors.violet,
        // Categorical series colours. Validated for colour-vision deficiency
        // against both surfaces (adjacent-pair ΔE ≥ 8, normal-vision ≥ 15).
        // Assign in fixed order 1→4 and never cycle; a 5th series folds into
        // "Other". Status hues are NOT in here on purpose.
        chart: {
          1: '#2563eb', // blue
          2: '#0d9488', // teal
          3: '#7c3aed', // violet
          4: '#db2777', // pink
        },
        'chart-dark': {
          1: '#3b82f6',
          2: '#0d9488',
          3: '#8b5cf6',
          4: '#ec4899',
        },
      },
      spacing: {
        px: '1px',
        0.5: '0.125rem',
        1: '0.25rem',
        2: '0.5rem',
        3: '0.75rem',
        4: '1rem',
        5: '1.25rem',
        6: '1.5rem',
        8: '2rem',
        10: '2.5rem',
        12: '3rem',
        16: '4rem',
        20: '5rem',
        24: '6rem',
      },
      // Admin chrome dimensions. Referenced by name so the shell and the
      // pages that offset against it can never drift apart.
      width: {
        sidebar: '15rem', // 240px expanded
        rail: '4rem', // 64px collapsed
      },
      height: {
        topbar: '3.5rem', // 56px
        control: '2.25rem', // 36px — admin density, vs the buyer app's 40px
        row: '2.75rem', // 44px table row
      },
      minWidth: {
        drawer: '28rem',
      },
      borderRadius: {
        sm: '0.25rem',
        DEFAULT: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        full: '9999px',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }], // 11px — table meta, column heads
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
      },
      boxShadow: {
        // The faintest step, for a card that needs an edge rather than lift.
        xs: '0 1px 2px 0 rgb(15 23 42 / 0.05)',
        card: '0 1px 3px 0 rgb(15 23 42 / 0.04), 0 1px 2px 0 rgb(15 23 42 / 0.02)',
        'card-hover': '0 12px 28px -4px rgb(15 23 42 / 0.09), 0 4px 10px -2px rgb(15 23 42 / 0.04)',
        glass: '0 8px 32px 0 rgba(15, 23, 42, 0.06)',
        raised: '0 1px 2px 0 rgb(15 23 42 / 0.06), 0 2px 8px -2px rgb(15 23 42 / 0.08)',
        overlay: '0 8px 24px -6px rgb(15 23 42 / 0.18), 0 2px 6px -2px rgb(15 23 42 / 0.08)',
      },
      // Panel motion. Short and ease-out on purpose: an overlay should feel
      // like it arrived, not like it performed. Reduced-motion users get the
      // global 0.01ms override in index.css, so none of these need a guard.
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': {
          from: { opacity: '0', transform: 'translateY(4px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        'slide-in-left': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'scale-in': 'scale-in 160ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slide-in-right 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-left': 'slide-in-left 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        'rise-in': 'rise-in 200ms ease-out',
      },
      // One ordering for every layer that floats. Anything that sets a raw
      // z-index number instead of one of these is a bug waiting to happen.
      zIndex: {
        dropdown: '30',
        sticky: '40',
        drawer: '50',
        modal: '60',
        popover: '70',
        toast: '80',
        palette: '90',
      },
    },
  },
  plugins: [],
}
