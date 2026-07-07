import type { Config } from 'tailwindcss';

// Design tokens — "personnel ledger" identity:
// cool neutral paper + near-black ink, a single deep-teal accent for primary
// actions, amber for pending/attention states, restrained serif for section
// titles (evokes a record/ledger heading) over an Inter UI face.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F3F5F6',
        ink: {
          DEFAULT: '#10192B',
          soft: '#3C4A5E',
          faint: '#7C8A9E',
        },
        border: '#E1E5EA',
        accent: {
          DEFAULT: '#0B6E63',
          hover: '#095A51',
          soft: '#E4F1EF',
        },
        amber: {
          DEFAULT: '#B45309',
          soft: '#FCEED8',
        },
        danger: {
          DEFAULT: '#B42318',
          soft: '#FBEAE9',
        },
      },
      fontFamily: {
        serif: ['var(--font-fraunces)', 'Georgia', 'serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 25, 43, 0.06), 0 1px 3px rgba(16, 25, 43, 0.04)',
      },
    },
  },
  plugins: [],
};

export default config;
