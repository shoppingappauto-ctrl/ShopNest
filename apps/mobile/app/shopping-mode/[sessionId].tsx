/**
 * Shopping Mode — fullscreen, large checkboxes, per-item purchase,
 * "Ask Family" photo confirmation, mark unavailable, finish shopping summary
 * (purchased/unavailable/remaining + spent). Exit button.
 *
 * Reads the session, then loads its list's items. Uses usePatchItem to flip
 * item statuses; useFinishSession to close out the trip.
 */

import React, { useMemo, useState } from 'react'
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  Camera,
  CheckCircle2,
  DollarSign,
  LogOut,
  X,
  Check,
} from 'lucide-react-native'
import type { ShoppingItem } from '@shopnest/shared'
import { formatCents } from '@shopnest/shared'
import {
  useFinishSession,
  useList,
  usePatchItem,
  useCreateItemConfirmation,
  useSession,
} from '../../lib/hooks'
import { useAuth } from '../../lib/auth'
import { BRAND, RADIUS, SPACING, TYPO } from '../../lib/theme'
import { Button, Caption, LoadingState, Pill, Subtitle, Title } from '../../components/ui'
import { captureConfirmationPhoto } from '../../lib/photo'
import { showLocalNotification } from '../../lib/notifications'

export default function ShoppingModeScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const { activeHousehold } = useAuth()
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const session = useSession(sessionId)
  const list = useList(session.data?.session.listId ?? null)
  const patchItem = usePatchItem(activeHousehold?.id ?? '')
  const finishSession = useFinishSession(activeHousehold?.id ?? '')
  const createConfirmation = useCreateItemConfirmation()

  const [summary, setSummary] = useState<{
    purchased: { id: string; name: string; priceCents: number | null }[]
    unavailable: { id: string; name: string }[]
    remaining: { id: string; name: string }[]
    spentCents: number
  } | null>(null)

  // Filter items by the session's storeId if set (otherwise show all in the list).
  const items: ShoppingItem[] = useMemo(() => {
    if (!list.data?.list?.items) return []
    const storeId = session.data?.session.storeId
    if (!storeId) return list.data.list.items
    return list.data.list.items.filter((it) => it.storeId === storeId || it.storeId === null)
  }, [list.data, session.data])

  const pending = items.filter((it) => it.status === 'PENDING')
  const purchased = items.filter((it) => it.status === 'PURCHASED')
  const unavailable = items.filter((it) => it.status === 'UNAVAILABLE')
  const substituted = items.filter((it) => it.status === 'SUBSTITUTED')

  if (session.isLoading || list.isLoading) {
    return <LoadingState label="Loading shopping mode…" />
  }
  if (!session.data?.session) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Title>Session not found</Title>
        <Button label="Back to home" onPress={() => router.replace('/')} style={{ marginTop: SPACING.lg }} />
      </View>
    )
  }

  const markPurchased = (it: ShoppingItem) => {
    patchItem.mutate({ id: it.id, patch: { status: 'PURCHASED' } })
  }

  const markUnavailable = (it: ShoppingItem) => {
    patchItem.mutate({ id: it.id, patch: { status: 'UNAVAILABLE' } })
  }

  const askFamily = async (it: ShoppingItem) => {
    const dataUrl = await captureConfirmationPhoto()
    try {
      await createConfirmation.mutateAsync({
        itemId: it.id,
        req: { note: 'Is this the right product?', photoDataUrl: dataUrl ?? null },
      })
      void showLocalNotification('Ask Family sent', `Waiting on a response for ${it.name}.`)
    } catch (e: unknown) {
      Alert.alert('Could not ask family', e instanceof Error ? e.message : '')
    }
  }

  const finish = () => {
    finishSession.mutate(sessionId, {
      onSuccess: (res) => {
        setSummary({
          purchased: res.summary.purchased.map((p) => ({ id: p.id, name: p.name, priceCents: p.priceCents })),
          unavailable: res.summary.unavailable.map((u) => ({ id: u.id, name: u.name })),
          remaining: res.summary.remaining.map((r) => ({ id: r.id, name: r.name })),
          spentCents: res.session.spentCents,
        })
      },
      onError: () => Alert.alert('Could not finish', 'Please try again.'),
    })
  }

  const exit = () => {
    Alert.alert(
      'Exit shopping mode?',
      pending.length > 0
        ? `${pending.length} item${pending.length === 1 ? '' : 's'} still pending — you can finish them later.`
        : 'Your progress is saved.',
      [
        { text: 'Keep shopping', style: 'cancel' },
        { text: 'Exit', style: 'destructive', onPress: () => router.replace('/(tabs)/lists') },
      ],
    )
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={exit} hitSlop={12} accessibilityLabel="Exit shopping mode">
          <LogOut color={BRAND.textPrimary} size={22} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.topTitle}>{list.data?.list.name ?? 'Shopping'}</Text>
          <Caption muted>
            {session.data.session.store?.name ?? 'All stores'} · started{' '}
            {new Date(session.data.session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Caption>
        </View>
        <Button label="Finish" size="sm" onPress={finish} loading={finishSession.isPending} />
      </View>

      {/* Live progress bar */}
      <View style={styles.progressRow}>
        <Pill label={`${purchased.length} ✓`} backgroundColor="#f0fdf4" color={BRAND.green} />
        <Pill label={`${pending.length} pending`} backgroundColor={BRAND.bgSubtle} color={BRAND.textSecondary} />
        <Pill label={`${unavailable.length} ✗`} backgroundColor="#fef2f2" color={BRAND.red} />
        {substituted.length > 0 && (
          <Pill label={`${substituted.length} sub`} backgroundColor="#fff7ed" color="#9a3412" />
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: SPACING.xxl }}
        renderItem={({ item: it }) => {
          const isPurchased = it.status === 'PURCHASED'
          const isUnavailable = it.status === 'UNAVAILABLE'
          return (
            <View style={styles.itemCard}>
              <Pressable
                onPress={() => (isPurchased ? null : markPurchased(it))}
                style={({ pressed }) => [styles.itemRow, { opacity: pressed ? 0.85 : 1 }]}
                accessibilityLabel={`Mark ${it.name} purchased`}
              >
                <View style={styles.bigCheck}>
                  {isPurchased ? (
                    <Check color="#fff" size={28} />
                  ) : isUnavailable ? (
                    <X color={BRAND.red} size={24} />
                  ) : (
                    <CheckCircle2 color={BRAND.grayLight} size={32} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemName, isPurchased && styles.strikeThrough, isUnavailable && styles.muted]}>
                    {it.name}
                  </Text>
                  <Caption muted>
                    {it.quantity} {it.unit}
                    {it.store ? ` · ${it.store.name}` : ''}
                    {isPurchased && it.purchasedBy ? ` · ${it.purchasedBy.name}` : ''}
                  </Caption>
                </View>
              </Pressable>
              {!isPurchased && (
                <View style={styles.itemActions}>
                  <Button label="Got it" size="sm" onPress={() => markPurchased(it)} />
                  <Button label="📷 Ask" size="sm" variant="outline" onPress={() => askFamily(it)} />
                  <Button label="✗ Gone" size="sm" variant="outline" danger onPress={() => markUnavailable(it)} />
                </View>
              )}
            </View>
          )
        }}
      />

      {/* Finish summary modal */}
      <Modal visible={!!summary} animationType="slide" transparent onRequestClose={() => router.replace('/(tabs)/lists')}>
        <View style={styles.modalRoot}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Title>Shopping complete</Title>
              <Pressable onPress={() => router.replace('/(tabs)/lists')} hitSlop={8}>
                <X color={BRAND.textMuted} size={20} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              <View style={styles.summaryRow}>
                <DollarSign color={BRAND.green} size={20} />
                <Text style={styles.summaryLabel}>Spent</Text>
                <Text style={styles.summaryValue}>{formatCents(summary?.spentCents ?? 0)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Check color={BRAND.green} size={20} />
                <Text style={styles.summaryLabel}>Purchased</Text>
                <Text style={styles.summaryValue}>{summary?.purchased.length ?? 0}</Text>
              </View>
              {summary && summary.purchased.map((p) => (
                <Caption key={p.id} muted style={{ paddingLeft: 32 }}>
                  {p.name}{p.priceCents != null ? ` — ${formatCents(p.priceCents)}` : ''}
                </Caption>
              ))}
              {summary && summary.unavailable.length > 0 && (
                <>
                  <View style={[styles.summaryRow, { marginTop: SPACING.md }]}>
                    <X color={BRAND.red} size={20} />
                    <Text style={styles.summaryLabel}>Unavailable</Text>
                    <Text style={styles.summaryValue}>{summary.unavailable.length}</Text>
                  </View>
                  {summary.unavailable.map((u) => (
                    <Caption key={u.id} muted style={{ paddingLeft: 32 }}>{u.name}</Caption>
                  ))}
                </>
              )}
              {summary && summary.remaining.length > 0 && (
                <>
                  <View style={[styles.summaryRow, { marginTop: SPACING.md }]}>
                    <Text style={styles.summaryLabel}>Remaining on list</Text>
                    <Text style={styles.summaryValue}>{summary.remaining.length}</Text>
                  </View>
                  {summary.remaining.map((r) => (
                    <Caption key={r.id} muted style={{ paddingLeft: 32 }}>{r.name}</Caption>
                  ))}
                </>
              )}
            </ScrollView>
            <Button label="Done" onPress={() => router.replace('/(tabs)/lists')} style={{ marginTop: SPACING.lg }} />
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BRAND.bgPage,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    gap: SPACING.md,
  },
  topTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: BRAND.textPrimary,
    textAlign: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    flexWrap: 'wrap',
  },
  itemCard: {
    backgroundColor: BRAND.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    minHeight: 56,
  },
  bigCheck: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: BRAND.grayLight,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND.white,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '600',
    color: BRAND.textPrimary,
  },
  strikeThrough: {
    textDecorationLine: 'line-through',
    color: BRAND.textMuted,
  },
  muted: { color: BRAND.textMuted },
  itemActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    flexWrap: 'wrap',
  },
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  summaryCard: {
    backgroundColor: BRAND.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 15,
    color: BRAND.textSecondary,
    flex: 1,
  },
  summaryValue: {
    fontSize: 17,
    fontWeight: '700',
    color: BRAND.textPrimary,
  },
})
