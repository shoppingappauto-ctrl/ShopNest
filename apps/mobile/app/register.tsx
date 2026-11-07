/**
 * Register screen: name + email + password. Posts to /api/auth/register.
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
import { BRAND, RADIUS, SPACING, TYPO } from '../lib/theme'
import { Button, Body, Caption } from '../components/ui'
import { ApiClientError } from '../lib/api-client'

export default function RegisterScreen() {
  const { register } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    setErr(null)
    if (name.trim().length < 2) return setErr('Enter your name (2+ characters).')
    if (!email.includes('@')) return setErr('Enter a valid email address.')
    if (password.length < 8) return setErr('Password must be at least 8 characters.')
    setBusy(true)
    try {
      await register({ name: name.trim(), email: email.trim().toLowerCase(), password })
      router.replace('/')
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : 'Sign-up failed.')
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
          { paddingTop: insets.top + SPACING.xl, paddingBottom: insets.bottom + SPACING.lg },
        ]}
      >
        <View style={styles.hero}>
          <View style={styles.logo}>
            <ShoppingBag color={BRAND.white} size={26} />
          </View>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Join your household's shopping list.</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={BRAND.textMuted}
            textContentType="name"
          />
          <Text style={[styles.label, { marginTop: SPACING.md }]}>Email</Text>
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
          <Text style={[styles.label, { marginTop: SPACING.md }]}>Password (min 8)</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={BRAND.textMuted}
            textContentType="newPassword"
          />

          {err && <Caption style={{ color: BRAND.red, marginTop: SPACING.sm }}>{err}</Caption>}

          <Button label="Create account" onPress={submit} loading={busy} style={{ marginTop: SPACING.lg }} />

          <View style={styles.registerRow}>
            <Body muted>Already have an account?</Body>
            <Link href="/login" asChild>
              <Pressable hitSlop={12}>
                <Text style={styles.registerLink}> Sign in</Text>
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
    marginBottom: SPACING.xl,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: BRAND.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: { ...TYPO.title, fontSize: 24, color: BRAND.textPrimary },
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
