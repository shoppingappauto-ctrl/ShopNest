/**
 * Household tab — household detail, members, invite code, leave household,
 * create/join household, account settings, logout.
 *
 * If the user has no household, renders the create/join setup screen.
 */

import React, { useState } from 'react'
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  Copy,
  LogOut,
  Plus,
  RefreshCw,
  Settings as SettingsIcon,
  UserPlus,
  Users,
} from 'lucide-react-native'
import {
  useCreateHousehold,
  useHousehold,
  useJoinHousehold,
  useLeaveHousehold,
  useRotateInvite,
} from '../../lib/hooks'
import { useAuth } from '../../lib/auth'
import { BRAND, RADIUS, SPACING, TYPO } from '../../lib/theme'
import {
  Body,
  Button,
  Card,
  Caption,
  EmptyState,
  Header,
  LoadingState,
  Pill,
  RowButton,
  SectionHeader,
  Subtitle,
  Title,
} from '../../components/ui'
import { ConnectionBanner } from '../../components/connection-banner'
import { useRealtime } from '../../lib/realtime'

export default function HouseholdTab() {
  const { user, households, activeHousehold, setActiveHousehold, logout } = useAuth()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const householdId = activeHousehold?.id ?? null

  const { status, queueCount } = useRealtime(households.map((h) => h.id), !!user)
  const household = useHousehold(householdId)
  const createHh = useCreateHousehold()
  const joinHh = useJoinHousehold()
  const leaveHh = useLeaveHousehold()
  const rotateInvite = useRotateInvite()

  const [createOpen, setCreateOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [invite, setInvite] = useState('')

  const doCreate = async () => {
    if (newName.trim().length < 2) return Alert.alert('Enter a name (2+ chars)')
    try {
      const res = await createHh.mutateAsync({ name: newName.trim() })
      setActiveHousehold(res.household.id)
      setNewName('')
      setCreateOpen(false)
    } catch (e: unknown) {
      Alert.alert('Could not create household', e instanceof Error ? e.message : '')
    }
  }

  const doJoin = async () => {
    if (!invite.trim()) return Alert.alert('Enter an invite code')
    try {
      await joinHh.mutateAsync({ inviteCode: invite.trim().toUpperCase() })
      setInvite('')
      setJoinOpen(false)
      // useAuth.refresh would refetch /me; the mutation invalidates the query.
    } catch (e: unknown) {
      Alert.alert('Could not join', e instanceof Error ? e.message : '')
    }
  }

  const doLeave = () => {
    if (!householdId) return
    Alert.alert(
      'Leave household?',
      `You'll lose access to “${activeHousehold?.name}” lists and items.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            leaveHh.mutate(householdId, {
              onSuccess: () => router.replace('/'),
            })
          },
        },
      ],
    )
  }

  const rotate = () => {
    if (!householdId) return
    Alert.alert(
      'Rotate invite code?',
      'The current code will stop working. Make sure no one is mid-invite.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Rotate', style: 'destructive', onPress: () => rotateInvite.mutate(householdId) },
      ],
    )
  }

  if (!activeHousehold) {
    return (
      <View style={{ flex: 1, backgroundColor: BRAND.bgPage, paddingTop: insets.top }}>
        <Header title="Household" />
        <ConnectionBanner status={status} queueCount={queueCount} />
        <EmptyState
          title="No household yet"
          hint="Create a new household, or join one with an invite code."
          action={
            <View style={{ gap: SPACING.sm }}>
              <Button label="Create household" onPress={() => setCreateOpen(true)} />
              <Button label="Join with invite code" variant="outline" onPress={() => setJoinOpen(true)} />
            </View>
          }
        />

        {modal(createOpen, setCreateOpen, 'Create household', (
          <>
            <Text style={styles.label}>Household name</Text>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="The Rahman Family"
              placeholderTextColor={BRAND.textMuted}
            />
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg }}>
              <Button label="Cancel" variant="ghost" onPress={() => setCreateOpen(false)} style={{ flex: 1 }} />
              <Button label="Create" onPress={doCreate} loading={createHh.isPending} style={{ flex: 1 }} />
            </View>
          </>
        ))}

        {modal(joinOpen, setJoinOpen, 'Join household', (
          <>
            <Text style={styles.label}>Invite code</Text>
            <TextInput
              style={styles.input}
              value={invite}
              onChangeText={setInvite}
              placeholder="SN-XXXXXX"
              placeholderTextColor={BRAND.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <Caption muted style={{ marginTop: SPACING.sm }}>
              Ask the household owner to share their code from the Household tab.
            </Caption>
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg }}>
              <Button label="Cancel" variant="ghost" onPress={() => setJoinOpen(false)} style={{ flex: 1 }} />
              <Button label="Join" onPress={doJoin} loading={joinHh.isPending} style={{ flex: 1 }} />
            </View>
          </>
        ))}
      </View>
    )
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BRAND.bgPage, paddingTop: insets.top }}
      contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 80 }}
    >
      <Header title="Household" subtitle={activeHousehold.name} />
      <ConnectionBanner status={status} queueCount={queueCount} />

      {household.isLoading ? (
        <LoadingState label="Loading household…" />
      ) : household.data ? (
        <View style={{ marginTop: SPACING.lg }}>
          <Card>
            <View style={styles.hhRow}>
              <View style={styles.hhIcon}>
                <Users color={BRAND.green} size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <Title>{household.data.household.name}</Title>
                <Caption muted>
                  {household.data.household.plan === 'PLUS' ? 'PLUS plan' : 'Free plan'} ·{' '}
                  {household.data.household.members.length} member
                  {household.data.household.members.length === 1 ? '' : 's'}
                </Caption>
              </View>
            </View>
          </Card>

          {/* Invite code */}
          <SectionHeader title="Invite code" action={
            <Pressable onPress={rotate} hitSlop={8}>
              <Text style={styles.link}>Rotate</Text>
            </Pressable>
          } />
          <Card>
            <View style={styles.codeRow}>
              <Text style={styles.code}>{household.data.household.inviteCode}</Text>
              <Pressable onPress={() => Alert.alert('Invite code', household.data!.household.inviteCode)} hitSlop={8}>
                <Copy color={BRAND.green} size={18} />
              </Pressable>
            </View>
            <Caption muted style={{ marginTop: SPACING.sm }}>
              Share this code so family can join. The owner can rotate it any time.
            </Caption>
          </Card>

          {/* Stats */}
          <SectionHeader title="Household stats" />
          <Card>
            <View style={styles.statRow}>
              <Stat label="Lists" value={household.data.household._count.lists} />
              <Stat label="Items" value={household.data.household._count.items} />
              <Stat label="Stores" value={household.data.household._count.stores} />
              <Stat label="Events" value={household.data.household._count.events} />
            </View>
          </Card>

          {/* Members */}
          <SectionHeader title="Members" />
          <Card style={{ padding: 0 }}>
            {household.data.household.members.map((m) => (
              <View key={m.id} style={[styles.memberRow, { borderBottomWidth: 1, borderBottomColor: BRAND.border }]}>
                <View style={[styles.avatar, { backgroundColor: m.user.avatarColor }]}>
                  <Text style={styles.avatarText}>
                    {m.user.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Body>{m.user.name}</Body>
                  <Caption muted>{m.user.email}</Caption>
                </View>
                <Pill label={m.role.toLowerCase()} backgroundColor={BRAND.bgSubtle} color={BRAND.textSecondary} />
              </View>
            ))}
          </Card>

          {/* Household switcher */}
          {households.length > 1 && (
            <>
              <SectionHeader title="Switch household" />
              <Card style={{ padding: 0 }}>
                {households.map((h) => (
                  <Pressable
                    key={h.id}
                    onPress={() => setActiveHousehold(h.id)}
                    style={[styles.memberRow, { borderBottomWidth: 1, borderBottomColor: BRAND.border }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Body>{h.name}</Body>
                      <Caption muted>{h.role.toLowerCase()}</Caption>
                    </View>
                    {h.id === activeHousehold.id && <Pill label="Active" backgroundColor="#f0fdf4" color={BRAND.green} />}
                  </Pressable>
                ))}
              </Card>
            </>
          )}

          {/* Create / Join additional households */}
          <SectionHeader title="More households" />
          <Card style={{ padding: 0 }}>
            <RowButton
              label="Create another household"
              icon={<Plus color={BRAND.green} size={18} />}
              onPress={() => setCreateOpen(true)}
            />
            <RowButton
              label="Join with invite code"
              icon={<UserPlus color={BRAND.green} size={18} />}
              onPress={() => setJoinOpen(true)}
            />
          </Card>

          {/* Account & danger zone */}
          <SectionHeader title="Account" />
          <Card style={{ padding: 0 }}>
            <RowButton
              label="Settings & notifications"
              sublabel="Name, large-text mode, push prefs"
              icon={<SettingsIcon color={BRAND.green} size={18} />}
              onPress={() => router.push('/settings')}
            />
            <RowButton
              label="Leave household"
              sublabel="You'll lose access to lists & items"
              icon={<LogOut color={BRAND.red} size={18} />}
              danger
              onPress={doLeave}
            />
            <RowButton
              label="Sign out"
              icon={<LogOut color={BRAND.red} size={18} />}
              danger
              onPress={() => logout()}
            />
          </Card>

          <Caption muted style={{ textAlign: 'center', marginTop: SPACING.lg }}>
            ShopNest Mobile · v1.0.0{'\n'}
            Payments are disabled in this build.
          </Caption>
        </View>
      ) : null}

      {modal(createOpen, setCreateOpen, 'Create household', (
        <>
          <Text style={styles.label}>Household name</Text>
          <TextInput
            style={styles.input}
            value={newName}
            onChangeText={setNewName}
            placeholder="The Rahman Family"
            placeholderTextColor={BRAND.textMuted}
          />
          <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg }}>
            <Button label="Cancel" variant="ghost" onPress={() => setCreateOpen(false)} style={{ flex: 1 }} />
            <Button label="Create" onPress={doCreate} loading={createHh.isPending} style={{ flex: 1 }} />
          </View>
        </>
      ))}

      {modal(joinOpen, setJoinOpen, 'Join household', (
        <>
          <Text style={styles.label}>Invite code</Text>
          <TextInput
            style={styles.input}
            value={invite}
            onChangeText={setInvite}
            placeholder="SN-XXXXXX"
            placeholderTextColor={BRAND.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg }}>
            <Button label="Cancel" variant="ghost" onPress={() => setJoinOpen(false)} style={{ flex: 1 }} />
            <Button label="Join" onPress={doJoin} loading={joinHh.isPending} style={{ flex: 1 }} />
          </View>
        </>
      ))}
    </ScrollView>
  )
}

function modal(open: boolean, close: (v: boolean) => void, title: string, children: React.ReactNode) {
  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={() => close(false)}>
      <View style={styles.modalRoot}>
        <Card style={{ margin: SPACING.lg }}>
          <Subtitle>{title}</Subtitle>
          <View style={{ marginTop: SPACING.md }}>{children}</View>
        </Card>
      </View>
    </Modal>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue}>{value}</Text>
      <Caption muted>{label}</Caption>
    </View>
  )
}

const styles = StyleSheet.create({
  hhRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  hhIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BRAND.greenTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  code: {
    fontSize: 22,
    fontWeight: '700',
    color: BRAND.greenDark,
    letterSpacing: 1,
  },
  link: { color: BRAND.green, fontWeight: '600', fontSize: 13 },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCell: { alignItems: 'center', flex: 1 },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: BRAND.textPrimary,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
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
})
