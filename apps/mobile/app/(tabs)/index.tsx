/**
 * Home tab — greeting, outstanding items count, "Start Shopping" CTA,
 * shopping-lists preview, essentials one-tap re-add, pantry preview,
 * favorite stores.
 *
 * Mirrors the web HomeView's information density in a mobile-friendly layout.
 */

import React, { useMemo } from 'react'
import { Alert, FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  CheckCircle2,
  ChevronRight,
  Plus,
  ShoppingBag,
  Sparkles,
  Store as StoreIcon,
} from 'lucide-react-native'
import type { Activity, MyHousehold, ShoppingItem } from '@shopnest/shared'
import {
  useActivity,
  useLists,
  useOutstanding,
  usePantry,
  useProducts,
  useStartSession,
  useStores,
} from '../../lib/hooks'
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
} from '../../components/ui'
import { ConnectionBanner } from '../../components/connection-banner'
import { useRealtime } from '../../lib/realtime'
import { useAuth } from '../../lib/auth'

export default function HomeTab() {
  const { user, activeHousehold } = useAuth()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const householdId = activeHousehold?.id ?? null

  // Realtime status banner (also re-plays offline queue on reconnect).
  const { status, queueCount } = useRealtime(activeHousehold ? [activeHousehold.id] : [], !!user)

  const me = user
  const lists = useLists(householdId)
  const outstanding = useOutstanding(householdId)
  const stores = useStores(householdId)
  const pantry = usePantry(householdId)
  const products = useProducts(householdId)
  const activity = useActivity(householdId)
  const startSession = useStartSession(householdId ?? '')

  const outstandingCount = useMemo(
    () =>
      (outstanding.data?.groups ?? []).reduce(
        (sum, g) => sum + (g.items?.length ?? 0),
        0,
      ),
    [outstanding.data],
  )

  const favoriteStores = useMemo(
    () => (stores.data?.stores ?? []).filter((s) => s.isFavorite).slice(0, 4),
    [stores.data],
  )

  const essentials = useMemo(
    () => (products.data?.products ?? []).filter((p) => p.isRecurring).slice(0, 5),
    [products.data],
  )

  const pantryLow = useMemo(
    () => (pantry.data?.items ?? []).filter((p) => p.status === 'RUNNING_LOW' || p.status === 'OUT_OF_STOCK').slice(0, 4),
    [pantry.data],
  )

  const recentActivity = useMemo(() => (activity.data?.activities ?? []).slice(0, 5), [activity.data])

  if (!householdId) {
    return (
      <View style={{ flex: 1, backgroundColor: BRAND.bgPage, paddingTop: insets.top }}>
        <EmptyState
          title="No household yet"
          hint="Create or join a household to start shopping together."
          action={
            <Link href="/(tabs)/household" asChild>
              <Pressable>
                <Button label="Set up household" />
              </Pressable>
            </Link>
          }
        />
      </View>
    )
  }

  if (lists.isLoading || outstanding.isLoading) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <LoadingState label="Loading your household…" />
      </View>
    )
  }

  const startShopping = (listId?: string) => {
    startSession.mutate(
      { listId: listId ?? null },
      {
        onSuccess: (res) => {
          router.push(`/shopping-mode/${res.session.id}`)
        },
        onError: () => Alert.alert('Could not start shopping', 'Please try again.'),
      },
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bgPage, paddingTop: insets.top }}>
      <Header
        title={`Hi, ${me?.name?.split(' ')[0] ?? 'there'}`}
        subtitle={activeHousehold?.name ?? ''}
        right={
          <Pressable onPress={() => router.push('/add-item')} hitSlop={12} accessibilityLabel="Add item">
            <View style={styles.iconBtn}>
              <Plus color={BRAND.green} size={20} />
            </View>
          </Pressable>
        }
      />
      <ConnectionBanner status={status} queueCount={queueCount} />

      <FlatList
        data={recentActivity}
        keyExtractor={(item) => item.id}
        renderItem={() => null}
        ListHeaderComponent={
          <View style={{ padding: SPACING.lg }}>
            {/* Outstanding + Start Shopping hero card */}
            <Card>
              <View style={styles.heroRow}>
                <View>
                  <Caption muted>Pending items across all lists</Caption>
                  <Text style={styles.heroCount}>{outstandingCount}</Text>
                </View>
                <View style={styles.heroCta}>
                  <Button
                    label="Start shopping"
                    onPress={() => startShopping()}
                    loading={startSession.isPending}
                    icon={<ShoppingBag color="#fff" size={18} />}
                  />
                </View>
              </View>
              {outstandingCount === 0 && (
                <Caption muted style={{ marginTop: SPACING.sm }}>
                  🎉 All caught up — nothing pending.
                </Caption>
              )}
            </Card>

            {/* Lists preview */}
            <SectionHeader
              title="Your lists"
              action={
                <Link href="/(tabs)/lists" asChild>
                  <Pressable hitSlop={8}>
                    <Text style={styles.link}>See all</Text>
                  </Pressable>
                </Link>
              }
            />
            {(lists.data?.lists ?? []).slice(0, 3).map((l) => (
              <Link key={l.id} href={`/list/${l.id}`} asChild>
                <Pressable>
                  <Card style={styles.mini}>
                    <View style={styles.row}>
                      <Text style={styles.emoji}>{l.emoji ?? '🛒'}</Text>
                      <View style={{ flex: 1 }}>
                        <Subtitle>{l.name}</Subtitle>
                        <Caption muted>{l.store?.name ?? 'No store'}</Caption>
                      </View>
                      <View style={styles.counts}>
                        {l.counts && l.counts.pending > 0 && (
                          <Pill label={`${l.counts.pending} pending`} />
                        )}
                        {l.counts && l.counts.purchased > 0 && (
                          <Pill
                            label={`${l.counts.purchased} ✓`}
                            backgroundColor="#f0fdf4"
                            color={BRAND.green}
                          />
                        )}
                      </View>
                    </View>
                  </Card>
                </Pressable>
              </Link>
            ))}
            {lists.data?.lists.length === 0 && (
              <Caption muted style={{ paddingHorizontal: SPACING.sm }}>
                No lists yet — head to the Lists tab to create one.
              </Caption>
            )}

            {/* Quick actions */}
            <SectionHeader title="Quick actions" />
            <Card style={{ padding: 0 }}>
              <RowButton
                label="Pantry"
                sublabel="Track what's running low"
                icon={<Sparkles color={BRAND.green} size={18} />}
                onPress={() => router.push('/pantry')}
                rightAccessory={<ChevronRight color={BRAND.textMuted} size={18} />}
              />
              <RowButton
                label="Confirmations"
                sublabel="Approve family questions"
                icon={<CheckCircle2 color={BRAND.green} size={18} />}
                onPress={() => router.push('/confirmations')}
                rightAccessory={<ChevronRight color={BRAND.textMuted} size={18} />}
              />
              <RowButton
                label="Budgets"
                sublabel="Trip / weekly / monthly"
                icon={<Sparkles color={BRAND.green} size={18} />}
                onPress={() => router.push('/budgets')}
                rightAccessory={<ChevronRight color={BRAND.textMuted} size={18} />}
              />
              <RowButton
                label="Price memory"
                sublabel="Compare your recorded prices"
                icon={<Sparkles color={BRAND.green} size={18} />}
                onPress={() => router.push('/price-memory')}
                rightAccessory={<ChevronRight color={BRAND.textMuted} size={18} />}
              />
              <RowButton
                label="Specialty catalog"
                sublabel="Bangla / halal / South Asian"
                icon={<Sparkles color={BRAND.green} size={18} />}
                onPress={() => router.push('/catalog')}
                rightAccessory={<ChevronRight color={BRAND.textMuted} size={18} />}
              />
            </Card>

            {/* Essentials (one-tap re-add) */}
            {essentials.length > 0 && (
              <>
                <SectionHeader title="Essentials — tap to re-add" />
                <Card>
                  <View style={styles.wrap}>
                    {essentials.map((p) => (
                      <Pressable
                        key={p.id}
                        onPress={() => router.push({ pathname: '/add-item', params: { name: p.name } })}
                        style={styles.chip}
                      >
                        <Text style={styles.chipText}>+ {p.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                </Card>
              </>
            )}

            {/* Pantry preview */}
            {pantryLow.length > 0 && (
              <>
                <SectionHeader title="Pantry running low" />
                <Card>
                  {pantryLow.map((p) => (
                    <View key={p.id} style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <Body>{p.name}</Body>
                        <Caption muted>{p.status.replace('_', ' ').toLowerCase()}</Caption>
                      </View>
                      <Pill
                        label={p.status === 'OUT_OF_STOCK' ? 'Out' : 'Low'}
                        backgroundColor="#fef2f2"
                        color={BRAND.red}
                      />
                    </View>
                  ))}
                </Card>
              </>
            )}

            {/* Favorite stores */}
            {favoriteStores.length > 0 && (
              <>
                <SectionHeader title="Favorite stores" />
                <Card>
                  {favoriteStores.map((s) => (
                    <View key={s.id} style={styles.row}>
                      <StoreIcon color={BRAND.green} size={18} />
                      <View style={{ flex: 1 }}>
                        <Body>{s.name}</Body>
                        <Caption muted>{s.category}</Caption>
                      </View>
                    </View>
                  ))}
                </Card>
              </>
            )}

            {/* Recent activity */}
            {recentActivity.length > 0 && (
              <>
                <SectionHeader title="Recent activity" />
                <Card>
                  {recentActivity.map((a: Activity) => (
                    <View key={a.id} style={[styles.row, { borderBottomWidth: 0 }]}>
                      <View style={{ flex: 1 }}>
                        <Body>{a.message}</Body>
                        <Caption muted>{a.user?.name ?? ''}</Caption>
                      </View>
                    </View>
                  ))}
                </Card>
              </>
            )}
          </View>
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BRAND.greenTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroCount: {
    fontSize: 38,
    fontWeight: '700',
    color: BRAND.textPrimary,
    marginTop: 4,
  },
  heroCta: {
    maxWidth: 180,
  },
  mini: {
    marginBottom: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  emoji: { fontSize: 22 },
  counts: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  link: { color: BRAND.green, fontWeight: '600', fontSize: 13 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
    backgroundColor: BRAND.greenTint,
  },
  chipText: { color: BRAND.greenDark, fontWeight: '600', fontSize: 13 },
})
