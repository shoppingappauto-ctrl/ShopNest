/**
 * ShopNest Mobile — UI primitives (a small set of styled React Native
 * components so the screen files stay lean and visually consistent).
 *
 * These mirror shadcn/ui's spirit (small, composable, themed) but are real
 * RN components — no DOM. Every interactive element targets ≥44pt.
 */

import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { RADIUS, SPACING, theme, TYPO } from '../lib/theme'

type Theme = ReturnType<typeof theme>

function useTheme(isDark: boolean): Theme {
  return theme(isDark)
}

// ─── Button ──────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger' | 'subtle'
type ButtonSize = 'sm' | 'md' | 'lg'

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  icon,
  style,
  accessibilityLabel,
  danger,
}: {
  label: string
  onPress?: () => void
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  icon?: React.ReactNode
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
  /** Render text/icon in the danger color (used with outline/ghost variants). */
  danger?: boolean
}) {
  const t = useTheme(false)
  const palette = (() => {
    switch (variant) {
      case 'primary':
        return { bg: t.brand, fg: '#fff', border: t.brand }
      case 'outline':
        return { bg: 'transparent', fg: danger ? t.danger : t.text, border: danger ? t.danger : t.border }
      case 'ghost':
        return { bg: 'transparent', fg: danger ? t.danger : t.text, border: 'transparent' }
      case 'danger':
        return { bg: t.danger, fg: '#fff', border: t.danger }
      case 'subtle':
        return { bg: t.bgSubtle, fg: t.text, border: t.border }
    }
  })()
  const heights: Record<ButtonSize, number> = { sm: 40, md: 48, lg: 56 }
  const fontSizes: Record<ButtonSize, number> = { sm: 14, md: 15, lg: 17 }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          height: heights[size],
          opacity: pressed ? 0.85 : disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.btnRow}>
          {icon}
          <Text style={{ color: palette.fg, fontSize: fontSizes[size], fontWeight: '600' }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  )
}

// ─── Card ────────────────────────────────────────────────────────────────────

export function Card({
  children,
  style,
  padded = true,
  accessibilityLabel,
}: {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  padded?: boolean
  accessibilityLabel?: string
}) {
  const t = useTheme(false)
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.card,
        {
          backgroundColor: t.card,
          borderColor: t.border,
          padding: padded ? SPACING.lg : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}

// ─── Text helpers ────────────────────────────────────────────────────────────

export function Title({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme(false)
  return <Text style={[TYPO.title, { color: t.text }, style]}>{children}</Text>
}

export function Subtitle({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme(false)
  return <Text style={[TYPO.subtitle, { color: t.text }, style]}>{children}</Text>
}

export function Body({ children, style, muted }: { children: React.ReactNode; style?: StyleProp<TextStyle>; muted?: boolean }) {
  const t = useTheme(false)
  return (
    <Text style={[TYPO.body, { color: muted ? t.textMuted : t.text }, style]}>
      {children}
    </Text>
  )
}

export function Caption({ children, style, muted }: { children: React.ReactNode; style?: StyleProp<TextStyle>; muted?: boolean }) {
  const t = useTheme(false)
  return (
    <Text style={[TYPO.caption, { color: muted ? t.textMuted : t.textSecondary }, style]}>
      {children}
    </Text>
  )
}

// ─── Pill / Badge ────────────────────────────────────────────────────────────

export function Pill({
  label,
  color,
  backgroundColor,
  style,
}: {
  label: string
  color?: string
  backgroundColor?: string
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: backgroundColor ?? '#dcfce7',
          borderColor: color ?? '#16a34a',
        },
        style,
      ]}
    >
      <Text style={[TYPO.caption, { color: color ?? '#15803d', fontWeight: '600' }]}>{label}</Text>
    </View>
  )
}

// ─── Screen wrapper ──────────────────────────────────────────────────────────

export function Screen({
  children,
  scroll = true,
  style,
}: {
  children: React.ReactNode
  scroll?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const t = useTheme(false)
  const content = (
    <View style={[styles.screen, { backgroundColor: t.bg }, style]}>{children}</View>
  )
  if (scroll) {
    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {content}
      </ScrollView>
    )
  }
  return content
}

// ─── States ──────────────────────────────────────────────────────────────────

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const t = useTheme(false)
  return (
    <View style={[styles.center, { backgroundColor: t.bg }]} accessibilityLabel={label}>
      <ActivityIndicator color={t.brand} size="large" />
      <Body muted style={{ marginTop: SPACING.md }}>{label}</Body>
    </View>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useTheme(false)
  return (
    <View style={[styles.center, { backgroundColor: t.bg }]} accessibilityLabel={`Error: ${message}`}>
      <Title>Something went wrong</Title>
      <Body muted style={{ marginTop: SPACING.sm, textAlign: 'center' }}>{message}</Body>
      {onRetry && (
        <Button label="Try again" variant="outline" onPress={onRetry} style={{ marginTop: SPACING.lg }} />
      )}
    </View>
  )
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  const t = useTheme(false)
  return (
    <View style={[styles.center, { backgroundColor: t.bg, paddingHorizontal: SPACING.xl }]} accessibilityLabel={title}>
      <Title style={{ textAlign: 'center' }}>{title}</Title>
      {hint && <Body muted style={{ marginTop: SPACING.sm, textAlign: 'center' }}>{hint}</Body>}
      {action && <View style={{ marginTop: SPACING.lg }}>{action}</View>}
    </View>
  )
}

// ─── Pressable row (≥44pt target) ─────────────────────────────────────────────

export function RowButton({
  label,
  sublabel,
  onPress,
  icon,
  rightAccessory,
  variant = 'default',
  danger,
  disabled,
}: {
  label: string
  sublabel?: string
  onPress?: () => void
  icon?: React.ReactNode
  rightAccessory?: React.ReactNode
  variant?: 'default' | 'card'
  danger?: boolean
  disabled?: boolean
} & PressableProps) {
  const t = useTheme(false)
  const bg = variant === 'card' ? t.card : t.bg
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: bg,
          borderColor: t.border,
          opacity: pressed ? 0.7 : disabled ? 0.5 : 1,
        },
      ]}
    >
      {icon && <View style={styles.rowIcon}>{icon}</View>}
      <View style={styles.rowBody}>
        <Text style={[TYPO.body, { color: danger ? t.danger : t.text, fontWeight: '500' }]}>{label}</Text>
        {sublabel ? <Caption muted>{sublabel}</Caption> : null}
      </View>
      {rightAccessory}
    </Pressable>
  )
}

// ─── Header ──────────────────────────────────────────────────────────────────

export function Header({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const t = useTheme(false)
  return (
    <View style={[styles.header, { borderColor: t.border }]}>
      <View style={{ flex: 1 }}>
        <Title>{title}</Title>
        {subtitle ? <Caption muted>{subtitle}</Caption> : null}
      </View>
      {right}
    </View>
  )
}

// ─── Section header ──────────────────────────────────────────────────────────

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  const t = useTheme(false)
  return (
    <View style={styles.sectionHeader}>
      <Text style={[TYPO.label, { color: t.textSecondary, letterSpacing: 0.4, textTransform: 'uppercase' }]}>
        {title}
      </Text>
      {action}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth ? 1 : 0,
    marginBottom: SPACING.md,
  },
  btn: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  pill: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderWidth: StyleSheet.hairlineWidth ? 0 : 0,
    borderBottomWidth: 1,
    gap: SPACING.md,
  },
  rowIcon: {
    width: 28,
    alignItems: 'center',
  },
  rowBody: {
    flex: 1,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
})
