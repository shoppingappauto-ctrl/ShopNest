/**
 * ShopNest Mobile — color theme tokens.
 *
 * Mirrors the web app's green brand color (#16a34a) so the experience is
 * consistent across native and web. All values are hex strings (React Native
 * does not understand Tailwind CSS variables). Text styles that pair a color
 * with a font size are produced by helpers in this module.
 */

export const BRAND = {
  green: '#16a34a',
  greenDark: '#15803d',
  greenSoft: '#dcfce7',
  greenTint: '#f0fdf4',
  orange: '#ea580c',
  red: '#dc2626',
  amber: '#d97706',
  gray: '#6b7280',
  grayLight: '#e5e7eb',
  grayDark: '#374151',
  black: '#0f172a',
  white: '#ffffff',
  bgSubtle: '#f8fafc',
  bgCard: '#ffffff',
  bgPage: '#ffffff',
  border: '#e5e7eb',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
}

export const DARK = {
  green: '#22c55e',
  greenDark: '#16a34a',
  greenSoft: '#14532d',
  greenTint: '#052e16',
  bgPage: '#0b1220',
  bgCard: '#111827',
  bgSubtle: '#1f2937',
  border: '#1f2937',
  textPrimary: '#f1f5f9',
  textSecondary: '#cbd5e1',
  textMuted: '#64748b',
}

export type Theme = {
  isDark: boolean
  brand: string
  brandDark: string
  brandSoft: string
  brandTint: string
  bg: string
  bgSubtle: string
  card: string
  border: string
  text: string
  textSecondary: string
  textMuted: string
  danger: string
  warn: string
}

export function theme(isDark: boolean): Theme {
  return isDark
    ? {
        isDark: true,
        brand: DARK.green,
        brandDark: DARK.greenDark,
        brandSoft: DARK.greenSoft,
        brandTint: DARK.greenTint,
        bg: DARK.bgPage,
        bgSubtle: DARK.bgSubtle,
        card: DARK.bgCard,
        border: DARK.border,
        text: DARK.textPrimary,
        textSecondary: DARK.textSecondary,
        textMuted: DARK.textMuted,
        danger: BRAND.red,
        warn: BRAND.amber,
      }
    : {
        isDark: false,
        brand: BRAND.green,
        brandDark: BRAND.greenDark,
        brandSoft: BRAND.greenSoft,
        brandTint: BRAND.greenTint,
        bg: BRAND.bgPage,
        bgSubtle: BRAND.bgSubtle,
        card: BRAND.bgCard,
        border: BRAND.border,
        text: BRAND.textPrimary,
        textSecondary: BRAND.textSecondary,
        textMuted: BRAND.textMuted,
        danger: BRAND.red,
        warn: BRAND.amber,
      }
}

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const

export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const

export const TYPO = {
  // Caregiver/elderly-friendly larger text mode (controlled by user.largeText).
  bodyLarge: { fontSize: 18, lineHeight: 26 },
  body: { fontSize: 15, lineHeight: 22 },
  caption: { fontSize: 12, lineHeight: 16 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  subtitle: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' as const },
}
