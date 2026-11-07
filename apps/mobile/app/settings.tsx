/**
 * Settings screen — account (name/email), notification prefs (Switch),
 * large-text accessibility (Switch), logout, account deletion.
 *
 * Account deletion: the API does not currently expose a DELETE /api/auth/me
 * route. We wire the flow but document the gap; calling this shows a clear
 * "feature not yet available" alert and logs the user out.
 */

import React, { useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Bell, LogOut, Type, UserCog, Trash2 } from 'lucide-react-native'
import { useAuth } from '../lib/auth'
import { useUpdatePrefs } from '../lib/hooks'
import { BRAND, RADIUS, SPACING, TYPO } from '../lib/theme'
import {
  Body,
  Button,
  Card,
  Caption,
  Header,
  RowButton,
  SectionHeader,
  Subtitle,
} from '../components/ui'
import { ConnectionBanner } from '../components/connection-banner'
import { useRealtime } from '../lib/realtime'

function parsePrefs(raw: string | null | undefined): { purchases: boolean; comments: boolean; reminders: boolean } {
  const base = { purchases: true, comments: true, reminders: true }
  if (!raw) return base
  try {
    return { ...base, ...JSON.parse(raw) }
  } catch {
    return base
  }
}

export default function SettingsScreen() {
  const { user, households, activeHousehold, logout } = useAuth()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const prefs = useUpdatePrefs()

  const { status, queueCount } = useRealtime(households.map((h) => h.id), !!user)

  const current = parsePrefs(user?.notifyPrefs)
  const [name, setName] = useState(user?.name ?? '')
  const [purchases, setPurchases] = useState(current.purchases)
  const [comments, setComments] = useState(current.comments)
  const [reminders, setReminders] = useState(current.reminders)
  const [largeText, setLargeText] = useState(user?.largeText ?? false)

  const saveName = () => {
    if (name.trim().length < 2) return Alert.alert('Name too short')
    prefs.mutate({ name: name.trim() })
  }
  const savePrefs = (patch: Partial<{ purchases: boolean; comments: boolean; reminders: boolean; largeText: boolean }>) => {
    prefs.mutate({
      notifyPrefs: patch,
      largeText: patch.largeText,
    })
  }

  const deleteAccount = () => {
    Alert.alert(
      'Delete account',
      'Account deletion is not yet available via the ShopNest API in this build. Signing out instead. Contact support@shopnest.app to request deletion.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => logout().then(() => router.replace('/login')) },
      ],
    )
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BRAND.bgPage, paddingTop: insets.top }}
      contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 24 }}
    >
      <Header title="Settings" subtitle={user?.email} />
      <ConnectionBanner status={status} queueCount={queueCount} />

      <SectionHeader title="Account" />
      <Card>
        <Text style={styles.label}>Display name</Text>
        <View style={styles.row}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={BRAND.textMuted}
          />
          <Button label="Save" size="sm" onPress={saveName} loading={prefs.isPending} />
        </View>
        <Caption muted style={{ marginTop: SPACING.sm }}>
          Email: {user?.email}
        </Caption>
      </Card>

      <SectionHeader title="Notifications" />
      <Card style={{ padding: 0 }}>
        <RowButton
          label="Purchases"
          sublabel="Notify me when items are bought"
          icon={<Bell color={BRAND.green} size={18} />}
          rightAccessory={
            <Switch
              value={purchases}
              onValueChange={(v) => {
                setPurchases(v)
                savePrefs({ purchases: v })
              }}
              trackColor={{ false: BRAND.grayLight, true: BRAND.green }}
            />
          }
        />
        <RowButton
          label="Comments & decisions"
          sublabel="Approve / reject / substitute responses"
          icon={<Bell color={BRAND.green} size={18} />}
          rightAccessory={
            <Switch
              value={comments}
              onValueChange={(v) => {
                setComments(v)
                savePrefs({ comments: v })
              }}
              trackColor={{ false: BRAND.grayLight, true: BRAND.green }}
            />
          }
        />
        <RowButton
          label="Reminders"
          sublabel="Pantry running low, budgets"
          icon={<Bell color={BRAND.green} size={18} />}
          rightAccessory={
            <Switch
              value={reminders}
              onValueChange={(v) => {
                setReminders(v)
                savePrefs({ reminders: v })
              }}
              trackColor={{ false: BRAND.grayLight, true: BRAND.green }}
            />
          }
        />
      </Card>

      <SectionHeader title="Accessibility" />
      <Card style={{ padding: 0 }}>
        <RowButton
          label="Large text mode"
          sublabel="Caregiver / elderly-friendly larger text"
          icon={<Type color={BRAND.green} size={18} />}
          rightAccessory={
            <Switch
              value={largeText}
              onValueChange={(v) => {
                setLargeText(v)
                savePrefs({ largeText: v })
              }}
              trackColor={{ false: BRAND.grayLight, true: BRAND.green }}
            />
          }
        />
      </Card>

      <SectionHeader title="Active household" />
      <Card>
        <Body>{activeHousehold?.name ?? 'No household'}</Body>
        <Caption muted>Plan: {activeHousehold?.plan ?? 'FREE'}</Caption>
      </Card>

      <SectionHeader title="Account actions" />
      <Card style={{ padding: 0 }}>
        <RowButton
          label="Sign out"
          icon={<LogOut color={BRAND.red} size={18} />}
          danger
          onPress={() => logout().then(() => router.replace('/login'))}
        />
        <RowButton
          label="Delete account"
          sublabel="Not yet available — contact support"
          icon={<Trash2 color={BRAND.red} size={18} />}
          danger
          onPress={deleteAccount}
        />
      </Card>

      <Caption muted style={{ textAlign: 'center', marginTop: SPACING.xl }}>
        ShopNest Mobile v1.0.0{'\n'}
        Build: {process.env.EXPO_PUBLIC_BUILD_LABEL ?? 'dev'}{'\n'}
        Payments are disabled in this build.
      </Caption>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  label: { ...TYPO.label, color: BRAND.textSecondary, marginBottom: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    backgroundColor: BRAND.white,
    color: BRAND.textPrimary,
    fontSize: 16,
  },
})
