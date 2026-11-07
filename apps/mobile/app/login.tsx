/**
 * Login screen: email + password, with a one-tap "Try the demo" button that
 * seeds the demo household and signs in as alex@demo.shopnest / shopnest123.
 */

import React, { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { Link, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ShoppingBag } from 'lucide-react-native'
import { useAuth } from '../lib/auth'
import { useDemoSeed } from '../lib/hooks'
import { BRAND, RADIUS, SPACING, TYPO } from '../lib/theme'
import { Button, Body, Caption } from '../components/ui'
import { ApiClientError } from '../lib/api-client'

export default function LoginScreen() {
  const { login } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const demoSeed = useDemoSeed()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    setErr(null)
    if (!email || !password) {
      setErr('Enter your email and password.')
      return
    }
    setBusy(true)
    try {
      await login({ email: email.trim().toLowerCase(), password })
      router.replace('/')
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : 'Sign-in failed.')
    } finally {
      setBusy(false)
    }
  }

  const demoLogin = async () => {
    setErr(null)
    setBusy(true)
    try {
      // 1. Seed (idempotent) — this guarantees the demo user exists.
      try {
        await demoSeed.mutateAsync()
      } catch {
        // already-seeded is fine; network blip falls through to login which will fail clearly
      }
      // 2. Sign in as the demo owner.
      await login({ email: 'alex@demo.shopnest', password: 'shopnest123' })
      router.replace('/')
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : 'Demo sign-in failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BRAND.bgPage }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + SPACING.xxl, paddingBottom: insets.bottom + SPACING.lg },
        ]}
      >
        <View style={styles.hero}>
          <View style={styles.logo}>
            <ShoppingBag color={BRAND.white} size={28} />
          </View>
          <Text style={styles.title}>ShopNest</Text>
          <Text style={styles.subtitle}>Your family. Your shopping. One place.</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={BRAND.textMuted}
            textContentType="emailAddress"
          />
          <Text style={[styles.label, { marginTop: SPACING.md }]}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={BRAND.textMuted}
            textContentType="password"
          />

          {err && <Caption style={{ color: BRAND.red, marginTop: SPACING.sm }}>{err}</Caption>}

          <Button label="Sign in" onPress={submit} loading={busy} style={{ marginTop: SPACING.lg }} />

          <Pressable onPress={demoLogin} disabled={busy} style={styles.demoBtn}>
            <Text style={styles.demoText}>Try the demo household →</Text>
          </Pressable>

          <View style={styles.registerRow}>
            <Body muted>Don't have an account?</Body>
            <Link href="/register" asChild>
              <Pressable hitSlop={12}>
                <Text style={styles.registerLink}> Sign up</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
  },
  hero: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: BRAND.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: { ...TYPO.title, fontSize: 28, color: BRAND.textPrimary },
  subtitle: { ...TYPO.body, color: BRAND.textSecondary, marginTop: 4 },
  form: {
    flex: 1,
  },
  label: { ...TYPO.label, color: BRAND.textSecondary, marginBottom: 6 },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    backgroundColor: BRAND.white,
    color: BRAND.textPrimary,
    fontSize: 16,
  },
  demoBtn: {
    marginTop: SPACING.lg,
    alignItems: 'center',
    padding: SPACING.md,
  },
  demoText: {
    color: BRAND.green,
    fontWeight: '600',
    fontSize: 15,
  },
  registerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xl,
  },
  registerLink: {
    color: BRAND.green,
    fontWeight: '600',
    fontSize: 15,
  },
})
